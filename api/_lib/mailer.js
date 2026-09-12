const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Alamat pengirim. Kalau belum verifikasi domain sendiri di Resend,
// pakai 'onboarding@resend.dev' dulu (bawaan Resend, langsung jalan
// tanpa setup DNS, cukup untuk tahap awal/testing).
const MAIL_FROM = process.env.MAIL_FROM || 'MyPsych <onboarding@resend.dev>';
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO || '';

function getResend_() {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY belum diset di Environment Variables Vercel.');
  }
  return new Resend(RESEND_API_KEY);
}

async function sendResetPasswordEmail(email, username, resetUrl) {
  const resend = getResend_();

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#18263b;">
      <h2 style="margin:0 0 16px;">Reset Password</h2>
      <p>Halo <b>${escapeHtml_(username)}</b>,</p>
      <p>Kami menerima permintaan reset password untuk akunmu di <b>Psychotest Practice</b>. Klik tombol di bawah untuk membuat password baru (berlaku 30 menit):</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${escapeHtml_(resetUrl)}" style="background:#2f7df2;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block;">
          Reset Password Saya
        </a>
      </p>
      <p style="color:#728196;font-size:13px;">Kalau tombolnya tidak bisa diklik, salin tautan ini ke browser: ${escapeHtml_(resetUrl)}</p>
      <p>Kalau kamu tidak meminta ini, abaikan saja email ini — password lamamu tetap aman.</p>
      <p>Salam,<br>Psychotest Practice</p>
    </div>
  `;

  const payload = {
    from: MAIL_FROM,
    to: [email],
    subject: 'Reset Password — MyPsych',
    html,
    text: `Halo ${username},\n\nKami menerima permintaan reset password untuk akunmu di MyPsych. Buka tautan berikut untuk membuat password baru (berlaku 30 menit):\n${resetUrl}\n\nKalau kamu tidak meminta reset password, abaikan email ini.`
  };

  if (MAIL_REPLY_TO) payload.replyTo = MAIL_REPLY_TO;

  const { error, data } = await resend.emails.send(payload);
  if (error) {
    const err = new Error(error.message || 'Resend gagal mengirim email.');
    err.statusCode = error.statusCode || 500;
    err.name = error.name || 'ResendError';
    throw err;
  }
  return data;
}

async function sendNewPasswordEmail(email, username, newPassword) {
  const resend = getResend_();

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#18263b;">
      <h2 style="margin:0 0 16px;">Password Baru</h2>
      <p>Halo <b>${escapeHtml_(username)}</b>,</p>
      <p>Admin telah mereset password akunmu di <b>Psychotest Practice</b>. Ini password barumu:</p>
      <p style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;background:#eff6ff;border-radius:8px;padding:12px 24px;font-size:20px;font-weight:bold;letter-spacing:1px;color:#2563eb;">
          ${escapeHtml_(newPassword)}
        </span>
      </p>
      <p>Silakan login dengan password ini, lalu segera ganti lagi kalau tersedia menu ganti password.</p>
      <p>Salam,<br>Psychotest Practice</p>
    </div>
  `;

  const payload = {
    from: MAIL_FROM,
    to: [email],
    subject: 'Password Baru — MyPsych',
    html,
    text: `Halo ${username},\n\nAdmin telah mereset password akunmu di MyPsych. Password baru: ${newPassword}\n\nSilakan login menggunakan password ini.`
  };

  if (MAIL_REPLY_TO) payload.replyTo = MAIL_REPLY_TO;

  const { error, data } = await resend.emails.send(payload);
  if (error) {
    const err = new Error(error.message || 'Resend gagal mengirim email.');
    err.statusCode = error.statusCode || 500;
    err.name = error.name || 'ResendError';
    throw err;
  }
  return data;
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendResetPasswordEmail, sendNewPasswordEmail };
