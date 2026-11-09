// POST /api/v1/observations: a classroom sensor sends its readings here.
//
//   Authorization: Bearer <device key>
//   X-Device-Id:   <device id>
//   Content-Type:  application/json
//   { "readings": [ { "observed_at": "2026-11-09T07:30:00Z", "co2_ppm": 712, "pm25_ugm3": 12.1,
//                     "temp_c": 25.6, "rh_pct": 54, "msg_id": "optional-unique-id" } ],
//     "firmware": "optional" }
//
// A single reading may also be sent without the "readings" list. Up to 120 readings per request, so a sensor
// that lost its connection can send what it stored. Checks: the key, the clock, each value's range.
// Impossible values are refused; unusual ones are kept and flagged for review. Sending the same msg_id twice is safe.

const { ID, METRICS, KEEP, redis, storage, devices, checkKey, calibration, round, send } = require('../_lib/core');

const MAX_READINGS = 120, MAX_BYTES = 64 * 1024, PER_MINUTE = 60;

function parseReading(r, now, cal) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { reason: 'not an object' };
  const t = typeof r.observed_at === 'string' ? Date.parse(r.observed_at) : NaN;
  if (!Number.isFinite(t)) return { reason: 'observed_at missing or not ISO 8601' };
  if (t > now + 5 * 60e3) return { reason: 'observed_at is in the future: check the sensor clock' };
  if (t < now - 7 * 864e5) return { reason: 'observed_at is more than 7 days old' };
  const values = {}, raw = {}, flags = [];
  for (const [k, m] of Object.entries(METRICS)) {
    if (r[k] == null) continue;
    const v = r[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return { reason: `${k} is not a number` };
    if (v < m.lo || v > m.hi) return { reason: `${k} ${v} is outside what the sensor can measure` };
    const c = cal[k] && typeof cal[k] === 'object' ? cal[k] : null;
    const fixed = c ? v * (Number(c.scale) || 1) + (Number(c.offset) || 0) : v;
    values[k] = round(Math.min(m.hi, Math.max(m.lo, fixed)), m.dp);
    if (c) raw[k] = v;
    if (v < m.slo || v > m.shi) flags.push(k);
  }
  if (!Object.keys(values).length) return { reason: 'no known measurements (co2_ppm, pm25_ugm3, temp_c, rh_pct)' };
  const msg = typeof r.msg_id === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(r.msg_id) ? r.msg_id : null;
  return { ok: { t, values, raw: Object.keys(raw).length ? raw : null, flags, msg } };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' }, { Allow: 'POST' });
  if (!storage()) return send(res, 503, { error: 'storage_not_configured', help: 'Connect Upstash for Redis in Vercel, then redeploy.' });

  const id = String(req.headers['x-device-id'] || '').trim();
  const auth = String(req.headers.authorization || '');
  const device = ID.test(id) ? devices().get(id) : null;
  if (!device || !auth.startsWith('Bearer ') || !checkKey(device, auth.slice(7).trim())) {
    return send(res, 401, { error: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
  }

  let body = req.body;
  if (typeof body === 'string') { if (body.length > MAX_BYTES) return send(res, 413, { error: 'too_large' }); try { body = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'invalid JSON' }); } }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, { error: 'send a JSON object' });
  if (JSON.stringify(body).length > MAX_BYTES) return send(res, 413, { error: 'too_large' });
  const list = Array.isArray(body.readings) ? body.readings : [body];
  if (!list.length) return send(res, 400, { error: 'no readings' });
  if (list.length > MAX_READINGS) return send(res, 413, { error: `send at most ${MAX_READINGS} readings at a time` });

  try {
    const minute = Math.floor(Date.now() / 60e3);
    const [count] = await redis([['INCR', `da:rl:${id}:${minute}`], ['EXPIRE', `da:rl:${id}:${minute}`, 120]]);
    if (count > PER_MINUTE) return send(res, 429, { error: 'too many requests' }, { 'Retry-After': '60' });

    const now = Date.now(), cal = calibration(id), rejected = [], good = [];
    list.forEach((r, i) => { const p = parseReading(r, now, cal); if (p.ok) good.push(p.ok); else rejected.push({ index: i, reason: p.reason }); });

    // Skip readings this device already sent (same msg_id within two days).
    let duplicates = 0, fresh = good;
    const withId = good.filter((g) => g.msg);
    if (withId.length) {
      const seen = await redis(withId.map((g) => ['SET', `da:msg:${id}:${g.msg}`, '1', 'NX', 'EX', 172800]));
      const dup = new Set(withId.filter((g, i) => seen[i] !== 'OK').map((g) => g.msg));
      duplicates = dup.size;
      fresh = good.filter((g) => !g.msg || !dup.has(g.msg));
    }

    const firmware = typeof body.firmware === 'string' ? body.firmware.slice(0, 40) : '';
    const cmds = [['HSET', `da:dev:${id}`, 'room', device.room, 'last_seen', String(now), 'firmware', firmware, 'last_status', rejected.length && !fresh.length ? 'rejected' : 'ok']];
    if (fresh.length) {
      fresh.sort((a, b) => a.t - b.t);
      const items = fresh.map((g) => JSON.stringify({ t: g.t, r: now, d: id, v: g.values, ...(g.raw ? { raw: g.raw } : {}), q: g.flags.length ? 'suspect' : 'ok', ...(g.flags.length ? { f: g.flags } : {}) }));
      cmds.push(['LPUSH', `da:obs:${device.room}`, ...items], ['LTRIM', `da:obs:${device.room}`, 0, KEEP - 1]);
    }
    await redis(cmds);

    // Latest value per measurement: only replace when this reading is newer than the one stored.
    if (fresh.length) {
      const [cur] = await redis([['HGETALL', `da:latest:${device.room}`]]);
      const have = {};
      for (let i = 0; cur && i < cur.length; i += 2) { try { have[cur[i]] = JSON.parse(cur[i + 1]); } catch (e) { /* replaced below */ } }
      const set = [];
      fresh.forEach((g) => Object.entries(g.values).forEach(([k, v]) => {
        if (have[k] && have[k].t >= g.t) return;
        have[k] = { t: g.t, r: now, d: id, v, q: g.flags.includes(k) ? 'suspect' : 'ok' };
        set.push(k, JSON.stringify(have[k]));
      }));
      if (set.length) await redis([['HSET', `da:latest:${device.room}`, ...set]]);
    }

    return send(res, rejected.length && !good.length ? 400 : 200, {
      room: device.room, received_at: new Date(now).toISOString(),
      accepted: fresh.length, duplicates, flagged: fresh.filter((g) => g.flags.length).length, rejected,
    });
  } catch (e) {
    return send(res, 502, { error: 'storage unavailable, keep the readings and retry' }, { 'Retry-After': '60' });
  }
};
