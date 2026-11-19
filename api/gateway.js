const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');
const { checkRateLimit } = require('./_lib/rateLimit');
const {
  hashPassword,
  verifyPassword,
  verifyPasswordAny,
  createSessionToken,
  verifySessionToken,
  isValidUsername,
  isValidEmail,
  nextUserId,
  generateRandomPassword,
  generateResetToken,
  hashToken,
  decodeTokenExp
} = require('./_lib/auth');
const { sendResetPasswordEmail, sendNewPasswordEmail } = require('./_lib/mailer');

const USER_COLUMNS = 'user-id, username, email, password_hash, salt, role, created_at';
const CANONICAL_APP_URL = 'https://my-psych-five.vercel.app/';
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // harus sama dengan SESSION_TTL di _lib/auth.js
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESET_COOLDOWN_MS = 5 * 60 * 1000;
const RESET_DAILY_LIMIT = 5;

// Kolom tambahan untuk bank soal bertipe stimulus (Paket SKD/TIU HOTS).
// Kalau migrasi SQL belum dijalankan, query otomatis jatuh ke kolom lama
// supaya bank soal biasa tetap bisa dipakai.
const QUESTION_BANK_COLUMNS_BASE = 'question_id, no_soal, question, option_a, option_b, option_c, option_d, option_e, answer, discussion, active';
const QUESTION_BANK_COLUMNS_WITH_META = 'question_id, no_soal, question, option_a, option_b, option_c, option_d, option_e, answer, discussion, stimulus, instruction, topic, active';
const QUESTION_BANK_META_FIELDS = ['stimulus', 'instruction', 'topic'];

function isMissingQuestionMetaColumn_(error) {
  if (!error) return false;
  const code = String(error.code || '');
  if (code === '42703' || code === 'PGRST204') return true;
  const message = `${error.message || ''} ${error.details || ''}`;
  return QUESTION_BANK_META_FIELDS.some(field => new RegExp(field, 'i').test(message))
    && /(column|schema cache|does not exist|not find)/i.test(message);
}

function hasQuestionMeta_(record) {
  return QUESTION_BANK_META_FIELDS.some(field => {
    const value = record[field];
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  });
}

async function selectQuestionBank_(supabase, buildQuery) {
  let result = await buildQuery(
    supabase.from('question_bank').select(QUESTION_BANK_COLUMNS_WITH_META)
  );

  if (result.error && isMissingQuestionMetaColumn_(result.error)) {
    result = await buildQuery(
      supabase.from('question_bank').select(QUESTION_BANK_COLUMNS_BASE)
    );
  }

  return result;
}

const QUESTION_META_MIGRATION_HINT =
  'Kolom stimulus/instruction/topic belum ada di question_bank. ' +
  'Jalankan migrasi docs/migrations/add-question-bank-stimulus.sql di Supabase SQL Editor, lalu upload ulang.';

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      service: 'Psychotest Practice API (Supabase)',
      message: 'API aktif.'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method tidak didukung.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch (_) { return res.status(400).json({ success: false, message: 'Payload JSON tidak valid.' }); }
  }
  body = body || {};

  const action = String(body.action || '').trim();
  const clientIp = getClientIp_(req);

  const gatewayOk = await checkRateLimit('gateway', clientIp);
  if (!gatewayOk) {
    return res.status(429).json({
      success: false,
      message: 'Terlalu banyak permintaan dari jaringan ini. Coba lagi sebentar.'
    });
  }

  try {
    let result;

    switch (action) {
      case 'register': {
        const ok = await checkRateLimit('register', clientIp);
        if (!ok) {
          result = { success: false, message: 'Terlalu banyak registrasi dari jaringan ini. Coba lagi nanti.' };
          break;
        }
        result = await register_(body.username, body.password, body.email);
        break;
      }
      case 'trackPdfDownload':
        result = await trackPdfDownload_(body.token, body.test_id);
        break;
        
        case 'subscribeInterest':
  result = await subscribeInterest_(body.email, body.category, body.userId, body.note);
  break;

case 'adminGetInterests':
  result = await adminGetInterests_(body.token, body.category);
  break;
      case 'login': {
        const ok = await checkRateLimit('login', `${clientIp}:${String(body.username || '').toLowerCase()}`);
        if (!ok) {
          result = { success: false, message: 'Terlalu banyak percobaan login. Tunggu 1 menit lalu coba lagi.' };
          break;
        }
        result = await login_(body.username, body.password);
        break;
      }

      case 'logout':
        result = await logout_(body.token);
        break;

      case 'getHistory':
        result = await getHistory_(body.token);
        break;

      case 'saveHistory':
        result = await saveHistory_(body);
        break;

      case 'getQuestionPackage':
        result = await getQuestionPackage_(body.test_type, body.package);
        break;

      case 'gradeTest':
        result = await gradeTest_(body.test_type, body.package, body.answers);
        break;

      case 'checkAnswer':
        result = await checkAnswer_(body.test_type, body.package, body.question_id, body.answer);
        break;

      case 'stats':
        result = await stats_();
        break;

      case 'saveTestDetail':
        result = await saveTestDetail_(body);
        break;

      case 'getTestDetail':
        result = await getTestDetail_(body);
        break;

      case 'adminDashboard':
        result = await adminDashboard_(body.token);
        break;

      case 'adminGetUsers':
        result = await adminGetUsers_(body.token);
        break;

      case 'adminCreateUser':
        result = await adminCreateUser_(body.token, body.user);
        break;

      case 'adminResetUserPassword':
        result = await adminResetUserPassword_(body.token, body.user_id, body.mode, body.password);
        break;

      case 'adminDeleteUser':
        result = await adminDeleteUser_(body.token, body.user_id);
        break;

      case 'adminGetResults':
        result = await adminGetResults_(body.token, body.filters);
        break;

      case 'adminGetQuestions':
        result = await adminGetQuestions_(body.token, body.test_type, body.package, body.include_inactive);
        break;

      case 'adminSaveQuestions':
        result = await adminSaveQuestions_(body.token, body.questions);
        break;

      case 'adminDeleteQuestion':
        result = await adminDeleteQuestion_(body.token, body.question_id);
        break;

      case 'adminDeleteQuestions':
        result = await adminDeleteQuestions_(body.token, body.question_ids);
        break;

      case 'adminGetScoreLabels':
        result = await adminGetScoreLabels_(body.token, body.test_type);
        break;

      case 'adminSaveScoreLabels':
        result = await adminSaveScoreLabels_(body.token, body.test_type, body.labels);
        break;

      case 'requestPasswordReset': {
        const ok = await checkRateLimit('reset', clientIp);
        if (!ok) {
          result = {
            success: false,
            message: 'Terlalu banyak permintaan reset. Coba lagi nanti atau hubungi admin.'
          };
          break;
        }
        result = await requestPasswordReset_(body.identifier, resolveResetBase_(req, body.appUrl));
        break;
      }

      case 'resetPassword':
        result = await resetPassword_(body.token, body.password);
        break;

      default:
        result = { success: false, message: 'Action tidak dikenali.' };
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[gateway] action=%s error=%s', action, (error && (error.stack || error.message)) || error);
    return res.status(200).json({
      success: false,
      message: 'Terjadi kesalahan pada server. Coba lagi beberapa saat lagi.'
    });
  }
};

