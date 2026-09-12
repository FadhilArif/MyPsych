const { getSupabaseAdmin } = require('./lib/supabaseAdmin');
const {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  isValidUsername,
  isValidEmail,
  nextUserId,
  generateRandomPassword
} = require('./lib/auth');
const { sendResetPasswordEmail, sendNewPasswordEmail } = require('./lib/mailer');

const USER_COLUMNS = 'user-id, username, email, password_hash, salt, role, created_at';
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 menit

// Token reset password disimpan di memori proses saja untuk contoh ini.
// Catatan: di Vercel serverless, tiap invocation bisa instance berbeda,
// jadi untuk produksi sebaiknya token reset disimpan di tabel Supabase.
// (Lihat catatan TODO di requestPasswordReset / resetPassword di bawah.)

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
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ success: false, message: 'Payload JSON tidak valid.' });
    }
  }
  body = body || {};

  const action = String(body.action || '').trim();

  try {
    let result;

    switch (action) {
      case 'register':
        result = await register_(body.username, body.password, body.email);
        break;

      case 'login':
        result = await login_(body.username, body.password);
        break;

      case 'logout':
        // Sesi berbasis JWT tidak butuh penghapusan di server;
        // cukup frontend membuang tokennya sendiri.
        result = { success: true };
        break;

      case 'getHistory':
        result = await getHistory_(body.token);
        break;

      case 'saveHistory':
        result = await saveHistory_(body);
        break;

      // ADMIN
      case 'adminDashboard':
        result = await adminDashboard_(body.token);
        break;

      case 'adminGetUsers':
        result = await adminGetUsers_(body.token);
        break;

      case 'adminGetResults':
        result = await adminGetResults_(body.token, body.filters || {});
        break;

      case 'adminCreateUser':
        result = await adminCreateUser_(body.token, body.user || body);
        break;

      case 'adminDeleteUser':
        result = await adminDeleteUser_(body.token, body.user_id);
        break;

      case 'adminResetUserPassword':
        result = await adminResetUserPassword_(body.token, body.user_id, body.mode, body.password);
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

      case 'getQuestionPackage':
        result = await getQuestionPackage_(body.test_type, body.package);
        break;

      case 'saveTestDetail':
        result = await saveTestDetail_(body);
        break;

      case 'getTestDetail':
        result = await getTestDetail_(body);
        break;

      case 'requestPasswordReset':
        result = await requestPasswordReset_(body.identifier, body.appUrl);
        break;

      case 'resetPassword':
        result = await resetPassword_(body.token, body.password);
        break;

      default:
        result = { success: false, message: 'Action tidak dikenali.' };
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(200).json({
      success: false,
      message: 'Terjadi kesalahan server: ' + String((error && error.message) || error)
    });
  }
};

/* ============================================================
   AUTH
   ============================================================ */

