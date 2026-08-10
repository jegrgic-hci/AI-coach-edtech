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
const SESSION_DAYS = 7;
const PRODUCTION = process.env.NODE_ENV === 'production';

// Secure cookies are a property of the *transport*, not of the environment,
// and staging conflates the two: it is served over HTTPS by Cloud Run but runs
// NODE_ENV=staging so the demo seed is allowed to populate it. Without this
// split it would issue session cookies without Secure over a public TLS
// origin. Defaults to PRODUCTION, so nothing changes for prod or for localhost.
const SECURE_COOKIES = PRODUCTION || process.env.SECURE_COOKIES === '1';

// Whether this instance's store was populated by the demo seed. The login
// page's test-account list is only truthful — and only safe to publish a shared
// password for — when it was. Opt-in and never true in production, so a real
// instance shows real users a plain sign-in form. See seed.js.
const DEMO_MODE = process.env.SEED_DEMO === '1' && !PRODUCTION;

// scrypt work factor. Node's default N is 2^14, which is below current
// guidance; 2^16 costs ~100ms per verification here, which is nothing against
// a login and a great deal against an offline cracker with the hash file.
// maxmem has to be raised alongside N or scrypt throws.
const SCRYPT = { N: 65536, r: 8, p: 1, maxmem: 128 * 65536 * 8 * 2 };
const KEYLEN = 64;

// Failed logins are throttled **per account only**. Without this, a shared
// weak password plus an unlimited guess rate is the whole authentication
// story. Firestore-backed rather than in-memory because Cloud Run runs
// several instances and a per-instance counter throttles nothing.
//
// Deliberately NOT throttled per IP: a school is one NAT gateway, so every
// student shares an address. An IP lockout would mean ten fumbled passwords
// anywhere in the building locks out the whole class — verified by doing
// exactly that, 2026-08-05. Password spraying across many accounts is
// therefore detected and logged loudly rather than blocked, because blocking
// by IP here means blocking the school.
const MAX_FAILURES = 10;
const LOCKOUT_MINUTES = 15;
const SPRAY_DISTINCT_ACCOUNTS = 25;

// Node's scrypt defaults, which every hash written before 2026-08-05 used.
// Kept so raising the work factor upgrades accounts instead of locking them
// out — the same reason params are stored per user from here on.
const LEGACY_SCRYPT = { N: 16384, r: 8, p: 1 };

function hashPassword(password, salt, params = SCRYPT) {
  return crypto.scryptSync(password, salt, KEYLEN, params).toString('hex');
}

async function setPassword(user, password) {
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  return col('users').update(user.id, {
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
    passwordParams: SCRYPT,
    passwordSetAt: new Date().toISOString(),
  });
}

function verifyPassword(user, password) {
  if (!user.passwordHash || !user.passwordSalt) return false;
  const params = user.passwordParams || LEGACY_SCRYPT;
  const candidate = hashPassword(password, user.passwordSalt, params);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// A correct password verified against outdated parameters is the only moment
// the plaintext is available to re-hash at the current cost. Silent, and it
// means the work factor can be raised again later without a reset for anyone.
function needsRehash(user) {
  const params = user.passwordParams;
  return !params || params.N < SCRYPT.N;
}

// An unknown email used to return before any hashing happened, so it answered
// in ~1ms where a real account took ~100ms — a timing oracle that lets someone
// enumerate which students have accounts. Burn the same work either way.
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
function burnEqualWork() {
  crypto.scryptSync('placeholder', DUMMY_SALT, KEYLEN, SCRYPT);
}

// Session tokens are stored hashed. The row is a bearer credential: anyone who
// reads the collection — a backup, an export, a misconfigured rule — could
// otherwise resume every live session without touching a password.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function windowStart() {
  return new Date(Date.now() - LOCKOUT_MINUTES * 60000).toISOString();
}

async function recentFailures(email) {
  const since = windowStart();
  return (await col('loginFailures').list({ email })).filter((f) => f.ts >= since).length;
}

