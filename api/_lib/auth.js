const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Ganti/atur SESSION_SECRET di Environment Variables Vercel.
// Ini kunci rahasia untuk menandatangani token sesi (JWT) —
// pengganti CacheService di Apps Script dulu. Siapa pun yang tahu
// nilai ini bisa memalsukan sesi, jadi harus rahasia & panjang/acak.
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL = '6h'; // sama seperti SESSION_TTL_SECONDS dulu (6 jam)

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

/**
 * Return session payload kalau token valid, atau null kalau tidak valid/kedaluwarsa.
 * Tidak melempar error — dipakai untuk pengecekan biasa (login opsional).
 */
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

/**
 * Skema lama dari Apps Script: SHA256(salt + ':' + password), disimpan
 * sebagai hex string. Dipakai untuk akun hasil migrasi Google Sheets
 * yang belum pernah login lagi sejak pindah ke Supabase.
 */
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

/**
 * Verifikasi password terhadap hash yang mungkin format bcrypt (akun baru)
 * ATAU format lama SHA256+salt (akun migrasi dari Google Sheets).
 * Return { ok, needsUpgrade } — needsUpgrade true kalau berhasil login
 * pakai format lama, supaya gateway.js bisa langsung upgrade ke bcrypt.
 */
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

function generateRandomPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
  generateRandomPassword
};