/* ============================================================
   HELPERS
   ============================================================ */
async function stats_() {
  try {
    const supabase = getSupabaseAdmin();
    const [usersRes, testsRes, questionsRes] = await Promise.all([
      supabase.from('table_user').select('*', { count: 'exact', head: true }),
      supabase.from('test_history').select('*', { count: 'exact', head: true }),
      supabase.from('question_bank').select('*', { count: 'exact', head: true }).eq('active', true)
    ]);

    return {
      success: true,
      stats: {
        users: usersRes.count || 0,
        tests: testsRes.count || 0,
        questions: questionsRes.count || 0
      }
    };
  } catch (err) {
    console.error('[stats] error:', err && err.message);
    return {
      success: true,
      stats: { users: 0, tests: 0, questions: 0 }
    };
  }
}
function getClientIp_(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  if (real) return String(real);
  return 'unknown';
}

/**
 * Escape karakter wildcard LIKE (%, _, \) supaya input user dicocokkan
 * secara literal, bukan sebagai pattern.
 */
function escapeLike_(value) {
  return String(value || '').replace(/[\\%_]/g, ch => '\\' + ch);
}

/**
 * Tandai semua sesi milik user sebagai tidak valid.
 * Dipakai setelah password diganti, karena JWT bersifat stateless dan
 * token lama masih berlaku sampai TTL 6 jam habis.
 */
async function revokeUserSessions_(supabase, userId, reason = 'password_reset') {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const { error } = await supabase.from('revoked_tokens').insert({
    token_hash: `user:${userId}:${now.getTime()}`,
    user_id: userId,
    reason,
    revoked_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  });
  if (error) throw error;
}

async function logAdminAction_(session, action, targetId, targetLabel, success, message) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('admin_audit_log').insert({
      admin_user_id: session.user_id,
      admin_username: session.username || '',
      action,
      target_id: targetId || '',
      target_label: targetLabel || '',
      success: success !== false,
      message: message || '',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[audit] gagal log:', err && err.message);
  }
}

/* ============================================================
   PDF DOWNLOAD TRACKING
   ============================================================ */

async function trackPdfDownload_(token, testId) {
  testId = String(testId || '').trim();
  if (!testId) return { success: false, message: 'test_id wajib diisi.' };

  // Token opsional — guest juga boleh cetak PDF
  let userId = null;
  if (token) {
    const session = await verifySessionWithRevocation_(token);
    if (session) userId = session.user_id;
  }

  try {
    const supabase = getSupabaseAdmin();

    // Kalau user login, cek duplikat per test_id (unique)
    if (userId) {
      const { data: existing } = await supabase
        .from('pdf_downloads')
        .select('id')
        .eq('test_id', testId)
        .eq('user_id', userId)
        .limit(1);

      if (existing && existing.length) {
        return { success: true, duplicate: true };
      }
    }

    const { error } = await supabase.from('pdf_downloads').insert({
      test_id: testId,
      user_id: userId,
      created_at: new Date().toISOString()
    });
    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error('[trackPdfDownload] error:', err && err.message);
    return { success: false, message: 'Tracking gagal (silent).' };
  }
}
/**
 * Verify session dengan cek revocation list.
 * Return session payload kalau valid, null kalau:
 *  - JWT tidak valid
 *  - Token ada di revoked_tokens
 */
async function verifySessionWithRevocation_(token) {
  const session = verifySessionToken(token);
  if (!session) return null;

  try {
    const supabase = getSupabaseAdmin();
    const tokenHash = hashToken(token);
    const { data, error } = await supabase
      .from('revoked_tokens')
      .select('id')
      .eq('token_hash', tokenHash)
      .limit(1);

    if (error) {
      // Kalau DB error, fail-open (anggap valid) supaya tidak lock user
      // Karena service_role dan RLS, ini seharusnya tidak terjadi.
      console.error('[revocation] DB error:', error.message);
      return session;
    }

    if (data && data.length) {
      // Token sudah di-revoke
      return null;
    }

    // Revokasi menyeluruh per user (mis. setelah ganti password).
    // Sengaja dipisah dari query di atas dan best-effort supaya kegagalan
    // di sini tidak mematikan pengecekan token per-token.
    const userId = String(session.user_id || '');
    const issuedAt = session.iat ? new Date(session.iat * 1000).toISOString() : null;

    if (issuedAt && /^[A-Za-z0-9_-]{1,64}$/.test(userId)) {
      try {
        const { data: resetRows } = await supabase
          .from('revoked_tokens')
          .select('id')
          .eq('user_id', userId)
          .eq('reason', 'password_reset')
          .gte('revoked_at', issuedAt)
          .limit(1);

        if (resetRows && resetRows.length) return null;
      } catch (resetErr) {
        console.error('[revocation] cek password_reset gagal:', resetErr && resetErr.message);
      }
    }

    return session;
  } catch (err) {
    console.error('[revocation] error:', err && err.message);
    return session; // fail-open
  }
}

