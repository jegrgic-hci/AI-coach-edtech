// Auth seam. Dev: email + password against the users collection, with an
// opaque session token in an HttpOnly cookie (authSessions collection).
// Prod: swap the body of authenticate() for Firebase Auth — verify the Bearer
// ID token, check the school domain, get-or-create the user doc. Route code
// never changes: it only ever sees the returned user.
//
// No passwords in prod. The plan is domain-restricted Google SSO (COPPA/FERPA);
// this password path exists so the POC has real per-student identity to build
// the UI against.

const crypto = require('crypto');
const { col } = require('./store');

const COOKIE = 'cta_session';
const SESSION_DAYS = 30;

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function setPassword(user, password) {
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  return col('users').update(user.id, {
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
  });
}

function verifyPassword(user, password) {
  if (!user.passwordHash || !user.passwordSalt) return false;
  const candidate = hashPassword(password, user.passwordSalt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header) {
  const out = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function login(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const user = col('users').list((u) => u.email.toLowerCase() === normalized)[0];
  if (!user || !verifyPassword(user, String(password || ''))) return null;

  const token = crypto.randomBytes(32).toString('hex');
  col('authSessions').add({
    userId: user.id,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(),
  });
  return { user, token };
}

function logout(token) {
  for (const s of col('authSessions').list((s) => s.token === token)) {
    col('authSessions').update(s.id, { expiresAt: new Date(0).toISOString() });
  }
}

// Returns the user, or null. Never throws — the router turns null into a 401.
function authenticate(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const session = col('authSessions').list((s) => s.token === token)[0];
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  return col('users').get(session.userId);
}

function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 86400;
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearedCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function tokenFrom(req) {
  return parseCookies(req.headers.cookie)[COOKIE] || null;
}

module.exports = {
  authenticate,
  login,
  logout,
  setPassword,
  sessionCookie,
  clearedCookie,
  tokenFrom,
};
