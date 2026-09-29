'use strict';

// ============================================================
  // FINISH + SAVE HISTORY
  // ============================================================

  function buildTestDetailRows(result) {
    const testType = result.type;
    const packageNumber = result.package;
    const rows = [];

    if (testType === 'kraepelin') {
      for (let col = 0; col < CONFIG.KRAEPELIN_COLUMNS; col += 1) {
        for (let q = 0; q < CONFIG.KRAEPELIN_QUESTIONS; q += 1) {
          const answer = state.answers[col]?.[q] ?? null;
          const time = state.kraepelinQuestionTimes[col]?.[q] ?? '';
          const top = state.columns[col]?.[25 - q] ?? 0;
          const bottom = state.columns[col]?.[26 - q] ?? 0;
          const expected = (top + bottom) % 10;
          const answered = answer !== null;

          rows.push({
            test_id: state.currentTestId,
            test_type: testType,
            package: packageNumber,
            no_soal: col * CONFIG.KRAEPELIN_QUESTIONS + q + 1,
            kolom: col + 1,
            no_soal_dalam_kolom: q + 1,
            waktu_detik: time,
            jawaban: answered ? String(answer) : '',
            benar: answered && Number(answer) === expected,
          });
        }
      }

      return rows;
    }

    return state.questions.map((question, index) => {
      const answer = state.answers[index];
      const answered = answer !== null;

      return {
        test_id: state.currentTestId,
        test_type: testType,
        package: packageNumber,
        no_soal: index + 1,
        kolom: '',
        no_soal_dalam_kolom: '',
        waktu_detik: state.questionTimes[index] ?? '',
        jawaban: answered ? String.fromCharCode(65 + answer) : '',
        benar:
          answered &&
          answer === question.correct,
      };
    });
  }

  async function saveTestDetail(result) {
    if (
      state.isGuest ||
      !state.session?.token ||
      !result?.testId
    ) {
      return false;
    }

    const rows = buildTestDetailRows(result);

    if (!rows.length) {
      return true;
    }

    const chunkSize = 250;

    try {
      for (let start = 0; start < rows.length; start += chunkSize) {
        const chunk = rows.slice(start, start + chunkSize);

        await apiChecked('saveTestDetail', {
          token: state.session.token,
          test_id: result.testId,
          details: chunk,
        });
      }

      return true;
    } catch (error) {
      console.error('TestDetail gagal disimpan:', error);
      return false;
    }
  }

  async function loadTestDetail(testId) {
    if (!state.session?.token || !testId) {
      return [];
    }

    const response = await apiChecked('getTestDetail', {
      token: state.session.token,
      test_id: testId,
    });

    return Array.isArray(response.details)
      ? response.details
      : [];
  }

  function enrichHistoryResultWithDetail(result, details) {
    if (!Array.isArray(details) || !details.length) {
      return result;
    }

    const sorted = [...details].sort(
      (a, b) => Number(a.no_soal || 0) - Number(b.no_soal || 0)
    );

    if (result.type === 'kraepelin') {
      const counts = Array(CONFIG.KRAEPELIN_COLUMNS).fill(0);

      sorted.forEach((item) => {
        if (
          Number(item.kolom) >= 1 &&
          Number(item.kolom) <= CONFIG.KRAEPELIN_COLUMNS &&
          String(item.jawaban ?? '') !== ''
        ) {
          counts[Number(item.kolom) - 1] += 1;
        }
      });

      result.chart = counts;
      return result;
    }

       result.chart = sorted.map((item) => ({
      time: Number(item.waktu_detik || 0),
      correct: Boolean(item.benar),
      answered: String(item.jawaban ?? '') !== '',
    }));

    // Hitung ulang wrongNumbers dari detail
    const wrongNumbers = [];
    sorted.forEach((item, idx) => {
      if (!item.benar) {
        wrongNumbers.push(Number(item.no_soal) || idx + 1);
      }
    });
    result.wrongNumbers = wrongNumbers;

    return result;
  }

  async function saveHistory(result) {
    if (state.isGuest || !state.session?.token || state.savingHistory) return false;

    state.savingHistory = true;

    try {
      await apiChecked('saveHistory', {
        token: state.session.token,
        test_id: state.currentTestId,
        test_type: result.type,
        package: result.package,
        tanggal: new Date().toISOString(),
        score: result.score,
        correct: result.correct,
        wrong: result.wrong,
        total: result.total,
        speed: result.speed,
        accuracy: result.accuracy,
        consistency: result.consistency,
        endurance: result.endurance,
      });

      return true;
    } catch (error) {
      toast(`Hasil tampil, tetapi belum masuk spreadsheet: ${error.message}`, 'warning', 5000);
      return false;
    } finally {
      state.savingHistory = false;
    }
  }

  async function finishTest() {
    if (state.finished) return;

    state.finished = true;
    stopTimer();

    const result = TESTS[state.test].kind === 'kraepelin'
      ? calculateKraepelin()
      : calculateMCQ();

    result.testId = state.currentTestId || `T-${Date.now()}-${randomInt(100000)}`;
    result.tanggal = new Date().toISOString();
    state.lastResult = result;
    clearPersistedTest();

    trackEvent('test_finish', { type: state.test, package: state.package, score: result.score });

    renderResult(result);
    drawChart(result);
    showView('result');

    const historySaved = await saveHistory(result);

    if (!state.isGuest && historySaved) {
      const detailSaved = await saveTestDetail(result);

      if (!detailSaved) {
        toast(
          'Ringkasan tersimpan, tetapi detail per soal belum berhasil disimpan.',
          'warning',
          5000
        );
      }

      try {
        await refreshHistory();
        toast('Hasil tersimpan ke database.', 'success');
      } catch (error) {
        console.warn('Refresh histori gagal:', error);
      }
    }
  }