/* ============================================================
   AUTH
   ============================================================ */

async function register_(username, password, email) {
  username = String(username || '').trim();
  password = String(password || '');
  email = String(email || '').trim().toLowerCase();

  if (!isValidUsername(username)) return { success: false, message: 'Format username tidak valid.' };
  if (password.length < 8) return { success: false, message: 'Password minimal 8 karakter.' };
  if (!isValidEmail(email)) return { success: false, message: 'Format email tidak valid.' };

  const supabase = getSupabaseAdmin();

  // Cek duplikat secara terarah (bukan menarik seluruh tabel) supaya tetap
  // ringan saat jumlah user bertambah.
  const [{ data: sameUsername, error: usernameError }, { data: sameEmail, error: emailError }] = await Promise.all([
    supabase.from('table_user').select('"user-id"')
      .ilike('username', escapeLike_(username)).limit(1),
    supabase.from('table_user').select('"user-id"')
      .eq('email', email).limit(1)
  ]);
  if (usernameError) throw usernameError;
  if (emailError) throw emailError;

  if (sameUsername && sameUsername.length) return { success: false, message: 'Username sudah digunakan.' };
  if (sameEmail && sameEmail.length) return { success: false, message: 'Email sudah digunakan.' };

  // Ambil ID terakhir saja untuk menentukan urutan berikutnya.
  // Catatan: format U + 5 digit menjaga urutan leksikal tetap sama dengan
  // urutan numerik sampai 99.999 user.
  const { data: lastRows, error: lastError } = await supabase
    .from('table_user').select('"user-id"')
    .order('"user-id"', { ascending: false }).limit(1);
  if (lastError) throw lastError;

  const userId = nextUserId((lastRows || []).map(r => r['user-id']));
  const passwordHash = await hashPassword(password);

  const { error: insertError } = await supabase.from('table_user').insert({
    'user-id': userId, username, email,
    password_hash: passwordHash, salt: '',
    role: 'user',
    created_at: new Date().toISOString()
  });

  if (insertError) {
    // Unique index (kalau ada) menangkap balapan dua registrasi bersamaan.
    if (String(insertError.code || '') === '23505') {
      return { success: false, message: 'Username atau email sudah digunakan.' };
    }
    throw insertError;
  }

  const token = createSessionToken({ user_id: userId, username, role: 'user' });
  return { success: true, session: { token, user_id: userId, username, role: 'user', is_admin: false } };
}

async function login_(username, password) {
  username = String(username || '').trim();
  password = String(password || '');

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('table_user').select(USER_COLUMNS).ilike('username', username).limit(1);
  if (error) throw error;

  const row = rows && rows[0];
  if (!row) return { success: false, message: 'Username atau password salah.' };

  const { ok: passwordOk, needsUpgrade } = await verifyPasswordAny(password, row.password_hash, row.salt);
  if (!passwordOk) return { success: false, message: 'Username atau password salah.' };

  const userId = String(row['user-id'] || '');

  if (needsUpgrade) {
    try {
      const upgradedHash = await hashPassword(password);
      await supabase.from('table_user').update({ password_hash: upgradedHash, salt: '' }).eq('user-id', userId);
    } catch (upgradeError) {
      console.error('Gagal upgrade hash lama:', upgradeError);
    }
  }

  const displayUsername = String(row.username || username);
  const role = String(row.role || 'user');
  const token = createSessionToken({ user_id: userId, username: displayUsername, role });

  return {
    success: true,
    session: { token, user_id: userId, username: displayUsername, role, is_admin: role === 'admin' }
  };
}

async function logout_(token) {
  if (!token) return { success: true };

  try {
    const session = verifySessionToken(token);
    if (!session) return { success: true }; // sudah invalid, tidak perlu di-revoke

    const supabase = getSupabaseAdmin();
    const tokenHash = hashToken(token);
    const exp = decodeTokenExp(token);
    const expiresAt = exp ? new Date(exp).toISOString() : new Date(Date.now() + 6 * 3600 * 1000).toISOString();

    // Insert atau update kalau sudah ada
    await supabase.from('revoked_tokens').upsert({
      token_hash: tokenHash,
      user_id: session.user_id,
      reason: 'logout',
      revoked_at: new Date().toISOString(),
      expires_at: expiresAt
    }, { onConflict: 'token_hash' });

    return { success: true };
  } catch (err) {
    console.error('[logout] revoke gagal:', err && err.message);
    // Tetap return success supaya user tetap ter-logout di frontend
    return { success: true };
  }
}

async function getQuestionPackage_(testType, packageNumber) {
  testType = String(testType || '').trim();
  const pkg = Number(packageNumber) || 0;
  if (!testType || !pkg) return { success: false, message: 'test_type dan package wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await selectQuestionBank_(
    supabase,
    (query) => query
      .eq('test_type', testType).eq('package', pkg)
      .order('no_soal', { ascending: true })
  );
  if (error) throw error;

  const activeRows = (rows || []).filter(row => row.active !== false);
  if (!activeRows.length) {
    return { success: false, message: 'Bank soal untuk ' + testType + ' paket ' + pkg + ' belum tersedia. Hubungi admin.' };
  }

  const questions = activeRows.map(row => {
    const options = {};
    if (row.option_a) options.A = row.option_a;
    if (row.option_b) options.B = row.option_b;
    if (row.option_c) options.C = row.option_c;
    if (row.option_d) options.D = row.option_d;
    if (row.option_e) options.E = row.option_e;
    // Sengaja TANPA answer/discussion: kunci jawaban hanya boleh keluar
    // lewat gradeTest/checkAnswer, bukan saat soal dimuat.
    return {
      id: row.no_soal ?? row.question_id,
      question: row.question,
      options,
      // Metadata stimulus untuk soal TIU HOTS. Kolom ini nullable, jadi
      // bank soal lama tetap aman.
      instruction: row.instruction || '',
      stimulus: row.stimulus || null,
      topic: row.topic || ''
    };
  });

  return { success: true, questions };
}

