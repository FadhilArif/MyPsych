-- ============================================================
-- Migrasi: metadata stimulus untuk bank soal (SKD Lengkap)
-- Jalankan sekali di Supabase SQL Editor sebelum mengunggah paket
-- SKD lewat panel admin (Bank Soal).
-- ============================================================

alter table if exists question_bank
  add column if not exists stimulus jsonb,
  add column if not exists instruction text default '',
  add column if not exists topic text default '';

-- stimulus  : { "tabel": "..." } | { "wacana": "..." } | { "konteks": "..." }
-- instruction: instruksi singkat di atas pertanyaan
-- topic     : label tipe soal, mis. "Analisa Tabel"
