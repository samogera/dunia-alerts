// Pilot sign-in for the Dunia team. Files in api/_lib are not served as functions.
//
// Accounts: the PILOT_USERS setting in Vercel lists one account per line (or comma):
//     email:scrypt:<salt>:<hash>
// Only the scrypt hash of each password is stored. Make a line with:  node tools/new-user.js someone@example.org
//
// Sessions: a cookie signed with SESSION_SECRET (at least 32 characters; make one with  node tools/new-user.js --secret).
// The cookie is HttpOnly, Secure and SameSite=Strict, and lasts 12 hours. Changing a person's password, or removing
// their line from PILOT_USERS, ends their sessions. Signing out also cancels the session on the server when
// storage is connected.

const crypto = require('crypto');
const { storage, redis } = require('./core');

const COOKIE = '__Host-da_session';
const MAX_AGE_S = 12 * 3600;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;
const EMAIL = /^[^\s@:,]{1,64}@[^\s@:,]{1,190}\.[a-z]{2,24}$/i;
const LIMIT = { perIp: 20, perAccount: 6, windowS: 15 * 60 };

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function users() {
  const list = new Map();
  String(process.env.PILOT_USERS || '').split(/[\s,]+/).filter(Boolean).forEach((line) => {
    const parts = line.split(':');
    if (parts.length !== 4 || parts[1] !== 'scrypt') return;
    const email = parts[0].toLowerCase();
    if (!EMAIL.test(email) || !/^[A-Za-z0-9_-]{16,}$/.test(parts[2]) || !/^[A-Za-z0-9_-]{40,}$/.test(parts[3])) return;
    list.set(email, { email, stored: `scrypt:${parts[2]}:${parts[3]}` });
  });
  return list;
}

function secret() {
  const s = process.env.SESSION_SECRET || '';
  return s.length >= 32 ? s : null;
}

const configured = () => Boolean(secret()) && users().size > 0;

function scrypt(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, KEYLEN, SCRYPT, (e, k) => (e ? reject(e) : resolve(k))));
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return `scrypt:${b64(salt)}:${b64(await scrypt(String(password).normalize('NFKC'), salt))}`;
}

// A fixed, valid hash, checked when the email is unknown so a wrong email takes as long as a wrong password.
const DUMMY = 'scrypt:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

async function verifyPassword(password, stored) {
  const [, saltB, hashB] = String(stored || DUMMY).split(':');
  const want = Buffer.from(hashB, 'base64url');
  const got = await scrypt(String(password).normalize('NFKC'), Buffer.from(saltB, 'base64url'));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

// The session carries a short fingerprint of the password hash, so a new password ends old sessions.
const fingerprint = (stored) => crypto.createHash('sha256').update(stored).digest('base64url').slice(0, 12);
const mac = (body) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');

function makeToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ u: user.email, pv: fingerprint(user.stored), iat: now, exp: now + MAX_AGE_S, jti: b64(crypto.randomBytes(12)) }));
  return `${body}.${mac(body)}`;
}

function readCookie(req, name) {
  const raw = String((req.headers && req.headers.cookie) || '');
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function parseToken(token) {
  if (!secret() || typeof token !== 'string' || token.length > 600) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(mac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!p || typeof p.u !== 'string' || typeof p.exp !== 'number' || p.exp <= Date.now() / 1000) return null;
  const user = users().get(p.u);
  if (!user || p.pv !== fingerprint(user.stored)) return null;
  return p;
}

// The signed-in person, or null. Checks the server-side sign-out list when storage is connected.
async function session(req) {
  const p = parseToken(readCookie(req, COOKIE));
  if (!p) return null;
  if (storage() && p.jti) {
    try { const [gone] = await redis([['GET', `da:signedout:${p.jti}`]]); if (gone) return null; } catch (e) { /* storage down: the signature still holds */ }
  }
  return { email: p.u, jti: p.jti, exp: p.exp };
}

const sessionCookie = (token) => `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE_S}; HttpOnly; Secure; SameSite=Strict`;
const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

// Requests that change the session must come from this site's own pages.
function sameOrigin(req) {
  const origin = req.headers && req.headers.origin;
  const host = req.headers && (req.headers['x-forwarded-host'] || req.headers.host);
  if (!origin || !host) return false;
  try { return new URL(origin).host === String(host).split(',')[0].trim(); } catch (e) { return false; }
}

function clientIp(req) {
  const f = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '');
  return (f.split(',')[0] || 'unknown').trim().slice(0, 64);
}

// Failed sign-ins: counted per address and per account for 15 minutes. Redis when connected,
// otherwise in this function's memory (weaker, but still slows guessing).
const memory = new Map();
function memIncr(key) {
  const now = Date.now(), e = memory.get(key);
  const n = e && e.until > now ? e.n + 1 : 1;
  memory.set(key, { n, until: e && e.until > now ? e.until : now + LIMIT.windowS * 1000 });
  if (memory.size > 5000) for (const [k, v] of memory) if (v.until <= now) memory.delete(k);
  return n;
}
const memGet = (key) => { const e = memory.get(key); return e && e.until > Date.now() ? e.n : 0; };
const accountKey = (email) => 'da:login:acct:' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 24);
const ipKey = (ip) => 'da:login:ip:' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);

async function tooMany(ip, email) {
  const keys = [ipKey(ip), accountKey(email)];
  let counts;
  if (storage()) {
    try { counts = (await redis(keys.map((k) => ['GET', k]))).map((v) => Number(v) || 0); } catch (e) { counts = null; }
  }
  if (!counts) counts = keys.map(memGet);
  return counts[0] >= LIMIT.perIp || counts[1] >= LIMIT.perAccount;
}

async function noteFailure(ip, email) {
  const keys = [ipKey(ip), accountKey(email)];
  if (storage()) {
    try { await redis(keys.flatMap((k) => [['INCR', k], ['EXPIRE', k, String(LIMIT.windowS)]])); return; } catch (e) { /* fall through */ }
  }
  keys.forEach(memIncr);
}

async function clearFailures(email) {
  if (storage()) { try { await redis([['DEL', accountKey(email)]]); return; } catch (e) { /* ignore */ } }
  memory.delete(accountKey(email));
}

async function signOut(s) {
  if (!s || !s.jti || !storage()) return;
  const left = Math.max(1, Math.ceil(s.exp - Date.now() / 1000));
  try { await redis([['SET', `da:signedout:${s.jti}`, '1', 'EX', String(left)]]); } catch (e) { /* cookie is cleared anyway */ }
}

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

module.exports = {
  COOKIE, MAX_AGE_S, EMAIL, LIMIT, users, configured, hashPassword, verifyPassword, makeToken, session,
  sessionCookie, clearCookie, sameOrigin, clientIp, tooMany, noteFailure, clearFailures, signOut, noStore,
};
