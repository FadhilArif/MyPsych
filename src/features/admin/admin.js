'use strict';

/* ============================================================
   ADMIN PANEL
   ============================================================ */

  state.admin = {
    stats: { users: 0, admins: 0, tests: 0, avg_score: 0 },
    users: [],
    results: [],
    labels: [],
    tab: 'overview'
  };

  const ADMIN_TEST_OPTIONS = Object.entries(TESTS)
    .filter(([id, test]) => test.kind === 'mcq')
    .map(([id, test]) => ({ id, name: test.name, group: test.group === 'skd' ? 'skd' : 'psikotes' }));

  function renderAdminTestOptions_(selected = '') {
    const groups = [
      ['psikotes', 'Psikotes Umum'],
      ['skd', 'SKD (CPNS)'],
    ];

    return groups.map(([groupId, label]) => {
      const options = ADMIN_TEST_OPTIONS
        .filter((item) => item.group === groupId)
        .map((item) => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`)
        .join('');
      return options ? `<optgroup label="${label}">${options}</optgroup>` : '';
    }).join('');
  }

  function isAdmin() {
    return state.session?.role === 'admin';
  }

  function adminRequireAccess() {
    if (!isAdmin()) {
      toast('Akses admin ditolak.', 'warning');
      return false;
    }
    return true;
  }

  async function openAdminDashboard(tab = state.admin?.tab || 'overview') {
    if (!adminRequireAccess()) return;
    state.admin.tab = tab;
    try {
      await refreshAdminData();
      renderAdmin();
      showView('admin');
    } catch (error) {
      toast(`Dashboard admin gagal dimuat: ${error.message}`, 'warning', 5000);
    }
  }

  async function refreshAdminData() {
    const response = await apiChecked('adminDashboard', {
      token: state.session.token,
    });

    state.admin.stats = response.stats || state.admin.stats;
    state.admin.users = Array.isArray(response.users) ? response.users : [];
    state.admin.results = Array.isArray(response.results) ? response.results : [];
    state.admin.labels = Array.isArray(response.labels) ? response.labels : [];
    return response;
  }

  function adminTestName(testType) {
    return TESTS[testType]?.name || testType || '—';
  }

  function renderAdmin() {
    if (!$('adminView')) return;

    if ($('adminWelcomeName')) $('adminWelcomeName').textContent = state.session?.username || '—';

    $('adminUsersStat').textContent = String(state.admin.stats.users || 0);
    $('adminTestsStat').textContent = String(state.admin.stats.tests || 0);
    $('adminAverageStat').textContent = `${Number(state.admin.stats.avg_score) || 0}%`;
    $('adminAdminsStat').textContent = String(state.admin.stats.admins || 0);

    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.adminTab === state.admin.tab);
    });

    if (state.admin.tab === 'users') renderAdminUsers();
    else if (state.admin.tab === 'results') renderAdminResults();
    else if (state.admin.tab === 'questions') renderAdminQuestions();
    else if (state.admin.tab === 'labels') renderAdminLabels();
    else renderAdminOverview();
  }

  function renderAdminOverview() {
    const results = state.admin.results.slice(0, 10);
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head">
        <div><div class="eyebrow">OVERVIEW</div><h2>Ringkasan sistem</h2></div>
        <button type="button" class="secondary-btn" id="adminRefreshBtn">↻ Refresh</button>
      </div>
            <div class="admin-stats-grid" style="margin-bottom: 14px;">
        <div class="admin-stat card">
          <span>PDF Dicetak</span>
          <strong>${Number(state.admin.stats.pdf_downloads) || 0}</strong>
          <small>laporan diunduh user</small>
        </div>
        <div class="admin-stat card">
          <span>Conversion</span>
          <strong>${state.admin.stats.tests ? Math.round((state.admin.stats.pdf_downloads / state.admin.stats.tests) * 100) : 0}%</strong>
          <small>tes → PDF</small>
        </div>
      </div>
      <div class="admin-grid-two">
        <div class="admin-card card">
          <h3>Aktivitas terbaru</h3>
          <p class="muted">10 hasil tes terbaru dari seluruh peserta.</p>
          <div class="table-wrap admin-table-wrap">
            <table><thead><tr><th>Peserta</th><th>Tes</th><th>Skor</th><th>Label</th><th>Tanggal</th></tr></thead>
            <tbody>${results.length ? results.map((item) => `
              <tr>
                <td>${escapeHtml(item.username)}</td>
                <td>${escapeHtml(adminTestName(item.test_type))}</td>
                <td><strong>${Number(item.score) || 0}%</strong></td>
                <td><span class="admin-badge">${escapeHtml(item.label || 'Belum ada label')}</span></td>
                <td>${escapeHtml(formatDate(item.tanggal))}</td>
              </tr>`).join('') : `<tr><td colspan="5" class="admin-empty-cell">Belum ada hasil tes.</td></tr>`}</tbody></table>
          </div>
        </div>
        <div class="admin-card card">
          <h3>Akses cepat</h3>
          <p class="muted">Kelola data tanpa membuka database secara manual.</p>
          <div class="admin-quick-grid">
            <button type="button" class="secondary-btn" data-admin-tab="users">Kelola Peserta</button>
            <button type="button" class="secondary-btn" data-admin-tab="results">Lihat Nilai</button>
            <button type="button" class="secondary-btn" data-admin-tab="questions">Bank Soal</button>
            <button type="button" class="secondary-btn" data-admin-tab="labels">Label Nilai</button>
          </div>
          <div class="warning-box"><strong>Catatan:</strong> perubahan bank soal dan label langsung tersimpan ke database.</div>
        </div>
      </div>
    `;

    $('adminRefreshBtn').addEventListener('click', async () => {
      busy($('adminRefreshBtn'), 'Memuat…', true);
      try { await refreshAdminData(); renderAdmin(); } catch (e) { toast(e.message, 'warning'); }
      finally { busy($('adminRefreshBtn'), '', false); }
    });
    bindAdminTabButtons();
  }

  function renderAdminUsers() {
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head">
        <div><div class="eyebrow">PESERTA</div><h2>Manajemen akun</h2><p class="muted">Tambah, reset sandi, atau hapus akun peserta.</p></div>
      </div>
      <div class="admin-card card">
        <form id="adminCreateUserForm" class="admin-form-grid">
          <label>Username<input id="adminNewUsername" maxlength="24" required></label>
          <label>Email<input id="adminNewEmail" type="email" placeholder="opsional"></label>
          <label>Password awal<input id="adminNewPassword" type="password" minlength="8" required></label>
          <button class="primary-btn" type="submit">+ Tambah Akun</button>
        </form>
      </div>
      <div class="admin-card card">
        <div class="admin-table-title"><h3>Daftar akun</h3><button type="button" class="secondary-btn" id="adminUsersRefresh">↻ Refresh</button></div>
        <div class="table-wrap admin-table-wrap"><table><thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Dibuat</th><th>Tes</th><th>Aksi</th></tr></thead><tbody id="adminUsersBody"></tbody></table></div>
      </div>
    `;

    const body = $('adminUsersBody');
    body.innerHTML = state.admin.users.map((user) => `
      <tr>
        <td><strong>${escapeHtml(user.username)}</strong><small class="admin-sub">${escapeHtml(user.user_id)}</small></td>
        <td>${escapeHtml(user.email || '—')}</td>
        <td><span class="admin-role ${user.role === 'admin' ? 'admin-role-admin' : ''}">${escapeHtml(user.role)}</span></td>
        <td>${escapeHtml(formatDate(user.created_at))}</td>
        <td>${Number(user.test_count) || 0}</td>
        <td class="admin-actions-cell">
          ${user.role === 'user' ? `<button type="button" class="secondary-btn admin-small-btn" data-user-reset="${escapeHtml(user.user_id)}">Reset Sandi</button><button type="button" class="danger-btn admin-small-btn" data-user-delete="${escapeHtml(user.user_id)}">Hapus</button>` : '<span class="admin-muted">Dilindungi</span>'}
        </td>
      </tr>
    `).join('') || `<tr><td colspan="6" class="admin-empty-cell">Belum ada akun.</td></tr>`;

    $('adminCreateUserForm').addEventListener('submit', adminCreateUserSubmit);
    $('adminUsersRefresh').addEventListener('click', async () => { await refreshAdminUsers(); });
    document.querySelectorAll('[data-user-reset]').forEach((button) => button.addEventListener('click', () => adminResetUser(button.dataset.userReset)));
    document.querySelectorAll('[data-user-delete]').forEach((button) => button.addEventListener('click', () => adminDeleteUser(button.dataset.userDelete)));
  }

  async function refreshAdminUsers() {
    try {
      const response = await apiChecked('adminGetUsers', { token: state.session.token });
      state.admin.users = response.users || [];
      renderAdminUsers();
    } catch (error) { toast(error.message, 'warning'); }
  }

  async function adminCreateUserSubmit(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const user = { username: $('adminNewUsername').value.trim(), email: $('adminNewEmail').value.trim(), password: $('adminNewPassword').value };
    try {
      busy(button, 'Menyimpan…', true);
      const response = await apiChecked('adminCreateUser', { token: state.session.token, user });
      toast(response.message || 'Akun dibuat.', 'success');
      event.currentTarget.reset();
      await refreshAdminUsers();
    } catch (error) { toast(error.message, 'warning'); }
    finally { busy(button, '', false); }
  }

  async function adminResetUser(userId) {
    const user = state.admin.users.find((item) => item.user_id === userId);
    if (!user) return;
    const choice = window.prompt(`Reset sandi untuk ${user.username}.\nKetik MANUAL untuk menentukan sandi sendiri, atau kosongkan untuk password otomatis.`, '');
    if (choice === null) return;
    const mode = choice.trim().toUpperCase() === 'MANUAL' ? 'manual' : 'generated';
    let password = '';
    if (mode === 'manual') {
      password = window.prompt('Masukkan password baru (minimal 8 karakter):', '');
      if (password === null) return;
    }
    try {
      const response = await apiChecked('adminResetUserPassword', { token: state.session.token, user_id: userId, mode, password });
      window.alert(`Password ${response.username || user.username} berhasil direset.\n\nPassword baru: ${response.temporary_password}`);
    } catch (error) { toast(error.message, 'warning'); }
  }

  async function adminDeleteUser(userId) {
    const user = state.admin.users.find((item) => item.user_id === userId);
    if (!user) return;
    if (!window.confirm(`Hapus akun ${user.username}?\n\nHistori dan detail tes akun ini juga akan dihapus.`)) return;
    try {
      const response = await apiChecked('adminDeleteUser', { token: state.session.token, user_id: userId });
      toast(response.message || 'Akun dihapus.', 'success');
      await refreshAdminUsers();
      await refreshAdminData();
    } catch (error) { toast(error.message, 'warning'); }
  }

  function renderAdminResults() {
    const resultRows = state.admin.results;
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head"><div><div class="eyebrow">HASIL TES</div><h2>Semua hasil peserta</h2><p class="muted">Filter berdasarkan username, tes, dan rentang skor.</p></div><button type="button" class="secondary-btn" id="adminResultsRefresh">↻ Refresh</button></div>
      <div class="admin-card card">
        <div class="admin-filter-grid">
          <label>Username<input id="adminFilterUsername" placeholder="cari username"></label>
          <label>Tes<select id="adminFilterTest"><option value="">Semua tes</option>${Object.entries(TESTS).map(([id, test]) => `<option value="${id}">${escapeHtml(test.name)}</option>`).join('')}</select></label>
          <label>Skor minimum<input id="adminFilterMin" type="number" min="0" max="100"></label>
          <label>Skor maksimum<input id="adminFilterMax" type="number" min="0" max="100"></label>
          <button type="button" class="primary-btn" id="adminApplyFilters">Terapkan Filter</button>
        </div>
      </div>
      <div class="admin-card card"><div class="table-wrap admin-table-wrap"><table><thead><tr><th>Tanggal</th><th>Peserta</th><th>Tes</th><th>Paket</th><th>Skor</th><th>Label</th><th>Benar</th><th>Salah</th><th>Kecepatan</th><th>Ketelitian</th></tr></thead><tbody id="adminResultsBody"></tbody></table></div></div>
    `;
    renderAdminResultsBody(resultRows);
    $('adminApplyFilters').addEventListener('click', adminApplyResultFilters);
    $('adminResultsRefresh').addEventListener('click', async () => { await refreshAdminData(); renderAdminResults(); });
  }

  function renderAdminResultsBody(rows) {
    const body = $('adminResultsBody');
    if (!body) return;
    body.innerHTML = rows.length ? rows.map((item) => `
      <tr><td>${escapeHtml(formatDate(item.tanggal))}</td><td><strong>${escapeHtml(item.username)}</strong><small class="admin-sub">${escapeHtml(item.email || '')}</small></td><td>${escapeHtml(adminTestName(item.test_type))}</td><td>${Number(item.package) || 1}</td><td><strong>${Number(item.score) || 0}%</strong></td><td><span class="admin-badge">${escapeHtml(item.label || 'Belum ada label')}</span></td><td>${Number(item.correct) || 0}</td><td>${Number(item.wrong) || 0}</td><td>${Number(item.speed) || 0}%</td><td>${Number(item.accuracy) || 0}%</td></tr>
    `).join('') : `<tr><td colspan="10" class="admin-empty-cell">Tidak ada data sesuai filter.</td></tr>`;
  }

  async function adminApplyResultFilters() {
    try {
      const response = await apiChecked('adminGetResults', { token: state.session.token, filters: { username: $('adminFilterUsername').value, test_type: $('adminFilterTest').value, min_score: $('adminFilterMin').value, max_score: $('adminFilterMax').value } });
      state.admin.results = response.results || [];
      renderAdminResultsBody(state.admin.results);
    } catch (error) { toast(error.message, 'warning'); }
  }

  function renderAdminQuestions() {
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head">
        <div>
          <div class="eyebrow">BANK SOAL</div>
          <h2>Kelola Bank Soal</h2>
          <p class="muted">Kelola bank soal Psikotes Umum dan SKD. Satu file JSON dapat berisi Paket 1, 2, dan 3 sekaligus.</p>
        </div>
      </div>
      <div class="admin-card card">
        <div class="admin-filter-grid admin-question-tools">
          <label>Tes<select id="adminQuestionTest">${renderAdminTestOptions_('kuantitatif')}</select></label>
          <label>Paket (filter)<select id="adminQuestionPackage"><option value="">Semua Paket</option><option value="1">Paket 1</option><option value="2">Paket 2</option><option value="3">Paket 3</option></select></label>
          <label>Upload JSON<input id="adminQuestionFile" type="file" accept="application/json,.json"></label>
          <button type="button" class="primary-btn" id="adminUploadQuestionBtn">Upload JSON</button>
          <button type="button" class="secondary-btn" id="adminMigrateAllQuestionsBtn">Migrasikan Semua JSON</button>
          <button type="button" class="secondary-btn" id="adminLoadQuestionsBtn">Muat Soal</button>
        </div>
        <div class="warning-box"><strong>Format:</strong> file JSON mengikuti struktur <code>kategori → paket[] → soal[]</code>. Upload tidak perlu memilih paket karena semua paket di dalam file akan diproses otomatis. Sistem mengirim maksimal 25 soal per request agar migrasi aman.</div>
        <div id="adminQuestionProgress" class="admin-muted" style="margin-top:10px"></div>
      </div>
      <div class="admin-card card"><div class="admin-table-title"><h3>Soal tersimpan</h3><span id="adminQuestionCount" class="admin-muted">0 soal</span></div><div class="table-wrap admin-table-wrap"><table><thead><tr><th>Paket</th><th>No</th><th>Pertanyaan</th><th>Jawaban</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="adminQuestionsBody"></tbody></table></div></div>
    `;
    $('adminUploadQuestionBtn').addEventListener('click', adminUploadQuestionFile);
    $('adminMigrateAllQuestionsBtn').addEventListener('click', adminMigrateAllQuestions);
    $('adminLoadQuestionsBtn').addEventListener('click', adminLoadQuestions);
    $('adminQuestionTest').addEventListener('change', adminLoadQuestions);
    $('adminQuestionPackage').addEventListener('change', adminLoadQuestions);
    adminLoadQuestions();
  }

  let adminQuestionsCache = [];

  async function adminLoadQuestions() {
    try {
      const packageValue = $('adminQuestionPackage').value;
      const response = await apiChecked('adminGetQuestions', {
        token: state.session.token,
        test_type: $('adminQuestionTest').value,
        package: packageValue === '' ? 0 : Number(packageValue),
        include_inactive: true
      });
      adminQuestionsCache = response.questions || [];
      $('adminQuestionCount').textContent = `${adminQuestionsCache.length} soal`;
      $('adminQuestionsBody').innerHTML = adminQuestionsCache.length ? adminQuestionsCache.map((q) => `
        <tr><td>${Number(q.package) || 0}</td><td>${Number(q.no_soal) || 0}</td><td class="admin-question-cell">${escapeHtml(q.question)}</td><td><strong>${escapeHtml(q.answer)}</strong></td><td><span class="admin-role ${q.active ? '' : 'admin-role-off'}">${q.active ? 'Aktif' : 'Nonaktif'}</span></td><td class="admin-actions-cell"><button type="button" class="secondary-btn admin-small-btn" data-q-edit="${escapeHtml(q.question_id)}">Edit</button>${q.active ? `<button type="button" class="danger-btn admin-small-btn" data-q-delete="${escapeHtml(q.question_id)}">Hapus</button>` : ''}</td></tr>
      `).join('') : `<tr><td colspan="6" class="admin-empty-cell">Belum ada soal pada filter ini. Upload JSON untuk memindahkan bank soal.</td></tr>`;
      document.querySelectorAll('[data-q-edit]').forEach((button) => button.addEventListener('click', () => adminEditQuestion(button.dataset.qEdit)));
      document.querySelectorAll('[data-q-delete]').forEach((button) => button.addEventListener('click', () => adminDeleteQuestion(button.dataset.qDelete)));
    } catch (error) { toast(error.message, 'warning'); }
  }

  const ADMIN_QUESTION_BATCH_SIZE = 25;

  function normalizeQuestionPayloads_(data, testType) {
    const questions = [];
    if (!data || !Array.isArray(data.paket)) {
      throw new Error('JSON tidak memiliki array paket[].');
    }

    data.paket.forEach((pkg) => {
      const packageNumber = Number(pkg?.id_paket);
      if (!Number.isInteger(packageNumber) || packageNumber < 1) return;
      if (!Array.isArray(pkg.soal)) return;

      pkg.soal.forEach((q, index) => {
        const noSoal = Number(q?.id) || index + 1;
        questions.push({
          question_id: `${testType}-${packageNumber}-${noSoal}`,
          test_type: testType,
          package: packageNumber,
          no_soal: noSoal,
          question: q?.question,
          options: q?.options || {},
          answer: q?.answer,
          discussion: q?.discussion || ''
        });
      });
    });

    if (!questions.length) {
      throw new Error('Tidak ada soal yang ditemukan di JSON.');
    }

    return questions;
  }

  async function adminSaveQuestionBatches(questions, label = 'Upload') {
    let added = 0;
    let updated = 0;

    for (let start = 0; start < questions.length; start += ADMIN_QUESTION_BATCH_SIZE) {
      const batch = questions.slice(start, start + ADMIN_QUESTION_BATCH_SIZE);
      const end = Math.min(start + batch.length, questions.length);
      const progress = $('adminQuestionProgress');
      if (progress) progress.textContent = `${label}: ${end}/${questions.length} soal diproses…`;

      const response = await apiChecked('adminSaveQuestions', {
        token: state.session.token,
        questions: batch
      });

      added += Number(response.added) || 0;
      updated += Number(response.updated) || 0;
    }

    const progress = $('adminQuestionProgress');
    if (progress) progress.textContent = `${label} selesai: ${added} ditambahkan, ${updated} diperbarui (${questions.length} total).`;

    return { added, updated, total: questions.length };
  }

  async function adminUploadQuestionFile() {
    const input = $('adminQuestionFile');
    const file = input.files?.[0];
    if (!file) { toast('Pilih file JSON dulu.', 'warning'); return; }

    const button = $('adminUploadQuestionBtn');
    try {
      busy(button, 'Memproses…', true);
      const data = JSON.parse(await file.text());
      const testType = $('adminQuestionTest').value;
      const questions = normalizeQuestionPayloads_(data, testType);
      const result = await adminSaveQuestionBatches(questions, file.name);

      toast(`${file.name}: ${result.total} soal diproses.`, 'success', 5000);
      input.value = '';
      await adminLoadQuestions();
      await refreshAdminData();
    } catch (error) {
      const progress = $('adminQuestionProgress');
      if (progress) progress.textContent = `Upload gagal: ${error.message}`;
      toast(`Upload JSON gagal: ${error.message}`, 'warning', 6000);
    } finally {
      busy(button, '', false);
    }
  }

  async function adminMigrateAllQuestions() {
    const button = $('adminMigrateAllQuestionsBtn');
    if (!button) return;
    if (!window.confirm('Migrasikan semua bank soal JSON yang tersedia ke database? Data dengan question_id yang sama akan diperbarui, bukan diduplikasi.')) return;

    const files = Object.entries(QUESTION_FILES);
    let total = 0;
    let added = 0;
    let updated = 0;
    let skipped = 0;

    try {
      busy(button, 'Migrasi berjalan…', true);

      for (let index = 0; index < files.length; index += 1) {
        const [testType, filePath] = files[index];
        const progress = $('adminQuestionProgress');
        if (progress) progress.textContent = `Memuat ${index + 1}/${files.length}: ${filePath}`;

        const response = await fetch(filePath, { cache: 'no-cache' });
        if (!response.ok) {
          skipped += 1;
          continue;
        }

        const data = await response.json();
        const questions = normalizeQuestionPayloads_(data, testType);
        const result = await adminSaveQuestionBatches(questions, `${filePath}`);

        total += result.total;
        added += result.added;
        updated += result.updated;
      }

      const progress = $('adminQuestionProgress');
      if (progress) progress.textContent = `Migrasi selesai: ${total} soal diproses, ${added} ditambahkan, ${updated} diperbarui${skipped ? `, ${skipped} file dilewati karena belum tersedia.` : '.'}`;
      toast(`Migrasi selesai (${total} soal).${skipped ? ` ${skipped} bank belum punya file JSON.` : ''}`, 'success', 6000);
      await adminLoadQuestions();
      await refreshAdminData();
    } catch (error) {
      const progress = $('adminQuestionProgress');
      if (progress) progress.textContent = `Migrasi berhenti: ${error.message}`;
      toast(`Migrasi semua JSON gagal: ${error.message}`, 'warning', 7000);
    } finally {
      busy(button, '', false);
    }
  }

  async function adminEditQuestion(questionId) {
    const question = adminQuestionsCache.find((item) => item.question_id === questionId);
    if (!question) return;
    const raw = window.prompt('Edit soal dalam JSON. Setelah selesai, tekan OK.\n\nFormat contoh: {"question":"...","options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"answer":"A","discussion":"..."}', JSON.stringify({ question: question.question, options: { A:question.option_a, B:question.option_b, C:question.option_c, D:question.option_d, E:question.option_e }, answer:question.answer, discussion:question.discussion }, null, 2));
    if (raw === null) return;
    try {
      const edited = JSON.parse(raw);
      const payload = { question_id: question.question_id, test_type: question.test_type, package: question.package, no_soal: question.no_soal, question: edited.question, options: edited.options, answer: edited.answer, discussion: edited.discussion };
      await apiChecked('adminSaveQuestions', { token: state.session.token, questions: [payload] });
      toast('Soal berhasil diperbarui.', 'success');
      await adminLoadQuestions();
    } catch (error) { toast(`Soal tidak valid: ${error.message}`, 'warning', 4500); }
  }

  async function adminDeleteQuestion(questionId) {
    const question = adminQuestionsCache.find((item) => item.question_id === questionId);
    if (!question || !window.confirm(`Nonaktifkan soal nomor ${question.no_soal}? Soal tidak akan dipakai peserta, tetapi datanya tetap tersimpan.`)) return;
    try { const response = await apiChecked('adminDeleteQuestion', { token: state.session.token, question_id: questionId }); toast(response.message || 'Soal dinonaktifkan.', 'success'); await adminLoadQuestions(); }
    catch (error) { toast(error.message, 'warning'); }
  }

  function renderAdminLabels() {
    const selected = state.admin.labelTest || 'kuantitatif';
    const labels = state.admin.labels.filter((item) => item.test_type === selected);
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head"><div><div class="eyebrow">PENILAIAN</div><h2>Label kelulusan multi-tingkat</h2><p class="muted">Atur batas nilai masing-masing tes. Rentang 0–100.</p></div></div>
      <div class="admin-card card">
        <div class="admin-filter-grid"><label>Tes<select id="adminLabelTest">${Object.entries(TESTS).map(([id,test]) => `<option value="${id}" ${id===selected?'selected':''}>${escapeHtml(test.name)}</option>`).join('')}</select></label><div class="admin-label-help">Contoh: 90–100 = Sangat Baik, 80–89 = Baik.</div><button type="button" class="secondary-btn" id="adminAddLabel">+ Tambah Label</button><button type="button" class="primary-btn" id="adminSaveLabels">Simpan Label</button></div>
      </div>
      <div class="admin-card card"><div id="adminLabelsList" class="admin-label-list"></div></div>
    `;
    const list = $('adminLabelsList');
    list.innerHTML = labels.map((item, index) => `
      <div class="admin-label-row" data-label-index="${index}"><input class="admin-label-name" value="${escapeHtml(item.label)}" placeholder="Nama label"><input class="admin-label-min" type="number" min="0" max="100" value="${Number(item.min_score)}"><span>hingga</span><input class="admin-label-max" type="number" min="0" max="100" value="${Number(item.max_score)}"><button type="button" class="danger-btn admin-small-btn admin-remove-label">Hapus</button></div>
    `).join('');
    $('adminLabelTest').addEventListener('change', async () => { state.admin.labelTest = $('adminLabelTest').value; await loadAdminLabelsForSelected(); });
    $('adminAddLabel').addEventListener('click', () => {
      const row = document.createElement('div'); row.className='admin-label-row'; row.innerHTML='<input class="admin-label-name" value="Label Baru"><input class="admin-label-min" type="number" min="0" max="100" value="0"><span>hingga</span><input class="admin-label-max" type="number" min="0" max="100" value="100"><button type="button" class="danger-btn admin-small-btn admin-remove-label">Hapus</button>'; list.appendChild(row); bindLabelRemoveButtons();
    });
    $('adminSaveLabels').addEventListener('click', adminSaveLabels);
    bindLabelRemoveButtons();
  }

  function bindLabelRemoveButtons() { document.querySelectorAll('.admin-remove-label').forEach((button) => button.onclick = () => button.closest('.admin-label-row')?.remove()); }

  async function loadAdminLabelsForSelected() {
    try { const response = await apiChecked('adminGetScoreLabels', { token:state.session.token, test_type:state.admin.labelTest }); state.admin.labels = [...state.admin.labels.filter((x)=>x.test_type!==state.admin.labelTest), ...(response.labels||[])]; renderAdminLabels(); }
    catch(error){toast(error.message,'warning');}
  }

  async function adminSaveLabels() {
    const type = $('adminLabelTest').value;
    const labels = Array.from(document.querySelectorAll('.admin-label-row')).map((row, index) => ({ label:row.querySelector('.admin-label-name').value.trim(), min_score:Number(row.querySelector('.admin-label-min').value), max_score:Number(row.querySelector('.admin-label-max').value), urutan:index+1 }));
    try { const response = await apiChecked('adminSaveScoreLabels', { token:state.session.token, test_type:type, labels }); toast(response.message||'Label tersimpan.','success'); const refreshed=await apiChecked('adminGetScoreLabels',{token:state.session.token,test_type:type}); state.admin.labels=[...state.admin.labels.filter((x)=>x.test_type!==type),...(refreshed.labels||[])]; renderAdminLabels(); }
    catch(error){toast(error.message,'warning');}
  }

  function bindAdminTabButtons() {
    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
      button.addEventListener('click', async () => { state.admin.tab = button.dataset.adminTab; if (state.admin.tab === 'labels' && !state.admin.labelTest) state.admin.labelTest='kuantitatif'; renderAdmin(); });
    });
  }