async function register_(username, password, email) {
  username = String(username || '').trim();
  password = String(password || '');
  email = String(email || '').trim().toLowerCase();

  if (!isValidUsername(username)) {
    return { success: false, message: 'Format username tidak valid.' };
  }
  if (password.length < 8) {
    return { success: false, message: 'Password minimal 8 karakter.' };
  }
  if (!isValidEmail(email)) {
    return { success: false, message: 'Format email tidak valid.' };
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from('table_user')
    .select('"user-id", username, email');

  if (existingError) throw existingError;

  const duplicateUsername = existing.some(
    row => String(row.username || '').toLowerCase() === username.toLowerCase()
  );
  if (duplicateUsername) {
    return { success: false, message: 'Username sudah digunakan.' };
  }

  const duplicateEmail = existing.some(
    row => String(row.email || '').toLowerCase() === email
  );
  if (duplicateEmail) {
    return { success: false, message: 'Email sudah digunakan.' };
  }

  const userId = nextUserId(existing.map(row => row['user-id']));
  const passwordHash = await hashPassword(password);

  const { error: insertError } = await supabase.from('table_user').insert({
    'user-id': userId,
    username,
    email,
    password_hash: passwordHash,
    salt: '', // tidak dipakai lagi (bcrypt menyimpan salt di dalam hash-nya sendiri)
    role: 'user',
    created_at: new Date().toISOString()
  });

  if (insertError) throw insertError;

  const token = createSessionToken({ user_id: userId, username, role: 'user' });

  return {
    success: true,
    session: { token, user_id: userId, username, is_admin: false }
  };
}

async function login_(username, password) {
  username = String(username || '').trim();
  password = String(password || '');

  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from('table_user')
    .select(USER_COLUMNS)
    .ilike('username', username)
    .limit(1);

  if (error) throw error;

  const row = rows && rows[0];

  if (!row) {
    return { success: false, message: 'Username atau password salah.' };
  }

  const passwordOk = await verifyPassword(password, row.password_hash);

  if (!passwordOk) {
    return { success: false, message: 'Username atau password salah.' };
  }

  const userId = String(row['user-id'] || '');
  const displayUsername = String(row.username || username);
  const role = String(row.role || 'user');

  const token = createSessionToken({ user_id: userId, username: displayUsername, role });

  return {
    success: true,
    session: {
      token,
      user_id: userId,
      username: displayUsername,
      role,
      is_admin: role === 'admin'
    }
  };
}

/* ============================================================
   HISTORY
   ============================================================ */

async function getHistory_(token) {
  const session = verifySessionToken(token);

  if (!session) {
    return { success: false, message: 'Sesi login sudah berakhir. Silakan masuk lagi.' };
  }

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

  if (!session) {
    return { success: false, message: 'Sesi login sudah berakhir. Silakan masuk lagi.' };
  }

  const numericFields = ['score', 'correct', 'wrong', 'total', 'speed', 'accuracy', 'consistency', 'endurance'];

  for (const field of numericFields) {
    const value = Number(payload[field]);
    if (!Number.isFinite(value) || value < 0) {
      return { success: false, message: 'Nilai ' + field + ' tidak valid.' };
    }
  }

  const testType = String(payload.test_type || '').trim();
  if (!testType) {
    return { success: false, message: 'test_type wajib diisi.' };
  }

  const testId = String(payload.test_id || ('T-' + Date.now())).slice(0, 80);
  const packageNumber = Number(payload.package) || 1;
  const tanggal = String(payload.tanggal || new Date().toISOString());

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('test_history').insert({
    test_id: testId,
    user_id: session.user_id,
    test_type: testType,
    package: packageNumber,
    tanggal,
    score: Number(payload.score),
    correct: Number(payload.correct),
    wrong: Number(payload.wrong),
    total: Number(payload.total),
    speed: Number(payload.speed),
    accuracy: Number(payload.accuracy),
    consistency: Number(payload.consistency),
    endurance: Number(payload.endurance)
  });

  if (error) throw error;

  return { success: true, test_id: testId };
}


/* ============================================================
   AUTHORIZATION / ADMIN
   ============================================================ */

function requireSession_(token) {
  const session = verifySessionToken(token);
  if (!session) {
    return { ok: false, message: 'Sesi login sudah berakhir. Silakan masuk lagi.' };
  }
  return { ok: true, session };
}

function requireAdmin_(token) {
  const auth = requireSession_(token);
  if (!auth.ok) return auth;
  if (String(auth.session.role || '').toLowerCase() !== 'admin') {
    return { ok: false, message: 'Akses admin ditolak.' };
  }
  return auth;
}

function escapePostgrest_(value) {
  return String(value ?? '').replace(/[%_\\]/g, '\\$&');
}

async function getAllUsers_() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('table_user')
    .select('"user-id", username, email, role, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getAllHistory_() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('test_history')
    .select('test_id, user_id, test_type, package, tanggal, score, correct, wrong, total, speed, accuracy, consistency, endurance')
    .order('tanggal', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getAllLabels_() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('score_table')
    .select('test_type, label, min_score, max_score, urutan, active')
    .order('test_type', { ascending: true })
    .order('urutan', { ascending: true });
  if (error) throw error;
  return data || [];
}

function labelForScore_(labels, testType, score) {
  const value = Number(score);
  const candidates = labels.filter((item) =>
    String(item.test_type || '').toLowerCase() === String(testType || '').toLowerCase() &&
    item.active !== false
  );
  return candidates.find((item) => value >= Number(item.min_score) && value <= Number(item.max_score))?.label || '';
}

async function adminDashboard_(token) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;

  const [users, history, labels] = await Promise.all([
    getAllUsers_(),
    getAllHistory_(),
    getAllLabels_(),
  ]);

  const userMap = new Map(users.map((user) => [String(user['user-id']), user]));
  const testCounts = new Map();
  history.forEach((row) => {
    const id = String(row.user_id || '');
    testCounts.set(id, (testCounts.get(id) || 0) + 1);
  });

  const publicUsers = users.map((user) => ({
    user_id: String(user['user-id'] || ''),
    username: String(user.username || ''),
    email: String(user.email || ''),
    role: String(user.role || 'user'),
    created_at: user.created_at,
    test_count: testCounts.get(String(user['user-id'])) || 0,
  }));

  const results = history.map((row) => {
    const user = userMap.get(String(row.user_id || '')) || {};
    return {
      ...row,
      username: user.username || '—',
      email: user.email || '',
      label: labelForScore_(labels, row.test_type, row.score),
    };
  });

  const avg = history.length
    ? history.reduce((sum, row) => sum + Number(row.score || 0), 0) / history.length
    : 0;

  return {
    success: true,
    stats: {
      users: users.length,
      admins: users.filter((u) => String(u.role || '').toLowerCase() === 'admin').length,
      tests: history.length,
      avg_score: Math.round(avg * 10) / 10,
    },
    users: publicUsers,
    results,
    labels,
  };
}

async function adminGetUsers_(token) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;

  const [users, history] = await Promise.all([getAllUsers_(), getAllHistory_()]);
  const counts = new Map();
  history.forEach((row) => {
    const id = String(row.user_id || '');
    counts.set(id, (counts.get(id) || 0) + 1);
  });

  return {
    success: true,
    users: users.map((user) => ({
      user_id: String(user['user-id'] || ''),
      username: String(user.username || ''),
      email: String(user.email || ''),
      role: String(user.role || 'user'),
      created_at: user.created_at,
      test_count: counts.get(String(user['user-id'])) || 0,
    })),
  };
}

