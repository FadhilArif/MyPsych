'use strict';

// ============================================================
  // BACKEND CONNECTOR (Vercel /api/gateway, same-origin fetch)
  // ============================================================

  async function api(action, payload = {}) {
    if (!CONFIG.API_URL) {
      throw new Error('URL backend belum dikonfigurasi.');
    }

    let response;

    try {
      response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
    } catch (error) {
      throw new Error(`Gagal menghubungi backend: ${error.message || error}`);
    }

    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error('Respons backend tidak valid.');
    }

    return result;
  }

  async function apiChecked(action, payload = {}) {
    const result = await api(action, payload);

    if (!result?.success) {
      throw new Error(result?.message || 'Permintaan backend gagal.');
    }

    return result;
  }
