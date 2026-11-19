'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const gateway = require('../api/gateway');
const auth = require('../api/_lib/auth');

const { escapeLike_, resolveQuestionKey_, resolveResetBase_, isMissingQuestionMetaColumn_, hasQuestionMeta_, QUESTION_BANK_COLUMNS_BASE, QUESTION_BANK_COLUMNS_WITH_META } = gateway.__internals;

test('escapeLike_ menetralkan wildcard LIKE', () => {
  assert.equal(escapeLike_('fadhil'), 'fadhil');
  assert.equal(escapeLike_('user_name'), 'user\\_name');
  assert.equal(escapeLike_('100%'), '100\\%');
  assert.equal(escapeLike_('a\\b'), 'a\\\\b');
  // karakter PostgREST yang dipakai untuk memecah filter
  assert.equal(escapeLike_('x,email.ilike.y'), 'x,email.ilike.y');
});

test('resolveQuestionKey_ memetakan huruf jawaban ke indeks opsi', () => {
  const full = { option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', option_e: 'e', answer: 'C' };
  assert.equal(resolveQuestionKey_(full).expected, 2);

  // Opsi yang kosong tidak boleh menggeser indeks
  const sparse = { option_a: 'a', option_b: '', option_c: 'c', option_d: '', option_e: '', answer: 'C' };
  assert.equal(resolveQuestionKey_(sparse).expected, 1);

  // Kunci tidak valid → null, bukan indeks ngawur
  assert.equal(resolveQuestionKey_({ option_a: 'a', answer: 'Z' }), null);
  assert.equal(resolveQuestionKey_({ option_a: 'a' }), null);

  const withDiscussion = { option_a: 'a', option_b: 'b', answer: 'B', discussion: 'karena B' };
  assert.equal(resolveQuestionKey_(withDiscussion).discussion, 'karena B');
});

test('deteksi kolom metadata bank soal yang belum dimigrasi', () => {
  assert.equal(isMissingQuestionMetaColumn_({ code: '42703' }), true);
  assert.equal(isMissingQuestionMetaColumn_({
    code: 'PGRST204',
    message: "Could not find the 'stimulus' column of 'question_bank' in the schema cache"
  }), true);

  assert.equal(isMissingQuestionMetaColumn_({ code: '23505', message: 'duplicate key value' }), false);
  assert.equal(isMissingQuestionMetaColumn_({ code: '42501', message: 'permission denied for table question_bank' }), false);
  assert.equal(isMissingQuestionMetaColumn_(null), false);
});

test('hasQuestionMeta_ hanya menandai soal yang punya metadata', () => {
  assert.equal(hasQuestionMeta_({ stimulus: null, instruction: '', topic: '' }), false);
  assert.equal(hasQuestionMeta_({ stimulus: {}, instruction: '   ', topic: '' }), false);
  assert.equal(hasQuestionMeta_({ instruction: 'Tentukan pola berikutnya.' }), true);
  assert.equal(hasQuestionMeta_({ topic: 'Analisa Tabel' }), true);
  assert.equal(hasQuestionMeta_({ stimulus: { tabel: 'a | b' } }), true);
});

test('kolom bank soal mencakup field yang dipakai UI dan edit admin', () => {
  const required = [
    'question_id', 'test_type', 'package', 'no_soal', 'question',
    'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
    'answer', 'discussion', 'active'
  ];

  [QUESTION_BANK_COLUMNS_BASE, QUESTION_BANK_COLUMNS_WITH_META].forEach((columns) => {
    const fields = columns.split(',').map((field) => field.trim());
    required.forEach((field) => assert.ok(fields.includes(field), `kolom ${field} hilang`));
  });

  assert.ok(QUESTION_BANK_COLUMNS_WITH_META.split(',').map((f) => f.trim()).includes('stimulus'));
  assert.ok(QUESTION_BANK_COLUMNS_WITH_META.split(',').map((f) => f.trim()).includes('instruction'));
  assert.ok(QUESTION_BANK_COLUMNS_WITH_META.split(',').map((f) => f.trim()).includes('topic'));
});

test('resolveResetBase_ mengabaikan origin dari client', () => {
  const req = { headers: { host: 'my-psych-five.vercel.app', 'x-forwarded-proto': 'https' } };

  // Upaya reset-link poisoning
  assert.equal(
    resolveResetBase_(req, 'https://evil.example/phish'),
    'https://my-psych-five.vercel.app/phish'
  );

  // Pathname sah tetap dipertahankan
  assert.equal(
    resolveResetBase_(req, 'https://my-psych-five.vercel.app/index.html'),
    'https://my-psych-five.vercel.app/index.html'
  );

  // Input aneh tetap jatuh ke root
  assert.equal(resolveResetBase_(req, 'javascript:alert(1)'), 'https://my-psych-five.vercel.app/');
  assert.equal(resolveResetBase_(req, ''), 'https://my-psych-five.vercel.app/');
});

test('resolveResetBase_ memakai host request hanya kalau diizinkan', () => {
  const vercelReq = { headers: { host: 'preview-abc.vercel.app', 'x-forwarded-proto': 'https' } };
  assert.equal(resolveResetBase_(vercelReq, '/'), 'https://preview-abc.vercel.app/');

  const evilReq = { headers: { host: 'evil.example', 'x-forwarded-proto': 'https' } };
  assert.equal(resolveResetBase_(evilReq, '/'), 'https://my-psych-five.vercel.app/');
});

test('nextUserId melanjutkan urutan ID', () => {
  assert.equal(auth.nextUserId([]), 'U00001');
  assert.equal(auth.nextUserId(['U00001', 'U00007']), 'U00008');
  assert.equal(auth.nextUserId(['bukan-id']), 'U00001');
});

test('validasi input auth', () => {
  assert.equal(auth.isValidUsername('fadhil_123'), true);
  assert.equal(auth.isValidUsername('ab'), false);
  assert.equal(auth.isValidUsername('nama dengan spasi'), false);
  assert.equal(auth.isValidEmail('a@b.co'), true);
  assert.equal(auth.isValidEmail('bukan-email'), false);
});
