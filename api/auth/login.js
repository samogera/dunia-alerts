// POST /api/auth/login  {"email": "...", "password": "..."}
// 200 {ok:true,email} and a session cookie · 401 wrong email or password · 429 too many tries · 503 not set up
const { send } = require('../_lib/core');
const A = require('../_lib/auth');

module.exports = async function handler(req, res) {
  A.noStore(res);
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  if (!A.sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
  if (!/application\/json/.test(String(req.headers['content-type'] || ''))) return send(res, 415, { error: 'json_only' });
  if (!A.configured()) return send(res, 503, { error: 'not_configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const email = body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body && typeof body.password === 'string' ? body.password : '';
  if (!email || email.length > 254 || !password || password.length > 200) return send(res, 400, { error: 'missing' });

  const ip = A.clientIp(req);
  if (await A.tooMany(ip, email)) {
    res.setHeader('Retry-After', String(A.LIMIT.windowS));
    return send(res, 429, { error: 'too_many' });
  }

  const user = A.users().get(email);
  const ok = await A.verifyPassword(password, user ? user.stored : null);
  if (!user || !ok) {
    await A.noteFailure(ip, email);
    return send(res, 401, { error: 'invalid' });
  }
  await A.clearFailures(email);
  res.setHeader('Set-Cookie', A.sessionCookie(A.makeToken(user)));
  return send(res, 200, { ok: true, email: user.email });
};
