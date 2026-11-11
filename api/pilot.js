// GET /pilot (rewritten here by vercel.json): the live pilot dashboard, for signed-in people only.
// Everyone else is sent to the sign-in page.
const A = require('./_lib/auth');
const { dashboard } = require('./_lib/shell');

module.exports = async function handler(req, res) {
  A.noStore(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).send('Method not allowed'); }
  const s = await A.session(req);
  if (!s) {
    res.setHeader('Location', '/login?next=%2Fpilot');
    return res.status(302).send('');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(req.method === 'HEAD' ? '' : dashboard({ mode: 'live', user: s.email }));
};
