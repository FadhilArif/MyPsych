/**
 * rateLimit.js — MyPsych
 *
 * Rate limiter dengan dua mode:
 *   1. Upstash Redis (kalau UPSTASH_REDIS_REST_URL & TOKEN di-set) — recommended
 *   2. In-memory Map (fallback otomatis kalau Upstash tidak di-set)
 *
 * In-memory hanya efektif per-instance Vercel function. Untuk proteksi
 * penuh, set up Upstash Redis (gratis 10.000 request/hari).
 */

let cachedRatelimit = null; // false kalau gagal init

async function getRatelimit_() {
  if (cachedRatelimit !== null) return cachedRatelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    cachedRatelimit = false;
    return false;
  }

  try {
    const { Ratelimit } = require('@upstash/ratelimit');
    const { Redis } = require('@upstash/redis');

    const redis = new Redis({ url, token });

    cachedRatelimit = {
      gateway:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 m'), prefix: 'rl:gw' }),
      login:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,   '1 m'), prefix: 'rl:login' }),
      register: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,   '1 h'), prefix: 'rl:reg' }),
      reset:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,   '1 h'), prefix: 'rl:reset' }),
    };
    return cachedRatelimit;
  } catch (err) {
    console.error('Upstash init gagal, fallback ke in-memory:', err.message);
    cachedRatelimit = false;
    return false;
  }
}

// ============================================================
// In-memory fallback
// ============================================================

const memStore = new Map();

function memLimit_(key, max, windowMs) {
  const now = Date.now();
  let entry = memStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count += 1;
  memStore.set(key, entry);

  // Housekeeping: hapus entry lama kalau map terlalu besar
  if (memStore.size > 5000) {
    for (const [k, v] of memStore.entries()) {
      if (v.resetAt < now) memStore.delete(k);
    }
  }

  return entry.count <= max;
}

const MEM_LIMITS = {
  gateway:  { max: 120, window: 60_000 },
  login:    { max: 5,   window: 60_000 },
  register: { max: 3,   window: 3_600_000 },
  reset:    { max: 3,   window: 3_600_000 },
};

// ============================================================
// Public API
// ============================================================

/**
 * Cek apakah request masih di bawah limit.
 * @param {string} kind - 'gateway' | 'login' | 'register' | 'reset'
 * @param {string} identifier - biasanya IP, atau IP:username
 * @returns {Promise<boolean>} true kalau boleh lanjut, false kalau kena limit
 */
async function checkRateLimit(kind, identifier) {
  const rl = await getRatelimit_();

  if (rl && rl[kind]) {
    try {
      const { success } = await rl[kind].limit(identifier);
      return success;
    } catch (err) {
      console.error('Upstash limit error, fallback in-memory:', err.message);
      // Lanjut ke in-memory fallback
    }
  }

  const limit = MEM_LIMITS[kind] || MEM_LIMITS.gateway;
  return memLimit_(`${kind}:${identifier}`, limit.max, limit.window);
}

module.exports = { checkRateLimit };