async function adminGetResults_(token, filters = {}) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;

  const [users, history, labels] = await Promise.all([
    getAllUsers_(),
    getAllHistory_(),
    getAllLabels_(),
  ]);
  const userMap = new Map(users.map((user) => [String(user['user-id']), user]));

  const usernameFilter = String(filters.username || '').trim().toLowerCase();
  const testFilter = String(filters.test_type || '').trim().toLowerCase();
  const minScore = filters.min_score === '' || filters.min_score == null ? null : Number(filters.min_score);
  const maxScore = filters.max_score === '' || filters.max_score == null ? null : Number(filters.max_score);

  const results = history.map((row) => {
    const user = userMap.get(String(row.user_id || '')) || {};
    return {
      ...row,
      username: user.username || '—',
      email: user.email || '',
      label: labelForScore_(labels, row.test_type, row.score),
    };
  }).filter((row) => {
    if (usernameFilter && !String(row.username).toLowerCase().includes(usernameFilter)) return false;
    if (testFilter && String(row.test_type).toLowerCase() !== testFilter) return false;
    if (minScore != null && Number(row.score) < minScore) return false;
    if (maxScore != null && Number(row.score) > maxScore) return false;
    return true;
  });

  return { success: true, results };
}

async function adminCreateUser_(token, userPayload = {}) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;

  const username = String(userPayload.username || '').trim();
  const email = String(userPayload.email || '').trim().toLowerCase();
  const password = String(userPayload.password || '');

  if (!isValidUsername(username)) {
    return { success: false, message: 'Username hanya boleh huruf, angka, dan underscore; 3–24 karakter.' };
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { success: false, message: 'Password minimal 8 karakter dan harus mengandung huruf serta angka.' };
  }
  if (email && !isValidEmail(email)) {
    return { success: false, message: 'Format email tidak valid.' };
  }

  const users = await getAllUsers_();
  if (users.some((u) => String(u.username || '').toLowerCase() === username.toLowerCase())) {
    return { success: false, message: 'Username sudah digunakan.' };
  }
  if (email && users.some((u) => String(u.email || '').toLowerCase() === email)) {
    return { success: false, message: 'Email sudah digunakan.' };
  }

  const userId = nextUserId(users.map((u) => u['user-id']));
  const passwordHash = await hashPassword(password);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('table_user').insert({
    'user-id': userId,
    username,
    email: email || null,
    password_hash: passwordHash,
    salt: '',
    role: 'user',
    created_at: new Date().toISOString(),
  });
  if (error) throw error;

  return { success: true, message: `Akun ${username} berhasil dibuat.`, user_id: userId };
}

