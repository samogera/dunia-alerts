// POST /api/auth/logout · ends the session on this device (and on the server when storage is connected)
const { send } = require('../_lib/core');
const A = require('../_lib/auth');

module.exports = async function handler(req, res) {
  A.noStore(res);
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  if (!A.sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
  await A.signOut(await A.session(req));
  res.setHeader('Set-Cookie', A.clearCookie());
  return send(res, 200, { ok: true });
};