/**
 * Ambil kunci jawaban sebuah baris question_bank sebagai indeks opsi.
 * Indeks mengikuti urutan opsi A..E yang benar-benar terisi, sama dengan
 * cara client menyusun array options.
 */
function resolveQuestionKey_(row) {
  const letters = ['A', 'B', 'C', 'D', 'E'].filter(letter => row['option_' + letter.toLowerCase()]);
  const expected = letters.indexOf(String(row.answer || '').trim().toUpperCase());
  if (expected < 0) return null;
  return { letters, expected, discussion: row.discussion || '' };
}

/**
 * Nilai satu paket sekaligus. Dipanggil setelah tes selesai, sehingga
 * pengiriman kunci jawaban di sini tidak lagi membantu peserta mencontek.
 */
async function gradeTest_(testType, packageNumber, answers) {
  testType = String(testType || '').trim();
  const pkg = Number(packageNumber) || 0;
  if (!testType || !pkg) return { success: false, message: 'test_type dan package wajib diisi.' };
  if (!Array.isArray(answers)) return { success: false, message: 'answers harus berupa array.' };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('question_bank')
    .select('no_soal, option_a, option_b, option_c, option_d, option_e, answer, discussion, active')
    .eq('test_type', testType).eq('package', pkg)
    .order('no_soal', { ascending: true });
  if (error) throw error;

  const activeRows = (rows || []).filter(row => row.active !== false);
  if (!activeRows.length) {
    return { success: false, message: 'Bank soal untuk ' + testType + ' paket ' + pkg + ' belum tersedia.' };
  }

  const byId = new Map(activeRows.map(row => [String(row.no_soal), row]));
  const items = [];

  answers.forEach((entry, index) => {
    const id = String(entry?.id ?? (index + 1));
    const row = byId.get(id);
    if (!row) return;

    const key = resolveQuestionKey_(row);
    if (!key) return;

    const given = String(entry?.answer || '').trim().toUpperCase();
    const givenIndex = key.letters.indexOf(given);

    items.push({
      id: Number(id) || index + 1,
      expected: key.expected,
      answered: givenIndex >= 0,
      correct: givenIndex >= 0 && givenIndex === key.expected,
      discussion: key.discussion
    });
  });

  return { success: true, total: activeRows.length, items };
}

/**
 * Cek satu jawaban untuk umpan balik instan. Tidak mengembalikan kunci
 * paket lain, hanya soal yang memang sedang dikerjakan.
 */
async function checkAnswer_(testType, packageNumber, questionId, given) {
  testType = String(testType || '').trim();
  const pkg = Number(packageNumber) || 0;
  const id = String(questionId ?? '').trim();
  if (!testType || !pkg || !id) return { success: false, message: 'Parameter cek jawaban tidak lengkap.' };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('question_bank')
    .select('no_soal, option_a, option_b, option_c, option_d, option_e, answer, discussion, active')
    .eq('test_type', testType).eq('package', pkg).eq('no_soal', Number(id)).limit(1);
  if (error) throw error;

  const row = (rows || []).find(item => item.active !== false);
  if (!row) return { success: false, message: 'Soal tidak ditemukan.' };

  const key = resolveQuestionKey_(row);
  if (!key) return { success: false, message: 'Kunci jawaban soal belum lengkap.' };

  const givenIndex = key.letters.indexOf(String(given || '').trim().toUpperCase());

  return {
    success: true,
    expected: key.expected,
    correct: givenIndex >= 0 && givenIndex === key.expected,
    discussion: key.discussion
  };
}

/* ============================================================
   HISTORY
   ============================================================ */

async function getHistory_(token) {
  const session = await verifySessionWithRevocation_(token);
  if (!session) return { success: false, message: 'Sesi login sudah berakhir. Silakan masuk lagi.' };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('test_history')
    .select('test_id, user_id, test_type, package, tanggal, score, correct, wrong, total, speed, accuracy, consistency, endurance')
    .eq('user_id', session.user_id)
    .order('tanggal', { ascending: false });
  if (error) throw error;

  return { success: true, history: rows || [] };
}

async function saveHistory_(payload) {
  const session = await verifySessionWithRevocation_(payload.token);
  if (!session) return { success: false, message: 'Sesi login sudah berakhir. Silakan masuk lagi.' };

  const numericFields = ['score', 'correct', 'wrong', 'total', 'speed', 'accuracy', 'consistency', 'endurance'];
  for (const field of numericFields) {
    const value = Number(payload[field]);
    if (!Number.isFinite(value) || value < 0) return { success: false, message: 'Nilai ' + field + ' tidak valid.' };
  }

  const testType = String(payload.test_type || '').trim();
  if (!testType) return { success: false, message: 'test_type wajib diisi.' };

  const testId = String(payload.test_id || ('T-' + Date.now())).slice(0, 80);
  const packageNumber = Number(payload.package) || 1;
  const tanggal = String(payload.tanggal || new Date().toISOString());

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('test_history').insert({
    test_id: testId, user_id: session.user_id, test_type: testType,
    package: packageNumber, tanggal,
    score: Number(payload.score), correct: Number(payload.correct),
    wrong: Number(payload.wrong), total: Number(payload.total),
    speed: Number(payload.speed), accuracy: Number(payload.accuracy),
    consistency: Number(payload.consistency), endurance: Number(payload.endurance)
  });
  if (error) throw error;

  return { success: true, test_id: testId };
}

/* ============================================================
   TEST DETAIL
   ============================================================ */