async function adminDeleteUser_(token, userId) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;

  userId = String(userId || '').trim();
  if (!userId) return { success: false, message: 'user_id wajib diisi.' };
  if (userId === String(auth.session.user_id)) {
    return { success: false, message: 'Akun admin yang sedang digunakan tidak dapat dihapus.' };
  }

  const supabase = getSupabaseAdmin();
  const { data: targetRows, error: targetError } = await supabase
    .from('table_user')
    .select('"user-id", username, role')
    .eq('user-id', userId)
    .limit(1);
  if (targetError) throw targetError;
  const target = targetRows?.[0];
  if (!target) return { success: false, message: 'Akun tidak ditemukan.' };
  if (String(target.role || 'user') === 'admin') {
    return { success: false, message: 'Akun admin dilindungi dan tidak dapat dihapus dari panel ini.' };
  }

  const { error: detailError } = await supabase.from('test_detail').delete().eq('user_id', userId);
  if (detailError) throw detailError;
  const { error: historyError } = await supabase.from('test_history').delete().eq('user_id', userId);
  if (historyError) throw historyError;
  const { error: userError } = await supabase.from('table_user').delete().eq('user-id', userId);
  if (userError) throw userError;

  return { success: true, message: `Akun ${target.username} beserta histori/detail tes berhasil dihapus.` };
}

async function adminResetUserPassword_(token, userId, mode, manualPassword) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;

  userId = String(userId || '').trim();
  const resetMode = String(mode || 'generated').toLowerCase();
  const password = resetMode === 'manual' ? String(manualPassword || '') : generateRandomPassword(10);

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { success: false, message: 'Password minimal 8 karakter dan harus mengandung huruf serta angka.' };
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('table_user')
    .select('"user-id", username, email, role')
    .eq('user-id', userId)
    .limit(1);
  if (error) throw error;
  const user = rows?.[0];
  if (!user) return { success: false, message: 'Akun tidak ditemukan.' };
  if (String(user.role || 'user') === 'admin') return { success: false, message: 'Password akun admin tidak dapat direset lewat menu peserta.' };

  const passwordHash = await hashPassword(password);
  const { error: updateError } = await supabase
    .from('table_user')
    .update({ password_hash: passwordHash, reset_token: null, reset_token_expires: null })
    .eq('user-id', userId);
  if (updateError) throw updateError;

  let emailSent = false;
  if (user.email) {
    try {
      await sendNewPasswordEmail(user.email, user.username, password);
      emailSent = true;
    } catch (mailError) {
      console.error('Email password baru gagal:', mailError);
    }
  }

  return {
    success: true,
    message: emailSent ? 'Password berhasil direset dan dikirim ke email peserta.' : 'Password berhasil direset. Email peserta belum dapat dikirim.',
    username: user.username,
    temporary_password: password,
    email_sent: emailSent,
  };
}

