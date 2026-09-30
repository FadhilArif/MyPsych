'use strict';

// ============================================================
  // INSTRUCTIONS
  // ============================================================

  function getTestReturnView_() {
    const current = document.body.dataset.view;
    return ['dashboard', 'psikotes', 'skd', 'history', 'cv'].includes(current)
      ? current
      : 'dashboard';
  }

  function openInstruction(testId, packageNumber) {
    state.test = testId;
    state.package = packageNumber;
    state.returnView = getTestReturnView_();

    const test = TESTS[testId];
    $('instructionEyebrow').textContent = `${test.name.toUpperCase()} • PAKET ${packageNumber}`;
    $('instructionTitle').textContent = test.name;
    $('instructionPackage').textContent = `Paket ${packageNumber}`;

    if (testId === 'skd_lengkap') {
      $('instructionLead').innerHTML =
        'Simulasi ini menggabungkan <strong>TWK, TIU, dan TKP</strong>. Kamu bebas berpindah soal selama waktu bagian aktif masih tersedia.';
      $('instructionBody').innerHTML = `
        <div class="instruction-grid">
          <div class="tip"><b>TWK · 20 menit</b><small>20 soal. Setelah waktu habis, otomatis masuk masa tunggu.</small></div>
          <div class="tip"><b>TIU · 20 menit</b><small>20 soal. Navigasi bebas selama waktu masih berjalan.</small></div>
          <div class="tip"><b>TKP · 20 menit</b><small>20 soal. Bagian terakhir menutup simulasi.</small></div>
          <div class="tip"><b>Jeda · 3 menit</b><small>Jeda otomatis di antara dua bagian.</small></div>
        </div>
        <div class="warning-box" style="margin-top:16px;">
          <strong>Catatan:</strong> Setelah berpindah dari TWK ke TIU atau dari TIU ke TKP, bagian sebelumnya tidak dapat dibuka kembali.
        </div>
      `;
      showView('instruction');
      return;
    }

    if (test.kind === 'kraepelin') {
      $('instructionLead').innerHTML =
        'Jumlahkan dua angka yang berdekatan dari <strong>bawah ke atas</strong>. Masukkan <strong>angka satuannya</strong>.';
      $('instructionBody').innerHTML = `
        <div class="example-layout">
          <div class="example-column">8<br>5<br>7<br>3</div>
          <div>→</div>
          <div class="example-results">
            <div>3 + 7 = 10 <strong>→ 0</strong></div>
            <div>7 + 5 = 12 <strong>→ 2</strong></div>
            <div>5 + 8 = 13 <strong>→ 3</strong></div>
          </div>
        </div>
        <div class="instruction-grid">
          <div class="tip"><b>50 kolom</b><small>Setiap kolom memiliki 26 jawaban.</small></div>
          <div class="tip"><b>15 detik</b><small>Waktu otomatis berpindah ke kolom berikutnya.</small></div>
        </div>
      `;
    } else {
      $('instructionLead').textContent =
        'Pilih jawaban yang paling tepat. Soal berpindah setelah jawaban dipilih atau waktu habis.';
      $('instructionBody').innerHTML = `
        <div class="instruction-grid">
          <div class="tip"><b>20 soal</b><small>Setiap paket menggunakan 20 soal dari bank soal JSON.</small></div>
          <div class="tip"><b>30 detik/soal</b><small>Timer otomatis berpindah bila waktu habis.</small></div>
          <div class="tip"><b>3 paket</b><small>Paket 1–3 tersedia untuk setiap jenis latihan.</small></div>
          <div class="tip"><b>Hasil PDF</b><small>Hasil tetap dapat diunduh meskipun mode tamu.</small></div>
        </div>
      `;
    }

    showView('instruction');
  }
