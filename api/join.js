// /api/join · applications to join the Dunia Alerts pilot, from schools, parents, partners, government and funders.
//
//   POST    (anyone, from this site's own /join page)
//           {type, name, title?, email, phone?, contact?, org, schoolType?, subcounty?, area?, learners?, concerns?, message?, consent:true, src?}
//           201 {ok:true, ref:"DA-XXXXXX"} · 400 {error, fields} · 403 · 413 · 415 · 429 too many · 503 storage not connected
//   GET     (signed-in Dunia team)  200 {items:[…newest first], count, labels}
//   PATCH   (signed-in Dunia team)  {id, status?, note?}  200 {ok:true, item}
//   DELETE  (signed-in Dunia team)  {id}                  200 {ok:true}
//
// Applications are kept in Upstash Redis (the same private store as sign-in), in one hash: da:join  id → JSON.
// Only adults' own contact details are asked for. The form asks people not to write children's names.
// Spam guard: a hidden field people never see, a minimum time on the page, and 5 applications per address per hour.
const crypto = require('crypto');
const { storage, redis, send } = require('./_lib/core');
const A = require('./_lib/auth');

const KEY = 'da:join';
const MAX_ITEMS = 5000;
const PER_HOUR = 5;
const MIN_MS = 2500;
const TYPES = {
  school: 'School', parent: 'Parent or community', partner: 'NGO, researcher or partner',
  gov: 'County or national government', funder: 'Funder or donor', other: 'Other',
};
// The first form asked for a role; old replies keep it, and an old page still sending one is mapped to a type.
const ROLES = {
  head: 'Head teacher or deputy', teacher: 'Teacher', school: 'School owner, manager or board member', parent: 'Parent or guardian',
  gov: 'County or national government', partner: 'NGO, researcher or partner', funder: 'Funder or donor', other: 'Something else',
};
const ROLE_TYPE = { head: 'school', teacher: 'school', school: 'school', parent: 'parent', gov: 'gov', partner: 'partner', funder: 'funder', other: 'other' };
const CONTACT = { email: 'Email', call: 'Phone call', whatsapp: 'WhatsApp' };
const SCHOOL_TYPES = { public: 'Public', private: 'Private', community: 'Community or low-cost' };
// Nairobi's 17 sub-counties (constituencies), and anywhere else.
const SUBCOUNTIES = {
  'dagoretti-north': 'Dagoretti North', 'dagoretti-south': 'Dagoretti South', 'embakasi-central': 'Embakasi Central', 'embakasi-east': 'Embakasi East',
  'embakasi-north': 'Embakasi North', 'embakasi-south': 'Embakasi South', 'embakasi-west': 'Embakasi West', kamukunji: 'Kamukunji', kasarani: 'Kasarani',
  kibra: 'Kibra', langata: 'Lang’ata', makadara: 'Makadara', mathare: 'Mathare', roysambu: 'Roysambu', ruaraka: 'Ruaraka', starehe: 'Starehe',
  westlands: 'Westlands', outside: 'Outside Nairobi',
};
const LEARNERS = { '': '', u300: 'Under 300', '300-700': '300 to 700', '700-1500': '700 to 1,500', '1500+': 'Over 1,500', na: 'Not a school' };
const CONCERNS = { air: 'Dirty air', heat: 'Extreme heat', rain: 'Heavy rain and floods', river: 'Rising rivers', room: 'Classroom air and comfort' };
const STATUS = { new: 'New', contacted: 'Contacted', joined: 'Joined', not_now: 'Not now' };
const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/;
const ID = /^j[a-z0-9]{8,24}$/;
const REF_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L: easy to read out on the phone

// Plain text only: no control characters, single spaces, trimmed, cut to length.
function clean(v, max, multiline = false) {
  if (typeof v !== 'string') return '';
  let s = v.normalize('NFKC').replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g : /[\u0000-\u001f\u007f\u2028\u2029]/g, ' ');
  s = multiline ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}
const pick = (v, list) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(list, v) ? v : '');

function makeRef() {
  const b = crypto.randomBytes(6);
  return 'DA-' + [...b].map((x) => REF_CHARS[x % REF_CHARS.length]).join('');
}

function check(body) {
  const f = {}, bad = [];
  f.type = pick(body.type, TYPES) || ROLE_TYPE[pick(body.role, ROLES)] || '';
  if (!f.type) bad.push('type');
  if (pick(body.role, ROLES)) f.role = body.role;
  f.name = clean(body.name, 80);
  if (f.name.length < 2) bad.push('name');
  f.title = clean(body.title, 80);
  f.email = clean(body.email, 254).toLowerCase();
  if (!A.EMAIL.test(f.email)) bad.push('email');
  f.phone = clean(body.phone, 24);
  if (f.phone && !PHONE.test(f.phone)) bad.push('phone');
  f.contact = pick(body.contact, CONTACT) || 'email';
  if (f.contact !== 'email' && !f.phone && !bad.includes('phone')) bad.push('phone');
  f.org = clean(body.org, 120);
  if (f.org.length < 2) bad.push('org');
  const school = f.type === 'school' || f.type === 'parent';
  f.schoolType = school ? pick(body.schoolType, SCHOOL_TYPES) : '';
  f.subcounty = pick(body.subcounty, SUBCOUNTIES);
  f.area = clean(body.area, 80);
  f.learners = school ? pick(body.learners, LEARNERS) : '';
  f.concerns = Array.isArray(body.concerns) ? [...new Set(body.concerns.filter((c) => typeof c === 'string' && CONCERNS[c]))] : [];
  f.message = clean(body.message, 1000, true);
  f.src = typeof body.src === 'string' && /^[a-z0-9-]{1,24}$/.test(body.src) ? body.src : '';   // where the link came from, e.g. qr
  if (body.consent !== true) bad.push('consent');
  return { f, bad };
}