async function adminGetQuestions_(token, testType, packageNumber, includeInactive) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('question_bank')
    .select('question_id, test_type, package, no_soal, question, option_a, option_b, option_c, option_d, option_e, answer, discussion, active, created_at, updated_at')
    .order('package', { ascending: true })
    .order('no_soal', { ascending: true });

  if (testType) query = query.eq('test_type', String(testType));
  if (Number(packageNumber) > 0) query = query.eq('package', Number(packageNumber));
  if (!includeInactive) query = query.eq('active', true);

  const { data, error } = await query;
  if (error) throw error;
  return { success: true, questions: data || [] };
}

async function adminSaveQuestions_(token, questions) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;
  if (!Array.isArray(questions) || !questions.length) return { success: false, message: 'Data soal kosong.' };
  if (questions.length > 500) return { success: false, message: 'Maksimal 500 soal per request.' };

  const normalized = questions.map((q, index) => {
    const testType = String(q.test_type || '').trim().toLowerCase();
    const pkg = Number(q.package) || 1;
    const noSoal = Number(q.no_soal ?? q.id ?? (index + 1)) || (index + 1);
    const options = q.options || {};
    const answer = String(q.answer || '').trim().toUpperCase();
    if (!testType || !String(q.question || '').trim() || !['A','B','C','D','E'].includes(answer)) {
      throw new Error(`Format soal tidak valid pada item ${index + 1}.`);
    }
    return {
      question_id: String(q.question_id || `${testType}-${pkg}-${noSoal}`).trim(),
      test_type: testType,
      package: pkg,
      no_soal: noSoal,
      question: String(q.question || '').trim(),
      option_a: String(options.A ?? q.option_a ?? ''),
      option_b: String(options.B ?? q.option_b ?? ''),
      option_c: String(options.C ?? q.option_c ?? ''),
      option_d: String(options.D ?? q.option_d ?? ''),
      option_e: String(options.E ?? q.option_e ?? ''),
      answer,
      discussion: String(q.discussion || ''),
      active: q.active === false ? false : true,
      updated_at: new Date().toISOString(),
      created_at: q.created_at || new Date().toISOString(),
    };
  });

  const supabase = getSupabaseAdmin();
  const { data: beforeRows, error: beforeError } = await supabase
    .from('question_bank')
    .select('question_id')
    .in('question_id', normalized.map((q) => q.question_id));
  if (beforeError) throw beforeError;
  const existing = new Set((beforeRows || []).map((q) => q.question_id));

  const { error: upsertError } = await supabase
    .from('question_bank')
    .upsert(normalized, { onConflict: 'question_id' });
  if (upsertError) throw upsertError;

  return {
    success: true,
    added: normalized.filter((q) => !existing.has(q.question_id)).length,
    updated: normalized.filter((q) => existing.has(q.question_id)).length,
    total: normalized.length,
  };
}

async function adminDeleteQuestion_(token, questionId) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;
  questionId = String(questionId || '').trim();
  if (!questionId) return { success: false, message: 'question_id wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('question_bank')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('question_id', questionId);
  if (error) throw error;
  return { success: true, message: 'Soal dinonaktifkan.' };
}

async function adminGetScoreLabels_(token, testType) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('score_table')
    .select('test_type, label, min_score, max_score, urutan, active')
    .order('urutan', { ascending: true });
  if (testType) query = query.eq('test_type', String(testType));
  const { data, error } = await query;
  if (error) throw error;
  return { success: true, labels: data || [] };
}

