'use strict';

// ============================================================
  // AUTH
  // ============================================================

  function showAuth(mode) {
    const registerMode = mode === 'register';
    const forgotMode = mode === 'forgot';

    $('loginPane').hidden = registerMode || forgotMode;
    $('registerPane').hidden = !registerMode;
    $('forgotPane').hidden = !forgotMode;
    if ($('resetPane')) $('resetPane').hidden = true;

    $('authTitle').textContent = registerMode
      ? 'Buat akun peserta'
      : forgotMode
        ? 'Lupa password'
        : 'Selamat datang kembali';
    $('authSubtitle').textContent = registerMode
      ? 'Akun digunakan untuk menyimpan histori latihan dan memantau perkembanganmu.'
      : forgotMode
        ? 'Masukkan username atau email akunmu, kami kirimkan link reset password ke email terdaftar.'
        : 'Masuk untuk melanjutkan latihan dan melihat histori.';

    $('loginError').textContent = '';
    $('registerError').textContent = '';
    if ($('forgotError')) $('forgotError').textContent = '';
    if ($('forgotSuccess')) $('forgotSuccess').textContent = '';

    showView('auth');

    setTimeout(() => {
      $(registerMode ? 'registerUsername' : forgotMode ? 'forgotIdentifier' : 'loginUsername')?.focus();
    }, 30);
  }

  async function register() {
    const username = $('registerUsername').value.trim();
    const email = $('registerEmail').value.trim();
    const password = $('registerPassword').value;
    const confirm = $('registerConfirm').value;
    const error = $('registerError');
    const button = $('registerForm').querySelector('button[type="submit"]');
    error.textContent = '';

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      error.textContent = 'Username 3–24 karakter dan hanya boleh huruf kecil, angka, serta underscore (_).';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error.textContent = 'Format email tidak valid.';
      return;
    }
    if (password.length < 8) {
      error.textContent = 'Password minimal 8 karakter.';
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      error.textContent = 'Password harus mengandung kombinasi huruf dan angka.';
      return;
    }
    if (password !== confirm) {
      error.textContent = 'Konfirmasi password belum sama.';
      return;
    }
trackEvent('register_attempt');
    busy(button, 'Membuat akun…', true);

    try {
      const response = await apiChecked('register', { username, password, email });
      state.session = response.session;
      state.isGuest = false;
      saveSession();
      $('registerForm').reset();
      await goDashboard('Akun berhasil dibuat.');
      trackEvent('register_success');
    } catch (errorObject) {
      error.textContent = errorObject.message || 'Gagal membuat akun.';
    } finally {
      busy(button, '', false);
    }
  }

  async function login() {
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;
    const error = $('loginError');
    const button = $('loginForm').querySelector('button[type="submit"]');
    error.textContent = '';

    if (!username || !password) {
      error.textContent = 'Username dan password wajib diisi.';
      return;
    }

    busy(button, 'Memeriksa…', true);

    let lastError = null;
    const maxAttempts = 3;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await apiChecked(
            'login',
            { username, password },
            20000
          );

          state.session = response.session;
          state.isGuest = false;
          saveSession();
          $('loginForm').reset();
          await goDashboard('Login berhasil.');
          return;
        } catch (errorObject) {
          lastError = errorObject;

          const isBackendTimeout =
            errorObject?.code === 'BACKEND_TIMEOUT' ||
            errorObject?.message === 'BACKEND_TIMEOUT';

          // Hanya retry kalau jalur backend timeout.
          // Salah username/password tidak perlu menunggu 3 kali.
          if (!isBackendTimeout || attempt >= maxAttempts) {
            throw errorObject;
          }

          error.textContent =
            `Mohon tunggu… mencoba lagi (${attempt}/${maxAttempts - 1})`;

          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * attempt)
          );
        }
      }
    } catch (errorObject) {
      const isBackendTimeout =
        errorObject?.code === 'BACKEND_TIMEOUT' ||
        errorObject?.message === 'BACKEND_TIMEOUT';

      if (isBackendTimeout || lastError?.code === 'BACKEND_TIMEOUT') {
        error.textContent =
          'Mohon tunggu / silakan refresh dan isi kembali.';
      } else {
        error.textContent =
          errorObject.message || 'Login gagal.';
      }
    } finally {
      busy(button, '', false);
    }
  }

  async function requestReset() {
    const identifier = $('forgotIdentifier').value.trim();
    const error = $('forgotError');
    const success = $('forgotSuccess');
    const button = $('forgotForm').querySelector('button[type="submit"]');
    error.textContent = '';
    success.textContent = '';

    if (!identifier) {
      error.textContent = 'Masukkan username atau email dulu.';
      return;
    }

    busy(button, 'Mengirim…', true);

    try {
      const appUrl = `${location.origin}${location.pathname}`;
      const response = await apiChecked('requestPasswordReset', { identifier, appUrl });
      success.textContent = response.message || 'Kalau akun ditemukan, link reset sudah dikirim ke email terdaftar.';
      $('forgotForm').reset();
    } catch (errorObject) {
      error.textContent = errorObject.message || 'Gagal mengirim link reset.';
    } finally {
      busy(button, '', false);
    }
  }

  async function submitNewPassword(token) {
    const password = $('resetPassword').value;
    const confirm = $('resetConfirm').value;
    const error = $('resetError');
    const button = $('resetForm').querySelector('button[type="submit"]');
    error.textContent = '';

    if (password.length < 8) {
      error.textContent = 'Password minimal 8 karakter.';
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      error.textContent = 'Password harus mengandung kombinasi huruf dan angka.';
      return;
    }
    if (password !== confirm) {
      error.textContent = 'Konfirmasi password belum sama.';
      return;
    }

    busy(button, 'Menyimpan…', true);

    try {
      const response = await apiChecked('resetPassword', { token, password });
      toast(response.message || 'Password berhasil diganti.', 'success', 3600);
      $('resetForm').reset();

      // Bersihkan token dari URL supaya tidak bisa dipakai ulang lewat tombol back,
      // lalu arahkan balik ke pane login.
      const url = new URL(location.href);
      url.searchParams.delete('reset');
      history.replaceState({}, '', url.toString());

      showAuth('login');
    } catch (errorObject) {
      error.textContent = errorObject.message || 'Gagal mengganti password.';
    } finally {
      busy(button, '', false);
    }
  }

  async function logout() {
    try {
      if (state.session?.token) {
        await apiChecked('logout', { token: state.session.token });
      }
    } catch (_) {
      // Logout lokal tetap dilakukan meskipun request backend gagal.
    } finally {
      clearSession();
      leaveGuest();
      showView('landing');
      toast('Kamu sudah keluar.', 'info');
    }
  }
