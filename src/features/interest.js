'use strict';

// ============================================================
  // HELPER
  // ============================================================
function trackEvent(name, props = {}) {
  try {
    if (window.va) {
      window.va('event', { name, ...props });
    }
  } catch (_) {}
}
  let interestCategory = null;

function openInterestModal(category) {
  interestCategory = category;
  const titles = {
    'kepribadian': 'Tes Kepribadian — Beri tahu saya',
    'situasional': 'Tes Situasional — Beri tahu saya',
    'cv-ats': 'Alat CV ATS — Beri tahu saya'
  };
  $('interestTitle').textContent = titles[category] || 'Beri tahu saya saat siap';
  $('interestError').textContent = '';
  $('interestSuccess').textContent = '';
  $('interestForm').reset();

  // Pre-fill email kalau sudah login
  if (state.session?.email) {
    $('interestEmail').value = state.session.email;
  }

  $('interestModal').hidden = false;
  setTimeout(() => $('interestEmail').focus(), 50);
}

function closeInterestModal() {
  $('interestModal').hidden = true;
  interestCategory = null;
}

async function submitInterest(event) {
  event.preventDefault();
  const email = $('interestEmail').value.trim();
  const note = $('interestNote').value.trim();
  const error = $('interestError');
  const success = $('interestSuccess');
  const button = event.currentTarget.querySelector('button[type="submit"]');

  error.textContent = '';
  success.textContent = '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.textContent = 'Format email tidak valid.';
    return;
  }

  busy(button, 'Mengirim…', true);
  trackEvent('interest_signup', { category: interestCategory });

  try {
    const response = await apiChecked('subscribeInterest', {
      email,
      category: interestCategory,
      userId: state.session?.user_id || '',
      note
    });
    success.textContent = response.message || 'Berhasil!';
    setTimeout(() => closeInterestModal(), 1800);
  } catch (err) {
    error.textContent = err.message || 'Gagal mengirim. Coba lagi nanti.';
  } finally {
    busy(button, '', false);
  }
}