async function saveTestDetail_(payload) {
  const session = await verifySessionWithRevocation_(payload.token);
  if (!session) return { success: false, message: 'Sesi login sudah berakhir.' };

  const testId = String(payload.test_id || '').trim();
  if (!testId) return { success: false, message: 'test_id wajib diisi.' };

  const details = Array.isArray(payload.details) ? payload.details : [];
  if (!details.length) return { success: true, saved: 0 };

  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from('test_detail').select('user_id').eq('test_id', testId).limit(1);
  if (existingError) throw existingError;
  if (existing && existing.length && String(existing[0].user_id) !== String(session.user_id)) {
    return { success: false, message: 'test_id tidak valid.' };
  }

  const records = details.map(d => ({
    test_id: testId,
    user_id: session.user_id,
    test_type: String(d.test_type || ''),
    package: Number(d.package) || 1,
    no_soal: Number(d.no_soal) || 0,
    kolom: d.kolom === '' || d.kolom === undefined ? null : Number(d.kolom),
    no_soal_dalam_kolom: d.no_soal_dalam_kolom === '' || d.no_soal_dalam_kolom === undefined
      ? null : Number(d.no_soal_dalam_kolom),
    waktu_detik: d.waktu_detik === '' || d.waktu_detik === undefined
      ? null : Number(String(d.waktu_detik).replace(',', '.')),
    jawaban: String(d.jawaban || ''),
    benar: Boolean(d.benar)
  }));

  const { error } = await supabase.from('test_detail').insert(records);
  if (error) throw error;

  return { success: true, saved: records.length };
}

async function getTestDetail_(payload) {
  const session = await verifySessionWithRevocation_(payload.token);
  if (!session) return { success: false, message: 'Sesi login sudah berakhir.' };

  const testId = String(payload.test_id || '').trim();
  if (!testId) return { success: false, message: 'test_id wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('test_detail').select('*')
    .eq('test_id', testId).eq('user_id', session.user_id)
    .order('no_soal', { ascending: true });
  if (error) throw error;

  return { success: true, details: data || [] };
}

/* ============================================================
   ADMIN
   ============================================================ */

async function verifyAdmin_(token) {
  const session = await verifySessionWithRevocation_(token);
  if (!session) return { ok: false, message: 'Sesi login sudah berakhir. Silakan masuk lagi.' };
  if (session.role !== 'admin') return { ok: false, message: 'Akses admin ditolak.' };
  return { ok: true, session };
}

function resolveLabel_(labels, testType, score) {
  if (!Array.isArray(labels) || !labels.length) return '';
  const match = labels.find(l =>
    String(l.test_type) === String(testType) &&
    score >= Number(l.min_score) &&
    score <= Number(l.max_score)
  );
  return match?.label || '';
}

async function adminDashboard_(token) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = getSupabaseAdmin();
  const [usersRes, historyRes, labelsRes, pdfRes] = await Promise.all([
    supabase.from('table_user').select('"user-id", username, email, role, created_at'),
    supabase.from('test_history').select('test_id, user_id, test_type, package, tanggal, score, correct, wrong, total, speed, accuracy, consistency, endurance').order('tanggal', { ascending: false }).limit(500),
    supabase.from('score_labels').select('*').order('urutan', { ascending: true }),
    supabase.from('pdf_downloads').select('*', { count: 'exact', head: true })
  ]);

  if (usersRes.error) throw usersRes.error;
  if (historyRes.error) throw historyRes.error;

  const users = usersRes.data || [];
  const results = historyRes.data || [];
  const labels = labelsRes.error ? [] : (labelsRes.data || []);

  const userMap = new Map();
  users.forEach(u => userMap.set(String(u['user-id']), u));

  const counts = new Map();
  results.forEach(r => {
    const uid = String(r.user_id || '');
    counts.set(uid, (counts.get(uid) || 0) + 1);
  });

  const enrichedUsers = users.map(u => ({
    user_id: u['user-id'], username: u.username, email: u.email || '',
    role: u.role || 'user', created_at: u.created_at,
    test_count: counts.get(String(u['user-id'])) || 0
  }));

  const enrichedResults = results.map(r => {
    const u = userMap.get(String(r.user_id || ''));
    return {
      ...r, username: u?.username || r.user_id || '—', email: u?.email || '',
      label: resolveLabel_(labels, r.test_type, Number(r.score) || 0)
    };
  });

  const admins = users.filter(u => (u.role || 'user') === 'admin').length;
  const avgScore = results.length
    ? Math.round(results.reduce((s, r) => s + (Number(r.score) || 0), 0) / results.length)
    : 0;

   return {
    success: true,
    stats: {
      users: users.length,
      admins,
      tests: results.length,
      avg_score: avgScore,
      pdf_downloads: pdfRes.count || 0   // <-- BARU
    },
    users: enrichedUsers,
    results: enrichedResults,
    labels
  };
}
async function adminGetUsers_(token) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = getSupabaseAdmin();
  const { data: users, error } = await supabase
    .from('table_user').select('"user-id", username, email, role, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: history } = await supabase.from('test_history').select('user_id');
  const counts = new Map();
  (history || []).forEach(h => {
    const uid = String(h.user_id || '');
    counts.set(uid, (counts.get(uid) || 0) + 1);
  });

  return {
    success: true,
    users: (users || []).map(u => ({
      user_id: u['user-id'], username: u.username, email: u.email || '',
      role: u.role || 'user', created_at: u.created_at,
      test_count: counts.get(String(u['user-id'])) || 0
    }))
  };
}

async function adminCreateUser_(token, user) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  user = user || {};
  const username = String(user.username || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  const password = String(user.password || '');

  if (!isValidUsername(username)) return { success: false, message: 'Format username tidak valid.' };
  if (password.length < 8) return { success: false, message: 'Password minimal 8 karakter.' };
  if (email && !isValidEmail(email)) return { success: false, message: 'Format email tidak valid.' };

  const supabase = getSupabaseAdmin();
  const { data: existing, error: exErr } = await supabase.from('table_user').select('"user-id", username, email');
  if (exErr) throw exErr;

  if (existing.some(r => String(r.username || '').toLowerCase() === username.toLowerCase()))
    return { success: false, message: 'Username sudah digunakan.' };
  if (email && existing.some(r => String(r.email || '').toLowerCase() === email))
    return { success: false, message: 'Email sudah digunakan.' };

  const userId = nextUserId(existing.map(r => r['user-id']));
  const passwordHash = await hashPassword(password);

  const { error: insErr } = await supabase.from('table_user').insert({
    'user-id': userId, username, email, password_hash: passwordHash, salt: '',
    role: 'user', created_at: new Date().toISOString()
  });
  if (insErr) throw insErr;

  await logAdminAction_(auth.session, 'adminCreateUser', userId, username, true, '');

  return { success: true, message: `Akun ${username} dibuat.`, user_id: userId };
}

