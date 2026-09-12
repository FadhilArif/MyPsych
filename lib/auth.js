const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
  createSessionToken,
  verifySessionToken,
  isValidUsername,
  isValidEmail,
  nextUserId,
  generateRandomPassword
};
