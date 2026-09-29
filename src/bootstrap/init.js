'use strict';

// ============================================================
  // INIT
  // ============================================================

  async function loadStats() {
  try {
    const response = await api('stats');
    if (!response?.success || !response.stats) return;
    const { users, tests, questions } = response.stats;

    document.querySelectorAll('[data-stat="users"]').forEach(el => {
      el.textContent = formatNumber(users);
    });
    document.querySelectorAll('[data-stat="tests"]').forEach(el => {
      el.textContent = formatNumber(tests);
    });
    document.querySelectorAll('[data-stat="questions"]').forEach(el => {
      el.textContent = formatNumber(questions);
    });
  } catch (err) {
    console.warn('[stats] gagal load:', err.message);
    // Biarkan placeholder "…" — jangan crash
  }
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0','') + ' jt';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0','') + ' rb';
  return String(n);
}
  async function init() {
    bind();

    // Always start with the desktop rail collapsed / mobile drawer closed.
    // This also clears a stale UI state when the browser restores a page.
    closeSidebar_();

    window.addEventListener('pageshow', () => {
      closeSidebar_();
    });

    const params = new URLSearchParams(location.search);
    const resetToken = params.get('reset');

    if (resetToken) {
      $('loginPane').hidden = true;
      $('registerPane').hidden = true;
      $('forgotPane').hidden = true;
      $('resetPane').hidden = false;
      $('authTitle').textContent = 'Buat password baru';
      $('authSubtitle').textContent = 'Masukkan password baru untuk akunmu. Link ini berlaku 30 menit.';
      showView('auth');
      return;
    }

    state.session = loadSession();
    state.isGuest = false;

    renderCatalog();
    loadStats();

    if (state.session) {
      $('welcomeName').textContent = state.session.username;
      updateUserChrome_(state.session.username, isAdmin() ? 'Administrator' : 'Akun peserta');

      if (isAdmin()) {
        try {
          await openAdminDashboard('overview');
        } catch (error) {
          toast(`Dashboard admin belum dapat dibuka: ${error.message}`, 'warning', 4500);
        }
        return;
      }

      showView('dashboard');

      try {
        await refreshHistory();
      } catch (error) {
        toast(`Belum dapat mengambil histori: ${error.message}`, 'warning', 4500);
      }

      if (loadPersistedTest() || loadPersistedSKDComplete_()) {
        toast(
          'Ada progress tes yang tersimpan. Klik untuk melanjutkan →',
          'info',
          6000,
          resumePersistedTest
        );
      }
    } else {
      showView('landing');
    }
  }

  init();
