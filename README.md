# MyPsych — Latihan Psikotes Online

Aplikasi latihan psikotes berbasis web: Kraepelin, TIU/TWK/TKP (SKD),
kuantitatif, verbal, figural, plus CV builder. Menyediakan mode tamu
(tanpa akun) dan mode akun dengan histori hasil, export PDF, serta panel admin.

**Produksi:** https://my-psych-five.vercel.app

---

## Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | HTML + CSS + JavaScript klasik (tanpa framework, tanpa bundler) |
| Backend | Satu Vercel Serverless Function: `api/gateway.js` |
| Database | Supabase (Postgres), diakses via service-role key dari server |
| Rate limit | Upstash Redis (sliding window), fallback in-memory |
| Email | Google Apps Script Web App (reset password) |
| PDF | Generator PDF buatan sendiri di browser (tanpa library) |
| Hosting | Vercel (static + functions) |

Tidak ada proses build. `vercel.json` menyetel `outputDirectory: "."`,
jadi repo di-deploy apa adanya.

## Struktur

```
index.html                 # seluruh view SPA (landing, auth, dashboard, tes, admin, CV)
privasi.html / syarat.html # halaman legal
api/
  gateway.js               # satu-satunya endpoint API (RPC via `action`)
  _lib/auth.js             # bcrypt, JWT, helper token
  _lib/rateLimit.js        # Upstash + fallback in-memory
  _lib/supabaseAdmin.js    # Supabase client (service role, server-only)
  _lib/mailer.js           # kirim email via Apps Script
src/
  core/config.js           # konstanta tes + katalog (window.MyPsychConfig)
  core/runtime.js          # state global, referensi DOM
  bootstrap/app.js         # memuat semua modul berurutan
  bootstrap/events.js      # binding event
  bootstrap/init.js        # boot aplikasi
  services/api.js          # pemanggil /api/gateway
  services/session.js      # persist sesi di localStorage
  features/tests/          # engine, scoring, persistence, finish, SKD lengkap
  features/pdf/            # generator PDF hasil tes
  features/cv/             # CV builder (lokal, 24 jam)
  features/admin/          # panel admin
  features/results/        # tampilan hasil & histori
  ui/                      # navigasi, view, sidebar
  styles/                  # base.css, overrides.css, landing.css
soal_*.json, paket_*.json  # bank soal fallback untuk mode tamu
assets/logos/              # logo tes + aset figural (SVG)
docs/database-schema.md    # skema tabel Supabase (hasil pembacaan kode)
docs/migrations/           # SQL sekali-jalan (mis. metadata bank soal)
```

### Catatan penting soal modul

Frontend **bukan** ES module. `src/bootstrap/app.js` menyuntikkan 23
`<script>` secara berurutan (`async = false`), dan semua modul berbagi
scope global lewat `window`. Karena itu **urutan di `MODULES` bersifat
load-bearing** — modul yang memakai fungsi dari modul lain harus dimuat
setelahnya.

Semua path aset memakai absolute path (`/src/...`), jadi aplikasi harus
disajikan dari root domain. Membuka `index.html` langsung lewat `file://`
tidak akan bekerja.

## Menjalankan lokal

Hanya frontend (mode tamu berfungsi, API akan gagal):

```bash
npx serve .
# buka http://localhost:3000
```

Lengkap dengan serverless API (butuh environment variable di bawah):

```bash
npm install
npx vercel dev
```

## Environment variables

Diset di Project Settings → Environment Variables Vercel. **Jangan commit
nilai apa pun ke repo.**

| Variabel | Wajib | Dipakai untuk |
|---|---|---|
| `SUPABASE_URL` | ya | koneksi Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | akses DB dari server (bypass RLS) |
| `SESSION_SECRET` | ya | menandatangani JWT sesi (6 jam) |
| `APPSCRIPT_EMAIL_URL` | ya | endpoint Apps Script pengirim email |
| `APPSCRIPT_EMAIL_SECRET` | ya | shared secret ke Apps Script |
| `UPSTASH_REDIS_REST_URL` | tidak | rate limit terdistribusi |
| `UPSTASH_REDIS_REST_TOKEN` | tidak | rate limit terdistribusi |

Tanpa Upstash, rate limit turun ke in-memory per instance function
(kurang efektif di lingkungan serverless multi-instance).

## API

Satu endpoint: `POST /api/gateway` dengan body `{ "action": "...", ...payload }`.

`GET /api/gateway` mengembalikan status service.

| Kelompok | Action |
|---|---|
| Auth | `register`, `login`, `logout`, `requestPasswordReset`, `resetPassword` |
| Tes | `getQuestionPackage`, `checkAnswer`, `gradeTest`, `saveHistory`, `getHistory`, `saveTestDetail`, `getTestDetail` |
| Publik | `stats`, `trackPdfDownload`, `subscribeInterest` |
| Admin | `adminDashboard`, `adminGetUsers`, `adminCreateUser`, `adminResetUserPassword`, `adminDeleteUser`, `adminGetResults`, `adminGetQuestions`, `adminSaveQuestions`, `adminDeleteQuestion`, `adminDeleteQuestions`, `adminGetScoreLabels`, `adminSaveScoreLabels`, `adminGetInterests` |

