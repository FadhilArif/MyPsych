'use strict';

// ============================================================
  // GUEST / DASHBOARD
  // ============================================================

  function enterGuest() {
    state.session = null;
    state.isGuest = true;
    state.history = [];
    saveSession();
    $('welcomeName').textContent = 'Tamu';
    updateUserChrome_('Tamu', 'Mode tamu');
    renderCatalog();
    trackEvent('guest_enter');
    showView('dashboard');
  }

  function leaveGuest() {
    state.isGuest = false;
    state.session = null;
    state.history = [];
  }

  function renderCatalog() {
    const root = $('testCatalog');
    if (!root) return;

    root.innerHTML = '';

    Object.entries(TESTS).forEach(([id, test]) => {
      if (test.group === 'skd') return;

      const card = document.createElement('article');
      card.className = 'test-item app-test-item';
      const isKraepelin = id === 'kraepelin';

      const logoSrc = test.logo || './assets/logos/logo_mypsych.png';
      card.innerHTML = `
        <div class="test-icon app-test-logo">
          <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(test.name)}" loading="lazy">
        </div>
        <div class="test-info">
          <strong>${escapeHtml(test.name)}</strong>
          <small>${escapeHtml(test.description)}</small>
        </div>
        <div class="app-test-controls">
          ${isKraepelin ? `
            <select class="speed-select" aria-label="Waktu per soal Kraepelin">
              <option value="15">15 detik</option>
              <option value="20">20 detik</option>
            </select>` : `
            <select class="package-select" aria-label="Paket ${escapeHtml(test.name)}">
              <option value="1">Paket 1</option>
              <option value="2">Paket 2</option>
              <option value="3">Paket 3</option>
            </select>`}
          <button class="btn btn-primary" type="button">Mulai</button>
        </div>
      `;

      const select = card.querySelector('.package-select');
      const speedSelect = card.querySelector('.speed-select');

      card.querySelector('button').addEventListener('click', () => {
        if (isKraepelin) {
          state.kraepelinSecondsChoice = Number(speedSelect?.value) || 15;
          openInstruction(id, 1);
          return;
        }
        openInstruction(id, Number(select?.value) || 1);
      });

      root.appendChild(card);
    });
  }

  async function refreshHistory() {
    if (state.isGuest || !state.session?.token) {
      state.history = [];
      return [];
    }

    try {
      const response = await apiChecked('getHistory', {
        token: state.session.token,
      });

      state.history = Array.isArray(response.history) ? response.history : [];
      renderHistory();
      renderDashboardSummary();
      return state.history;
    } catch (error) {
      if (/sesi login/i.test(error.message)) {
        clearSession();
        state.isGuest = false;
        showView('landing');
      }
      throw error;
    }
  }

  function renderDashboardSummary() {
    const count = state.history.length;
    if ($('historyCount')) $('historyCount').textContent = String(count);

    if (!count) {
      if ($('latestDate')) $('latestDate').textContent = 'Belum ada tes';
      if ($('dashScore')) $('dashScore').textContent = '—';
      if ($('dashSpeed')) $('dashSpeed').textContent = '—';
      if ($('dashAccuracy')) $('dashAccuracy').textContent = '—';
      if ($('dashConsistency')) $('dashConsistency').textContent = '—';
      if ($('dashEndurance')) $('dashEndurance').textContent = '—';
      if ($('dashStrengthValue')) $('dashStrengthValue').textContent = '—';
      if ($('dashStrengthLabel')) $('dashStrengthLabel').textContent = 'Belum ada data latihan';
      if ($('dashStrengthBar')) $('dashStrengthBar').style.width = '0%';
      if ($('dashRecordValue')) $('dashRecordValue').textContent = '—';
      return;
    }

    const latest = state.history[0];
    if ($('latestDate')) $('latestDate').textContent = formatDate(latest.tanggal);
    if ($('dashScore')) $('dashScore').textContent = `${Number(latest.score) || 0}%`;
    if ($('dashSpeed')) $('dashSpeed').textContent = `${Number(latest.speed) || 0}%`;
    if ($('dashAccuracy')) $('dashAccuracy').textContent = `${Number(latest.accuracy) || 0}%`;
    if ($('dashConsistency')) $('dashConsistency').textContent = `${Number(latest.consistency) || 0}%`;
    if ($('dashEndurance')) $('dashEndurance').textContent = `${Number(latest.endurance) || 0}%`;

    const metrics = [
      { key: 'accuracy', label: 'Ketelitian' },
      { key: 'consistency', label: 'Konsistensi' },
      { key: 'endurance', label: 'Ketahanan' },
      { key: 'speed', label: 'Kecepatan' },
    ];
    const strongest = metrics.reduce((best, item) => {
      const value = Number(latest[item.key]) || 0;
      return value > best.value ? { ...item, value } : best;
    }, { key: '', label: '—', value: -1 });

    const recordSpeed = state.history.reduce((max, item) => {
      return Math.max(max, Number(item.speed) || 0);
    }, 0);

    if ($('dashStrengthValue')) $('dashStrengthValue').textContent = strongest.value >= 0 ? `${strongest.value}%` : '—';
    if ($('dashStrengthLabel')) $('dashStrengthLabel').textContent = strongest.value >= 0
      ? `${strongest.label} — kekuatan tertinggi pada tes terakhir`
      : 'Belum ada data latihan';
    if ($('dashStrengthBar')) $('dashStrengthBar').style.width = `${Math.min(100, Math.max(0, strongest.value))}%`;
    if ($('dashRecordValue')) $('dashRecordValue').textContent = recordSpeed ? `${recordSpeed}%` : '—';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '—');
    return date.toLocaleString('id-ID');
  }

  function renderHistory() {
    const body = $('historyTableBody');
    const mobileList = $('historyMobileList');
    if (!body) return;

    const history = state.isGuest ? [] : state.history;
    $('historyPageCount').textContent = String(history.length);
    body.innerHTML = '';
    if (mobileList) mobileList.innerHTML = '';

    $('emptyHistory').hidden = history.length > 0;
    $('historyTable').hidden = history.length === 0;
    if (mobileList) mobileList.hidden = history.length === 0;

    const headerRow = $('historyTable')?.querySelector('thead tr');
    if (headerRow) {
      headerRow.innerHTML = `
        <th>#</th>
        <th>Tanggal</th>
        <th>Tes</th>
        <th>Paket</th>
        <th>Skor</th>
        <th>Kecepatan</th>
        <th>Ketelitian</th>
        <th>Konsistensi</th>
        <th>Ketahanan</th>
        <th>Aksi</th>
      `;
    }

    history.forEach((item, index) => {
      const testName = TESTS[item.test_type]?.name || item.test_type || '—';
      const dateLabel = formatDate(item.tanggal);
      const score = Number(item.score) || 0;
      const speed = Number(item.speed) || 0;
      const accuracy = Number(item.accuracy) || 0;
      const consistency = Number(item.consistency) || 0;
      const endurance = Number(item.endurance) || 0;
      const packageLabel = item.package ?? '—';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(dateLabel)}</td>
        <td>${escapeHtml(testName)}</td>
        <td>${escapeHtml(packageLabel)}</td>
        <td>${score}%</td>
        <td>${speed}%</td>
        <td>${accuracy}%</td>
        <td>${consistency}%</td>
        <td>${endurance}%</td>
        <td class="history-action-cell"></td>
      `;

      const actionCell = row.querySelector('.history-action-cell');
      const pdfButton = document.createElement('button');
      pdfButton.type = 'button';
      pdfButton.className = 'secondary-btn history-pdf-btn';
      pdfButton.textContent = 'Cetak PDF';
      pdfButton.title = 'Cetak hasil PDF';
      pdfButton.addEventListener('click', () => {
        downloadHistoryPdf(item, pdfButton);
      });
      actionCell.appendChild(pdfButton);
      body.appendChild(row);

      if (mobileList) {
        const card = document.createElement('article');
        card.className = 'history-mobile-card';

        const summary = document.createElement('button');
        summary.type = 'button';
        summary.className = 'history-mobile-summary';
        summary.setAttribute('aria-expanded', 'false');
        summary.innerHTML = `
          <span class="history-mobile-main">
            <strong>${escapeHtml(testName)}</strong>
            <small>${escapeHtml(dateLabel)} · Paket ${escapeHtml(packageLabel)}</small>
          </span>
          <span class="history-mobile-score">
            <strong>${score}%</strong>
            <small>Skor</small>
          </span>
          <span class="history-mobile-chevron" aria-hidden="true">›</span>
        `;

        const details = document.createElement('div');
        details.className = 'history-mobile-details';
        details.hidden = true;
        details.innerHTML = `
          <div class="history-mobile-metrics">
            <div><span>Kecepatan</span><strong>${speed}%</strong></div>
            <div><span>Ketelitian</span><strong>${accuracy}%</strong></div>
            <div><span>Konsistensi</span><strong>${consistency}%</strong></div>
            <div><span>Ketahanan</span><strong>${endurance}%</strong></div>
          </div>
          <div class="history-mobile-actions"></div>
        `;

        const mobilePdfButton = document.createElement('button');
        mobilePdfButton.type = 'button';
        mobilePdfButton.className = 'secondary-btn history-mobile-pdf';
        mobilePdfButton.textContent = 'Cetak PDF';
        mobilePdfButton.addEventListener('click', () => {
          downloadHistoryPdf(item, mobilePdfButton);
        });
        details.querySelector('.history-mobile-actions').appendChild(mobilePdfButton);

        summary.addEventListener('click', () => {
          const expanded = summary.getAttribute('aria-expanded') === 'true';
          summary.setAttribute('aria-expanded', String(!expanded));
          details.hidden = expanded;
          card.classList.toggle('is-open', !expanded);
        });

        card.appendChild(summary);
        card.appendChild(details);
        mobileList.appendChild(card);
      }
    });
  }

  function historyItemToResult(item) {
    const normalizedType = item?.test_type || 'kuantitatif';

    return {
      testId: item?.test_id || '',
      type: normalizedType,
      package: Number(item?.package) || 1,
      answered: Number(item?.answered) || (Number(item?.correct) || 0) + (Number(item?.wrong) || 0),
      correct: Number(item?.correct) || 0,
      wrong: Number(item?.wrong) || 0,
      total: Number(item?.total) || CONFIG.MCQ_QUESTIONS,
      score: Number(item?.score) || 0,
      speed: Number(item?.speed) || 0,
      accuracy: Number(item?.accuracy) || 0,
      consistency: Number(item?.consistency) || 0,
      endurance: Number(item?.endurance) || 0,
      chart: Array.isArray(item?.chart) ? item.chart : [],
      tanggal: item?.tanggal || new Date().toISOString(),
    };
  }

  async function downloadHistoryPdf(item, button) {
    if (!item) return;

    busy(button, 'PDF…', true);

    try {
      // Kalau hasil ini baru saja selesai, gunakan result lengkapnya
      // sehingga grafik waktu per soal tetap ikut tercetak.
      let result = null;
      if (
        state.lastResult &&
        item.test_id &&
        state.lastResult.testId === item.test_id
      ) {
        result = state.lastResult;
          } else {
        result = historyItemToResult(item);

        // Ambil detail jawaban per soal dari TestDetail
        try {
          const details = await loadTestDetail(item.test_id);
          enrichHistoryResultWithDetail(result, details);
        } catch (detailError) {
          console.warn('Detail histori tidak tersedia:', detailError);
        }


          function enrichWrongDetailsWithQuestions(result, questions) {
    if (!Array.isArray(questions) || !questions.length) return result;
    if (!Array.isArray(result.wrongNumbers) || !result.wrongNumbers.length) return result;

    // Map nomor soal -> objek soal
    const byNo = new Map();
    questions.forEach((q) => {
      const no = Number(q.id ?? q.no_soal);
      if (Number.isInteger(no)) byNo.set(no, q);
    });

    result.wrongDetails = result.wrongNumbers.map((no) => {
      const q = byNo.get(no);
      return {
        no,
        text: String(q?.question || ''),
        userAnswer: null,
        correctAnswer: null,
        options: q?.options ? Object.values(q.options).map(String) : [],
      };
    });

    return result;
  }
        // Ambil teks soal dari bank soal untuk memperkaya wrongDetails
        try {
          const qp = await api('getQuestionPackage', {
            test_type: item.test_type,
            package: item.package,
          });
          if (qp?.success && Array.isArray(qp.questions)) {
            enrichWrongDetailsWithQuestions(result, qp.questions);
          }
        } catch (questionError) {
          console.warn('Teks soal histori tidak tersedia:', questionError);
        }
      }
      const participant =
        state.session?.username || 'Peserta';

      const bytes = await buildPdf(
        result,
        participant
      );

      const blob = new Blob(
        [bytes],
        { type: 'application/pdf' }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download =
        `hasil-${result.type}-paket-${result.package}-${new Date(
          result.tanggal
        ).toISOString().slice(0, 10)}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );

      toast(
        'PDF histori berhasil dibuat.',
        'success'
      );
        try {
        await api('trackPdfDownload', {
          token: state.session?.token || '',
          test_id: item.test_id || ''
        });
      } catch (_) {
        // Silent
      }
    } catch (error) {
      console.error(
        'History PDF error:',
        error
      );

      toast(
        `PDF histori gagal dibuat: ${error.message}`,
        'warning',
        5000
      );
    } finally {
      busy(button, '', false);
    }
  }

  function updateUserChrome_(name, role = 'Akun peserta') {
    const safeName = String(name || 'Peserta');
    if ($('sidebarUserName')) $('sidebarUserName').textContent = safeName;
    if ($('topbarUserName')) $('topbarUserName').textContent = safeName;
    if ($('sidebarUserRole')) $('sidebarUserRole').textContent = role;
    if ($('sidebarAvatar')) $('sidebarAvatar').textContent = safeName.charAt(0).toUpperCase();
  }

  async function goDashboard(message = '') {
    if (isAdmin()) {
      await openAdminDashboard();
      return;
    }

    if (state.isGuest) {
      updateUserChrome_('Tamu', 'Mode tamu');
      renderCatalog();
      showView('dashboard');
      return;
    }

    if (!state.session) {
      showView('landing');
      return;
    }

    $('welcomeName').textContent = state.session.username;
    updateUserChrome_(state.session.username, 'Akun peserta');
    renderCatalog();
    showView('dashboard');

    try {
      await refreshHistory();
    } catch (error) {
      toast(`Histori belum bisa dimuat: ${error.message}`, 'warning', 4200);
    }

    if (message) toast(message, 'success');
  }
