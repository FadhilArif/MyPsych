'use strict';

/* Core runtime state, DOM references, and shared state. */
// ============================================================
  // PSYCHOTEST PRACTICE — PHASE 4
  // 
  // ============================================================

  const { CONFIG, SKD_COMPLETE_CONFIG, TESTS } = window.MyPsychConfig;
  const $ = (id) => document.getElementById(id);

const views = {
  landing: $('landingView'),
  auth: $('authView'),
  dashboard: $('dashboardView'),
  skd: $('skdView'),
  instruction: $('instructionView'),
  test: $('testView'),
  result: $('resultView'),
  history: $('historyView'),
  admin: $('adminView'),
  about: $('aboutView'),
  cv: $('cvView'),
  psikotes: $('psikotesView'),
};
  
  const state = {
    session: null,
    isGuest: false,
    history: [],
    test: null,
    package: 1,
    currentTestId: null,
    questions: [],
    answers: [],
    questionTimes: [],
    kraepelinQuestionTimes: [],
    index: 0,
    columns: [],
    colIndex: 0,
    qIndex: 0,
    timerId: null,
    questionStartedAt: 0,
    testStartedAt: 0,
    lastResult: null,
    returnView: 'dashboard',
    pendingProtectedView: null,
    finished: true,
    savingHistory: false,
    kraepelinSecondsChoice: 15,

    // State terpisah agar engine SKD Lengkap tidak mengganggu MCQ lama.
    skdComplete: {
      active: false,
      package: 1,
      sectionOrder: ['twk', 'tiu', 'tkp'],
      sectionIndex: 0,
      sections: {
        twk: null,
        tiu: null,
        tkp: null,
      },
      waiting: false,
      waitingUntil: 0,
      timerId: null,
    },
  };
