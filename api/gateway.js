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
  generateResetToken
} = require('./_lib/auth');
const { sendResetPasswordEmail, sendNewPasswordEmail } = require('./_lib/mailer');

const USER_COLUMNS = 'user-id, username, email, password_hash, salt, role, created_at';
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESET_COOLDOWN_MS = 5 * 60 * 1000;
const RESET_DAILY_LIMIT = 5;

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
        result = { success: true };
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
        result = await requestPasswordReset_(body.identifier, body.appUrl);
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
    console.error('[gateway] action=%s error=%s', action, error && error.message);
    return res.status(200).json({
      success: false,
      message: 'Terjadi kesalahan server: ' + String((error && error.message) || error)
    });
  }
};

/* ============================================================
   HELPERS
   ============================================================ */

function getClientIp_(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  if (real) return String(real);
  return 'unknown';
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
  const { data: existing, error: existingError } = await supabase
    .from('table_user').select('"user-id", username, email');
  if (existingError) throw existingError;

  if (existing.some(r => String(r.username || '').toLowerCase() === username.toLowerCase()))
    return { success: false, message: 'Username sudah digunakan.' };
  if (existing.some(r => String(r.email || '').toLowerCase() === email))
    return { success: false, message: 'Email sudah digunakan.' };

  const userId = nextUserId(existing.map(r => r['user-id']));
  const passwordHash = await hashPassword(password);

  const { error: insertError } = await supabase.from('table_user').insert({
    'user-id': userId, username, email,
    password_hash: passwordHash, salt: '',
    role: 'user',
    created_at: new Date().toISOString()
  });
  if (insertError) throw insertError;

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

async function getQuestionPackage_(testType, packageNumber) {
  testType = String(testType || '').trim();
  const pkg = Number(packageNumber) || 0;
  if (!testType || !pkg) return { success: false, message: 'test_type dan package wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('question_bank')
    .select('question_id, no_soal, question, option_a, option_b, option_c, option_d, option_e, answer, discussion, active')
    .eq('test_type', testType).eq('package', pkg).order('no_soal', { ascending: true });
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
    return {
      id: row.no_soal ?? row.question_id,
      question: row.question,
      options,
      answer: row.answer,
      discussion: row.discussion || ''
    };
  });

  return { success: true, questions };
}

/* ============================================================
   HISTORY
   ============================================================ */