// Replies per address per hour: Redis when connected, otherwise this function's memory.
const memory = new Map();
async function overLimit(ip) {
  const k = 'da:join:ip:' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);
  try {
    const [n] = await redis([['INCR', k], ['EXPIRE', k, '3600']]);
    return Number(n) > PER_HOUR;
  } catch (e) {
    const now = Date.now(), m = memory.get(k);
    const n = m && m.until > now ? m.n + 1 : 1;
    memory.set(k, { n, until: m && m.until > now ? m.until : now + 3600e3 });
    return n > PER_HOUR;
  }
}

function parse(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

async function all() {
  const flat = (await redis([['HGETALL', KEY]]))[0] || [];
  const items = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    try { const it = JSON.parse(flat[i + 1]); if (it && it.id) items.push(it); } catch (e) { /* skip a broken entry */ }
  }
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

async function submit(req, res) {
  if (!A.sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
  if (!/application\/json/.test(String(req.headers['content-type'] || ''))) return send(res, 415, { error: 'json_only' });
  const body = parse(req);
  if (!body) return send(res, 400, { error: 'bad_request' });
  if (JSON.stringify(body).length > 8000) return send(res, 413, { error: 'too_long' });

  // Robots fill the hidden field or send the form at once. Say thank you, keep nothing.
  const spent = Number(body.t);
  if ((typeof body.website === 'string' && body.website.trim()) || !Number.isFinite(spent) || spent < MIN_MS) return send(res, 201, { ok: true, ref: makeRef() });

  const { f, bad } = check(body);
  if (bad.length) return send(res, 400, { error: 'invalid', fields: bad });
  if (!storage()) return send(res, 503, { error: 'not_configured' });
  if (await overLimit(A.clientIp(req))) { res.setHeader('Retry-After', '3600'); return send(res, 429, { error: 'too_many' }); }

  try {
    const [count] = await redis([['HLEN', KEY]]);
    if (Number(count) >= MAX_ITEMS) return send(res, 503, { error: 'full' });
    const id = 'j' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
    const ref = makeRef();
    const item = { id, ref, at: new Date().toISOString(), ...f, status: 'new', note: '' };
    await redis([['HSET', KEY, id, JSON.stringify(item)]]);
    return send(res, 201, { ok: true, ref });
  } catch (e) {
    return send(res, 503, { error: 'storage' });
  }
}

module.exports = async function handler(req, res) {
  A.noStore(res);
  const m = req.method;
  if (m === 'POST') return submit(req, res);
  if (!['GET', 'PATCH', 'DELETE'].includes(m)) { res.setHeader('Allow', 'GET, POST, PATCH, DELETE'); return send(res, 405, { error: 'method_not_allowed' }); }

  const s = await A.session(req);
  if (!s) return send(res, 401, { error: 'sign_in' });
  if (!storage()) return send(res, 503, { error: 'not_configured' });

  try {
    if (m === 'GET') {
      const items = await all();
      return send(res, 200, { items, count: items.length, labels: { types: TYPES, roles: ROLES, contact: CONTACT, schoolTypes: SCHOOL_TYPES, subcounties: SUBCOUNTIES, learners: LEARNERS, concerns: CONCERNS, status: STATUS } });
    }
    if (!A.sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
    const body = parse(req) || {};
    const id = typeof body.id === 'string' ? body.id : String((req.query && req.query.id) || '');
    if (!ID.test(id)) return send(res, 400, { error: 'bad_id' });

    if (m === 'DELETE') {
      await redis([['HDEL', KEY, id]]);
      return send(res, 200, { ok: true });
    }
    const [raw] = await redis([['HGET', KEY, id]]);
    if (!raw) return send(res, 404, { error: 'not_found' });
    const item = JSON.parse(raw);
    if (body.status !== undefined) {
      if (!STATUS[body.status]) return send(res, 400, { error: 'bad_status' });
      item.status = body.status;
    }
    if (body.note !== undefined) item.note = clean(body.note, 500, true);
    item.updatedAt = new Date().toISOString();
    item.updatedBy = s.email;
    await redis([['HSET', KEY, id, JSON.stringify(item)]]);
    return send(res, 200, { ok: true, item });
  } catch (e) {
    return send(res, 503, { error: 'storage' });
  }
};

module.exports.TYPES = TYPES;
module.exports.SUBCOUNTIES = SUBCOUNTIES;
module.exports.SCHOOL_TYPES = SCHOOL_TYPES;
module.exports.CONTACT = CONTACT;
module.exports.ROLES = ROLES;
module.exports.LEARNERS = LEARNERS;
module.exports.CONCERNS = CONCERNS;
module.exports.STATUS = STATUS;
