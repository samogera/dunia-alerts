// GET /api/v1/classroom?room=<room_id>[&history=1]
// Also at /api/v1/classrooms/<room_id>/latest and /api/v1/classrooms/<room_id>/history (see vercel.json).
//
// The latest checked reading for each measurement, how old it is and whether it is current,
// plus the sensor's last contact. With history=1: hourly averages for the last 24 hours and a trend.
// Room data only: no names, no personal information. Read-only and public, like a thermometer on the wall.

const { ID, METRICS, FRESH_S, redis, storage, devices, send } = require('../_lib/core');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Use GET' }, { Allow: 'GET, HEAD' });
  const q = req.query || {};
  const room = String(q.room || '').toLowerCase();
  if (!ID.test(room)) return send(res, 400, { error: 'room must be 2–40 letters, numbers or dashes' }, { 'Cache-Control': 'no-store' });

  const devs = [...devices().values()].filter((d) => d.room === room);
  if (!storage() || !devices().size) return send(res, 200, { room, configured: false }, { 'Cache-Control': 'public, s-maxage=300' });
  if (!devs.length) return send(res, 404, { room, configured: true, error: 'unknown_room' }, { 'Cache-Control': 'public, s-maxage=300' });

  try {
    const wantHistory = q.history === '1' || q.history === 'true';
    const cmds = [['HGETALL', `da:latest:${room}`], ...devs.map((d) => ['HGETALL', `da:dev:${d.id}`])];
    if (wantHistory) cmds.push(['LRANGE', `da:obs:${room}`, 0, 599]);
    const out = await redis(cmds);
    const now = Date.now();

    const latest = {};
    const flat = out[0] || [];
    for (let i = 0; i < flat.length; i += 2) {
      if (!METRICS[flat[i]]) continue;
      try {
        const o = JSON.parse(flat[i + 1]);
        const age = Math.max(0, Math.round((now - o.t) / 1000));
        latest[flat[i]] = { value: o.v, unit: METRICS[flat[i]].unit, observed_at: new Date(o.t).toISOString(), received_at: new Date(o.r).toISOString(),
          age_s: age, fresh: age <= FRESH_S, quality: o.q === 'suspect' ? 'suspect' : 'ok' };
      } catch (e) { /* skip a damaged entry */ }
    }
    const sensors = devs.map((d, i) => {
      const f = out[1 + i] || [], h = {};
      for (let k = 0; k < f.length; k += 2) h[f[k]] = f[k + 1];
      const seen = Number(h.last_seen) || null;
      return { device_id: d.id, last_seen: seen ? new Date(seen).toISOString() : null,
        status: !seen ? 'never_seen' : now - seen > FRESH_S * 1000 ? 'offline' : h.last_status === 'rejected' ? 'sending_bad_data' : 'ok' };
    });
    const vals = Object.values(latest);
    const status = !vals.length ? 'no_data' : vals.some((v) => v.fresh) ? 'live' : 'stale';
    const body = { room, configured: true, status, freshness_window_s: FRESH_S, server_time: new Date(now).toISOString(), latest, sensors };

    if (wantHistory) {
      const obs = (out[out.length - 1] || []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } })
        .filter((o) => o && o.q === 'ok' && o.t > now - 24 * 3600e3);
      const hours = new Map();
      obs.forEach((o) => {
        const h = Math.floor(o.t / 3600e3) * 3600e3;
        const b = hours.get(h) || {}; hours.set(h, b);
        Object.entries(o.v || {}).forEach(([k, v]) => { if (METRICS[k]) { b[k] = b[k] || [0, 0]; b[k][0] += v; b[k][1]++; } });
      });
      body.hours = [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([t, b]) => {
        const row = { t: new Date(t).toISOString() };
        Object.entries(b).forEach(([k, [s, n]]) => { const dp = METRICS[k].dp, f = 10 ** dp; row[k] = Math.round(s / n * f) / f; });
        return row;
      });
      // Trend: latest value against the average 25–35 minutes earlier.
      body.trend = {};
      Object.keys(latest).forEach((k) => {
        const then = obs.filter((o) => o.v && o.v[k] != null && now - o.t >= 25 * 60e3 && now - o.t <= 35 * 60e3).map((o) => o.v[k]);
        if (!then.length || !latest[k].fresh) return;
        const was = then.reduce((a, b) => a + b, 0) / then.length, d = latest[k].value - was;
        const step = { co2_ppm: 60, pm25_ugm3: 3, temp_c: 0.5, rh_pct: 4 }[k];
        body.trend[k] = d > step ? 'up' : d < -step ? 'down' : 'steady';
      });
    }
    return send(res, 200, body, { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' });
  } catch (e) {
    return send(res, 502, { room, configured: true, error: 'storage unavailable' }, { 'Cache-Control': 'no-store' });
  }
};
