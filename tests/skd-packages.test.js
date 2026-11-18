'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'skd');
const PACKAGE_COUNT = 10;
const QUESTIONS_PER_PACKAGE = 36;
const TYPES = {
  deret_bilangan: 'none',
  kecukupan_data: 'none',
  bilangan_setara: 'konteks',
  penalaran_analitis: 'wacana',
  analisa_tabel: 'tabel',
  silogisme: 'none',
};

function readPackage(number) {
  const file = path.join(DATA_DIR, `paket_${number}.json`);
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

const packages = Array.from({ length: PACKAGE_COUNT }, (_, index) => readPackage(index + 1));

test('semua paket SKD tersedia dengan 36 soal', () => {
  packages.forEach(({ file, data }, index) => {
    assert.equal(data.id_paket, index + 1, `${path.basename(file)}: id_paket salah`);
    assert.equal(data.soal_per_paket, QUESTIONS_PER_PACKAGE, `${path.basename(file)}: soal_per_paket salah`);
    assert.ok(Array.isArray(data.soal), `${path.basename(file)}: soal bukan array`);
    assert.equal(data.soal.length, QUESTIONS_PER_PACKAGE, `${path.basename(file)}: jumlah soal salah`);
    assert.match(String(data.kategori || ''), /TIU/i, `${path.basename(file)}: kategori harus TIU`);
  });
});

test('setiap soal punya teks, opsi, kunci valid, dan pembahasan', () => {
  packages.forEach(({ file, data }) => {
    data.soal.forEach((soal, index) => {
      const label = `${path.basename(file)} soal ${index + 1}`;

      assert.equal(soal.category, 'tiu', `${label}: category bukan tiu`);
      assert.equal(typeof soal.question, 'string', `${label}: question tidak ada`);
      assert.ok(soal.question.trim().length > 0, `${label}: question kosong`);
      assert.equal(soal.question_image, null, `${label}: question_image belum didukung UI`);
      assert.equal(typeof soal.explanation, 'string', `${label}: explanation tidak ada`);
      assert.ok(soal.explanation.trim().length > 0, `${label}: explanation kosong`);

      const letters = Object.keys(soal.options || {});
      assert.ok(letters.length >= 4, `${label}: opsi kurang dari 4`);
      assert.ok(letters.includes(soal.answer), `${label}: kunci ${soal.answer} tidak ada di opsi`);
      letters.forEach((letter) => {
        assert.ok(
          String(soal.options[letter] ?? '').trim().length > 0,
          `${label}: opsi ${letter} kosong`
        );
      });
    });
  });
});

test('komposisi tipe soal konsisten dan stimulus ada di tipe yang tepat', () => {
  packages.forEach(({ file, data }) => {
    const counts = {};

    data.soal.forEach((soal, index) => {
      const label = `${path.basename(file)} soal ${index + 1}`;
      assert.ok(TYPES[soal.type], `${label}: tipe tidak dikenal (${soal.type})`);
      counts[soal.type] = (counts[soal.type] || 0) + 1;

      const expectedStimulus = TYPES[soal.type];
      if (expectedStimulus === 'none') {
        assert.equal(soal.stimulus, undefined, `${label}: tidak seharusnya punya stimulus`);
        return;
      }

      assert.ok(soal.stimulus, `${label}: stimulus wajib ada untuk ${soal.type}`);
      assert.equal(typeof soal.stimulus[expectedStimulus], 'string', `${label}: stimulus.${expectedStimulus} hilang`);
      assert.ok(soal.stimulus[expectedStimulus].trim().length > 0, `${label}: stimulus.${expectedStimulus} kosong`);
    });

    Object.keys(TYPES).forEach((type) => {
      assert.equal(counts[type], 6, `${path.basename(file)}: ${type} harus 6 soal`);
    });
  });
});

test('question_id unik di seluruh paket', () => {
  const seen = new Set();

  packages.forEach(({ file, data }) => {
    data.soal.forEach((soal) => {
      assert.ok(soal.question_id, `${path.basename(file)}: question_id kosong`);
      assert.equal(seen.has(soal.question_id), false, `question_id duplikat: ${soal.question_id}`);
      seen.add(soal.question_id);
    });
  });

  assert.equal(seen.size, PACKAGE_COUNT * QUESTIONS_PER_PACKAGE);
});
