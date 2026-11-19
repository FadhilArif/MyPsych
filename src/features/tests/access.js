'use strict';

// ============================================================
// AKSES PAKET BERBAYAR (SKD / TIU HOTS)
// ============================================================
//
// Admin membuka paket per user lewat panel admin. Di client, status
// akses hanya dipakai untuk UX (label kunci + cegah mulai). Penegakan
// sebenarnya tetap di server (getQuestionPackage / checkAnswer / gradeTest).

function packageAccessState_(testId = 'skd_paket') {
  if (!state.packageAccess) state.packageAccess = {};

  const id = String(testId);
  if (!state.packageAccess[id]) {
    state.packageAccess[id] = {
      userId: null,
      loaded: false,
      loading: false,
      promise: null,
      admin: false,
      total: Number(TESTS[id]?.packages) || 0,
      unlocked: [],
      error: ''
    };
  }

  return state.packageAccess[id];
}

async function loadPackageAccess_(testId = 'skd_paket', options = {}) {
  const id = String(testId);
  const access = packageAccessState_(id);
  const userId = state.session?.user_id || null;

  if (!state.session?.token || !userId) {
    access.userId = null;
    access.loaded = true;
    access.loading = false;
    access.admin = false;
    access.unlocked = [];
    access.error = '';
    return access;
  }

  if (!options.force && access.loaded && access.userId === userId) return access;
  if (access.loading && access.promise) return access.promise;

  access.loading = true;
  access.error = '';
  access.promise = (async () => {
    try {
      const response = await apiChecked('getPackageAccess', {
        token: state.session.token,
        test_type: id
      });

      access.userId = userId;
      access.admin = !!response.admin;
      access.total = Number(response.total) || access.total;
      access.unlocked = Array.isArray(response.unlocked)
        ? response.unlocked.map(Number).filter((value) => Number.isInteger(value))
        : [];
      access.loaded = true;
    } catch (error) {
      access.userId = userId;
      access.loaded = true;
      access.error = error.message || 'Akses paket gagal dimuat.';
      if (!options.silent) toast(access.error, 'warning', 5000);
    } finally {
      access.loading = false;
      access.promise = null;
    }

    return access;
  })();

  return access.promise;
}

async function ensurePackageAccess_(testId = 'skd_paket') {
  const access = packageAccessState_(testId);
  const userId = state.session?.user_id || null;

  if (access.loaded && access.userId === userId) return access;
  return loadPackageAccess_(testId, { silent: true });
}

function hasPackageAccess_(testId, packageNumber) {
  const access = packageAccessState_(testId);
  if (access.admin) return true;
  return access.unlocked.includes(Number(packageNumber));
}

function renderSKDPackageAccess_() {
  const access = packageAccessState_('skd_paket');
  const select = document.querySelector('[data-skd-package="skd_paket"]');
  const status = document.getElementById('skdPackageAccessStatus');
  const optionTotal = select ? select.options.length : 0;

  if (select) {
    Array.from(select.options).forEach((option) => {
      const number = Number(option.value);
      const unlocked = access.admin || access.unlocked.includes(number);
      option.textContent = `${unlocked ? '🔓' : '🔒'} Paket ${number}`;
    });
  }

  if (!status) return;

  if (!state.session?.token) {
    status.textContent = 'Masuk untuk melihat akses paket.';
    status.dataset.state = 'locked';
    return;
  }

  if (access.loading && !access.loaded) {
    status.textContent = 'Memuat akses paket…';
    status.dataset.state = 'loading';
    return;
  }

  if (access.admin) {
    status.textContent = 'Admin: semua paket terbuka.';
    status.dataset.state = 'admin';
    return;
  }

  if (access.error) {
    status.textContent = access.error;
    status.dataset.state = 'error';
    return;
  }

  const total = Number(access.total) || optionTotal || 10;

  if (!access.unlocked.length) {
    status.textContent = `0/${total} paket terbuka. Hubungi admin untuk membeli akses.`;
    status.dataset.state = 'locked';
    return;
  }

  const locked = [];
  for (let number = 1; number <= total; number += 1) {
    if (!access.unlocked.includes(number)) locked.push(number);
  }

  status.textContent = locked.length
    ? `Terbuka: ${access.unlocked.map((n) => `Paket ${n}`).join(', ')} · Terkunci: ${locked.map((n) => `Paket ${n}`).join(', ')}`
    : `Semua ${total} paket terbuka.`;
  status.dataset.state = locked.length ? 'partial' : 'open';
}

async function refreshSKDPackageAccess_(options = {}) {
  renderSKDPackageAccess_();
  await loadPackageAccess_('skd_paket', { silent: true, force: true, ...options });
  renderSKDPackageAccess_();
}
