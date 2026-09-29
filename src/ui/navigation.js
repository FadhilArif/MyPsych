'use strict';

// ============================================================
  // MODAL / NAVIGATION
  // ============================================================

  function openEndTestModal() {
    if (!views.test?.classList.contains('active')) return;
    $('confirmModal').hidden = false;
  }

  async function returnToTestOrigin_() {
    const target = state.returnView || 'dashboard';
    closeSidebar_();

    if (target === 'psikotes') {
      renderCatalog();
      showView('psikotes');
      return;
    }

    if (target === 'skd') {
      showView('skd');
      return;
    }

    if (target === 'history') {
      if (!state.isGuest) {
        try { await refreshHistory(); } catch (error) { toast(error.message, 'warning'); }
      }
      renderHistory();
      showView('history');
      return;
    }

    if (target === 'cv') {
      showView('cv');
      return;
    }

    await goDashboard();
  }

  function abandonTest() {
    stopTimer();
    stopSKDCompleteTimer_();
    state.skdComplete.active = false;
    state.skdComplete.waiting = false;
    $('testView')?.classList.remove('skd-complete-mode');
    state.finished = true;
    state.lastResult = null;
    clearPersistedTest();
    $('confirmModal').hidden = true;
    returnToTestOrigin_();
    toast('Tes dibatalkan. Progress tidak disimpan.', 'info');
  }
