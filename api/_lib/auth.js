const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL = '6h';

function requireSessionSecret_() {
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET belum diset di Environment Variables Vercel.');
  }
}

async function hashPassword(password) {
  return bcrypt.hash(String(password), 10);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(password), String(hash));
}

function createSessionToken(payload) {
  requireSessionSecret_();
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: SESSION_TTL });
}

function verifySessionToken(token) {
  requireSessionSecret_();
  if (!token) return null;
  try {
    return jwt.verify(String(token), SESSION_SECRET);
  } catch (_) {
    return null;
  }
}

function isBcryptHash(hash) {
  return /^\$2[aby]\$/.test(String(hash || ''));
}

function legacyHash(password, salt) {
  return crypto
    .createHash('sha256')
    .update(String(salt || '') + ':' + String(password))
    .digest('hex');
}

function safeEqualHex(a, b) {
  a = String(a || '').toLowerCase();
  b = String(b || '').toLowerCase();
  if (a.length !== b.length || !a.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyPasswordAny(password, hash, salt) {
  if (isBcryptHash(hash)) {
    const ok = await verifyPassword(password, hash);
    return { ok, needsUpgrade: false };
  }

  const ok = safeEqualHex(legacyHash(password, salt), hash);
  return { ok, needsUpgrade: ok };
}

function isValidUsername(username) {
  return /^[A-Za-z0-9_]{3,24}$/.test(String(username || ''));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function nextUserId(existingIds) {
  let max = 0;

  existingIds.forEach(value => {
    const match = String(value || '').match(/^U(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
  });

  return 'U' + String(max + 1).padStart(5, '0');
}

/**
 * Generate password acak yang aman secara kriptografis.
 * Sebelumnya pakai Math.random() yang bisa diprediksi.
 * Sekarang pakai crypto.randomInt().
 */
function generateRandomPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return result;
}

/**
 * Generate reset token yang aman (64 karakter hex dari 32 byte random).
 * Dipakai oleh requestPasswordReset_ di gateway.js.
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifyPasswordAny,
  createSessionToken,
  verifySessionToken,
  isValidUsername,
  isValidEmail,
  nextUserId,
  generateRandomPassword,
  generateResetToken
};
