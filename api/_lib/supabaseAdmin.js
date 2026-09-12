const { createClient } = require('@supabase/supabase-js');

// SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY diambil dari Environment
// Variables di Vercel — TIDAK PERNAH ditulis langsung di kode ini.
// Service role key membypass semua Row Level Security, jadi wajib
// hanya dipakai di sini (server), tidak pernah dikirim ke browser.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client = null;

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Environment Variables Vercel.'
    );
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  }

  return client;
}

module.exports = { getSupabaseAdmin };