async function adminResetUserPassword_(token, userId, mode, password) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  userId = String(userId || '').trim();
  if (!userId) return { success: false, message: 'user_id wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('table_user').select('"user-id", username, email').eq('user-id', userId).limit(1);
  if (error) throw error;

  const row = rows && rows[0];
  if (!row) return { success: false, message: 'Akun tidak ditemukan.' };

  let newPassword;
  if (mode === 'manual') {
    newPassword = String(password || '');
    if (newPassword.length < 8) return { success: false, message: 'Password manual minimal 8 karakter.' };
  } else {
    newPassword = generateRandomPassword(10);
  }

  const newHash = await hashPassword(newPassword);
  const { error: updErr } = await supabase
    .from('table_user').update({ password_hash: newHash, salt: '' }).eq('user-id', userId);
  if (updErr) throw updErr;

  // Password diganti oleh admin → sesi lama user harus berhenti berlaku.
  try {
    await revokeUserSessions_(supabase, userId);
  } catch (revokeError) {
    console.error('[adminResetUserPassword] gagal revoke sesi lama:', revokeError && revokeError.message);
  }

  if (row.email) {
    try { await sendNewPasswordEmail(row.email, row.username, newPassword); }
    catch (mailErr) { console.error('Email password baru gagal:', mailErr); }
  }

  await logAdminAction_(auth.session, 'adminResetUserPassword', userId, row.username, true, mode || 'generated');

  return { success: true, username: row.username, temporary_password: newPassword };
}

async function adminDeleteUser_(token, userId) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  userId = String(userId || '').trim();
  if (!userId) return { success: false, message: 'user_id wajib diisi.' };
  if (userId === String(auth.session.user_id)) return { success: false, message: 'Tidak bisa menghapus akun sendiri.' };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('table_user').select('"user-id", role, username').eq('user-id', userId).limit(1);
  if (error) throw error;

  const row = rows && rows[0];
  if (!row) return { success: false, message: 'Akun tidak ditemukan.' };
  if ((row.role || 'user') === 'admin') return { success: false, message: 'Akun admin tidak bisa dihapus dari panel.' };

  await supabase.from('test_detail').delete().eq('user_id', userId);
  await supabase.from('test_history').delete().eq('user_id', userId);

  const { error: delErr } = await supabase.from('table_user').delete().eq('user-id', userId);
  if (delErr) throw delErr;

  await logAdminAction_(auth.session, 'adminDeleteUser', userId, row.username, true, '');

  return { success: true, message: `Akun ${row.username} dihapus.` };
}

async function adminGetResults_(token, filters) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  filters = filters || {};
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('test_history')
    .select('test_id, user_id, test_type, package, tanggal, score, correct, wrong, total, speed, accuracy, consistency, endurance')
    .order('tanggal', { ascending: false }).limit(500);

  if (filters.test_type) query = query.eq('test_type', String(filters.test_type));
  if (filters.min_score !== undefined && filters.min_score !== '' && filters.min_score !== null) {
    const min = Number(filters.min_score);
    if (Number.isFinite(min)) query = query.gte('score', min);
  }
  if (filters.max_score !== undefined && filters.max_score !== '' && filters.max_score !== null) {
    const max = Number(filters.max_score);
    if (Number.isFinite(max)) query = query.lte('score', max);
  }

  const { data: results, error } = await query;
  if (error) throw error;

  const { data: users } = await supabase.from('table_user').select('"user-id", username, email');
  const userMap = new Map();
  (users || []).forEach(u => userMap.set(String(u['user-id']), u));

  const { data: labels } = await supabase.from('score_labels').select('*');
  const labelList = labels || [];

  const usernameFilter = String(filters.username || '').trim().toLowerCase();

  const enriched = (results || []).map(r => {
    const u = userMap.get(String(r.user_id || ''));
    return {
      ...r, username: u?.username || r.user_id || '—', email: u?.email || '',
      label: resolveLabel_(labelList, r.test_type, Number(r.score) || 0)
    };
  }).filter(r => !usernameFilter || String(r.username).toLowerCase().includes(usernameFilter));

  return { success: true, results: enriched };
}

async function adminGetQuestions_(token, testType, pkg, includeInactive) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await selectQuestionBank_(
    supabase,
    (query) => {
      let next = query.eq('test_type', String(testType || '').trim());
      if (pkg && Number(pkg) > 0) next = next.eq('package', Number(pkg));
      if (!includeInactive) next = next.eq('active', true);
      return next.order('package', { ascending: true }).order('no_soal', { ascending: true });
    }
  );
  if (error) throw error;

  return {
    success: true,
    questions: (rows || []).map(r => ({
      question_id: r.question_id, test_type: r.test_type, package: r.package, no_soal: r.no_soal,
      question: r.question, option_a: r.option_a, option_b: r.option_b, option_c: r.option_c,
      option_d: r.option_d, option_e: r.option_e, answer: r.answer,
      discussion: r.discussion || '', instruction: r.instruction || '',
      stimulus: r.stimulus || null, topic: r.topic || '',
      active: r.active !== false
    }))
  };
}

