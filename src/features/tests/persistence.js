'use strict';

// ============================================================
  // PERSIST ACTIVE TEST
  // ============================================================

  function persistTest() {
    if (state.test === 'skd_lengkap') {
      persistSKDComplete_();
      return;
    }

    if (state.finished || state.isGuest || !state.session) return;

    try {
      localStorage.setItem(
        CONFIG.TEST_KEY,
        JSON.stringify({
          version: 2,
          userId: state.session.user_id,
          test: state.test,
          package: state.package,
          returnView: state.returnView || 'dashboard',
          currentTestId: state.currentTestId,
          questions: state.questions,
          answers: state.answers,
          questionTimes: state.questionTimes,
          kraepelinQuestionTimes: state.kraepelinQuestionTimes,
          index: state.index,
          columns: state.columns,
          colIndex: state.colIndex,
          qIndex: state.qIndex,
          questionStartedAt: state.questionStartedAt,
          testStartedAt: state.testStartedAt,
          kraepelinSecondsChoice: state.kraepelinSecondsChoice,
        }),
      );
    } catch (error) {
      console.warn('Progress tes tidak tersimpan:', error);
    }
  }

  function clearPersistedTest() {
    localStorage.removeItem(CONFIG.TEST_KEY);
    clearPersistedSKDComplete_();
  }

  function loadPersistedTest() {
    if (!state.session) return null;

    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.TEST_KEY) || 'null');
      if (!saved || saved.userId !== state.session.user_id || !saved.test) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function resumePersistedTest() {
    const skdSaved = loadPersistedSKDComplete_();
    if (skdSaved) {
      resumePersistedSKDComplete_();
      return;
    }

    const saved = loadPersistedTest();
    if (!saved) {
      toast('Tidak ada progress tes yang bisa dilanjutkan.', 'warning');
      return;
    }

    state.test = saved.test;
    state.package = Number(saved.package) || 1;
    state.returnView = saved.returnView || (saved.test === 'skd_lengkap' ? 'skd' : 'dashboard');
    state.currentTestId = saved.currentTestId || `T-${Date.now()}-${randomInt(100000)}`;
    state.questions = Array.isArray(saved.questions) ? saved.questions : [];
    state.answers = Array.isArray(saved.answers) ? saved.answers : [];
    state.questionTimes = Array.isArray(saved.questionTimes)
      ? saved.questionTimes
      : Array(state.questions.length).fill(null);
    state.kraepelinQuestionTimes = Array.isArray(saved.kraepelinQuestionTimes)
      ? saved.kraepelinQuestionTimes
      : Array.from(
          { length: CONFIG.KRAEPELIN_COLUMNS },
          () => Array(CONFIG.KRAEPELIN_QUESTIONS).fill(null),
        );
    state.index = Number(saved.index) || 0;
    state.columns = Array.isArray(saved.columns) ? saved.columns : [];
    state.colIndex = Number(saved.colIndex) || 0;
    state.qIndex = Number(saved.qIndex) || 0;
    state.testStartedAt = Number(saved.testStartedAt) || Date.now();
    state.kraepelinSecondsChoice = Number(saved.kraepelinSecondsChoice) || 15;
    state.finished = false;

    if (TESTS[state.test]?.kind === 'kraepelin') {
      renderKraepelin();
      showView('test');
      state.questionStartedAt = Date.now();
      startColumnTimer();
    } else {
      renderMCQ();
      showView('test');
      state.questionStartedAt = Date.now();
      startQuestionTimer();
    }

    toast('Progress tes dipulihkan.', 'success');
  }