async function getHistory_(token) {
  const session = verifySessionToken(token);
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
  const session = verifySessionToken(payload.token);
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
   TEST DETAIL — DENGAN VALIDASI OWNERSHIP
   ============================================================ */

async function saveTestDetail_(payload) {
  const session = verifySessionToken(payload.token);
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
  const session = verifySessionToken(payload.token);
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

function verifyAdmin_(token) {
  const session = verifySessionToken(token);
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
  const auth = verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = getSupabaseAdmin();
  const [usersRes, historyRes, labelsRes] = await Promise.all([
    supabase.from('table_user').select('"user-id", username, email, role, created_at'),
    supabase.from('test_history').select('test_id, user_id, test_type, package, tanggal, score, correct, wrong, total, speed, accuracy, consistency, endurance').order('tanggal', { ascending: false }).limit(500),
    supabase.from('score_labels').select('*').order('urutan', { ascending: true })
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
    stats: { users: users.length, admins, tests: results.length, avg_score: avgScore },
    users: enrichedUsers, results: enrichedResults, labels
  };
}

async function adminGetUsers_(token) {
  const auth = verifyAdmin_(token);
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
  const auth = verifyAdmin_(token);
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
  const auth = verifyAdmin_(token);
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

  if (row.email) {
    try { await sendNewPasswordEmail(row.email, row.username, newPassword); }
    catch (mailErr) { console.error('Email password baru gagal:', mailErr); }
  }

  await logAdminAction_(auth.session, 'adminResetUserPassword', userId, row.username, true, mode || 'generated');

  return { success: true, username: row.username, temporary_password: newPassword };
}

async function adminDeleteUser_(token, userId) {
  const auth = verifyAdmin_(token);
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
  const auth = verifyAdmin_(token);
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
  const auth = verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('question_bank')
    .select('question_id, test_type, package, no_soal, question, option_a, option_b, option_c, option_d, option_e, answer, discussion, active')
    .eq('test_type', String(testType || '').trim())
    .order('package', { ascending: true }).order('no_soal', { ascending: true });

  if (pkg && Number(pkg) > 0) query = query.eq('package', Number(pkg));
  if (!includeInactive) query = query.eq('active', true);

  const { data: rows, error } = await query;
  if (error) throw error;

  return {
    success: true,
    questions: (rows || []).map(r => ({
      question_id: r.question_id, test_type: r.test_type, package: r.package, no_soal: r.no_soal,
      question: r.question, option_a: r.option_a, option_b: r.option_b, option_c: r.option_c,
      option_d: r.option_d, option_e: r.option_e, answer: r.answer,
      discussion: r.discussion || '', active: r.active !== false
    }))
  };
}

async function adminSaveQuestions_(token, questions) {
  const auth = verifyAdmin_(token);
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
      active: true
    };

    if (existingSet.has(qid)) {
      const { error } = await supabase.from('question_bank').update(record).eq('question_id', qid);
      if (error) throw error;
      updated += 1;
    } else {
      const { error } = await supabase.from('question_bank').insert(record);
      if (error) throw error;
      added += 1;
    }
  }

  await logAdminAction_(auth.session, 'adminSaveQuestions', '', `${added} added, ${updated} updated`, true, '');

  return { success: true, added, updated, total: questions.length };
}

async function adminDeleteQuestion_(token, questionId) {
  const auth = verifyAdmin_(token);
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
  const auth = verifyAdmin_(token);
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = getSupabaseAdmin();
  let query = supabase.from('score_labels').select('*').order('urutan', { ascending: true });
  if (testType) query = query.eq('test_type', String(testType));

  const { data, error } = await query;
  if (error) return { success: true, labels: [] };
  return { success: true, labels: data || [] };
}

async function adminSaveScoreLabels_(token, testType, labels) {
  const auth = verifyAdmin_(token);
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
   PASSWORD RESET — DENGAN COOLDOWN PER AKUN
   ============================================================ */

async function requestPasswordReset_(identifier, appUrl) {
  identifier = String(identifier || '').trim();
  const genericSuccess = {
    success: true,
    message: 'Kalau akun ditemukan, link reset sudah dikirim ke email terdaftar.'
  };
  if (!identifier) return { success: false, message: 'Username atau email wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('table_user')
    .select('"user-id", username, email, reset_requested_at, reset_request_count_today, reset_request_date')
    .or(`username.ilike.${identifier},email.ilike.${identifier}`)
    .limit(1);
  if (error) throw error;

  const row = rows && rows[0];
  if (!row || !row.email) return genericSuccess;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // ---- Cek cooldown 5 menit ----
  if (row.reset_requested_at) {
    const elapsed = now.getTime() - new Date(row.reset_requested_at).getTime();
    if (elapsed < RESET_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESET_COOLDOWN_MS - elapsed) / 1000);
      const minutes = Math.floor(waitSec / 60);
      const seconds = waitSec % 60;
      const label = minutes > 0
        ? `${minutes} menit ${seconds} detik`
        : `${seconds} detik`;
      return {
        success: false,
        message: `Mohon tunggu ${label} sebelum meminta link reset lagi.`
      };
    }
  }

  // ---- Cek limit harian ----
  let todayCount = 0;
  if (row.reset_request_date === today) {
    todayCount = Number(row.reset_request_count_today) || 0;
  }

  if (todayCount >= RESET_DAILY_LIMIT) {
    return {
      success: false,
      message: `Batas permintaan reset hari ini sudah tercapai (${RESET_DAILY_LIMIT}x). Coba lagi besok atau hubungi admin.`
    };
  }

  // ---- Generate token & simpan ----
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

  const base = String(appUrl || '').trim() || 'https://my-psych-five.vercel.app/';
  const separator = base.indexOf('?') >= 0 ? '&' : '?';
  const resetUrl = base + separator + 'reset=' + encodeURIComponent(token);

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

  return { success: true, message: 'Password berhasil diganti. Silakan login menggunakan password baru.' };
}
