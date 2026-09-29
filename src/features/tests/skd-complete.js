'use strict';

// ============================================================
  // SKD PAKET LENGKAP — ENGINE
  // ============================================================

  function createSKDSectionState_(type, questions) {
    return {
      type,
      questions: Array.isArray(questions) ? questions : [],
      answers: Array.isArray(questions)
        ? Array(questions.length).fill(null)
        : [],
      questionTimes: Array.isArray(questions)
        ? Array(questions.length).fill(null)
        : [],
      currentIndex: 0,
      startedAt: 0,
      questionStartedAt: 0,
      deadline: 0,
      finished: false,
      forcedFinish: false,
    };
  }

  async function loadSKDCompleteQuestions_(packageNumber) {
    const output = {};

    for (const type of ['twk', 'tiu', 'tkp']) {
      const questions = await loadQuestionPackage(type, packageNumber);

      if (!Array.isArray(questions) || questions.length < SKD_COMPLETE_CONFIG.sections[type].questions) {
        throw new Error(
          `${SKD_COMPLETE_CONFIG.sections[type].name} Paket ${packageNumber} harus memiliki ${SKD_COMPLETE_CONFIG.sections[type].questions} soal aktif.`
        );
      }

      // Hanya ambil 20 soal pertama sesuai kontrak bank soal SKD saat ini.
      output[type] = questions.slice(0, SKD_COMPLETE_CONFIG.sections[type].questions);
    }

    return output;
  }

  async function startSKDComplete(packageNumber) {
    stopSKDCompleteTimer_();

    const questions = await loadSKDCompleteQuestions_(packageNumber);

    state.skdComplete.active = true;
    $('testView')?.classList.add('skd-complete-mode');
    state.skdComplete.package = Number(packageNumber) || 1;
    state.skdComplete.sectionIndex = 0;
    state.skdComplete.waiting = false;
    state.skdComplete.waitingUntil = 0;

    state.skdComplete.sections.twk = createSKDSectionState_('twk', questions.twk);
    state.skdComplete.sections.tiu = createSKDSectionState_('tiu', questions.tiu);
    state.skdComplete.sections.tkp = createSKDSectionState_('tkp', questions.tkp);

    persistSKDComplete_();
    startSKDSection_('twk');
  }

  function getActiveSKDSection_() {
    const type = state.skdComplete.sectionOrder[state.skdComplete.sectionIndex];
    return state.skdComplete.sections[type] || null;
  }

  function getActiveSKDType_() {
    return state.skdComplete.sectionOrder[state.skdComplete.sectionIndex] || null;
  }

  function startSKDSection_(type) {
    const section = state.skdComplete.sections[type];
    if (!section) return;

    stopSKDCompleteTimer_();

    state.skdComplete.active = true;
    state.skdComplete.waiting = false;
    state.skdComplete.sectionIndex = state.skdComplete.sectionOrder.indexOf(type);

    section.startedAt = Date.now();
    section.questionStartedAt = section.startedAt;
    section.deadline =
      section.startedAt +
      SKD_COMPLETE_CONFIG.sections[type].minutes * 60 * 1000;
    section.finished = false;
    section.forcedFinish = false;

    renderSKDComplete_();
    showView('test');
    startSKDSectionTimer_();
    persistSKDComplete_();
  }

  function startSKDSectionTimer_() {
    stopSKDCompleteTimer_();

    state.skdComplete.timerId = setInterval(() => {
      const section = getActiveSKDSection_();
      if (!section || section.finished) {
        stopSKDCompleteTimer_();
        return;
      }

      const remaining = Math.max(
        0,
        Math.ceil((section.deadline - Date.now()) / 1000)
      );

      updateSKDTimerDisplay_(remaining);

      if (remaining <= 0) {
        stopSKDCompleteTimer_();
        finishSKDSection_(true);
      }
    }, 250);

    const section = getActiveSKDSection_();
    if (section) {
      updateSKDTimerDisplay_(Math.max(0, Math.ceil((section.deadline - Date.now()) / 1000)));
    }
  }

  function stopSKDCompleteTimer_() {
    if (state.skdComplete.timerId) {
      clearInterval(state.skdComplete.timerId);
      state.skdComplete.timerId = null;
    }
  }

  function updateSKDTimerDisplay_(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const text = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if ($('timeCounter')) $('timeCounter').textContent = text;
  }

  function renderSKDComplete_() {
    const type = getActiveSKDType_();
    const section = getActiveSKDSection_();
    if (!type || !section) return;

    const config = SKD_COMPLETE_CONFIG.sections[type];
    const question = section.questions[section.currentIndex];
    if (!question) return;

    $('testTypeLabel').textContent = `SKD · ${config.name}`;
    $('questionCounter').textContent = `${section.currentIndex + 1}/${section.questions.length}`;

    const answered = section.answers.filter((answer) => answer !== null).length;
    const progress = section.questions.length
      ? ((answered / section.questions.length) * 100)
      : 0;

    $('progressBar').style.width = `${progress}%`;

    $('testContent').innerHTML = `
      <div class="skd-complete-section-head">
        <div>
          <div class="test-question-label">${escapeHtml(config.name)} · PAKET ${state.skdComplete.package}</div>
          <h3>${answered}/${section.questions.length} terjawab</h3>
        </div>
        <span class="skd-section-pill">${config.minutes} menit</span>
      </div>
      <div class="test-question-label">PERTANYAAN ${section.currentIndex + 1}</div>
      <h2>${escapeHtml(question.text)}</h2>
    `;

    $('keypad').innerHTML = '';
    $('keypad').className = 'test-keypad test-keypad-answer';

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'test-answer';
      button.textContent = `${String.fromCharCode(65 + optionIndex)}. ${option}`;

      if (section.answers[section.currentIndex] === optionIndex) {
        button.classList.add('selected');
      }

      button.addEventListener('click', () => answerSKDComplete_(optionIndex));
      $('keypad').appendChild(button);
    });

    $('testHint').textContent =
      'Navigasi bebas. Memilih jawaban tidak otomatis memindahkan soal.';

    renderSKDNavigator_();
    renderSKDControls_();
  }

  function answerSKDComplete_(choice) {
    const section = getActiveSKDSection_();
    if (!section || section.finished) return;

    const index = section.currentIndex;
    if (section.answers[index] !== null) return;

    const elapsed = Math.max(
      0,
      Math.min(
        SKD_COMPLETE_CONFIG.sections[section.type].minutes * 60,
        (Date.now() - (section.questionStartedAt || section.startedAt)) / 1000
      )
    );

    section.answers[index] = choice;
    section.questionTimes[index] = Number(elapsed.toFixed(2));

    renderSKDComplete_();
    persistSKDComplete_();
  }

  function goToSKDQuestion_(index) {
    const section = getActiveSKDSection_();
    if (!section || section.finished) return;
    if (index < 0 || index >= section.questions.length) return;

    section.currentIndex = index;
    section.questionStartedAt = Date.now();
    renderSKDComplete_();
    persistSKDComplete_();
  }

  function nextSKDQuestion_() {
    const section = getActiveSKDSection_();
    if (!section) return;
    goToSKDQuestion_(Math.min(section.questions.length - 1, section.currentIndex + 1));
  }

  function previousSKDQuestion_() {
    const section = getActiveSKDSection_();
    if (!section) return;
    goToSKDQuestion_(Math.max(0, section.currentIndex - 1));
  }

  function renderSKDNavigator_() {
    const section = getActiveSKDSection_();
    const root = $('skdQuestionNavigator');
    if (!section || !root) return;

    root.innerHTML = `
      <div class="skd-nav-title-row">
        <strong>Navigasi Soal</strong>
        <span>${section.answers.filter((answer) => answer !== null).length}/${section.questions.length} terjawab</span>
      </div>
      <div class="skd-question-nav">
        ${section.questions.map((_, index) => `
          <button
            type="button"
            class="skd-question-number ${section.answers[index] !== null ? 'answered' : ''} ${index === section.currentIndex ? 'active' : ''}"
            data-skd-question="${index}"
          >${index + 1}</button>
        `).join('')}
      </div>
    `;

    root.querySelectorAll('[data-skd-question]').forEach((button) => {
      button.addEventListener('click', () => {
        goToSKDQuestion_(Number(button.dataset.skdQuestion));
      });
    });
  }

  function renderSKDControls_() {
    const root = $('skdControls');
    const section = getActiveSKDSection_();
    if (!root || !section) return;

    const type = getActiveSKDType_();
    const isLast = state.skdComplete.sectionIndex >= state.skdComplete.sectionOrder.length - 1;

    root.innerHTML = `
      <div class="skd-nav-buttons">
        <button type="button" class="secondary-btn" id="skdPrevBtn" ${section.currentIndex === 0 ? 'disabled' : ''}>← Sebelumnya</button>
        <button type="button" class="secondary-btn" id="skdNextBtn" ${section.currentIndex === section.questions.length - 1 ? 'disabled' : ''}>Berikutnya →</button>
      </div>
      <button type="button" class="btn btn-primary skd-finish-section-btn" id="skdFinishSectionBtn">
        ${isLast ? 'Selesaikan SKD' : `Selesaikan ${escapeHtml(SKD_COMPLETE_CONFIG.sections[type].name)}`}
      </button>
    `;

    $('skdPrevBtn').addEventListener('click', previousSKDQuestion_);
    $('skdNextBtn').addEventListener('click', nextSKDQuestion_);
    $('skdFinishSectionBtn').addEventListener('click', confirmFinishSKDSection_);
  }

  function confirmFinishSKDSection_() {
    const section = getActiveSKDSection_();
    if (!section) return;

    const unanswered = section.answers.filter((answer) => answer === null).length;
    const type = getActiveSKDType_();
    const isLast = state.skdComplete.sectionIndex >= state.skdComplete.sectionOrder.length - 1;

    const message = isLast
      ? `Selesaikan seluruh simulasi?\n\n${unanswered} soal ${SKD_COMPLETE_CONFIG.sections[type].name} belum dijawab. Setelah selesai, kamu tidak dapat kembali ke bagian ini.`
      : `Selesaikan ${SKD_COMPLETE_CONFIG.sections[type].name}?\n\n${unanswered} soal belum dijawab. Setelah lanjut, kamu tidak dapat kembali ke ${SKD_COMPLETE_CONFIG.sections[type].name}.`;

    if (!window.confirm(message)) return;
    finishSKDSection_(false);
  }

  function finishSKDSection_(forced = false) {
    const section = getActiveSKDSection_();
    if (!section || section.finished) return;

    section.finished = true;
    section.forcedFinish = Boolean(forced);
    stopSKDCompleteTimer_();
    persistSKDComplete_();

    const nextIndex = state.skdComplete.sectionIndex + 1;

    if (nextIndex >= state.skdComplete.sectionOrder.length) {
      finishSKDComplete_();
      return;
    }

    state.skdComplete.sectionIndex = nextIndex;
    startSKDWaiting_();
  }

  function startSKDWaiting_() {
    stopSKDCompleteTimer_();

    state.skdComplete.waiting = true;
    state.skdComplete.waitingUntil = Date.now() + SKD_COMPLETE_CONFIG.waitingSeconds * 1000;

    renderSKDWaiting_();
    showView('test');

    state.skdComplete.timerId = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((state.skdComplete.waitingUntil - Date.now()) / 1000)
      );

      updateSKDWaitingDisplay_(remaining);

      if (remaining <= 0) {
        stopSKDCompleteTimer_();
        state.skdComplete.waiting = false;
        const nextType = getActiveSKDType_();
        startSKDSection_(nextType);
      }
    }, 250);

    updateSKDWaitingDisplay_(SKD_COMPLETE_CONFIG.waitingSeconds);
    persistSKDComplete_();
  }

  function updateSKDWaitingDisplay_(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const nextType = getActiveSKDType_();
    const nextName = SKD_COMPLETE_CONFIG.sections[nextType]?.name || 'bagian berikutnya';

    $('testTypeLabel').textContent = 'SKD · JEDA';
    $('questionCounter').textContent = '—';
    $('timeCounter').textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    $('progressBar').style.width = `${(state.skdComplete.sectionIndex / state.skdComplete.sectionOrder.length) * 100}%`;

    $('testContent').innerHTML = `
      <div class="skd-waiting-card-inline">
        <div class="eyebrow">SKD PAKET LENGKAP</div>
        <h2>Jeda sebelum ${escapeHtml(nextName)}</h2>
        <p>Gunakan waktu ini untuk bersiap. Bagian berikutnya akan terbuka otomatis setelah jeda selesai.</p>
        <div class="skd-waiting-timer" id="skdWaitingTimer">${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}</div>
        <div class="skd-section-progress">
          ${state.skdComplete.sectionOrder.map((type, index) => {
            const section = state.skdComplete.sections[type];
            const active = index === state.skdComplete.sectionIndex;
            const done = Boolean(section?.finished);
            return `<span class="${done ? 'done' : active ? 'active' : ''}">${done ? '✓' : index + 1} ${escapeHtml(SKD_COMPLETE_CONFIG.sections[type].name)}</span>`;
          }).join('')}
        </div>
      </div>
    `;

    $('keypad').innerHTML = '';
    $('keypad').className = 'test-keypad';
    $('testHint').textContent = 'Jeda otomatis. Tidak perlu melakukan apa pun.';

    const controls = $('skdControls');
    if (controls) controls.innerHTML = '';
    const navigator = $('skdQuestionNavigator');
    if (navigator) navigator.innerHTML = '';
  }

  function renderSKDWaiting_() {
    updateSKDWaitingDisplay_(SKD_COMPLETE_CONFIG.waitingSeconds);
  }

  function calculateSKDSection_(section) {
    const total = section.questions.length;
    const answered = section.answers.filter((answer) => answer !== null).length;
    const correct = section.answers.reduce((sum, answer, index) => {
      return sum + (answer !== null && answer === section.questions[index].correct ? 1 : 0);
    }, 0);
    const wrong = answered - correct;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
    const completion = total ? Math.round((answered / total) * 100) : 0;

    return {
      type: section.type,
      total,
      answered,
      correct,
      wrong,
      accuracy,
      completion,
      score: accuracy,
      chart: section.questions.map((question, index) => ({
        time: Number(section.questionTimes[index] ?? SKD_COMPLETE_CONFIG.sections[section.type].minutes * 60),
        correct: section.answers[index] !== null && section.answers[index] === question.correct,
        answered: section.answers[index] !== null,
      })),
    };
  }

  function calculateSKDComplete_() {
    const sectionResults = {};
    let total = 0;
    let answered = 0;
    let correct = 0;

    state.skdComplete.sectionOrder.forEach((type) => {
      const section = state.skdComplete.sections[type];
      const result = calculateSKDSection_(section);
      sectionResults[type] = result;
      total += result.total;
      answered += result.answered;
      correct += result.correct;
    });

    const wrong = answered - correct;
    const score = total ? Math.round((correct / total) * 100) : 0;
    const speed = total ? Math.round((answered / total) * 100) : 0;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
    const consistency = Math.round(mean(
      state.skdComplete.sectionOrder.map((type) => sectionResults[type].accuracy)
    ));
    const endurance = speed;

    const chart = [];
    state.skdComplete.sectionOrder.forEach((type) => {
      const sectionResult = sectionResults[type];
      sectionResult.chart.forEach((item) => chart.push(item));
    });

    return {
      type: 'skd_lengkap',
      package: state.skdComplete.package,
      answered,
      correct,
      wrong,
      total,
      score,
      speed,
      accuracy,
      consistency,
      endurance,
      chart,
      sectionResults,
      tanggal: new Date().toISOString(),
      testId: state.currentTestId,
    };
  }

  function renderSKDCompleteResult_(result) {
    const sectionCards = state.skdComplete.sectionOrder.map((type) => {
      const config = SKD_COMPLETE_CONFIG.sections[type];
      const item = result.sectionResults[type];
      return `
        <article class="skd-result-section-card">
          <div class="skd-result-section-top">
            <strong>${escapeHtml(config.name)}</strong>
            <span>${item.accuracy}%</span>
          </div>
          <div class="skd-result-section-meta">
            <span>${item.correct} benar</span>
            <span>${item.wrong} salah</span>
            <span>${item.total - item.answered} kosong</span>
          </div>
          <div class="score-track"><i style="--score:${item.accuracy}%"></i></div>
        </article>
      `;
    }).join('');

    const root = $('resultIntro');
    if (root) {
      root.innerHTML = state.isGuest
        ? 'Hasil simulasi <strong>SKD Paket Lengkap</strong> tidak disimpan ke histori mode tamu. Kamu tetap bisa mencetak PDF.'
        : `Hasil simulasi <strong>SKD Paket Lengkap</strong> sudah diproses. Paket ${result.package}.`;
    }

    const sectionRoot = $('skdResultSections');
    if (sectionRoot) sectionRoot.innerHTML = sectionCards;
  }

  function persistSKDComplete_() {
    if (!state.skdComplete.active) return;

    try {
      localStorage.setItem(`${CONFIG.TEST_KEY}_skd_complete`, JSON.stringify({
        version: 1,
        userId: state.session?.user_id || null,
        isGuest: state.isGuest,
        test: 'skd_lengkap',
        package: state.skdComplete.package,
        returnView: state.returnView || 'skd',
        currentTestId: state.currentTestId,
        sectionIndex: state.skdComplete.sectionIndex,
        waiting: state.skdComplete.waiting,
        waitingUntil: state.skdComplete.waitingUntil,
        sections: state.skdComplete.sections,
      }));
    } catch (error) {
      console.warn('Progress SKD Lengkap tidak tersimpan:', error);
    }
  }

  function clearPersistedSKDComplete_() {
    localStorage.removeItem(`${CONFIG.TEST_KEY}_skd_complete`);
  }

  function loadPersistedSKDComplete_() {
    try {
      const saved = JSON.parse(localStorage.getItem(`${CONFIG.TEST_KEY}_skd_complete`) || 'null');
      if (!saved || saved.test !== 'skd_lengkap') return null;

      // Progress akun tidak boleh tertukar antar akun.
      if (saved.userId) {
        if (!state.session?.user_id || saved.userId !== state.session.user_id) return null;
      } else if (state.session && !state.isGuest) {
        return null;
      }

      return saved;
    } catch {
      return null;
    }
  }

  function resumePersistedSKDComplete_() {
    const saved = loadPersistedSKDComplete_();
    if (!saved) {
      toast('Tidak ada progress SKD Lengkap yang bisa dilanjutkan.', 'warning');
      return;
    }

    state.test = 'skd_lengkap';
    state.package = Number(saved.package) || 1;
    state.returnView = saved.returnView || 'skd';
    state.currentTestId = saved.currentTestId || `SKD-${Date.now()}-${randomInt(100000)}`;
    state.finished = false;

    state.skdComplete.active = true;
    state.skdComplete.package = state.package;
    state.skdComplete.sectionIndex = Number(saved.sectionIndex) || 0;
    state.skdComplete.waiting = Boolean(saved.waiting);
    state.skdComplete.waitingUntil = Number(saved.waitingUntil) || 0;
    state.skdComplete.sections = saved.sections || { twk: null, tiu: null, tkp: null };

    const active = getActiveSKDSection_();
    if (!active) {
      clearPersistedSKDComplete_();
      toast('Progress SKD Lengkap rusak dan telah dibersihkan.', 'warning');
      return;
    }

    showView('test');

    if (state.skdComplete.waiting) {
      const remaining = state.skdComplete.waitingUntil - Date.now();
      if (remaining <= 0) {
        state.skdComplete.waiting = false;
        startSKDSection_(getActiveSKDType_());
      } else {
        renderSKDWaiting_();
        state.skdComplete.timerId = setInterval(() => {
          const left = Math.max(0, Math.ceil((state.skdComplete.waitingUntil - Date.now()) / 1000));
          updateSKDWaitingDisplay_(left);
          if (left <= 0) {
            stopSKDCompleteTimer_();
            state.skdComplete.waiting = false;
            startSKDSection_(getActiveSKDType_());
          }
        }, 250);
      }
      return;
    }

    if (active.finished) {
      const nextIndex = state.skdComplete.sectionIndex + 1;
      if (nextIndex < state.skdComplete.sectionOrder.length) {
        state.skdComplete.sectionIndex = nextIndex;
        startSKDWaiting_();
      } else {
        finishSKDComplete_();
      }
      return;
    }

    renderSKDComplete_();
    startSKDSectionTimer_();
  }

  async function finishSKDComplete_() {
    if (!state.skdComplete.active) return;

    stopSKDCompleteTimer_();
    state.skdComplete.waiting = false;
    state.finished = true;

    const result = calculateSKDComplete_();
    state.lastResult = result;
    state.currentTestId = result.testId || `SKD-${Date.now()}-${randomInt(100000)}`;
    clearPersistedSKDComplete_();

    trackEvent('skd_complete_finish', {
      package: result.package,
      score: result.score,
      answered: result.answered,
    });

    $('testView')?.classList.remove('skd-complete-mode');
    renderResult(result);
    renderSKDCompleteResult_(result);
    drawChart(result);
    showView('result');

    if (!state.isGuest && state.session?.token) {
      try {
        await apiChecked('saveHistory', {
          token: state.session.token,
          test_id: result.testId,
          test_type: result.type,
          package: result.package,
          tanggal: result.tanggal,
          score: result.score,
          correct: result.correct,
          wrong: result.wrong,
          total: result.total,
          speed: result.speed,
          accuracy: result.accuracy,
          consistency: result.consistency,
          endurance: result.endurance,
        });
        await refreshHistory();
        toast('Hasil SKD Paket Lengkap tersimpan.', 'success');
      } catch (error) {
        toast(`Hasil tampil, tetapi histori belum tersimpan: ${error.message}`, 'warning', 5000);
      }
    }
  }

  async function loadSKDJsonFallback_(testId, packageNumber) {
    const response = await fetch('./soal_skd.json', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Gagal memuat soal_skd.json. HTTP ${response.status}.`);
    }

    const data = await response.json();
    const category = data[String(testId || '').toUpperCase()];
    const selectedPackage = category?.[`paket_${Number(packageNumber)}`];

    if (!Array.isArray(selectedPackage) || !selectedPackage.length) {
      throw new Error(`Paket ${packageNumber} untuk ${String(testId).toUpperCase()} tidak ditemukan di soal_skd.json.`);
    }

    return selectedPackage.map((item, index) => {
      const optionEntries = Object.entries(item.pilihan || {});
      const answerLetter = String(item.kunci || item.kunci_ideal || '').trim().toUpperCase();
      const correctIndex = optionEntries.findIndex(([letter]) => String(letter).toUpperCase() === answerLetter);

      if (correctIndex < 0) {
        throw new Error(`Kunci soal ${item.no ?? index + 1} pada ${String(testId).toUpperCase()} tidak valid.`);
      }

      return {
        id: item.no ?? index + 1,
        text: String(item.soal ?? ''),
        options: optionEntries.map(([, value]) => {
          if (value && typeof value === 'object') return String(value.teks ?? value.text ?? '');
          return String(value);
        }),
        correct: correctIndex,
        discussion: String(item.pembahasan ?? ''),
      };
    });
  }

  function startKraepelin() {
    // Kraepelin uses its own keypad only; SKD navigator must stay hidden.
    $('testView')?.classList.remove('skd-complete-mode');
    if ($('skdQuestionNavigator')) $('skdQuestionNavigator').innerHTML = '';
    if ($('skdControls')) $('skdControls').innerHTML = '';

    state.columns = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () => Array.from({ length: 27 }, () => randomInt(10)),
    );
    state.answers = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () => Array(CONFIG.KRAEPELIN_QUESTIONS).fill(null),
    );
    state.kraepelinQuestionTimes = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () => Array(CONFIG.KRAEPELIN_QUESTIONS).fill(null),
    );
    state.colIndex = 0;
    state.qIndex = 0;
    state.questions = [];

    renderKraepelin();
    showView('test');
    state.questionStartedAt = Date.now();
    startColumnTimer();
  }

  function renderKraepelin() {
    const column = state.columns[state.colIndex];
    const answerIndex = state.qIndex;
    const bottom = column[26 - answerIndex];
    const top = column[25 - answerIndex];

    $('testTypeLabel').textContent = 'Kraepelin';
    $('questionCounter').textContent = `${answerIndex + 1}/26`;
    $('timeCounter').textContent = `${state.kraepelinSecondsChoice}s`;
    $('progressBar').style.width = `${((state.colIndex * 26 + answerIndex) / 1300) * 100}%`;

    $('testContent').innerHTML = `
      <div class="test-question-label">JUMLAHKAN</div>
      <div class="test-number">${top}</div>
      <div class="test-mark">?</div>
      <div class="test-number">${bottom}</div>
    `;
    $('keypad').innerHTML = '';
    $('keypad').className = 'test-keypad test-keypad-numeric';
    [7, 8, 9, 4, 5, 6, 1, 2, 3, 0].forEach((digit) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `test-digit ${digit === 0 ? 'zero' : ''}`;
      button.textContent = digit;
      button.addEventListener('click', () => answerKraepelin(digit));
      $('keypad').appendChild(button);
    });

    $('testHint').textContent = 'Keyboard 0–9 juga bisa digunakan.';
  }

  function startColumnTimer() {
    stopTimer();
    const end = Date.now() + state.kraepelinSecondsChoice * 1000;

    state.timerId = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      $('timeCounter').textContent = `${left}s`;

      if (left <= 0) {
        stopTimer();
        nextColumn();
      }
    }, 100);
  }

  function answerKraepelin(digit) {
    if (state.answers[state.colIndex][state.qIndex] !== null) return;

    const elapsedSeconds = Math.max(
      0,
      Math.min(
        state.kraepelinSecondsChoice,
        (Date.now() - state.questionStartedAt) / 1000
      )
    );

    state.answers[state.colIndex][state.qIndex] = Number(digit);
    state.kraepelinQuestionTimes[state.colIndex][state.qIndex] =
      Number(elapsedSeconds.toFixed(2));

    if (state.qIndex < CONFIG.KRAEPELIN_QUESTIONS - 1) {
      state.qIndex += 1;
      renderKraepelin();
      state.questionStartedAt = Date.now();
    } else {
      nextColumn();
    }

    persistTest();
  }

  function nextColumn() {
    if (state.colIndex >= CONFIG.KRAEPELIN_COLUMNS - 1) {
      finishTest();
      return;
    }

    state.colIndex += 1;
    state.qIndex = 0;
    renderKraepelin();
    state.questionStartedAt = Date.now();
    startColumnTimer();
    persistTest();
  }

  async function startMCQ() {
    // Regular psychotests must never inherit SKD Complete UI state.
    $('testView')?.classList.remove('skd-complete-mode');
    if ($('skdQuestionNavigator')) $('skdQuestionNavigator').innerHTML = '';
    if ($('skdControls')) $('skdControls').innerHTML = '';

    state.questions = await loadQuestionPackage(
      state.test,
      state.package
    );

    state.answers = Array(
      state.questions.length
    ).fill(null);

    state.questionTimes = Array(
      state.questions.length
    ).fill(null);

    state.index = 0;

    renderMCQ();
    showView('test');

    state.questionStartedAt = Date.now();

    startQuestionTimer();
  }

  function renderMCQ() {
    const question = state.questions[state.index];
    if (!question) return;

    $('testTypeLabel').textContent = TESTS[state.test].name;
    $('questionCounter').textContent = `${state.index + 1}/${CONFIG.MCQ_QUESTIONS}`;
    $('timeCounter').textContent = `${CONFIG.MCQ_SECONDS}s`;
    $('progressBar').style.width = `${(state.index / CONFIG.MCQ_QUESTIONS) * 100}%`;

    $('testContent').innerHTML = `
      <div class="test-question-label">PERTANYAAN ${state.index + 1}</div>
      <h2>${escapeHtml(question.text)}</h2>
    `;

    $('keypad').innerHTML = '';
    $('keypad').className = 'test-keypad test-keypad-answer';

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'test-answer';
      button.textContent = `${String.fromCharCode(65 + optionIndex)}. ${option}`;
      button.addEventListener('click', () => answerMCQ(optionIndex));
      $('keypad').appendChild(button);
    });

    $('testHint').textContent = `Pilih satu jawaban. Waktu per soal: ${CONFIG.MCQ_SECONDS} detik.`;
  }

  function startQuestionTimer() {
    stopTimer();
    const end = Date.now() + CONFIG.MCQ_SECONDS * 1000;

    state.timerId = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      $('timeCounter').textContent = `${left}s`;

      if (left <= 0) {
        stopTimer();
        answerMCQ(null);
      }
    }, 100);
  }

  function answerMCQ(choice) {
    if (
      state.answers[state.index] !== null ||
      state.finished
    ) {
      return;
    }

    const question =
      state.questions[state.index];

    const isLastQuestion =
      state.index >=
      state.questions.length - 1;

    // Catat waktu yang dipakai untuk soal ini.
    // Batas maksimal mengikuti timer per soal.
    const elapsedSeconds = Math.min(
      CONFIG.MCQ_SECONDS,
      Math.max(
        0,
        (Date.now() - state.questionStartedAt) / 1000
      )
    );

    state.questionTimes[state.index] =
      Number(elapsedSeconds.toFixed(2));

    state.answers[state.index] = choice;

    stopTimer();

    const buttons =
      $('keypad').querySelectorAll('button');

    buttons.forEach(
      (button, buttonIndex) => {
        button.disabled = true;

        if (
          choice !== null &&
          buttonIndex === question.correct
        ) {
          button.classList.add('correct');
        }

        if (
          choice !== null &&
          buttonIndex === choice &&
          choice !== question.correct
        ) {
          button.classList.add('wrong');
        }
      }
    );

    persistTest();

    if (isLastQuestion) {
      setTimeout(
        () => finishTest(),
        choice === null ? 0 : 160
      );
      return;
    }

    setTimeout(
      () => {
        state.index += 1;

        renderMCQ();

        state.questionStartedAt = Date.now();

        startQuestionTimer();
        persistTest();
      },
      choice === null ? 0 : 160
    );
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }
