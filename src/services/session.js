'use strict';

// ============================================================
  // SESSION
  // ============================================================

  function saveSession() {
    if (!state.session) {
      localStorage.removeItem(CONFIG.SESSION_KEY);
      return;
    }

    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(state.session));
  }

  function loadSession() {
    try {
      const session = JSON.parse(localStorage.getItem(CONFIG.SESSION_KEY) || 'null');
      if (!session?.token || !session?.user_id || !session?.username) return null;
      if (!session.role) session.role = 'user';
      return session;
    } catch {
      return null;
    }
  }

  function clearSession() {
    state.session = null;
    localStorage.removeItem(CONFIG.SESSION_KEY);
  }
