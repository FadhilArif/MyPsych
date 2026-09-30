(() => {
  'use strict';

  const MODULES = [
    '/src/core/runtime.js',
    '/src/features/interest.js',
    '/src/ui/view.js',
    '/src/services/session.js',
    '/src/services/api.js',
    '/src/features/pdf/pdf-core.js',
    '/src/features/dashboard/dashboard.js',
    '/src/features/auth/auth.js',
    '/src/features/cv/cv-builder.js',
    '/src/features/tests/instructions.js',
    '/src/features/tests/engine.js',
    '/src/features/tests/skd-complete.js',
    '/src/features/tests/scoring.js',
    '/src/features/tests/persistence.js',
    '/src/features/tests/finish.js',
    '/src/features/results/results.js',
    '/src/features/pdf/result-pdf.js',
    '/src/ui/navigation.js',
    '/src/features/admin/admin.js',
    '/src/ui/password.js',
    '/src/ui/sidebar.js',
    '/src/bootstrap/events.js',
    '/src/bootstrap/init.js',
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Gagal memuat modul ${src}`));
      document.head.appendChild(script);
    });
  }

  (async () => {
    try {
      for (const src of MODULES) {
        await loadScript(src);
      }
    } catch (error) {
      console.error('[MyPsych] Module bootstrap failed:', error);
      const root = document.getElementById('toastRoot');
      if (root) {
        root.textContent = 'Aplikasi gagal dimuat. Silakan refresh halaman.';
      }
    }
  })();
})();
