'use strict';

// ============================================================
  // PASSWORD VISIBILITY TOGGLE
  // ============================================================

  function bindPasswordToggles() {
    document.querySelectorAll('[data-password-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = $(button.dataset.passwordTarget);
        if (!input) return;

        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';

        button.setAttribute(
          'aria-label',
          visible ? 'Tampilkan password' : 'Sembunyikan password'
        );
        button.setAttribute(
          'title',
          visible ? 'Tampilkan password' : 'Sembunyikan password'
        );
        button.classList.toggle('is-visible', !visible);

        const icon = button.querySelector('span');
        if (icon) icon.textContent = visible ? 'Show' : 'Hide';
      });
    });
  }
