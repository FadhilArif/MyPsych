'use strict';

// ============================================================
  // VIEW / TOAST
  // ============================================================

  function showView(name) {
    if ((name === 'skd' || name === 'cv') && !state.session) {
      openAccountGate_(name);
      return;
    }

    Object.values(views).forEach((view) => view?.classList.remove('active'));
    if (name !== 'test') {
      $('testView')?.classList.remove('skd-complete-mode');
    }
    views[name]?.classList.add('active');
    document.body.dataset.view = name;
    document.body.dataset.mode = state.isGuest ? 'guest' : 'account';

    const pageTitles = {
      dashboard: 'Dashboard',
      skd: 'SKD (CPNS)',
      history: 'Histori',
      instruction: 'Persiapan Tes',
      result: 'Hasil Latihan',
      admin: 'Admin Panel',
      cv: 'Buat CV',
      psikotes: 'Psikotes Umum',
    };
    const pageTitle = $('pageTitle');
    if (pageTitle) pageTitle.textContent = pageTitles[name] || 'MyPsych';

    document.querySelectorAll('[data-app-nav]').forEach((item) => {
      item.classList.toggle('active', item.dataset.appNav === name);
    });

    if (name !== 'test') stopTimer();

    if (name === 'cv') {
      window.MyPsychCv?.init?.();
    }

    window.scrollTo(0, 0);
  }

  function toast(message, type = 'info', duration = 2800, onClick = null) {
    const root = $('toastRoot');
    if (!root) return;

    root.innerHTML = '';
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;

    if (onClick) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        onClick();
        el.remove();
      });
    }

    root.appendChild(el);

    setTimeout(() => el.remove(), duration);
  }

  function busy(button, label, isBusy) {
    if (!button) return;

    if (isBusy) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = label;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }
