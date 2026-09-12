/**
 * mailer.js — MyPsych
 * Mengirim email lewat Google Apps Script Web App (Gmail),
 * bukan lagi lewat Resend.
 *
 * Env vars yang dipakai:
 *   APPSCRIPT_EMAIL_URL     — URL Web App (…/exec)
 *   APPSCRIPT_EMAIL_SECRET  — sama dengan Script Property INTERNAL_SECRET
 */

const APPSCRIPT_EMAIL_URL = process.env.script.google.com/macros/s/AKfycbyy2D1lAYlZcoyO0-sdJNepJ5XSpyHtLW8NiNLxzOg-pz7v6jtr2FHFt-x6l7oYhK6l/exec;
const APPSCRIPT_EMAIL_SECRET = process.env.cqd6R08BcIq12UeKoJ4TI4dFzVB3J655VMJx5ait066P;
const APPSCRIPT_TIMEOUT_MS = 15000;

async function sendViaAppsScript_(payload) {
  if (!APPSCRIPT_EMAIL_URL) {
    throw new Error('APPSCRIPT_EMAIL_URL belum diset di Environment Variables Vercel.');
  }
  if (!APPSCRIPT_EMAIL_SECRET) {
    throw new Error('APPSCRIPT_EMAIL_SECRET belum diset di Environment Variables Vercel.');
  }

  const body = JSON.stringify({
    secret: APPSCRIPT_EMAIL_SECRET,
    ...payload
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPSCRIPT_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(APPSCRIPT_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      redirect: 'follow',
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Apps Script tidak merespons dalam ' + (APPSCRIPT_TIMEOUT_MS / 1000) + ' detik.');
    }
    throw new Error('Gagal menghubungi Apps Script: ' + (error.message || error));
  } finally {
    clearTimeout(timer);
  }

  let result;
  try {
    result = await response.json();
  } catch (_) {
    throw new Error('Respons Apps Script tidak valid (HTTP ' + response.status + ').');
  }

  if (!result || !result.success) {
    throw new Error((result && result.message) || 'Apps Script gagal mengirim email.');
  }

  return result;
}

async function sendResetPasswordEmail(email, username, resetUrl) {
  return sendViaAppsScript_({
    kind: 'reset',
    to: email,
    username,
    resetUrl
  });
}

async function sendNewPasswordEmail(email, username, newPassword) {
  return sendViaAppsScript_({
    kind: 'new-password',
    to: email,
    username,
    newPassword
  });
}

module.exports = { sendResetPasswordEmail, sendNewPasswordEmail };
