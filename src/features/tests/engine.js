'use strict';

// ============================================================
  // TEST ENGINE
  // ============================================================

  // Bank soal MCQ disimpan sebagai file JSON di root GitHub Pages.
  const QUESTION_FILES = Object.freeze({
    kuantitatif: './soal_kuantitatif.json',
    numerical: './soal_numerical.json',
    sinonim: './soal_sinonim.json',
    silogisme: './soal_silogisme.json',
    analogi: './soal_analogi.json',
    kognitif: './soal_kognitif.json',
    twk: './soal_twk.json',
    tiu: './soal_tiu.json',
    tkp: './soal_tkp.json',
  });

  async function loadQuestionPackage(testId, packageNumber) {
    // Akun peserta terdaftar memprioritaskan bank soal di supabase.
    // Kalau bank belum dimigrasikan, fallback tetap menggunakan JSON GitHub lama.
    if (state.session?.token && !state.isGuest) {
      try {
        const backend = await apiChecked('getQuestionPackage', {
          test_type: testId,
          package: packageNumber,
        });
        if (Array.isArray(backend.questions) && backend.questions.length) {
          return backend.questions.map((item, index) => {
            const optionEntries = Object.entries(item.options || {});
            const correctIndex = optionEntries.findIndex(([letter]) => String(letter).toUpperCase() === String(item.answer || '').toUpperCase());
            if (correctIndex < 0) throw new Error(`Jawaban soal nomor ${item.id ?? index + 1} tidak valid di QuestionBank.`);
            return { id:item.id ?? index + 1, text:String(item.question ?? ''), options:optionEntries.map(([,value])=>String(value)), correct:correctIndex, discussion:String(item.discussion ?? '') };
          });
        }
      } catch (error) {
        console.warn('Bank soal Sheet belum siap, fallback ke JSON:', error);
      }
    }

    const filePath = QUESTION_FILES[testId];

    // Featured UI V2 membawa satu bank SKD gabungan sebagai fallback guest.
    // Ini menjaga TWK/TIU/TKP tetap bisa diuji tanpa mengubah Supabase.
    if (!filePath && ['twk', 'tiu', 'tkp'].includes(testId)) {
      return loadSKDJsonFallback_(testId, packageNumber);
    }

    if (!filePath) {
      throw new Error(
        `Bank soal untuk tes "${testId}" belum tersedia.`
      );
    }

    let response = await fetch(filePath, {
      cache: 'no-cache',
    });

    if (!response.ok) {
      if (['twk', 'tiu', 'tkp'].includes(testId)) {
        return loadSKDJsonFallback_(testId, packageNumber);
      }
      throw new Error(
        `Gagal memuat ${filePath}. HTTP ${response.status}.`
      );
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.paket)) {
      throw new Error(
        `Format ${filePath} tidak valid.`
      );
    }

    const selectedPackage = data.paket.find(
      (item) => Number(item.id_paket) === Number(packageNumber)
    );

    if (!selectedPackage) {
      throw new Error(
        `Paket ${packageNumber} untuk ${TESTS[testId].name} tidak ditemukan.`
      );
    }

    if (
      !Array.isArray(selectedPackage.soal) ||
      selectedPackage.soal.length !== CONFIG.MCQ_QUESTIONS
    ) {
      throw new Error(
        `${TESTS[testId].name} Paket ${packageNumber} harus berisi ${CONFIG.MCQ_QUESTIONS} soal.`
      );
    }

    return selectedPackage.soal.map((item, index) => {
      if (!item || !item.options || !item.answer) {
        throw new Error(
          `Data soal nomor ${item?.id ?? index + 1} pada ${filePath} tidak lengkap.`
        );
      }

      const optionEntries = Object.entries(item.options);

      const correctIndex = optionEntries.findIndex(
        ([letter]) =>
          String(letter).toUpperCase() ===
          String(item.answer).trim().toUpperCase()
      );

      if (correctIndex === -1) {
        throw new Error(
          `Jawaban soal nomor ${item.id ?? index + 1} pada ${filePath} tidak valid.`
        );
      }

      return {
        id: item.id ?? index + 1,
        text: String(item.question ?? ''),
        options: optionEntries.map(([, value]) => String(value)),
        correct: correctIndex,
        discussion: String(item.discussion ?? ''),
      };
    });
  }
async function loadKuantitatifPackage(packageNumber) {
  const response = await fetch('./soal_kuantitatif.json', {
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error(
      `File soal kuantitatif gagal dimuat. HTTP ${response.status}.`
    );
  }

  const data = await response.json();

  if (
    !data ||
    !Array.isArray(data.paket)
  ) {
    throw new Error(
      'Format soal_kuantitatif.json tidak valid.'
    );
  }

  const selectedPackage = data.paket.find(
    (item) =>
      Number(item.id_paket) === Number(packageNumber)
  );

  if (!selectedPackage) {
    throw new Error(
      `Paket Kuantitatif ${packageNumber} tidak ditemukan.`
    );
  }

  if (
    !Array.isArray(selectedPackage.soal) ||
    selectedPackage.soal.length !== CONFIG.MCQ_QUESTIONS
  ) {
    throw new Error(
      `Paket ${packageNumber} harus memiliki ${CONFIG.MCQ_QUESTIONS} soal.`
    );
  }

  state.questions = selectedPackage.soal.map((item) => {
    const optionEntries = Object.entries(item.options);

    const correctIndex = optionEntries.findIndex(
      ([letter]) =>
        letter.toUpperCase() === String(item.answer).toUpperCase()
    );

    if (correctIndex === -1) {
      throw new Error(
        `Jawaban soal nomor ${item.id} tidak valid.`
      );
    }

    return {
      id: item.id,
      text: item.question,
      options: optionEntries.map(([, text]) => text),
      correct: correctIndex,
      discussion: item.discussion || '',
    };
  });

  return state.questions;
}
  async function startTest() {
  if (!state.test || !TESTS[state.test]) {
    return;
  }
trackEvent('test_start', { type: state.test, package: state.package });
  const button = $('startTestBtn');

  stopTimer();

  state.finished = false;
  state.lastResult = null;
  state.currentTestId = `T-${Date.now()}-${randomInt(100000)}`;
  state.testStartedAt = Date.now();

  busy(button, 'Memuat soal…', true);

  try {
    if (TESTS[state.test].kind === 'skd_complete') {
      await startSKDComplete(state.package);
    } else if (TESTS[state.test].kind === 'kraepelin') {
      startKraepelin();
    } else {
      await startMCQ();
    }

    persistTest();
  } catch (error) {
    state.finished = true;
    state.lastResult = null;

    showView('instruction');

    toast(
      error.message || 'Soal gagal dimuat.',
      'warning',
      5000
    );
  } finally {
    busy(button, '', false);
  }
}