Semua respons berstatus HTTP 200 dengan `{ success: boolean, message? }`.
Error tak terduga dicatat di log function, bukan dikirim ke client.

## Alur tes

1. Pilih tes → halaman instruksi → `startTest()`
2. Soal dimuat dari `question_bank` (akun login, termasuk Paket SKD) atau JSON statis (tamu)
3. Jawaban disimpan di memori + `localStorage` (`psychotest_active_v2`) agar bisa dilanjutkan
4. `finishTest()` → penilaian → `saveHistory` (ringkasan) + `saveTestDetail` (per soal)
5. Hasil dirender, PDF dibuat di browser, tracking download dicatat

Penilaian MCQ dilakukan **di server** untuk bank soal Supabase, sehingga
kunci jawaban tidak pernah dikirim ke client. Mode tamu memakai JSON lokal
yang memang berisi kunci jawaban (skor tamu tidak pernah disimpan).

## Paket SKD (TIU HOTS)

Area terpisah di menu SKD: 10 paket yang bisa dipilih (Paket 1–10), masing-masing
36 soal TIU dan 60 detik per soal. **Bank soal tidak lagi disimpan sebagai file
statis** — soal diunggah admin ke `question_bank` dengan `test_type = 'skd_paket'`.

- Sebelum upload pertama, jalankan
  `docs/migrations/add-question-bank-stimulus.sql` di Supabase SQL Editor.
  Migrasi ini menambah kolom `stimulus` (jsonb), `instruction`, dan `topic`.
- Buka **Admin → Bank Soal**, pilih tes **Paket SKD**, lalu upload file JSON
  paket (format `{ id_paket, nama_paket, soal: [...] }`). Ulangi untuk Paket 1–10.
- Upload bersifat idempoten: `question_id` dibentuk dari
  `skd_paket-<paket>-<nomor>`, jadi upload ulang memperbarui soal yang sama,
  bukan menduplikasi.
- `stimulus`, `instruction`, `topic` (dari `metadata.tipe`), dan `discussion`
  (dari `explanation`) ikut tersimpan sehingga tampilan dua kolom tetap jalan.
- Kunci jawaban tidak dikirim saat soal dimuat; penilaian tetap lewat server
  (`checkAnswer` / `gradeTest`).
- Jika bank untuk paket yang dipilih belum diunggah, peserta melihat pesan
  "Paket SKD <n> belum diunggah admin."
- Enam tipe soal, 6 soal per tipe: `deret_bilangan`, `kecukupan_data`,
  `bilangan_setara`, `penalaran_analitis`, `analisa_tabel`, `silogisme`.

## Test

```bash
npm install
npm test          # node --test
```

Test saat ini menutup helper murni di backend: escaping filter LIKE,
pemetaan kunci jawaban ke indeks opsi, penentuan base URL link reset, dan
validasi input auth. Test tidak menyentuh Supabase.

## Keamanan

- **Kunci jawaban tidak ikut saat soal dimuat.** `getQuestionPackage`
  mengirim soal tanpa `answer`/`discussion`. Kunci hanya keluar lewat
  `checkAnswer` (satu soal, untuk umpan balik) dan `gradeTest` (setelah
  tes selesai).
- **Umpan balik instan masih bisa dijadikan oracle.** Karena UI menandai
  jawaban benar/salah segera setelah menjawab, kunci satu soal bisa
  diperoleh satu per satu. Menutup celah ini sepenuhnya berarti
  menghilangkan umpan balik instan — itu keputusan produk, belum diubah.
- **Skor tetap dikirim client** ke `saveHistory`. Angka yang dikirim masih
  bisa dipalsukan oleh pemilik akun sendiri; memindahkan seluruh
  perhitungan metrik (speed/accuracy/consistency/endurance) ke server
  adalah pekerjaan lanjutan.
- Origin link reset tidak lagi diambil dari input client (mencegah
  reset-link poisoning). Set `APP_BASE_URL` bila domain berubah.
- Ganti password (mandiri maupun oleh admin) me-revoke semua sesi lama
  lewat tabel `revoked_tokens`.

## Admin

Role admin tidak bisa dibuat dari UI. Set manual di Supabase:

```sql
update table_user set role = 'admin' where username = 'nama_admin';
```

Setiap aksi admin dicatat ke `admin_audit_log`.

## Database

Lihat [`docs/database-schema.md`](docs/database-schema.md). Skema tidak
dikelola lewat migration tool — perubahan dilakukan langsung di Supabase.

## Konvensi commit

Conventional Commits, contoh:

```
feat(admin): add bulk question selection and disable
fix(auth): route admin to admin dashboard after login
style(cv): add smart job search UI
```
