// GET /api/auth/me · who is signed in on this device: 200 {signedIn, email} or 200 {signedIn:false, configured}.
// Always 200 so the sign-in page can ask without filling the browser console with errors.
const { send } = require('../_lib/core');
const A = require('../_lib/auth');

module.exports = async function handler(req, res) {
  A.noStore(res);
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'method_not_allowed' }); }
  const s = await A.session(req);
  if (!s) return send(res, 200, { signedIn: false, configured: A.configured() });
  return send(res, 200, { signedIn: true, email: s.email });
};