async function recordFailure(email, ip) {
  await col('loginFailures').add({ email, ip: ip || null, ts: new Date().toISOString() });

  // Spray signature: one address failing against many *different* accounts.
  // A class fumbling their own passwords produces a few failures each across
  // a handful of accounts; a script produces one failure each across dozens.
  if (!ip) return;
  const since = windowStart();
  const distinct = new Set(
    (await col('loginFailures').list({ ip })).filter((f) => f.ts >= since).map((f) => f.email)
  );
  if (distinct.size >= SPRAY_DISTINCT_ACCOUNTS) {
    console.error(`[auth] possible password spray — ${ip} failed against ${distinct.size} distinct accounts in ${LOCKOUT_MINUTES}m`);
  }
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

// A user doc with no status predates the admin role — treat it as active
// rather than locking out every account seeded before suspension existed.
function isSuspended(user) {
  return !!user && user.status === 'suspended';
}

// Scans `users` rather than querying on email: the stored value is compared
// case-insensitively, which an equality query cannot do. The collection is
// bounded per school, so the read cost is small and the auth semantics stay
// exactly as they were.
// Returns { user, token } on success, null on bad credentials, or
// { lockedOut: true } when the caller has failed too often lately. The caller
// must not distinguish the first two in what it shows the person.
async function login(email, password, clientIp = null) {
  const normalized = String(email || '').trim().toLowerCase();

  if (await recentFailures(normalized) >= MAX_FAILURES) return { lockedOut: true };

  const user = (await col('users').list((u) => u.email.toLowerCase() === normalized))[0];

  // Suspended accounts burn the same work and fail the same way as a wrong
  // password — the form must not distinguish "suspended" from "wrong
  // password" any more than it distinguishes "no such account".
  if (!user || isSuspended(user) || !verifyPassword(user, String(password || ''))) {
    if (!user) burnEqualWork();
    await recordFailure(normalized, clientIp);
    return null;
  }

  if (needsRehash(user)) await setPassword(user, String(password));

  const token = crypto.randomBytes(32).toString('hex');
  await col('authSessions').add({
    userId: user.id,
    tokenHash: hashToken(token),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(),
  });
  return { user, token };
}

async function logout(token) {
  // Deleted, not expired in place: a revoked session should stop existing
  // rather than linger as a row someone could un-expire.
  for (const s of await col('authSessions').list({ tokenHash: hashToken(token) })) {
    await col('authSessions').delete(s.id);
  }
}

// Returns the user, or null. Never throws — the router turns null into a 401.
async function authenticate(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const session = (await col('authSessions').list({ tokenHash: hashToken(token) }))[0];
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  const user = await col('users').get(session.userId);
  // Checked per-request, not just at login, so suspending a teacher ends the
  // tab they already have open instead of waiting out the cookie.
  if (isSuspended(user)) return null;
  return user;
}

// Secure is conditional because localhost is plain HTTP — setting it
// unconditionally would silently break dev sign-in, and hard-coding it off
// would silently ship a cookie that travels in the clear.
function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 86400;
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${SECURE_COOKIES ? '; Secure' : ''}`;
}

function clearedCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${SECURE_COOKIES ? '; Secure' : ''}`;
}

// Every seeded and admin-created account shares one password in dev, which is
// the point — the login page lists the accounts and fills the form on click.
// It is also the single worst thing that could reach production, so the value
// is chosen here rather than passed in, and production gets a random one that
// nobody can guess from having read this repo.
//
// It lives here rather than in seed-data.js (where it was until 2026-08-08)
// because index.js needs it for admin-created accounts, and importing it from
// seed-data meant every production process loaded the demo fixtures module.
const DEV_PASSWORD = 'coach1234';

function newTempPassword() {
  if (PRODUCTION) return crypto.randomBytes(12).toString('base64url');
  return DEV_PASSWORD;
}

function tokenFrom(req) {
  return parseCookies(req.headers.cookie)[COOKIE] || null;
}

module.exports = {
  authenticate,
  isSuspended,
  login,
  logout,
  setPassword,
  newTempPassword,
  sessionCookie,
  clearedCookie,
  tokenFrom,
  PRODUCTION,
  DEMO_MODE,
  DEV_PASSWORD,
};
