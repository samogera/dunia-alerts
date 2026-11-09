// GET /api/v1/health: is the classroom sensor service set up? Counts only, nothing private.
const { storage, devices, rooms, send } = require('../_lib/core');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Use GET' }, { Allow: 'GET, HEAD' });
  return send(res, 200, {
    ok: true,
    api: 'v1',
    storage: Boolean(storage()),
    devices: devices().size,
    rooms: rooms().size,
    openaq: Boolean(process.env.OPENAQ_API_KEY),
  }, { 'Cache-Control': 'public, s-maxage=60' });
};
