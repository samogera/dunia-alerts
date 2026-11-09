#!/usr/bin/env node
// Pretend to be a classroom sensor, to test the API and the classroom screen before hardware arrives.
//   node tools/simulate-sensor.js <site_url> <device_id> <key> [--backfill] [--every 60]
// Example: node tools/simulate-sensor.js https://dunia-alerts.vercel.app dev-test-1 dak_xxx --backfill
// --backfill sends the last 3 hours at 5-minute steps first (like a sensor that was offline).
// Readings are made up and follow a school day: CO2 rises in lessons and falls at break.
const [base, id, key, ...rest] = process.argv.slice(2);
if (!base || !id || !key) { console.error('Usage: node tools/simulate-sensor.js <site_url> <device_id> <key> [--backfill] [--every 60]'); process.exit(1); }
const every = Number(rest[rest.indexOf('--every') + 1]) || 60;
const url = base.replace(/\/+$/, '') + '/api/v1/observations';
function reading(t) {
  const h = new Date(t).getUTCHours() + 3 + new Date(t).getUTCMinutes() / 60;           // Nairobi time
  const lesson = h >= 8 && h < 16 && !(h >= 10.5 && h < 11) && !(h >= 13 && h < 14);
  const phase = (h * 60) % 40 / 40;                                                    // CO2 builds through a 40-minute lesson
  const co2 = Math.round(lesson ? 600 + 900 * phase : 450) + Math.round(Math.random() * 30);
  const temp = 21 + 6 * Math.max(0, Math.sin((h - 7) / 12 * Math.PI)) + Math.random() * 0.3;
  return { observed_at: new Date(t).toISOString(), msg_id: `${id}-${Math.floor(t / 1000)}`, co2_ppm: co2,
    pm25_ugm3: Math.round((14 + 6 * Math.random()) * 10) / 10, temp_c: Math.round(temp * 10) / 10, rh_pct: Math.round(55 - (temp - 21) * 2) };
}
async function post(readings) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, 'X-Device-Id': id }, body: JSON.stringify({ readings, firmware: 'simulator' }) });
  console.log(new Date().toLocaleTimeString(), r.status, await r.text());
}
(async () => {
  if (rest.includes('--backfill')) { const now = Date.now(); await post(Array.from({ length: 36 }, (_, i) => reading(now - (36 - i) * 5 * 60e3))); }
  await post([reading(Date.now())]);
  setInterval(() => post([reading(Date.now())]).catch((e) => console.error(e.message)), every * 1000);
})();