async function adminSaveQuestions_(token, questions) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };
  if (!Array.isArray(questions) || !questions.length) return { success: false, message: 'questions kosong.' };

  const supabase = getSupabaseAdmin();
  const ids = questions.map(q => String(q.question_id || '')).filter(Boolean);
  const { data: existing } = await supabase.from('question_bank').select('question_id').in('question_id', ids);
  const existingSet = new Set((existing || []).map(r => r.question_id));

  let added = 0, updated = 0;
  for (const q of questions) {
    const qid = String(q.question_id || '').trim();
    if (!qid) continue;

    const options = q.options || {};
    const record = {
      question_id: qid,
      test_type: String(q.test_type || '').trim(),
      package: Number(q.package) || 1,
      no_soal: Number(q.no_soal) || 1,
      question: String(q.question || '').trim(),
      option_a: String(options.A ?? q.option_a ?? ''),
      option_b: String(options.B ?? q.option_b ?? ''),
      option_c: String(options.C ?? q.option_c ?? ''),
      option_d: String(options.D ?? q.option_d ?? ''),
      option_e: String(options.E ?? q.option_e ?? ''),
      answer: String(q.answer || '').trim().toUpperCase(),
      discussion: String(q.discussion || ''),
      stimulus: q.stimulus && typeof q.stimulus === 'object' ? q.stimulus : null,
      instruction: String(q.instruction || ''),
      topic: String(q.topic || ''),
      active: true
    };

    const isUpdate = existingSet.has(qid);
    const write = (payload) => isUpdate
      ? supabase.from('question_bank').update(payload).eq('question_id', qid)
      : supabase.from('question_bank').insert(payload);

    let { error } = await write(record);

    if (error && isMissingQuestionMetaColumn_(error)) {
      // Bank soal lama tetap bisa diunggah sebelum migrasi dijalankan,
      // tapi soal yang membawa stimulus harus menunggu kolom baru.
      if (hasQuestionMeta_(record)) {
        return { success: false, message: QUESTION_META_MIGRATION_HINT };
      }

      const legacyRecord = { ...record };
      QUESTION_BANK_META_FIELDS.forEach(field => delete legacyRecord[field]);
      ({ error } = await write(legacyRecord));
    }

    if (error) throw error;
    if (isUpdate) updated += 1;
    else added += 1;
  }

  await logAdminAction_(auth.session, 'adminSaveQuestions', '', `${added} added, ${updated} updated`, true, '');

  return { success: true, added, updated, total: questions.length };
}

async function adminDeleteQuestions_(token, questionIds) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const ids = Array.isArray(questionIds)
    ? [...new Set(questionIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];

  if (!ids.length) return { success: false, message: 'Tidak ada soal yang dipilih.' };
  if (ids.length > 500) return { success: false, message: 'Maksimal 500 soal per aksi bulk.' };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('question_bank')
    .update({ active: false })
    .in('question_id', ids);
  if (error) throw error;

  await logAdminAction_(auth.session, 'adminDeleteQuestions', '', `${ids.length} questions`, true, '');

  return {
    success: true,
    message: `${ids.length} soal dinonaktifkan.`,
    count: ids.length
  };
}

async function adminDeleteQuestion_(token, questionId) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const qid = String(questionId || '').trim();
  if (!qid) return { success: false, message: 'question_id wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('question_bank').update({ active: false }).eq('question_id', qid);
  if (error) throw error;

  await logAdminAction_(auth.session, 'adminDeleteQuestion', qid, '', true, '');

  return { success: true, message: 'Soal dinonaktifkan.' };
}

async function adminGetScoreLabels_(token, testType) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = getSupabaseAdmin();
  let query = supabase.from('score_labels').select('*').order('urutan', { ascending: true });
  if (testType) query = query.eq('test_type', String(testType));

  const { data, error } = await query;
  if (error) return { success: true, labels: [] };
  return { success: true, labels: data || [] };
}

async function adminSaveScoreLabels_(token, testType, labels) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  testType = String(testType || '').trim();
  if (!testType) return { success: false, message: 'test_type wajib diisi.' };
  if (!Array.isArray(labels)) return { success: false, message: 'labels harus array.' };

  const supabase = getSupabaseAdmin();
  const { error: delErr } = await supabase.from('score_labels').delete().eq('test_type', testType);
  if (delErr) throw delErr;

  if (labels.length) {
    const records = labels.map((l, i) => ({
      test_type: testType,
      label: String(l.label || '').trim(),
      min_score: Number(l.min_score) || 0,
      max_score: Number(l.max_score) || 100,
      urutan: Number(l.urutan) || i + 1
    })).filter(l => l.label);

    if (records.length) {
      const { error: insErr } = await supabase.from('score_labels').insert(records);
      if (insErr) throw insErr;
    }
  }

  await logAdminAction_(auth.session, 'adminSaveScoreLabels', testType, `${labels.length} labels`, true, '');

  return { success: true, message: 'Label tersimpan.' };
}
/* ============================================================
   INTEREST SIGNUPS
   ============================================================ */

async function subscribeInterest_(email, category, userId, note) {
  email = String(email || '').trim().toLowerCase();
  category = String(category || '').trim().slice(0, 64);
  userId = String(userId || '').trim();
  note = String(note || '').trim().slice(0, 280);

  if (!isValidEmail(email)) {
    return { success: false, message: 'Format email tidak valid.' };
  }
  if (!category) {
    return { success: false, message: 'Kategori tidak dikenali.' };
  }

  // Rate limit khusus — pakai 'register' limit (3/jam per IP)
  // Sudah otomatis berlaku dari case handler, tapi kita bisa double-check di sini.

  const supabase = getSupabaseAdmin();

  // Cek duplikat
  const { data: existing, error: checkErr } = await supabase
    .from('interest_signups')
    .select('id, status')
    .eq('email', email)
    .eq('category', category)
    .limit(1);

  if (checkErr) throw checkErr;

  if (existing && existing.length) {
    // Sudah pernah daftar — return success supaya tidak leak info
    return {
      success: true,
      message: 'Kamu sudah terdaftar. Kami akan kabari saat siap.'
    };
  }

  const { error: insertErr } = await supabase.from('interest_signups').insert({
    email,
    category,
    user_id: userId || null,
    note,
    status: 'pending',
    created_at: new Date().toISOString()
  });
  if (insertErr) throw insertErr;

  return {
    success: true,
    message: 'Berhasil! Kami akan kabari lewat email saat fitur siap.'
  };
}

