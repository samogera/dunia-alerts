// GET /pilot/signups (rewritten here by vercel.json): the team's list of "Join the pilot" replies.
// Signed-in people only; everyone else goes to the sign-in page. The replies themselves come from /api/join.
const A = require('./_lib/auth');
const { signups } = require('./_lib/shell');

module.exports = async function handler(req, res) {
  A.noStore(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).send('Method not allowed'); }
  const s = await A.session(req);
  if (!s) {
    res.setHeader('Location', '/login?next=%2Fpilot%2Fsignups');
    return res.status(302).send('');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(req.method === 'HEAD' ? '' : signups({ user: s.email }));
};
