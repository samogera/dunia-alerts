// Shared helpers for the classroom sensor API. Files in api/_lib are not served as functions.
//
// Storage: Upstash Redis over its REST API (free tier). Connect it in Vercel → Storage → Upstash for Redis,
// which adds KV_REST_API_URL and KV_REST_API_TOKEN. UPSTASH_REDIS_REST_URL / _TOKEN also work.
//
// Devices: DEVICE_KEYS lists each sensor as  device_id:room_id:sha256_of_its_key  (comma or new line between devices).
// Make a key and its line with:  node tools/new-device.js <device_id> <room_id>
// Only the hash is stored on the server, so a leaked setting cannot be used to send readings.

const crypto = require('crypto');

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

// What each sensor may send. lo/hi: values outside are impossible and rejected.
// slo/shi: values outside are possible but suspicious, so they are kept and flagged for review.
const METRICS = {
  co2_ppm:   { unit: 'ppm',   lo: 0,   hi: 40000, slo: 350, shi: 5000, dp: 0 },
  pm25_ugm3: { unit: 'µg/m³', lo: 0,   hi: 2000,  slo: 0,   shi: 500,  dp: 1 },
  temp_c:    { unit: '°C',    lo: -40, hi: 85,    slo: 5,   shi: 45,   dp: 1 },
  rh_pct:    { unit: '%',     lo: 0,   hi: 100,   slo: 5,   shi: 99,   dp: 0 },
};
const FRESH_S = 15 * 60;            // a reading older than this is not shown as current
const KEEP = 3000;                  // observations kept per room (about 10 days at one every 5 minutes)

function storage() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const local = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url || '');   // only for local tests
  if (!url || !token || (!/^https:\/\//.test(url) && !local)) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function redis(cmds) {
  const s = storage();
  if (!s) throw Object.assign(new Error('storage not configured'), { code: 'no_storage' });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(s.url + '/pipeline', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + s.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!r.ok) throw new Error('storage ' + r.status);
    const out = await r.json();
    return out.map((x) => { if (x && x.error) throw new Error('storage: ' + x.error); return x ? x.result : null; });
  } finally { clearTimeout(t); }
}

function devices() {
  const list = new Map();
  String(process.env.DEVICE_KEYS || '').split(/[\s,]+/).filter(Boolean).forEach((line) => {
    const [id, room, hash] = line.split(':');
    if (ID.test(id || '') && ID.test(room || '') && /^[a-f0-9]{64}$/.test(hash || '')) list.set(id, { id, room, hash });
  });
  return list;
}
const rooms = () => new Set([...devices().values()].map((d) => d.room));

function checkKey(device, key) {
  if (!device || typeof key !== 'string' || key.length < 24 || key.length > 200) return false;
  const a = Buffer.from(crypto.createHash('sha256').update(key).digest('hex'));
  const b = Buffer.from(device.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Optional per-device calibration, e.g. CALIBRATION_JSON={"dev-a1":{"pm25_ugm3":{"scale":0.62,"offset":1.5}}}
function calibration(deviceId) {
  try { const all = JSON.parse(process.env.CALIBRATION_JSON || '{}'); return all && typeof all === 'object' ? all[deviceId] || {} : {}; }
  catch (e) { return {}; }
}

const round = (v, dp) => { const f = 10 ** dp; return Math.round(v * f) / f; };

function send(res, status, body, extra = {}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  Object.entries(extra).forEach(([k, v]) => res.setHeader(k, v));
  return res.status(status).send(JSON.stringify(body));
}

module.exports = { ID, METRICS, FRESH_S, KEEP, storage, redis, devices, rooms, checkKey, calibration, round, send };
