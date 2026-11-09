// Live PM2.5 from ground sensors near the schools, through OpenAQ (which includes AirQo sensors).
// Runs on Vercel as a serverless function, so the API key stays secret.
// Set OPENAQ_API_KEY in Vercel → Project → Settings → Environment Variables (free key: https://explore.openaq.org/register).
// Without a key it answers { connected: false } and the app uses model estimates only.

const BASE = 'https://api.openaq.org/v3';
const MAX_AGE_MS = 6 * 3600 * 1000;   // ignore sensors silent for more than 6 hours
const MAX_LOCATIONS = 25;             // keeps each refresh well inside the free rate limit

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send(JSON.stringify({ error: 'Method not allowed' }));
  }
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
  const key = process.env.OPENAQ_API_KEY;
  if (!key) return res.status(200).send(JSON.stringify({ connected: false, sensors: [] }));

  // The area is set on the server, never by the visitor: one cached answer for everyone, and the key
  // can't be used to query anywhere else. Nairobi by default; change with PILOT_LAT / PILOT_LNG.
  let lat = parseFloat(process.env.PILOT_LAT), lng = parseFloat(process.env.PILOT_LNG);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) lat = -1.2864;
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) lng = 36.8172;

  const get = async (path) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(BASE + path, { headers: { 'X-API-Key': key, Accept: 'application/json' }, signal: ctl.signal });
      if (!r.ok) throw new Error('OpenAQ ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  };

  try {
    const found = await get(`/locations?coordinates=${lat.toFixed(4)},${lng.toFixed(4)}&radius=25000&parameters_id=2&limit=100`);
    const now = Date.now();
    const locations = (found.results || [])
      .filter((l) => l && l.coordinates && l.datetimeLast && l.datetimeLast.utc && now - Date.parse(l.datetimeLast.utc) < MAX_AGE_MS)
      .slice(0, MAX_LOCATIONS);

    const sensors = (await Promise.all(locations.map(async (l) => {
      const pm = (l.sensors || []).find((s) => s.parameter && s.parameter.name === 'pm25');
      if (!pm) return null;
      try {
        const latest = await get(`/locations/${l.id}/latest`);
        const m = (latest.results || []).find((v) => v.sensorsId === pm.id);
        if (!m || m.value == null || m.value < 0 || !m.datetime) return null;
        return {
          id: l.id,
          name: l.name || 'Sensor',
          provider: l.provider && l.provider.name ? l.provider.name : null,
          lat: l.coordinates.latitude,
          lng: l.coordinates.longitude,
          pm25: Math.round(m.value * 10) / 10,
          at: m.datetime.utc,
        };
      } catch (e) { return null; }
    }))).filter(Boolean);

    return res.status(200).send(JSON.stringify({ connected: true, source: 'OpenAQ', sensors }));
  } catch (e) {
    return res.status(200).send(JSON.stringify({ connected: true, error: 'OpenAQ could not be reached', sensors: [] }));
  }
};
