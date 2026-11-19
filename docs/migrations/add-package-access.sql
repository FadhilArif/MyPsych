-- ============================================================
-- Migrasi: akses paket berbayar per user
-- Jalankan sekali di Supabase SQL Editor sebelum memakai fitur
-- kunci/buka paket SKD di panel admin.
-- ============================================================

create table if not exists test_package_access (
  user_id     text not null,
  test_type   text not null default 'skd_paket',
  package     integer not null check (package > 0),
  unlocked_at timestamptz not null default now(),
  unlocked_by text default '',
  note        text default '',
  primary key (user_id, test_type, package)
);

create index if not exists test_package_access_user_idx
  on test_package_access (user_id, test_type);

-- Satu baris = satu paket yang sudah dibuka admin untuk satu user.
-- Paket yang tidak punya baris di sini dianggap terkunci.