async function adminSaveScoreLabels_(token, testType, labels) {
  const auth = requireAdmin_(token);
  if (!auth.ok) return auth;
  const type = String(testType || '').trim().toLowerCase();
  if (!type || !Array.isArray(labels)) return { success: false, message: 'Data label tidak valid.' };

  const cleaned = labels.map((item, index) => {
    const min = Number(item.min_score);
    const max = Number(item.max_score);
    const label = String(item.label || '').trim();
    if (!label || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) {
      throw new Error(`Rentang label nomor ${index + 1} tidak valid.`);
    }
    return { test_type: type, label, min_score: min, max_score: max, urutan: index + 1, active: true };
  });

  const supabase = getSupabaseAdmin();
  const { error: deleteError } = await supabase.from('score_table').delete().eq('test_type', type);
  if (deleteError) throw deleteError;
  if (cleaned.length) {
    const { error: insertError } = await supabase.from('score_table').insert(cleaned);
    if (insertError) throw insertError;
  }
  return { success: true, message: 'Label nilai berhasil disimpan.' };
}

async function getQuestionPackage_(testType, packageNumber) {
  const type = String(testType || '').trim().toLowerCase();
  const pkg = Number(packageNumber) || 1;
  if (!type) return { success: false, message: 'test_type wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('question_bank')
    .select('question_id, test_type, package, no_soal, question, option_a, option_b, option_c, option_d, option_e, answer, discussion')
    .eq('test_type', type)
    .eq('package', pkg)
    .eq('active', true)
    .order('no_soal', { ascending: true });
  if (error) throw error;

  const questions = (data || []).map((row) => {
    const optionList = [row.option_a, row.option_b, row.option_c, row.option_d, row.option_e].filter((value) => String(value ?? '').trim() !== '');
    const answer = String(row.answer || '').toUpperCase();
    return {
      id: Number(row.no_soal) || 0,
      question_id: row.question_id,
      text: String(row.question || ''),
      question: String(row.question || ''),
      options: optionList,
      correct: Math.max(0, 'ABCDE'.indexOf(answer)),
      answer,
      discussion: String(row.discussion || ''),
    };
  });

  return { success: true, questions };
}

async function saveTestDetail_(payload) {
  const auth = requireSession_(payload.token);
  if (!auth.ok) return auth;
  if (!Array.isArray(payload.details) || !payload.details.length) return { success: true, saved: 0 };

  const testId = String(payload.test_id || '').trim();
  if (!testId) return { success: false, message: 'test_id wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { data: historyRows, error: historyError } = await supabase
    .from('test_history')
    .select('test_id, user_id')
    .eq('test_id', testId)
    .eq('user_id', auth.session.user_id)
    .limit(1);
  if (historyError) throw historyError;
  if (!historyRows?.length) return { success: false, message: 'Hasil tes tidak ditemukan untuk akun ini.' };

  const rows = payload.details.map((item) => ({
    test_id: testId,
    user_id: auth.session.user_id,
    test_type: String(item.test_type || ''),
    package: Number(item.package) || 1,
    no_soal: Number(item.no_soal) || 0,
    kolom: item.kolom == null || item.kolom === '' ? null : Number(item.kolom),
    no_soal_dalam_kolom: item.no_soal_dalam_kolom == null || item.no_soal_dalam_kolom === '' ? null : Number(item.no_soal_dalam_kolom),
    waktu_detik: Number(item.waktu_detik || 0),
    jawaban: item.jawaban == null ? null : String(item.jawaban),
    benar: Boolean(item.benar),
  }));

  const { data: existingRows, error: existingError } = await supabase
    .from('test_detail')
    .select('test_id, kolom, no_soal, user_id')
    .eq('test_id', testId)
    .eq('user_id', auth.session.user_id);
  if (existingError) throw existingError;

  const existingKeys = new Set((existingRows || []).map((row) => `${row.kolom ?? ''}|${row.no_soal}`));
  const newRows = rows.filter((row) => !existingKeys.has(`${row.kolom ?? ''}|${row.no_soal}`));
  if (newRows.length) {
    const { error: insertError } = await supabase.from('test_detail').insert(newRows);
    if (insertError) throw insertError;
  }

  return { success: true, saved: newRows.length };
}

async function getTestDetail_(payload) {
  const auth = requireSession_(payload.token);
  if (!auth.ok) return auth;
  const testId = String(payload.test_id || '').trim();
  if (!testId) return { success: false, message: 'test_id wajib diisi.' };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('test_detail')
    .select('test_id, user_id, test_type, package, no_soal, kolom, no_soal_dalam_kolom, waktu_detik, jawaban, benar')
    .eq('test_id', testId)
    .eq('user_id', auth.session.user_id)
    .order('kolom', { ascending: true, nullsFirst: true })
    .order('no_soal', { ascending: true });
  if (error) throw error;
  return { success: true, details: data || [] };
}

/* ============================================================
   PASSWORD RESET
   ============================================================
   CATATAN PENTING: implementasi di bawah menyimpan token reset di
   TABEL Supabase (bukan di memori server), supaya tetap berfungsi
   walau permintaan reset dan submit password baru ditangani oleh
   instance server Vercel yang berbeda (ini normal untuk serverless).
   Tabel yang dipakai: table_user kolom reset_token & reset_token_expires.
   Kalau kolom ini belum ada, tambahkan dulu di Supabase:
     alter table public.table_user
       add column if not exists reset_token text,
       add column if not exists reset_token_expires timestamptz;
*/

async function requestPasswordReset_(identifier, appUrl) {
  identifier = String(identifier || '').trim();

  const genericSuccess = {
    success: true,
    message: 'Kalau akun ditemukan, link reset sudah dikirim ke email terdaftar.'
  };

  if (!identifier) {
    return { success: false, message: 'Username atau email wajib diisi.' };
  }

  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from('table_user')
    .select('"user-id", username, email')
    .or(`username.ilike.${identifier},email.ilike.${identifier}`)
    .limit(1);

  if (error) throw error;

  const row = rows && rows[0];
  if (!row || !row.email) return genericSuccess;

  const token = generateRandomPassword(24) + generateRandomPassword(24);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

  const { error: updateError } = await supabase
    .from('table_user')
    .update({ reset_token: token, reset_token_expires: expiresAt })
    .eq('user-id', row['user-id']);

  if (updateError) throw updateError;

  const base = String(appUrl || '').trim() || 'https://my-psych-five.vercel.app/';
  const separator = base.indexOf('?') >= 0 ? '&' : '?';
  const resetUrl = base + separator + 'reset=' + encodeURIComponent(token);

  await sendResetPasswordEmail(row.email, row.username, resetUrl);

  return genericSuccess;
}

async function resetPassword_(token, newPassword) {
  token = String(token || '').trim();
  newPassword = String(newPassword || '');

  if (!token) {
    return { success: false, message: 'Token reset tidak valid.' };
  }
  if (newPassword.length < 8) {
    return { success: false, message: 'Password minimal 8 karakter.' };
  }

  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from('table_user')
    .select('"user-id", reset_token, reset_token_expires')
    .eq('reset_token', token)
    .limit(1);

  if (error) throw error;

  const row = rows && rows[0];

  if (!row || !row.reset_token_expires || new Date(row.reset_token_expires).getTime() < Date.now()) {
    return {
      success: false,
      message: 'Link reset sudah tidak berlaku atau sudah digunakan. Silakan minta link baru.'
    };
  }

  const newHash = await hashPassword(newPassword);

  const { error: updateError } = await supabase
    .from('table_user')
    .update({ password_hash: newHash, reset_token: null, reset_token_expires: null })
    .eq('user-id', row['user-id']);

  if (updateError) throw updateError;

  return { success: true, message: 'Password berhasil diganti. Silakan login menggunakan password baru.' };
}
