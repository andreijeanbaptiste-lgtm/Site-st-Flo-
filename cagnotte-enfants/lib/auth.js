// Authentification du gérant : mot de passe haché (scrypt) + cookie signé (HMAC).
const crypto = require('crypto');
const db = require('./db');

const COOKIE = 'gerant';
const SESSION_DAYS = 14;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

const secret = () => process.env.SESSION_SECRET || db.data.settings.sessionSecret;

function sign(value) {
  const mac = crypto.createHmac('sha256', secret()).update(value).digest('base64url');
  return `${value}.${mac}`;
}

function unsign(signed) {
  const i = signed.lastIndexOf('.');
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const a = Buffer.from(sign(value));
  const b = Buffer.from(signed);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? value : null;
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

// Le jeton contient la date d'expiration et une empreinte du mot de passe :
// changer le mot de passe déconnecte toutes les autres sessions.
function passwordFingerprint() {
  return crypto.createHash('sha256').update(String(db.data.settings.passwordHash)).digest('hex').slice(0, 16);
}

function login(req, res) {
  const expires = Date.now() + SESSION_DAYS * 864e5;
  const token = sign(`${expires}:${passwordFingerprint()}`);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  });
}

function logout(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function isLoggedIn(req) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return false;
  const value = unsign(raw);
  if (!value) return false;
  const [expires, fp] = value.split(':');
  return Number(expires) > Date.now() && fp === passwordFingerprint();
}

function requireAdmin(req, res, next) {
  if (!db.data.settings.passwordHash) return res.redirect('/admin/installation');
  if (!isLoggedIn(req)) return res.redirect('/admin/connexion');
  next();
}

// Limite les tentatives de connexion (anti force brute) : 10 essais / 15 min par IP.
const attempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60e3);
  attempts.set(ip, list);
  return list.length >= 10;
}
function recordFailure(ip) {
  attempts.set(ip, [...(attempts.get(ip) || []), Date.now()]);
}

module.exports = {
  hashPassword,
  verifyPassword,
  login,
  logout,
  isLoggedIn,
  requireAdmin,
  tooManyAttempts,
  recordFailure,
};