async function adminGetInterests_(token, category) {
  const auth = await verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('interest_signups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (category) query = query.eq('category', String(category));

  const { data, error } = await query;
  if (error) throw error;

  return { success: true, signups: data || [] };
}
/* ============================================================
   PUBLIC STATS
   ============================================================ */

/* ============================================================
   PASSWORD RESET
   ============================================================ */

/**
 * Tentukan base URL untuk link reset password.
 *
 * Origin TIDAK diambil dari input client: kalau bisa dikendalikan penyerang,
 * link reset berisi token sah akan mengarah ke domain mereka
 * (reset-link poisoning). Yang diambil dari client hanya pathname-nya,
 * digabung dengan origin tepercaya.
 */
function resolveResetBase_(req, requestedUrl) {
  const configured = String(process.env.APP_BASE_URL || '').trim();
  let base = configured || CANONICAL_APP_URL;

  if (!configured) {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0].trim().toLowerCase();
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const hostAllowed =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'my-psych-five.vercel.app' ||
      host.endsWith('.vercel.app');

    if (host && hostAllowed) base = `${proto}://${host}/`;
  }

  let path = '/';
  try {
    const candidate = new URL(String(requestedUrl || ''), base);
    path = candidate.pathname || '/';
  } catch (_) {
    path = '/';
  }

  if (!path.startsWith('/') || path.length > 200) path = '/';
  return base.replace(/\/+$/, '') + path;
}

async function findUserForReset_(supabase, identifier) {
  const columns = '"user-id", username, email, reset_requested_at, reset_request_count_today, reset_request_date';

  // Email dicocokkan persis (disimpan lowercase), username pakai ilike
  // dengan wildcard yang sudah di-escape. Tidak ada nilai user yang
  // dirangkai ke dalam sintaks filter PostgREST.
  if (identifier.includes('@')) {
    const { data, error } = await supabase
      .from('table_user').select(columns)
      .eq('email', identifier.toLowerCase()).limit(1);
    if (error) throw error;
    if (data && data[0]) return data[0];
  }

  if (!isValidUsername(identifier)) return null;

  const { data, error } = await supabase
    .from('table_user').select(columns)
    .ilike('username', escapeLike_(identifier)).limit(1);
  if (error) throw error;

  return (data && data[0]) || null;
}

async function requestPasswordReset_(identifier, resetBase) {
  identifier = String(identifier || '').trim();
  const genericSuccess = {
    success: true,
    message: 'Kalau akun ditemukan, link reset sudah dikirim ke email terdaftar.'
  };
  if (!identifier || identifier.length > 254) return genericSuccess;

  const supabase = getSupabaseAdmin();
  const row = await findUserForReset_(supabase, identifier);
  if (!row || !row.email) return genericSuccess;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (row.reset_requested_at) {
    const elapsed = now.getTime() - new Date(row.reset_requested_at).getTime();
    if (elapsed < RESET_COOLDOWN_MS) {
      // Respons tetap generik supaya tidak membocorkan bahwa akun ini ada
      // dan sedang dalam masa cooldown.
      console.warn('[reset] cooldown aktif user=%s', row['user-id']);
      return genericSuccess;
    }
  }

  let todayCount = 0;
  if (row.reset_request_date === today) {
    todayCount = Number(row.reset_request_count_today) || 0;
  }

  if (todayCount >= RESET_DAILY_LIMIT) {
    console.warn('[reset] batas harian tercapai user=%s', row['user-id']);
    return genericSuccess;
  }

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

  const { error: updateError } = await supabase
    .from('table_user')
    .update({
      reset_token: token,
      reset_token_expires: expiresAt,
      reset_requested_at: now.toISOString(),
      reset_request_count_today: todayCount + 1,
      reset_request_date: today
    })
    .eq('user-id', row['user-id']);
  if (updateError) throw updateError;

  const base = resetBase || CANONICAL_APP_URL;
  const resetUrl = base + '?reset=' + encodeURIComponent(token);

  await sendResetPasswordEmail(row.email, row.username, resetUrl).catch(sendError => {
    console.error('Gagal kirim email reset:', sendError);
    throw new Error('Email reset gagal dikirim (masalah di penyedia email). Coba lagi nanti atau hubungi admin.');
  });

  return genericSuccess;
}

async function resetPassword_(token, newPassword) {
  token = String(token || '').trim();
  newPassword = String(newPassword || '');

  if (!token) return { success: false, message: 'Token reset tidak valid.' };
  if (newPassword.length < 8) return { success: false, message: 'Password minimal 8 karakter.' };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('table_user').select('"user-id", reset_token, reset_token_expires')
    .eq('reset_token', token).limit(1);
  if (error) throw error;

  const row = rows && rows[0];
  if (!row || !row.reset_token_expires || new Date(row.reset_token_expires).getTime() < Date.now()) {
    return { success: false, message: 'Link reset sudah tidak berlaku atau sudah digunakan. Silakan minta link baru.' };
  }

  const newHash = await hashPassword(newPassword);
  const { error: updateError } = await supabase
    .from('table_user')
    .update({
      password_hash: newHash,
      reset_token: null,
      reset_token_expires: null,
      reset_requested_at: null
    })
    .eq('user-id', row['user-id']);
  if (updateError) throw updateError;

  // Sesi lama (token 6 jam yang mungkin sudah beredar) harus mati.
  try {
    await revokeUserSessions_(supabase, row['user-id']);
  } catch (revokeError) {
    console.error('[resetPassword] gagal revoke sesi lama:', revokeError && revokeError.message);
  }

  return { success: true, message: 'Password berhasil diganti. Silakan login menggunakan password baru.' };
}

/* ============================================================
   EKSPOR UNTUK TEST
   Handler tetap yang di-export utama; helper murni ditempel sebagai
   properti supaya bisa diuji tanpa database. Tidak dipakai di produksi.
   ============================================================ */
module.exports.__internals = {
  escapeLike_,
  resolveQuestionKey_,
  resolveResetBase_,
  getClientIp_,
  isMissingQuestionMetaColumn_,
  hasQuestionMeta_
};
