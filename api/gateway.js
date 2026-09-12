const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');
const {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  isValidUsername,
  isValidEmail,
  nextUserId,
  generateRandomPassword
} = require('./_lib/auth');
const { sendResetPasswordEmail, sendNewPasswordEmail } = require('./_lib/mailer');

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
