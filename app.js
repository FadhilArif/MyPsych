(() => {
  'use strict';

  // ============================================================
  // PSYCHOTEST PRACTICE — PHASE 4
  // 
  // ============================================================

  const CONFIG = Object.freeze({
    API_URL: '/api/gateway',
    SESSION_KEY: 'psychotest_session_v2',
    TEST_KEY: 'psychotest_active_v2',
    PDF_TIMEOUT: 10000,
    KRAEPELIN_COLUMNS: 50,
    KRAEPELIN_QUESTIONS: 26,
    KRAEPELIN_SECONDS: 15,
    MCQ_QUESTIONS: 20,
    MCQ_SECONDS: 30,
  });

  const TESTS = {
    kraepelin: {
      name: 'Kraepelin',
      icon: '🧮',
      description: 'Latihan ritme kerja, kecepatan, ketelitian, konsistensi, dan ketahanan.',
      kind: 'kraepelin',
    },
    kuantitatif: {
      name: 'Kuantitatif',
      icon: '➗',
      description: 'Latihan hitungan dasar, persentase, rasio, dan operasi numerik.',
      kind: 'mcq',
    },
    numerical: {
      name: 'Numerical',
      icon: '🔢',
      description: 'Latihan pola angka, deret, perbandingan, dan penalaran numerik.',
      kind: 'mcq',
    },
    sinonim: {
      name: 'Sinonim Verbal',
      icon: '🔤',
      description: 'Latihan memahami persamaan makna kata dalam konteks psikotes.',
      kind: 'mcq',
    },
    silogisme: {
      name: 'Silogisme',
      icon: '🧠',
      description: 'Latihan menarik kesimpulan logis dari beberapa premis.',
      kind: 'mcq',
    },
    analogi: {
      name: 'Analogi',
      icon: '🔗',
      description: 'Latihan hubungan kata dan konsep secara analogis.',
      kind: 'mcq',
    },
    kognitif: {
      name: 'Tes Kognitif',
      icon: '🧩',
      description: 'Latihan gabungan perhatian, logika, memori, dan pemecahan masalah.',
      kind: 'mcq',
    },
  };

  // Dummy bank sementara. Nanti dipindah ke JSON/GitHub pada fase bank soal.
  const SAMPLE = {
    kuantitatif: [
      ['12 + 8 = ?', ['18', '20', '22', '24'], 1],
      ['25% dari 80 = ?', ['15', '20', '25', '30'], 1],
      ['7 × 9 = ?', ['54', '56', '63', '72'], 2],
      ['144 ÷ 12 = ?', ['10', '11', '12', '14'], 2],
      ['3/4 dari 40 = ?', ['20', '25', '30', '35'], 2],
      ['Jika 5 barang = 60.000, maka 8 barang = ?', ['84.000', '90.000', '96.000', '100.000'], 2],
    ],
    numerical: [
      ['Deret: 2, 4, 6, 8, …', ['9', '10', '11', '12'], 1],
      ['Deret: 3, 6, 12, 24, …', ['36', '42', '48', '54'], 2],
      ['Angka mana paling besar?', ['0,75', '0,8', '0,65', '0,7'], 1],
      ['Jika 5 buku = 50.000, 8 buku = ?', ['70.000', '75.000', '80.000', '90.000'], 2],
      ['Deret: 20, 17, 14, 11, …', ['7', '8', '9', '10'], 1],
      ['Deret: 1, 4, 9, 16, …', ['20', '24', '25', '27'], 2],
    ],
    sinonim: [
      ['Sinonim “akurat” adalah …', ['cepat', 'tepat', 'lambat', 'besar'], 1],
      ['Sinonim “konkret” adalah …', ['nyata', 'rumit', 'sementara', 'abstrak'], 0],
      ['Sinonim “efisien” adalah …', ['boros', 'hemat guna', 'lambat', 'acak'], 1],
      ['Sinonim “valid” adalah …', ['sah', 'lemah', 'samar', 'salah'], 0],
      ['Sinonim “esensial” adalah …', ['tambahan', 'pokok', 'sementara', 'remeh'], 1],
      ['Sinonim “abstrak” adalah …', ['nyata', 'konkret', 'tidak berwujud', 'terukur'], 2],
    ],
    silogisme: [
      ['Semua A adalah B. Semua B adalah C. Kesimpulan yang benar?', ['Semua A adalah C', 'Semua C adalah A', 'Sebagian A bukan B', 'Tidak ada hubungan'], 0],
      ['Semua dokter adalah pekerja. Rina adalah dokter. Maka …', ['Rina bukan pekerja', 'Rina pekerja', 'Semua pekerja dokter', 'Tidak dapat disimpulkan'], 1],
      ['Semua X adalah Y. Tidak ada Y yang Z. Maka …', ['X adalah Z', 'Tidak ada X yang Z', 'Semua Z adalah X', 'Sebagian X pasti Z'], 1],
      ['Sebagian P adalah Q. Semua Q adalah R. Maka …', ['Sebagian P adalah R', 'Semua P adalah R', 'Tidak ada P yang R', 'Semua R adalah P'], 0],
      ['Semua M adalah N. Sebagian N adalah O. Maka …', ['Semua M adalah O', 'Sebagian M pasti O', 'Mungkin sebagian M adalah O', 'Tidak ada N yang M'], 2],
      ['Semua siswa rajin lulus. Budi siswa. Kesimpulan?', ['Budi pasti lulus', 'Budi tidak lulus', 'Budi pasti malas', 'Tidak bisa menyimpulkan'], 0],
    ],
    analogi: [
      ['Buku : Membaca = Makanan : …', ['memasak', 'makan', 'membeli', 'menjual'], 1],
      ['Dokter : Rumah sakit = Guru : …', ['pasar', 'sekolah', 'bank', 'terminal'], 1],
      ['Panas : Dingin = Tinggi : …', ['besar', 'jauh', 'rendah', 'panjang'], 2],
      ['Mata : Melihat = Telinga : …', ['berbicara', 'mendengar', 'berjalan', 'menulis'], 1],
      ['Kunci : Pintu = Password : …', ['akun', 'meja', 'buku', 'kursi'], 0],
      ['Pensil : Menulis = Gunting : …', ['mengukur', 'memotong', 'melipat', 'menempel'], 1],
    ],
    kognitif: [
      ['Jika semua lampu mati, ruangan menjadi …', ['terang', 'gelap', 'ramai', 'dingin'], 1],
      ['Manakah yang berbeda?', ['Apel', 'Mangga', 'Wortel', 'Jeruk'], 2],
      ['Jika hari ini Senin, 3 hari lagi adalah …', ['Selasa', 'Rabu', 'Kamis', 'Jumat'], 2],
      ['Pola: ▲ ● ▲ ● … berikutnya?', ['▲', '●', '■', '◆'], 0],
      ['Jika A lebih besar dari B dan B lebih besar dari C, maka …', ['A<C', 'A=C', 'A>C', 'B<A tidak pasti'], 2],
      ['Manakah yang termasuk pola berulang?', ['A-B-A-B', 'A-A-B-C', 'A-B-C-D', 'A-C-B-D'], 0],
    ],
  };

  const $ = (id) => document.getElementById(id);

const views = {
  landing: $('landingView'),
  auth: $('authView'),
  dashboard: $('dashboardView'),
  instruction: $('instructionView'),
  test: $('testView'),
  result: $('resultView'),
  history: $('historyView'),
  admin: $('adminView'),
  about: $('aboutView'),
};
  
  const state = {
    session: null,
    isGuest: false,
    history: [],
    test: null,
    package: 1,
    currentTestId: null,
    questions: [],
    answers: [],
    questionTimes: [],
    kraepelinQuestionTimes: [],
    index: 0,
    columns: [],
    colIndex: 0,
    qIndex: 0,
    timerId: null,
    questionStartedAt: 0,
    testStartedAt: 0,
    lastResult: null,
    finished: true,
    savingHistory: false,
    kraepelinSecondsChoice: 15,
  };
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
  // ============================================================
  // VIEW / TOAST
  // ============================================================

  function showView(name) {
    Object.values(views).forEach((view) => view?.classList.remove('active'));
    views[name]?.classList.add('active');
    document.body.dataset.view = name;
    document.body.dataset.mode = state.isGuest ? 'guest' : 'account';
    if (name !== 'test') stopTimer();
    window.scrollTo(0, 0);
  }

  function toast(message, type = 'info', duration = 2800) {
    const root = $('toastRoot');
    if (!root) return;

    root.innerHTML = '';
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
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

  // ============================================================
  // PDF — NO EXTERNAL LIBRARY REQUIRED
  // ============================================================

  function pdfEscape(value) {
    return String(value ?? '')
      .replace(/[^\x20-\x7E]/g, '?')
      .replaceAll('(', '[')
      .replaceAll(')', ']');
  }

  function asciiBytes(value) {
    return new TextEncoder().encode(String(value));
  }

  function concatBytes(parts) {
    const total = parts.reduce(
      (sum, part) => sum + part.length,
      0
    );

    const output = new Uint8Array(total);
    let offset = 0;

    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });

    return output;
  }

  function createPdfBytes(content, imageBytes, imageWidth, imageHeight) {
    const pageWidth = 595;
    const pageHeight = 842;

    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 4 0 R >>',
      null,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      null,
    ];

    const contentBytes = asciiBytes(content);

    objects[3] =
      `<< /Length ${contentBytes.length} >>\nstream\n` +
      content +
      '\nendstream';

    objects[5] =
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\n` +
      'stream';

    const parts = [];
    const offsets = [0];

    const header = asciiBytes('%PDF-1.4\n');
    parts.push(header);

    for (let index = 0; index < objects.length; index += 1) {
      const objectNumber = index + 1;
      offsets[objectNumber] = parts.reduce(
        (sum, part) => sum + part.length,
        0
      );

      parts.push(
        asciiBytes(
          `${objectNumber} 0 obj\n${objects[index]}\n`
        )
      );

      if (objectNumber === 6) {
        parts.push(imageBytes);
        parts.push(asciiBytes('\nendstream\nendobj\n'));
      } else {
        parts.push(asciiBytes('endobj\n'));
      }
    }

    const xrefOffset = parts.reduce(
      (sum, part) => sum + part.length,
      0
    );

    let xref = `xref\n0 ${objects.length + 1}\n`;
    xref += '0000000000 65535 f \n';

    for (let index = 1; index <= objects.length; index += 1) {
      xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }

    xref +=
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF`;

    parts.push(asciiBytes(xref));

    return concatBytes(parts);
  }

  function drawPdfText(lines, text, x, y, size = 10) {
    lines.push('BT');
    lines.push(`/F1 ${size} Tf`);
    lines.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    lines.push(`(${pdfEscape(text)}) Tj`);
    lines.push('ET');
  }

  function drawPdfLine(lines, x1, y1, x2, y2) {
    lines.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m`);
    lines.push(`${x2.toFixed(2)} ${y2.toFixed(2)} l`);
    lines.push('S');
  }

  function drawPdfRect(lines, x, y, width, height, stroke = true) {
    lines.push(
      `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`
    );
    lines.push(stroke ? 'S' : 'f');
  }

  function buildMcqPdfChart(lines, result) {
    const data = result.chart.slice(0, 20);
    const chartX = 60;
    const chartY = 265;
    const chartWidth = 475;
    const chartHeight = 150;
    const maxTime = CONFIG.MCQ_SECONDS;
    const gap = 4;
    const barWidth = Math.max(
      6,
      (chartWidth - gap * (data.length - 1)) / data.length
    );

    lines.push('0.85 0.89 0.94 RG');
    drawPdfLine(
      lines,
      chartX,
      chartY,
      chartX,
      chartY + chartHeight
    );
    drawPdfLine(
      lines,
      chartX,
      chartY,
      chartX + chartWidth,
      chartY
    );

    lines.push('0.92 0.94 0.97 RG');
    [0, 10, 20, 30].forEach((seconds) => {
      const ratio = 1 - seconds / maxTime;
      const y = chartY + ratio * chartHeight;
      drawPdfLine(
        lines,
        chartX,
        y,
        chartX + chartWidth,
        y
      );
    });

    drawPdfText(lines, '0s', 38, chartY + chartHeight - 3, 7);
    drawPdfText(lines, '10s', 34, chartY + chartHeight * (2 / 3) - 3, 7);
    drawPdfText(lines, '20s', 34, chartY + chartHeight * (1 / 3) - 3, 7);
    drawPdfText(lines, '30s', 34, chartY - 3, 7);

    data.forEach((item, index) => {
      const time = Math.max(
        0,
        Math.min(
          maxTime,
          Number(item?.time || 0)
        )
      );

      const performance =
        1 - time / maxTime;

      const barHeight = Math.max(
        2,
        performance * chartHeight
      );

      const x =
        chartX +
        index * (barWidth + gap);

      if (item?.correct) {
        lines.push('0.18 0.49 0.95 rg');
      } else {
        lines.push('0.88 0.27 0.30 rg');
      }

      lines.push(
        `${x.toFixed(2)} ${chartY.toFixed(2)} ${barWidth.toFixed(2)} ${barHeight.toFixed(2)} re f`
      );

      drawPdfText(
        lines,
        String(index + 1),
        x + barWidth / 2 - 2,
        chartY - 14,
        7
      );
    });

    drawPdfText(
      lines,
      'Biru = benar   Merah = salah / kosong',
      chartX,
      chartY - 30,
      8
    );
  }

  function buildKraepelinPdfChart(lines, result) {
    const data = result.chart.slice(0, 50);
    const chartX = 60;
    const chartY = 270;
    const chartWidth = 475;
    const chartHeight = 145;
    const max = Math.max(1, ...data);
    const gap = 2;
    const barWidth = Math.max(
      4,
      (chartWidth - gap * (data.length - 1)) / data.length
    );

    lines.push('0.85 0.89 0.94 RG');
    drawPdfLine(
      lines,
      chartX,
      chartY,
      chartX,
      chartY + chartHeight
    );
    drawPdfLine(
      lines,
      chartX,
      chartY,
      chartX + chartWidth,
      chartY
    );

    lines.push('0.18 0.49 0.95 rg');

    data.forEach((value, index) => {
      const barHeight =
        (Number(value || 0) / max) *
        chartHeight;

      const x =
        chartX +
        index * (barWidth + gap);

      lines.push(
        `${x.toFixed(2)} ${chartY.toFixed(2)} ${barWidth.toFixed(2)} ${barHeight.toFixed(2)} re f`
      );
    });

    drawPdfText(
      lines,
      `0 - ${max} jawaban per kolom`,
      chartX,
      chartY - 18,
      8
    );
  }

  async function buildPdf(result, participant) {
    const templateResponse = await fetch(
      './pdf-template.jpg',
      { cache: 'no-cache' }
    );

    if (!templateResponse.ok) {
      throw new Error(
        `Template PDF tidak ditemukan (HTTP ${templateResponse.status}).`
      );
    }

    const templateBuffer =
      await templateResponse.arrayBuffer();

    const templateBytes =
      new Uint8Array(templateBuffer);

    // Template merupakan JPEG A4 hasil rasterisasi dari template FA-Test.
    // Rasio halaman dipertahankan 595 x 842 pt.
    const templateWidth = 1241;
    const templateHeight = 1755;

    const lines = [];

    // Background template.
    lines.push('q');
    lines.push('595 0 0 842 0 0 cm');
    lines.push('/Im1 Do');
    lines.push('Q');

    // Warna dasar teks hasil.
    lines.push('0.10 0.19 0.30 rg');

    drawPdfText(
      lines,
      'Hasil Latihan Psikotes',
      52,
      686,
      20
    );

    drawPdfText(
      lines,
      `Peserta: ${participant}`,
      52,
      662,
      10
    );

    drawPdfText(
      lines,
      `Tes: ${TESTS[result.type].name} - Paket ${result.package}`,
      52,
      646,
      10
    );

    drawPdfText(
      lines,
      `Tanggal: ${formatDate(result.tanggal)}`,
      52,
      630,
      10
    );

    lines.push('0.18 0.49 0.95 rg');
    drawPdfText(
      lines,
      'Ringkasan Performa',
      52,
      600,
      13
    );

    // Dua baris ringkasan agar tetap rapi di atas chart.
    const cards = [
      ['Skor utama', `${result.score}%`],
      ['Kecepatan', `${result.speed}%`],
      ['Ketelitian', `${result.accuracy}%`],
      ['Konsistensi', `${result.consistency}%`],
      ['Ketahanan', `${result.endurance}%`],
      ['Dijawab', `${result.answered}/${result.total}`],
      ['Benar', String(result.correct)],
      ['Salah', String(result.wrong)],
    ];

    const cardX = 52;
    const cardW = 118;
    const cardH = 40;
    const cardGap = 6;

    cards.forEach(([label, value], index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const x = cardX + col * (cardW + cardGap);
      const y = 540 - row * 50;

      lines.push('0.95 0.97 0.99 rg');
      drawPdfRect(
        lines,
        x,
        y,
        cardW,
        cardH,
        false
      );

      lines.push('0.10 0.19 0.30 rg');
      drawPdfText(
        lines,
        label,
        x + 8,
        y + 25,
        7
      );

      lines.push('0.18 0.49 0.95 rg');
      drawPdfText(
        lines,
        value,
        x + 8,
        y + 10,
        12
      );
    });

    lines.push('0.18 0.49 0.95 rg');
    drawPdfText(
      lines,
      'Grafik performa',
      52,
      432,
      13
    );

    lines.push('0.38 0.43 0.50 rg');

    if (result.type === 'kraepelin') {
      drawPdfText(
        lines,
        'Semakin tinggi batang, semakin banyak soal yang berhasil dijawab pada kolom.',
        52,
        417,
        8
      );

      if (Array.isArray(result.chart) && result.chart.length) {
        buildKraepelinPdfChart(
          lines,
          result
        );
      } else {
        drawPdfText(
          lines,
          'Data grafik detail tidak tersedia pada histori.',
          52,
          330,
          9
        );
      }
    } else {
      drawPdfText(
        lines,
        'Semakin tinggi batang, semakin cepat waktu menjawab. Biru = benar, merah = salah/kosong.',
        52,
        417,
        8
      );

      if (Array.isArray(result.chart) && result.chart.length) {
        buildMcqPdfChart(
          lines,
          result
        );
      } else {
        drawPdfText(
          lines,
          'Sabar kak, ada error wkwkwk.',
          52,
          330,
          9
        );
      }
    }

    lines.push('0.10 0.19 0.30 rg');
    drawPdfText(
      lines,
      'Catatan',
      52,
      210,
      10
    );

    lines.push('0.38 0.43 0.50 rg');
    drawPdfText(
      lines,
      'Skor di website ini adalah skor latihan internal. Gunakan untuk melihat',
      52,
      195,
      8
    );
    drawPdfText(
      lines,
      'perkembangan latihan pribadi, bukan sebagai penilaian psikologis resmi.',
      52,
      183,
      8
    );

    const content = lines.join('\n');

    return createPdfBytes(
      content,
      templateBytes,
      templateWidth,
      templateHeight
    );
  }

  // RANDOM
  // ============================================================

  function randomInt(max) {
    if (window.crypto?.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    })[char]);
  }

  // ============================================================
  // GUEST / DASHBOARD
  // ============================================================

  function enterGuest() {
    state.session = null;
    state.isGuest = true;
    state.history = [];
    saveSession();
    $('welcomeName').textContent = 'Tamu';
    renderCatalog();
    trackEvent('guest_enter');
    showView('dashboard');
  }

  function leaveGuest() {
    state.isGuest = false;
    state.session = null;
    state.history = [];
  }

  function renderCatalog() {
    const root = $('testCatalog');
    if (!root) return;

    root.innerHTML = '';

    Object.entries(TESTS).forEach(([id, test]) => {
      const card = document.createElement('article');
      card.className = 'test-card card';
      const isKraepelin = id === 'kraepelin';

      card.innerHTML = `
        <div class="test-card-top">
          <div class="test-icon">${test.icon}</div>
          <div>
            <h3>${test.name}</h3>
            <p>${test.description}</p>
          </div>
        </div>
        <div class="package-row">
          ${isKraepelin ? `
          <select class="speed-select" aria-label="Waktu per soal Kraepelin">
            <option value="15">15 detik/soal</option>
            <option value="20">20 detik/soal</option>
          </select>` : `
          <select class="package-select" aria-label="Paket ${escapeHtml(test.name)}">
            <option value="1">Paket 1</option>
            <option value="2">Paket 2</option>
            <option value="3">Paket 3</option>
          </select>`}
          <button class="primary-btn" type="button">Mulai →</button>
        </div>
      `;

      const select = card.querySelector('.package-select');
      const speedSelect = card.querySelector('.speed-select');

      card.querySelector('button').addEventListener('click', () => {
        if (isKraepelin) {
          state.kraepelinSecondsChoice = Number(speedSelect.value) || 15;
          openInstruction(id, 1);
          return;
        }
        openInstruction(id, Number(select.value));
      });

      root.appendChild(card);
    });
  }

  async function refreshHistory() {
    if (state.isGuest || !state.session?.token) {
      state.history = [];
      return [];
    }

    try {
      const response = await apiChecked('getHistory', {
        token: state.session.token,
      });

      state.history = Array.isArray(response.history) ? response.history : [];
      renderHistory();
      renderDashboardSummary();
      return state.history;
    } catch (error) {
      if (/sesi login/i.test(error.message)) {
        clearSession();
        state.isGuest = false;
        showView('landing');
      }
      throw error;
    }
  }

  function renderDashboardSummary() {
    const count = state.history.length;
    if ($('historyCount')) $('historyCount').textContent = String(count);

    if (!count) {
      if ($('latestDate')) $('latestDate').textContent = 'Belum ada tes';
      if ($('dashSpeed')) $('dashSpeed').textContent = '—';
      if ($('dashAccuracy')) $('dashAccuracy').textContent = '—';
      if ($('dashConsistency')) $('dashConsistency').textContent = '—';
      if ($('dashEndurance')) $('dashEndurance').textContent = '—';
      return;
    }

    const latest = state.history[0];
    if ($('latestDate')) $('latestDate').textContent = formatDate(latest.tanggal);
    if ($('dashSpeed')) $('dashSpeed').textContent = `${Number(latest.speed) || 0}%`;
    if ($('dashAccuracy')) $('dashAccuracy').textContent = `${Number(latest.accuracy) || 0}%`;
    if ($('dashConsistency')) $('dashConsistency').textContent = `${Number(latest.consistency) || 0}%`;
    if ($('dashEndurance')) $('dashEndurance').textContent = `${Number(latest.endurance) || 0}%`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '—');
    return date.toLocaleString('id-ID');
  }

  function renderHistory() {
    const body = $('historyTableBody');
    if (!body) return;

    const history = state.isGuest ? [] : state.history;
    $('historyPageCount').textContent = String(history.length);
    body.innerHTML = '';
    $('emptyHistory').hidden = history.length > 0;
    $('historyTable').hidden = history.length === 0;

    // Tambahkan kolom aksi secara dinamis supaya tidak perlu mengubah HTML.
    const headerRow = $('historyTable')?.querySelector('thead tr');
    if (headerRow) {
      headerRow.innerHTML = `
        <th>#</th>
        <th>Tanggal</th>
        <th>Tes</th>
        <th>Paket</th>
        <th>Skor</th>
        <th>Kecepatan</th>
        <th>Ketelitian</th>
        <th>Konsistensi</th>
        <th>Ketahanan</th>
        <th>Aksi</th>
      `;
    }

    history.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(formatDate(item.tanggal))}</td>
        <td>${escapeHtml(TESTS[item.test_type]?.name || item.test_type || '—')}</td>
        <td>${escapeHtml(item.package ?? '—')}</td>
        <td>${Number(item.score) || 0}%</td>
        <td>${Number(item.speed) || 0}%</td>
        <td>${Number(item.accuracy) || 0}%</td>
        <td>${Number(item.consistency) || 0}%</td>
        <td>${Number(item.endurance) || 0}%</td>
        <td class="history-action-cell"></td>
      `;

      const actionCell = row.querySelector('.history-action-cell');
      const pdfButton = document.createElement('button');
      pdfButton.type = 'button';
      pdfButton.className = 'secondary-btn history-pdf-btn';
      pdfButton.textContent = 'Cetak PDF';
      pdfButton.title = 'Cetak hasil PDF';
      pdfButton.addEventListener('click', () => {
        downloadHistoryPdf(item, pdfButton);
      });

      actionCell.appendChild(pdfButton);
      body.appendChild(row);
    });
  }

  function historyItemToResult(item) {
    const normalizedType = item?.test_type || 'kuantitatif';

    return {
      testId: item?.test_id || '',
      type: normalizedType,
      package: Number(item?.package) || 1,
      answered: Number(item?.answered) || (Number(item?.correct) || 0) + (Number(item?.wrong) || 0),
      correct: Number(item?.correct) || 0,
      wrong: Number(item?.wrong) || 0,
      total: Number(item?.total) || CONFIG.MCQ_QUESTIONS,
      score: Number(item?.score) || 0,
      speed: Number(item?.speed) || 0,
      accuracy: Number(item?.accuracy) || 0,
      consistency: Number(item?.consistency) || 0,
      endurance: Number(item?.endurance) || 0,
      chart: Array.isArray(item?.chart) ? item.chart : [],
      tanggal: item?.tanggal || new Date().toISOString(),
    };
  }

  async function downloadHistoryPdf(item, button) {
    if (!item) return;

    busy(button, 'PDF…', true);

    try {
      // Kalau hasil ini baru saja selesai, gunakan result lengkapnya
      // sehingga grafik waktu per soal tetap ikut tercetak.
      let result = null;
      if (
        state.lastResult &&
        item.test_id &&
        state.lastResult.testId === item.test_id
      ) {
        result = state.lastResult;
      } else {
        result = historyItemToResult(item);

        // Histori dibuat dari TestHistory, lalu detail soal
        // diambil dari TestDetail agar grafik bisa direkonstruksi.
        try {
          const details = await loadTestDetail(item.test_id);
          enrichHistoryResultWithDetail(result, details);
        } catch (detailError) {
          console.warn('Detail histori tidak tersedia:', detailError);
        }
      }

      const participant =
        state.session?.username || 'Peserta';

      const bytes = await buildPdf(
        result,
        participant
      );

      const blob = new Blob(
        [bytes],
        { type: 'application/pdf' }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download =
        `hasil-${result.type}-paket-${result.package}-${new Date(
          result.tanggal
        ).toISOString().slice(0, 10)}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );

      toast(
        'PDF histori berhasil dibuat.',
        'success'
      );
    } catch (error) {
      console.error(
        'History PDF error:',
        error
      );

      toast(
        `PDF histori gagal dibuat: ${error.message}`,
        'warning',
        5000
      );
    } finally {
      busy(button, '', false);
    }
  }

  async function goDashboard(message = '') {
    if (isAdmin()) {
      await openAdminDashboard();
      return;
    }

    if (state.isGuest) {
      renderCatalog();
      showView('dashboard');
      return;
    }

    if (!state.session) {
      showView('landing');
      return;
    }

    $('welcomeName').textContent = state.session.username;
    renderCatalog();
    showView('dashboard');

    try {
      await refreshHistory();
    } catch (error) {
      toast(`Histori belum bisa dimuat: ${error.message}`, 'warning', 4200);
    }

    if (message) toast(message, 'success');
  }

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
          trackEvent('register_success');
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

  // ============================================================
  // INSTRUCTIONS
  // ============================================================

  function openInstruction(testId, packageNumber) {
    state.test = testId;
    state.package = packageNumber;

    const test = TESTS[testId];
    $('instructionEyebrow').textContent = `${test.name.toUpperCase()} • PAKET ${packageNumber}`;
    $('instructionTitle').textContent = test.name;
    $('instructionPackage').textContent = `Paket ${packageNumber}`;

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

  // ============================================================
  // TEST ENGINE
  // ============================================================

  // Bank soal MCQ disimpan sebagai file JSON di root GitHub Pages.
  const QUESTION_FILES = Object.freeze({
    kuantitatif: './soal_kuantitatif.json',
    numerical: './soal_numerical.json',
    sinonim: './soal_sinonim.json',
    silogisme: './soal_silogisme.json',
    analogi: './soal_analogi.json',
    kognitif: './soal_kognitif.json',
  });

  async function loadQuestionPackage(testId, packageNumber) {
    // Akun peserta terdaftar memprioritaskan bank soal di supabase.
    // Kalau bank belum dimigrasikan, fallback tetap menggunakan JSON GitHub lama.
    if (state.session?.token && !state.isGuest) {
      try {
        const backend = await apiChecked('getQuestionPackage', {
          test_type: testId,
          package: packageNumber,
        });
        if (Array.isArray(backend.questions) && backend.questions.length) {
          return backend.questions.map((item, index) => {
            const optionEntries = Object.entries(item.options || {});
            const correctIndex = optionEntries.findIndex(([letter]) => String(letter).toUpperCase() === String(item.answer || '').toUpperCase());
            if (correctIndex < 0) throw new Error(`Jawaban soal nomor ${item.id ?? index + 1} tidak valid di QuestionBank.`);
            return { id:item.id ?? index + 1, text:String(item.question ?? ''), options:optionEntries.map(([,value])=>String(value)), correct:correctIndex, discussion:String(item.discussion ?? '') };
          });
        }
      } catch (error) {
        console.warn('Bank soal Sheet belum siap, fallback ke JSON:', error);
      }
    }

    const filePath = QUESTION_FILES[testId];

    if (!filePath) {
      throw new Error(
        `Bank soal untuk tes "${testId}" belum tersedia.`
      );
    }

    const response = await fetch(filePath, {
      cache: 'no-cache',
    });

    if (!response.ok) {
      throw new Error(
        `Gagal memuat ${filePath}. HTTP ${response.status}.`
      );
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.paket)) {
      throw new Error(
        `Format ${filePath} tidak valid.`
      );
    }

    const selectedPackage = data.paket.find(
      (item) => Number(item.id_paket) === Number(packageNumber)
    );

    if (!selectedPackage) {
      throw new Error(
        `Paket ${packageNumber} untuk ${TESTS[testId].name} tidak ditemukan.`
      );
    }

    if (
      !Array.isArray(selectedPackage.soal) ||
      selectedPackage.soal.length !== CONFIG.MCQ_QUESTIONS
    ) {
      throw new Error(
        `${TESTS[testId].name} Paket ${packageNumber} harus berisi ${CONFIG.MCQ_QUESTIONS} soal.`
      );
    }

    return selectedPackage.soal.map((item, index) => {
      if (!item || !item.options || !item.answer) {
        throw new Error(
          `Data soal nomor ${item?.id ?? index + 1} pada ${filePath} tidak lengkap.`
        );
      }

      const optionEntries = Object.entries(item.options);

      const correctIndex = optionEntries.findIndex(
        ([letter]) =>
          String(letter).toUpperCase() ===
          String(item.answer).trim().toUpperCase()
      );

      if (correctIndex === -1) {
        throw new Error(
          `Jawaban soal nomor ${item.id ?? index + 1} pada ${filePath} tidak valid.`
        );
      }

      return {
        id: item.id ?? index + 1,
        text: String(item.question ?? ''),
        options: optionEntries.map(([, value]) => String(value)),
        correct: correctIndex,
        discussion: String(item.discussion ?? ''),
      };
    });
  }
async function loadKuantitatifPackage(packageNumber) {
  const response = await fetch('./soal_kuantitatif.json', {
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error(
      `File soal kuantitatif gagal dimuat. HTTP ${response.status}.`
    );
  }

  const data = await response.json();

  if (
    !data ||
    !Array.isArray(data.paket)
  ) {
    throw new Error(
      'Format soal_kuantitatif.json tidak valid.'
    );
  }

  const selectedPackage = data.paket.find(
    (item) =>
      Number(item.id_paket) === Number(packageNumber)
  );

  if (!selectedPackage) {
    throw new Error(
      `Paket Kuantitatif ${packageNumber} tidak ditemukan.`
    );
  }

  if (
    !Array.isArray(selectedPackage.soal) ||
    selectedPackage.soal.length !== CONFIG.MCQ_QUESTIONS
  ) {
    throw new Error(
      `Paket ${packageNumber} harus memiliki ${CONFIG.MCQ_QUESTIONS} soal.`
    );
  }

  state.questions = selectedPackage.soal.map((item) => {
    const optionEntries = Object.entries(item.options);

    const correctIndex = optionEntries.findIndex(
      ([letter]) =>
        letter.toUpperCase() === String(item.answer).toUpperCase()
    );

    if (correctIndex === -1) {
      throw new Error(
        `Jawaban soal nomor ${item.id} tidak valid.`
      );
    }

    return {
      id: item.id,
      text: item.question,
      options: optionEntries.map(([, text]) => text),
      correct: correctIndex,
      discussion: item.discussion || '',
    };
  });

  return state.questions;
}
  async function startTest() {
  if (!state.test || !TESTS[state.test]) {
    return;
  }
trackEvent('test_start', { type: state.test, package: state.package });
  const button = $('startTestBtn');

  stopTimer();

  state.finished = false;
  state.lastResult = null;
  state.currentTestId = `T-${Date.now()}-${randomInt(100000)}`;
  state.testStartedAt = Date.now();

  busy(button, 'Memuat soal…', true);

  try {
    if (TESTS[state.test].kind === 'kraepelin') {
      startKraepelin();
    } else {
      await startMCQ();
    }

    persistTest();
  } catch (error) {
    state.finished = true;
    state.lastResult = null;

    showView('instruction');

    toast(
      error.message || 'Soal gagal dimuat.',
      'warning',
      5000
    );
  } finally {
    busy(button, '', false);
  }
}

  function startKraepelin() {
    state.columns = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () => Array.from({ length: 27 }, () => randomInt(10)),
    );
    state.answers = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () => Array(CONFIG.KRAEPELIN_QUESTIONS).fill(null),
    );
    state.kraepelinQuestionTimes = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () => Array(CONFIG.KRAEPELIN_QUESTIONS).fill(null),
    );
    state.colIndex = 0;
    state.qIndex = 0;
    state.questions = [];

    renderKraepelin();
    showView('test');
    state.questionStartedAt = Date.now();
    startColumnTimer();
  }

  function renderKraepelin() {
    const column = state.columns[state.colIndex];
    const answerIndex = state.qIndex;
    const bottom = column[26 - answerIndex];
    const top = column[25 - answerIndex];

    $('testTypeLabel').textContent = 'Kraepelin';
    $('questionCounter').textContent = `${answerIndex + 1}/26`;
    $('timeCounter').textContent = `${state.kraepelinSecondsChoice}s`;
    $('progressBar').style.width = `${((state.colIndex * 26 + answerIndex) / 1300) * 100}%`;

    $('testContent').innerHTML = `
      <div class="question-label">JUMLAHKAN</div>
      <div class="big-number">${top}</div>
      <div class="question-mark">?</div>
      <div class="big-number">${bottom}</div>
    `;

    $('keypad').innerHTML = '';
    [7, 8, 9, 4, 5, 6, 1, 2, 3, 0].forEach((digit) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `digit-btn ${digit === 0 ? 'zero-btn' : ''}`;
      button.textContent = digit;
      button.addEventListener('click', () => answerKraepelin(digit));
      $('keypad').appendChild(button);
    });

    $('testHint').textContent = 'Keyboard 0–9 juga bisa digunakan.';
  }

  function startColumnTimer() {
    stopTimer();
    const end = Date.now() + state.kraepelinSecondsChoice * 1000;

    state.timerId = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      $('timeCounter').textContent = `${left}s`;

      if (left <= 0) {
        stopTimer();
        nextColumn();
      }
    }, 100);
  }

  function answerKraepelin(digit) {
    if (state.answers[state.colIndex][state.qIndex] !== null) return;

    const elapsedSeconds = Math.max(
      0,
      Math.min(
        state.kraepelinSecondsChoice,
        (Date.now() - state.questionStartedAt) / 1000
      )
    );

    state.answers[state.colIndex][state.qIndex] = Number(digit);
    state.kraepelinQuestionTimes[state.colIndex][state.qIndex] =
      Number(elapsedSeconds.toFixed(2));

    if (state.qIndex < CONFIG.KRAEPELIN_QUESTIONS - 1) {
      state.qIndex += 1;
      renderKraepelin();
      state.questionStartedAt = Date.now();
    } else {
      nextColumn();
    }

    persistTest();
  }

  function nextColumn() {
    if (state.colIndex >= CONFIG.KRAEPELIN_COLUMNS - 1) {
      finishTest();
      return;
    }

    state.colIndex += 1;
    state.qIndex = 0;
    renderKraepelin();
    state.questionStartedAt = Date.now();
    startColumnTimer();
    persistTest();
  }

  async function startMCQ() {
    state.questions = await loadQuestionPackage(
      state.test,
      state.package
    );

    state.answers = Array(
      state.questions.length
    ).fill(null);

    state.questionTimes = Array(
      state.questions.length
    ).fill(null);

    state.index = 0;

    renderMCQ();
    showView('test');

    state.questionStartedAt = Date.now();

    startQuestionTimer();
  }

  function renderMCQ() {
    const question = state.questions[state.index];
    if (!question) return;

    $('testTypeLabel').textContent = TESTS[state.test].name;
    $('questionCounter').textContent = `${state.index + 1}/${CONFIG.MCQ_QUESTIONS}`;
    $('timeCounter').textContent = `${CONFIG.MCQ_SECONDS}s`;
    $('progressBar').style.width = `${(state.index / CONFIG.MCQ_QUESTIONS) * 100}%`;

    $('testContent').innerHTML = `
      <div class="question-label">PERTANYAAN ${state.index + 1}</div>
      <h2>${escapeHtml(question.text)}</h2>
    `;

    $('keypad').innerHTML = '';

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer-btn';
      button.textContent = `${String.fromCharCode(65 + optionIndex)}. ${option}`;
      button.addEventListener('click', () => answerMCQ(optionIndex));
      $('keypad').appendChild(button);
    });

    $('testHint').textContent = `Pilih satu jawaban. Waktu per soal: ${CONFIG.MCQ_SECONDS} detik.`;
  }

  function startQuestionTimer() {
    stopTimer();
    const end = Date.now() + CONFIG.MCQ_SECONDS * 1000;

    state.timerId = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      $('timeCounter').textContent = `${left}s`;

      if (left <= 0) {
        stopTimer();
        answerMCQ(null);
      }
    }, 100);
  }

  function answerMCQ(choice) {
    if (
      state.answers[state.index] !== null ||
      state.finished
    ) {
      return;
    }

    const question =
      state.questions[state.index];

    const isLastQuestion =
      state.index >=
      state.questions.length - 1;

    // Catat waktu yang dipakai untuk soal ini.
    // Batas maksimal mengikuti timer per soal.
    const elapsedSeconds = Math.min(
      CONFIG.MCQ_SECONDS,
      Math.max(
        0,
        (Date.now() - state.questionStartedAt) / 1000
      )
    );

    state.questionTimes[state.index] =
      Number(elapsedSeconds.toFixed(2));

    state.answers[state.index] = choice;

    stopTimer();

    const buttons =
      $('keypad').querySelectorAll('button');

    buttons.forEach(
      (button, buttonIndex) => {
        button.disabled = true;

        if (
          choice !== null &&
          buttonIndex === question.correct
        ) {
          button.classList.add('correct');
        }

        if (
          choice !== null &&
          buttonIndex === choice &&
          choice !== question.correct
        ) {
          button.classList.add('wrong');
        }
      }
    );

    persistTest();

    if (isLastQuestion) {
      setTimeout(
        () => finishTest(),
        choice === null ? 0 : 160
      );
      return;
    }

    setTimeout(
      () => {
        state.index += 1;

        renderMCQ();

        state.questionStartedAt = Date.now();

        startQuestionTimer();
        persistTest();
      },
      choice === null ? 0 : 160
    );
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  // ============================================================
  // SCORE
  // ============================================================

  function clamp(value) {
    return Math.max(0, Math.min(100, value));
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function level(score) {
    if (score >= 90) return 'Sangat baik';
    if (score >= 80) return 'Baik';
    if (score >= 65) return 'Cukup';
    if (score >= 50) return 'Perlu latihan';
    return 'Perlu ditingkatkan';
  }

  function calculateKraepelin() {
    let answered = 0;
    let correct = 0;
    const counts = [];

    state.answers.forEach((columnAnswers, columnIndex) => {
      let columnCount = 0;

      columnAnswers.forEach((answer, questionIndex) => {
        if (answer === null) return;

        answered += 1;
        columnCount += 1;

        const expected = (
          state.columns[columnIndex][26 - questionIndex] +
          state.columns[columnIndex][25 - questionIndex]
        ) % 10;

        if (Number(answer) === expected) correct += 1;
      });

      counts.push(columnCount);
    });

    const total = CONFIG.KRAEPELIN_COLUMNS * CONFIG.KRAEPELIN_QUESTIONS;
    const average = mean(counts);
    const standardDeviation = Math.sqrt(
      mean(counts.map((count) => (count - average) ** 2)),
    );

    const consistency = Math.round(
      clamp(100 - (average ? standardDeviation / average : 1) * 100),
    );

    const first = mean(counts.slice(0, 10));
    const middle = mean(counts.slice(20, 30));
    const last = mean(counts.slice(40, 50));
    const baseline = Math.max(1, mean([first, middle]));
    const endurance = Math.round(
      clamp(100 - Math.max(0, (baseline - last) / baseline) * 100),
    );

    return {
      type: 'kraepelin',
      package: state.package,
      answered,
      correct,
      wrong: answered - correct,
      total,
      score: Math.round((correct / total) * 100),
      speed: Math.round((answered / total) * 100),
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      consistency,
      endurance,
      average,
      chart: counts,
    };
  }

  function calculateMCQ() {
    const total = state.questions.length;

    const answered =
      state.answers.filter(
        (answer) => answer !== null
      ).length;

    const correct = state.answers.reduce(
      (sum, answer, index) =>
        sum +
        (
          answer ===
          state.questions[index].correct
            ? 1
            : 0
        ),
      0
    );

    const wrong =
      answered - correct;

    const accuracy = answered
      ? Math.round(
          (correct / answered) * 100
        )
      : 0;

    const speed = total
      ? Math.round(
          (answered / total) * 100
        )
      : 0;

    const consistency = Math.round(
      clamp(
        100 -
        Math.abs(
          speed - accuracy
        )
      )
    );

    const endurance = Math.round(
      clamp(
        total
          ? (answered / total) * 100
          : 0
      )
    );

    const chart = state.questions.map(
      (_, index) => {
        const answer =
          state.answers[index];

        const time =
          state.questionTimes[index];

        if (answer === null) {
          return {
            time: CONFIG.MCQ_SECONDS,
            correct: false,
            answered: false,
          };
        }

        return {
          time: Number(time || 0),
          correct:
            answer ===
            state.questions[index].correct,
          answered: true,
        };
      }
    );

    return {
      type: state.test,
      package: state.package,
      answered,
      correct,
      wrong,
      total,
      score: accuracy,
      speed,
      accuracy,
      consistency,
      endurance,
      average: mean(
        state.answers.map(
          (answer) =>
            answer === null ? 0 : 1
        )
      ),
      chart,
    };
  }

  // ============================================================
  // PERSIST ACTIVE TEST
  // ============================================================

  function persistTest() {
    if (state.finished || state.isGuest || !state.session) return;

    try {
      localStorage.setItem(
        CONFIG.TEST_KEY,
        JSON.stringify({
          version: 2,
          userId: state.session.user_id,
          test: state.test,
          package: state.package,
          currentTestId: state.currentTestId,
          questions: state.questions,
          answers: state.answers,
          questionTimes: state.questionTimes,
          kraepelinQuestionTimes: state.kraepelinQuestionTimes,
          index: state.index,
          columns: state.columns,
          colIndex: state.colIndex,
          qIndex: state.qIndex,
          questionStartedAt: state.questionStartedAt,
          testStartedAt: state.testStartedAt,
          kraepelinSecondsChoice: state.kraepelinSecondsChoice,
        }),
      );
    } catch (error) {
      console.warn('Progress tes tidak tersimpan:', error);
    }
  }

  function clearPersistedTest() {
    localStorage.removeItem(CONFIG.TEST_KEY);
  }

  function loadPersistedTest() {
    if (!state.session) return null;

    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.TEST_KEY) || 'null');
      if (!saved || saved.userId !== state.session.user_id || !saved.test) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function resumePersistedTest() {
    const saved = loadPersistedTest();
    if (!saved) {
      toast('Tidak ada progress tes yang bisa dilanjutkan.', 'warning');
      return;
    }

    state.test = saved.test;
    state.package = Number(saved.package) || 1;
    state.currentTestId = saved.currentTestId || `T-${Date.now()}-${randomInt(100000)}`;
    state.questions = Array.isArray(saved.questions) ? saved.questions : [];
    state.answers = Array.isArray(saved.answers) ? saved.answers : [];
    state.questionTimes = Array.isArray(saved.questionTimes)
      ? saved.questionTimes
      : Array(state.questions.length).fill(null);
    state.kraepelinQuestionTimes = Array.isArray(saved.kraepelinQuestionTimes)
      ? saved.kraepelinQuestionTimes
      : Array.from(
          { length: CONFIG.KRAEPELIN_COLUMNS },
          () => Array(CONFIG.KRAEPELIN_QUESTIONS).fill(null),
        );
    state.index = Number(saved.index) || 0;
    state.columns = Array.isArray(saved.columns) ? saved.columns : [];
    state.colIndex = Number(saved.colIndex) || 0;
    state.qIndex = Number(saved.qIndex) || 0;
    state.testStartedAt = Number(saved.testStartedAt) || Date.now();
    state.kraepelinSecondsChoice = Number(saved.kraepelinSecondsChoice) || 15;
    state.finished = false;

    if (TESTS[state.test]?.kind === 'kraepelin') {
      renderKraepelin();
      showView('test');
      state.questionStartedAt = Date.now();
      startColumnTimer();
    } else {
      renderMCQ();
      showView('test');
      state.questionStartedAt = Date.now();
      startQuestionTimer();
    }

    toast('Progress tes dipulihkan.', 'success');
  }

  // ============================================================
  // FINISH + SAVE HISTORY
  // ============================================================

  function buildTestDetailRows(result) {
    const testType = result.type;
    const packageNumber = result.package;
    const rows = [];

    if (testType === 'kraepelin') {
      for (let col = 0; col < CONFIG.KRAEPELIN_COLUMNS; col += 1) {
        for (let q = 0; q < CONFIG.KRAEPELIN_QUESTIONS; q += 1) {
          const answer = state.answers[col]?.[q] ?? null;
          const time = state.kraepelinQuestionTimes[col]?.[q] ?? '';
          const top = state.columns[col]?.[25 - q] ?? 0;
          const bottom = state.columns[col]?.[26 - q] ?? 0;
          const expected = (top + bottom) % 10;
          const answered = answer !== null;

          rows.push({
            test_id: state.currentTestId,
            test_type: testType,
            package: packageNumber,
            no_soal: col * CONFIG.KRAEPELIN_QUESTIONS + q + 1,
            kolom: col + 1,
            no_soal_dalam_kolom: q + 1,
            waktu_detik: time,
            jawaban: answered ? String(answer) : '',
            benar: answered && Number(answer) === expected,
          });
        }
      }

      return rows;
    }

    return state.questions.map((question, index) => {
      const answer = state.answers[index];
      const answered = answer !== null;

      return {
        test_id: state.currentTestId,
        test_type: testType,
        package: packageNumber,
        no_soal: index + 1,
        kolom: '',
        no_soal_dalam_kolom: '',
        waktu_detik: state.questionTimes[index] ?? '',
        jawaban: answered ? String.fromCharCode(65 + answer) : '',
        benar:
          answered &&
          answer === question.correct,
      };
    });
  }

  async function saveTestDetail(result) {
    if (
      state.isGuest ||
      !state.session?.token ||
      !result?.testId
    ) {
      return false;
    }

    const rows = buildTestDetailRows(result);

    if (!rows.length) {
      return true;
    }

    const chunkSize = 250;

    try {
      for (let start = 0; start < rows.length; start += chunkSize) {
        const chunk = rows.slice(start, start + chunkSize);

        await apiChecked('saveTestDetail', {
          token: state.session.token,
          test_id: result.testId,
          details: chunk,
        });
      }

      return true;
    } catch (error) {
      console.error('TestDetail gagal disimpan:', error);
      return false;
    }
  }

  async function loadTestDetail(testId) {
    if (!state.session?.token || !testId) {
      return [];
    }

    const response = await apiChecked('getTestDetail', {
      token: state.session.token,
      test_id: testId,
    });

    return Array.isArray(response.details)
      ? response.details
      : [];
  }

  function enrichHistoryResultWithDetail(result, details) {
    if (!Array.isArray(details) || !details.length) {
      return result;
    }

    const sorted = [...details].sort(
      (a, b) => Number(a.no_soal || 0) - Number(b.no_soal || 0)
    );

    if (result.type === 'kraepelin') {
      const counts = Array(CONFIG.KRAEPELIN_COLUMNS).fill(0);

      sorted.forEach((item) => {
        if (
          Number(item.kolom) >= 1 &&
          Number(item.kolom) <= CONFIG.KRAEPELIN_COLUMNS &&
          String(item.jawaban ?? '') !== ''
        ) {
          counts[Number(item.kolom) - 1] += 1;
        }
      });

      result.chart = counts;
      return result;
    }

    result.chart = sorted.map((item) => ({
      time: Number(item.waktu_detik || 0),
      correct: Boolean(item.benar),
      answered: String(item.jawaban ?? '') !== '',
    }));

    return result;
  }

  async function saveHistory(result) {
    if (state.isGuest || !state.session?.token || state.savingHistory) return false;

    state.savingHistory = true;

    try {
      await apiChecked('saveHistory', {
        token: state.session.token,
        test_id: state.currentTestId,
        test_type: result.type,
        package: result.package,
        tanggal: new Date().toISOString(),
        score: result.score,
        correct: result.correct,
        wrong: result.wrong,
        total: result.total,
        speed: result.speed,
        accuracy: result.accuracy,
        consistency: result.consistency,
        endurance: result.endurance,
      });

      return true;
    } catch (error) {
      toast(`Hasil tampil, tetapi belum masuk spreadsheet: ${error.message}`, 'warning', 5000);
      return false;
    } finally {
      state.savingHistory = false;
    }
  }

  async function finishTest() {
    if (state.finished) return;

    state.finished = true;
    stopTimer();

    const result = TESTS[state.test].kind === 'kraepelin'
      ? calculateKraepelin()
      : calculateMCQ();

    result.testId = state.currentTestId || `T-${Date.now()}-${randomInt(100000)}`;
    result.tanggal = new Date().toISOString();
    state.lastResult = result;
    clearPersistedTest();

    renderResult(result);
    drawChart(result);
    showView('result');

    const historySaved = await saveHistory(result);

    if (!state.isGuest && historySaved) {
      const detailSaved = await saveTestDetail(result);

      if (!detailSaved) {
        toast(
          'Ringkasan tersimpan, tetapi detail per soal belum berhasil disimpan.',
          'warning',
          5000
        );
      }

      try {
        await refreshHistory();
        toast('Hasil tersimpan ke Safety Database.', 'success');
      } catch (error) {
        console.warn('Refresh histori gagal:', error);
      }
    }
  }

  // ============================================================
  // RESULT + CHART
  // ============================================================

  function renderResult(result) {
    const name = state.isGuest ? 'Tamu' : state.session?.username || 'Peserta';
    $('resultTitle').textContent = `${TESTS[result.type].name} selesai 🎉`;


    $('resultIntro').innerHTML = state.isGuest
      ? 'Hasil mode <strong>Tamu</strong> tidak disimpan ke histori. <strong>Download PDF</strong> untuk menyimpan salinannya.'
      : `Hasil <strong>${escapeHtml(name)}</strong> sudah tersimpan di akunmu. Download PDF untuk menyimpan salinan detailnya.`;

    const scores = [
      ['speed', 'Kecepatan', result.speed],
      ['accuracy', 'Ketelitian', result.accuracy],
      ['consistency', 'Konsistensi', result.consistency],
      ['endurance', 'Ketahanan', result.endurance],
    ];

    $('resultScores').innerHTML = scores.map(([key, label, score]) => `
      <article class="score-card">
        <span class="score-label">${label}</span>
        <strong>${score}%</strong>
        <small>${level(score)}</small>
        <div class="score-track"><i style="--score:${score}%"></i></div>
      </article>
    `).join('');

    $('resultSummary').innerHTML = [
      ['Skor utama', `${result.score}%`],
      ['Total dijawab', `${result.answered}/${result.total}`],
      ['Benar', result.correct],
      ['Salah', result.wrong],
    ].map(([label, value]) => `
      <div><span>${label}</span><strong>${value}</strong></div>
    `).join('');

    const chartTitle = document.querySelector('.chart-heading b');

    if (chartTitle) {
      chartTitle.textContent = result.type === 'kraepelin'
        ? 'Grafik performa per kolom'
        : 'Grafik waktu menjawab per soal';
    }

    $('chartSubtitle').textContent = result.type === 'kraepelin'
      ? 'Semakin tinggi batang, semakin banyak soal yang berhasil dijawab pada kolom tersebut.'
      : 'Semakin tinggi batang, semakin cepat menjawab. Biru = benar, merah = salah/kosong.';

    $('chartBadge').textContent = result.type === 'kraepelin'
      ? '50 kolom'
      : `${result.total} soal`;
  }

  function drawChart(result) {
    const canvas = $('performanceChart');
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(500, canvas.clientWidth || 700);
    const height = result.type === 'kraepelin' ? 220 : 250;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (result.type === 'kraepelin') {
      drawKraepelinChart(ctx, result, width, height);
      return;
    }

    const data = result.chart.slice(0, 20);
    const maxTime = CONFIG.MCQ_SECONDS;

    const left = 42;
    const right = 12;
    const top = 20;
    const bottom = 38;

    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    ctx.strokeStyle = '#dbe5ef';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, height - bottom);
    ctx.lineTo(width - right, height - bottom);
    ctx.stroke();

    ctx.font = '10px Inter, sans-serif';

    // Karena batang yang tinggi berarti waktu lebih cepat,
    // skala waktu dibalik: 0s di atas, 30s di bawah.
    [0, 10, 20, 30].forEach((seconds) => {
      const ratio = seconds / maxTime;
      const y = height - bottom - (1 - ratio) * chartHeight;

      ctx.strokeStyle = '#edf2f7';
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();

      ctx.fillStyle = '#718099';
      ctx.fillText(`${seconds}s`, 8, y + 3);
    });

    const gap = 5;
    const barWidth = Math.max(
      7,
      (
        chartWidth -
        gap * (data.length - 1)
      ) / data.length
    );

    data.forEach((item, index) => {
      const time = Math.max(
        0,
        Math.min(
          maxTime,
          Number(item.time || 0)
        )
      );

      // Waktu lebih singkat = performa lebih tinggi.
      const performance =
        1 - time / maxTime;

      const barHeight =
        performance * chartHeight;

      const x =
        left +
        index * (barWidth + gap);

      const y =
        height -
        bottom -
        barHeight;

      // Biru = benar, merah = salah atau tidak terjawab.
      ctx.fillStyle = item.correct
        ? '#2f7df2'
        : '#e05252';

      ctx.fillRect(
        x,
        y,
        barWidth,
        barHeight
      );

      ctx.fillStyle = '#718099';
      ctx.fillText(
        String(index + 1),
        x + barWidth / 2 - 3,
        height - 20
      );
    });
  }

  function drawKraepelinChart(
    ctx,
    result,
    width,
    height
  ) {
    ctx.strokeStyle = '#dbe5ef';
    ctx.fillStyle = '#6f7f94';
    ctx.font = '10px Inter, sans-serif';

    ctx.beginPath();
    ctx.moveTo(35, 10);
    ctx.lineTo(35, height - 28);
    ctx.lineTo(width - 10, height - 28);
    ctx.stroke();

    const data = result.chart.slice(0, 50);
    const max = Math.max(1, ...data);
    const gap = 4;
    const barWidth = Math.max(
      3,
      (width - 55) / data.length - gap
    );

    data.forEach((value, index) => {
      const barHeight =
        (value / max) *
        (height - 55);

      const x =
        38 +
        index * (barWidth + gap);

      const y =
        height -
        28 -
        barHeight;

      ctx.fillStyle = '#2f7df2';
      ctx.fillRect(
        x,
        y,
        barWidth,
        barHeight
      );
    });

    ctx.fillStyle = '#6f7f94';
    ctx.fillText(
      '0',
      18,
      height - 25
    );

    ctx.fillText(
      String(max),
      12,
      18
    );
  }

  // ============================================================
  // PDF
  // ============================================================

  async function downloadPdf() {
    const result = state.lastResult;

    if (!result) {
      toast('Hasil tes belum tersedia.', 'warning');
      return;
    }

    const button = $('downloadPdfBtn');
    busy(button, 'Menyiapkan PDF…', true);

    try {
      const participant = state.isGuest
        ? 'Tamu'
        : state.session?.username || 'Peserta';
      const bytes = await buildPdf(result, participant);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download =
        `hasil-${result.type}-paket-${result.package}-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast('PDF berhasil disimpan.', 'success');
    } catch (error) {
      console.error('PDF error:', error);
      toast('PDF gagal dibuat.', 'warning', 4500);
    } finally {
      busy(button, '', false);
    }
  }


  // ============================================================
  // MODAL / NAVIGATION
  // ============================================================

  function openEndTestModal() {
    if (!views.test?.classList.contains('active')) return;
    $('confirmModal').hidden = false;
  }

  function abandonTest() {
    stopTimer();
    state.finished = true;
    state.lastResult = null;
    clearPersistedTest();
    $('confirmModal').hidden = true;
    showView('dashboard');
    toast('Tes dibatalkan. Progress tidak disimpan.', 'info');
  }


/* ============================================================
   ADMIN PANEL
   ============================================================ */

  state.admin = {
    stats: { users: 0, admins: 0, tests: 0, avg_score: 0 },
    users: [],
    results: [],
    labels: [],
    tab: 'overview'
  };

  const ADMIN_TEST_OPTIONS = Object.entries(TESTS)
    .filter(([id, test]) => test.kind === 'mcq')
    .map(([id, test]) => ({ id, name: test.name }));

  function isAdmin() {
    return state.session?.role === 'admin';
  }

  function adminRequireAccess() {
    if (!isAdmin()) {
      toast('Akses admin ditolak.', 'warning');
      return false;
    }
    return true;
  }

  async function openAdminDashboard(tab = state.admin?.tab || 'overview') {
    if (!adminRequireAccess()) return;
    state.admin.tab = tab;
    try {
      await refreshAdminData();
      renderAdmin();
      showView('admin');
    } catch (error) {
      toast(`Dashboard admin gagal dimuat: ${error.message}`, 'warning', 5000);
    }
  }

  async function refreshAdminData() {
    const response = await apiChecked('adminDashboard', {
      token: state.session.token,
    });

    state.admin.stats = response.stats || state.admin.stats;
    state.admin.users = Array.isArray(response.users) ? response.users : [];
    state.admin.results = Array.isArray(response.results) ? response.results : [];
    state.admin.labels = Array.isArray(response.labels) ? response.labels : [];
    return response;
  }

  function adminTestName(testType) {
    return TESTS[testType]?.name || testType || '—';
  }

  function renderAdmin() {
    if (!$('adminView')) return;

    if ($('adminWelcomeName')) $('adminWelcomeName').textContent = state.session?.username || '—';

    $('adminUsersStat').textContent = String(state.admin.stats.users || 0);
    $('adminTestsStat').textContent = String(state.admin.stats.tests || 0);
    $('adminAverageStat').textContent = `${Number(state.admin.stats.avg_score) || 0}%`;
    $('adminAdminsStat').textContent = String(state.admin.stats.admins || 0);

    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.adminTab === state.admin.tab);
    });

    if (state.admin.tab === 'users') renderAdminUsers();
    else if (state.admin.tab === 'results') renderAdminResults();
    else if (state.admin.tab === 'questions') renderAdminQuestions();
    else if (state.admin.tab === 'labels') renderAdminLabels();
    else renderAdminOverview();
  }

  function renderAdminOverview() {
    const results = state.admin.results.slice(0, 10);
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head">
        <div><div class="eyebrow">OVERVIEW</div><h2>Ringkasan sistem</h2></div>
        <button type="button" class="secondary-btn" id="adminRefreshBtn">↻ Refresh</button>
      </div>
      <div class="admin-grid-two">
        <div class="admin-card card">
          <h3>Aktivitas terbaru</h3>
          <p class="muted">10 hasil tes terbaru dari seluruh peserta.</p>
          <div class="table-wrap admin-table-wrap">
            <table><thead><tr><th>Peserta</th><th>Tes</th><th>Skor</th><th>Label</th><th>Tanggal</th></tr></thead>
            <tbody>${results.length ? results.map((item) => `
              <tr>
                <td>${escapeHtml(item.username)}</td>
                <td>${escapeHtml(adminTestName(item.test_type))}</td>
                <td><strong>${Number(item.score) || 0}%</strong></td>
                <td><span class="admin-badge">${escapeHtml(item.label || 'Belum ada label')}</span></td>
                <td>${escapeHtml(formatDate(item.tanggal))}</td>
              </tr>`).join('') : `<tr><td colspan="5" class="admin-empty-cell">Belum ada hasil tes.</td></tr>`}</tbody></table>
          </div>
        </div>
        <div class="admin-card card">
          <h3>Akses cepat</h3>
          <p class="muted">Kelola data tanpa membuka database secara manual.</p>
          <div class="admin-quick-grid">
            <button type="button" class="secondary-btn" data-admin-tab="users">👥 Kelola Peserta</button>
            <button type="button" class="secondary-btn" data-admin-tab="results">📊 Lihat Nilai</button>
            <button type="button" class="secondary-btn" data-admin-tab="questions">🧩 Bank Soal</button>
            <button type="button" class="secondary-btn" data-admin-tab="labels">🏷️ Label Nilai</button>
          </div>
          <div class="warning-box"><strong>Catatan:</strong> perubahan bank soal dan label langsung tersimpan ke Safety Database.</div>
        </div>
      </div>
    `;

    $('adminRefreshBtn').addEventListener('click', async () => {
      busy($('adminRefreshBtn'), 'Memuat…', true);
      try { await refreshAdminData(); renderAdmin(); } catch (e) { toast(e.message, 'warning'); }
      finally { busy($('adminRefreshBtn'), '', false); }
    });
    bindAdminTabButtons();
  }

  function renderAdminUsers() {
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head">
        <div><div class="eyebrow">PESERTA</div><h2>Manajemen akun</h2><p class="muted">Tambah, reset sandi, atau hapus akun peserta.</p></div>
      </div>
      <div class="admin-card card">
        <form id="adminCreateUserForm" class="admin-form-grid">
          <label>Username<input id="adminNewUsername" maxlength="24" required></label>
          <label>Email<input id="adminNewEmail" type="email" placeholder="opsional"></label>
          <label>Password awal<input id="adminNewPassword" type="password" minlength="8" required></label>
          <button class="primary-btn" type="submit">+ Tambah Akun</button>
        </form>
      </div>
      <div class="admin-card card">
        <div class="admin-table-title"><h3>Daftar akun</h3><button type="button" class="secondary-btn" id="adminUsersRefresh">↻ Refresh</button></div>
        <div class="table-wrap admin-table-wrap"><table><thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Dibuat</th><th>Tes</th><th>Aksi</th></tr></thead><tbody id="adminUsersBody"></tbody></table></div>
      </div>
    `;

    const body = $('adminUsersBody');
    body.innerHTML = state.admin.users.map((user) => `
      <tr>
        <td><strong>${escapeHtml(user.username)}</strong><small class="admin-sub">${escapeHtml(user.user_id)}</small></td>
        <td>${escapeHtml(user.email || '—')}</td>
        <td><span class="admin-role ${user.role === 'admin' ? 'admin-role-admin' : ''}">${escapeHtml(user.role)}</span></td>
        <td>${escapeHtml(formatDate(user.created_at))}</td>
        <td>${Number(user.test_count) || 0}</td>
        <td class="admin-actions-cell">
          ${user.role === 'user' ? `<button type="button" class="secondary-btn admin-small-btn" data-user-reset="${escapeHtml(user.user_id)}">Reset Sandi</button><button type="button" class="danger-btn admin-small-btn" data-user-delete="${escapeHtml(user.user_id)}">Hapus</button>` : '<span class="admin-muted">Dilindungi</span>'}
        </td>
      </tr>
    `).join('') || `<tr><td colspan="6" class="admin-empty-cell">Belum ada akun.</td></tr>`;

    $('adminCreateUserForm').addEventListener('submit', adminCreateUserSubmit);
    $('adminUsersRefresh').addEventListener('click', async () => { await refreshAdminUsers(); });
    document.querySelectorAll('[data-user-reset]').forEach((button) => button.addEventListener('click', () => adminResetUser(button.dataset.userReset)));
    document.querySelectorAll('[data-user-delete]').forEach((button) => button.addEventListener('click', () => adminDeleteUser(button.dataset.userDelete)));
  }

  async function refreshAdminUsers() {
    try {
      const response = await apiChecked('adminGetUsers', { token: state.session.token });
      state.admin.users = response.users || [];
      renderAdminUsers();
    } catch (error) { toast(error.message, 'warning'); }
  }

  async function adminCreateUserSubmit(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const user = { username: $('adminNewUsername').value.trim(), email: $('adminNewEmail').value.trim(), password: $('adminNewPassword').value };
    try {
      busy(button, 'Menyimpan…', true);
      const response = await apiChecked('adminCreateUser', { token: state.session.token, user });
      toast(response.message || 'Akun dibuat.', 'success');
      event.currentTarget.reset();
      await refreshAdminUsers();
    } catch (error) { toast(error.message, 'warning'); }
    finally { busy(button, '', false); }
  }

  async function adminResetUser(userId) {
    const user = state.admin.users.find((item) => item.user_id === userId);
    if (!user) return;
    const choice = window.prompt(`Reset sandi untuk ${user.username}.\nKetik MANUAL untuk menentukan sandi sendiri, atau kosongkan untuk password otomatis.`, '');
    if (choice === null) return;
    const mode = choice.trim().toUpperCase() === 'MANUAL' ? 'manual' : 'generated';
    let password = '';
    if (mode === 'manual') {
      password = window.prompt('Masukkan password baru (minimal 8 karakter):', '');
      if (password === null) return;
    }
    try {
      const response = await apiChecked('adminResetUserPassword', { token: state.session.token, user_id: userId, mode, password });
      window.alert(`Password ${response.username || user.username} berhasil direset.\n\nPassword baru: ${response.temporary_password}`);
    } catch (error) { toast(error.message, 'warning'); }
  }

  async function adminDeleteUser(userId) {
    const user = state.admin.users.find((item) => item.user_id === userId);
    if (!user) return;
    if (!window.confirm(`Hapus akun ${user.username}?\n\nHistori dan detail tes akun ini juga akan dihapus.`)) return;
    try {
      const response = await apiChecked('adminDeleteUser', { token: state.session.token, user_id: userId });
      toast(response.message || 'Akun dihapus.', 'success');
      await refreshAdminUsers();
      await refreshAdminData();
    } catch (error) { toast(error.message, 'warning'); }
  }

  function renderAdminResults() {
    const resultRows = state.admin.results;
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head"><div><div class="eyebrow">HASIL TES</div><h2>Semua hasil peserta</h2><p class="muted">Filter berdasarkan username, tes, dan rentang skor.</p></div><button type="button" class="secondary-btn" id="adminResultsRefresh">↻ Refresh</button></div>
      <div class="admin-card card">
        <div class="admin-filter-grid">
          <label>Username<input id="adminFilterUsername" placeholder="cari username"></label>
          <label>Tes<select id="adminFilterTest"><option value="">Semua tes</option>${Object.entries(TESTS).map(([id, test]) => `<option value="${id}">${escapeHtml(test.name)}</option>`).join('')}</select></label>
          <label>Skor minimum<input id="adminFilterMin" type="number" min="0" max="100"></label>
          <label>Skor maksimum<input id="adminFilterMax" type="number" min="0" max="100"></label>
          <button type="button" class="primary-btn" id="adminApplyFilters">Terapkan Filter</button>
        </div>
      </div>
      <div class="admin-card card"><div class="table-wrap admin-table-wrap"><table><thead><tr><th>Tanggal</th><th>Peserta</th><th>Tes</th><th>Paket</th><th>Skor</th><th>Label</th><th>Benar</th><th>Salah</th><th>Kecepatan</th><th>Ketelitian</th></tr></thead><tbody id="adminResultsBody"></tbody></table></div></div>
    `;
    renderAdminResultsBody(resultRows);
    $('adminApplyFilters').addEventListener('click', adminApplyResultFilters);
    $('adminResultsRefresh').addEventListener('click', async () => { await refreshAdminData(); renderAdminResults(); });
  }

  function renderAdminResultsBody(rows) {
    const body = $('adminResultsBody');
    if (!body) return;
    body.innerHTML = rows.length ? rows.map((item) => `
      <tr><td>${escapeHtml(formatDate(item.tanggal))}</td><td><strong>${escapeHtml(item.username)}</strong><small class="admin-sub">${escapeHtml(item.email || '')}</small></td><td>${escapeHtml(adminTestName(item.test_type))}</td><td>${Number(item.package) || 1}</td><td><strong>${Number(item.score) || 0}%</strong></td><td><span class="admin-badge">${escapeHtml(item.label || 'Belum ada label')}</span></td><td>${Number(item.correct) || 0}</td><td>${Number(item.wrong) || 0}</td><td>${Number(item.speed) || 0}%</td><td>${Number(item.accuracy) || 0}%</td></tr>
    `).join('') : `<tr><td colspan="10" class="admin-empty-cell">Tidak ada data sesuai filter.</td></tr>`;
  }

  async function adminApplyResultFilters() {
    try {
      const response = await apiChecked('adminGetResults', { token: state.session.token, filters: { username: $('adminFilterUsername').value, test_type: $('adminFilterTest').value, min_score: $('adminFilterMin').value, max_score: $('adminFilterMax').value } });
      state.admin.results = response.results || [];
      renderAdminResultsBody(state.admin.results);
    } catch (error) { toast(error.message, 'warning'); }
  }

  function renderAdminQuestions() {
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head">
        <div>
          <div class="eyebrow">BANK SOAL</div>
          <h2>Kelola soal MCQ</h2>
          <p class="muted">Satu file JSON dapat berisi Paket 1, 2, dan 3 sekaligus. Paket di bawah ini hanya untuk memfilter soal yang ditampilkan.</p>
        </div>
      </div>
      <div class="admin-card card">
        <div class="admin-filter-grid admin-question-tools">
          <label>Tes<select id="adminQuestionTest">${ADMIN_TEST_OPTIONS.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label>
          <label>Paket (filter)<select id="adminQuestionPackage"><option value="">Semua Paket</option><option value="1">Paket 1</option><option value="2">Paket 2</option><option value="3">Paket 3</option></select></label>
          <label>Upload JSON<input id="adminQuestionFile" type="file" accept="application/json,.json"></label>
          <button type="button" class="primary-btn" id="adminUploadQuestionBtn">Upload JSON</button>
          <button type="button" class="secondary-btn" id="adminMigrateAllQuestionsBtn">⚡ Migrasikan Semua JSON</button>
          <button type="button" class="secondary-btn" id="adminLoadQuestionsBtn">Muat Soal</button>
        </div>
        <div class="warning-box"><strong>Format:</strong> file JSON mengikuti struktur <code>kategori → paket[] → soal[]</code>. Upload tidak perlu memilih paket karena semua paket di dalam file akan diproses otomatis. Sistem mengirim maksimal 25 soal per request agar migrasi aman.</div>
        <div id="adminQuestionProgress" class="admin-muted" style="margin-top:10px"></div>
      </div>
      <div class="admin-card card"><div class="admin-table-title"><h3>Soal tersimpan</h3><span id="adminQuestionCount" class="admin-muted">0 soal</span></div><div class="table-wrap admin-table-wrap"><table><thead><tr><th>Paket</th><th>No</th><th>Pertanyaan</th><th>Jawaban</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="adminQuestionsBody"></tbody></table></div></div>
    `;
    $('adminUploadQuestionBtn').addEventListener('click', adminUploadQuestionFile);
    $('adminMigrateAllQuestionsBtn').addEventListener('click', adminMigrateAllQuestions);
    $('adminLoadQuestionsBtn').addEventListener('click', adminLoadQuestions);
    $('adminQuestionTest').addEventListener('change', adminLoadQuestions);
    $('adminQuestionPackage').addEventListener('change', adminLoadQuestions);
    adminLoadQuestions();
  }

  let adminQuestionsCache = [];

  async function adminLoadQuestions() {
    try {
      const packageValue = $('adminQuestionPackage').value;
      const response = await apiChecked('adminGetQuestions', {
        token: state.session.token,
        test_type: $('adminQuestionTest').value,
        package: packageValue === '' ? 0 : Number(packageValue),
        include_inactive: true
      });
      adminQuestionsCache = response.questions || [];
      $('adminQuestionCount').textContent = `${adminQuestionsCache.length} soal`;
      $('adminQuestionsBody').innerHTML = adminQuestionsCache.length ? adminQuestionsCache.map((q) => `
        <tr><td>${Number(q.package) || 0}</td><td>${Number(q.no_soal) || 0}</td><td class="admin-question-cell">${escapeHtml(q.question)}</td><td><strong>${escapeHtml(q.answer)}</strong></td><td><span class="admin-role ${q.active ? '' : 'admin-role-off'}">${q.active ? 'Aktif' : 'Nonaktif'}</span></td><td class="admin-actions-cell"><button type="button" class="secondary-btn admin-small-btn" data-q-edit="${escapeHtml(q.question_id)}">Edit</button>${q.active ? `<button type="button" class="danger-btn admin-small-btn" data-q-delete="${escapeHtml(q.question_id)}">Hapus</button>` : ''}</td></tr>
      `).join('') : `<tr><td colspan="6" class="admin-empty-cell">Belum ada soal pada filter ini. Upload JSON untuk memindahkan bank soal.</td></tr>`;
      document.querySelectorAll('[data-q-edit]').forEach((button) => button.addEventListener('click', () => adminEditQuestion(button.dataset.qEdit)));
      document.querySelectorAll('[data-q-delete]').forEach((button) => button.addEventListener('click', () => adminDeleteQuestion(button.dataset.qDelete)));
    } catch (error) { toast(error.message, 'warning'); }
  }

  const ADMIN_QUESTION_BATCH_SIZE = 25;

  function normalizeQuestionPayloads_(data, testType) {
    const questions = [];
    if (!data || !Array.isArray(data.paket)) {
      throw new Error('JSON tidak memiliki array paket[].');
    }

    data.paket.forEach((pkg) => {
      const packageNumber = Number(pkg?.id_paket);
      if (!Number.isInteger(packageNumber) || packageNumber < 1) return;
      if (!Array.isArray(pkg.soal)) return;

      pkg.soal.forEach((q, index) => {
        const noSoal = Number(q?.id) || index + 1;
        questions.push({
          question_id: `${testType}-${packageNumber}-${noSoal}`,
          test_type: testType,
          package: packageNumber,
          no_soal: noSoal,
          question: q?.question,
          options: q?.options || {},
          answer: q?.answer,
          discussion: q?.discussion || ''
        });
      });
    });

    if (!questions.length) {
      throw new Error('Tidak ada soal yang ditemukan di JSON.');
    }

    return questions;
  }

  async function adminSaveQuestionBatches(questions, label = 'Upload') {
    let added = 0;
    let updated = 0;

    for (let start = 0; start < questions.length; start += ADMIN_QUESTION_BATCH_SIZE) {
      const batch = questions.slice(start, start + ADMIN_QUESTION_BATCH_SIZE);
      const end = Math.min(start + batch.length, questions.length);
      const progress = $('adminQuestionProgress');
      if (progress) progress.textContent = `${label}: ${end}/${questions.length} soal diproses…`;

      const response = await apiChecked('adminSaveQuestions', {
        token: state.session.token,
        questions: batch
      });

      added += Number(response.added) || 0;
      updated += Number(response.updated) || 0;
    }

    const progress = $('adminQuestionProgress');
    if (progress) progress.textContent = `✅ ${label} selesai: ${added} ditambahkan, ${updated} diperbarui (${questions.length} total).`;

    return { added, updated, total: questions.length };
  }

  async function adminUploadQuestionFile() {
    const input = $('adminQuestionFile');
    const file = input.files?.[0];
    if (!file) { toast('Pilih file JSON dulu.', 'warning'); return; }

    const button = $('adminUploadQuestionBtn');
    try {
      busy(button, 'Memproses…', true);
      const data = JSON.parse(await file.text());
      const testType = $('adminQuestionTest').value;
      const questions = normalizeQuestionPayloads_(data, testType);
      const result = await adminSaveQuestionBatches(questions, file.name);

      toast(`✅ ${file.name}: ${result.total} soal diproses.`, 'success', 5000);
      input.value = '';
      await adminLoadQuestions();
      await refreshAdminData();
    } catch (error) {
      const progress = $('adminQuestionProgress');
      if (progress) progress.textContent = `❌ Upload gagal: ${error.message}`;
      toast(`Upload JSON gagal: ${error.message}`, 'warning', 6000);
    } finally {
      busy(button, '', false);
    }
  }

  async function adminMigrateAllQuestions() {
    const button = $('adminMigrateAllQuestionsBtn');
    if (!button) return;
    if (!window.confirm('Migrasikan semua 6 bank soal JSON ke Safety Database? Data dengan question_id yang sama akan diperbarui, bukan diduplikasi.')) return;

    const files = Object.entries(QUESTION_FILES);
    let total = 0;
    let added = 0;
    let updated = 0;

    try {
      busy(button, 'Migrasi berjalan…', true);

      for (let index = 0; index < files.length; index += 1) {
        const [testType, filePath] = files[index];
        const progress = $('adminQuestionProgress');
        if (progress) progress.textContent = `Memuat ${index + 1}/${files.length}: ${filePath}`;

        const response = await fetch(filePath, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`Gagal memuat ${filePath}. HTTP ${response.status}.`);

        const data = await response.json();
        const questions = normalizeQuestionPayloads_(data, testType);
        const result = await adminSaveQuestionBatches(questions, `${filePath}`);

        total += result.total;
        added += result.added;
        updated += result.updated;
      }

      const progress = $('adminQuestionProgress');
      if (progress) progress.textContent = `✅ Migrasi semua selesai: ${total} soal diproses, ${added} ditambahkan, ${updated} diperbarui.`;
      toast(`✅ Semua bank soal berhasil dimigrasikan (${total} soal).`, 'success', 6000);
      await adminLoadQuestions();
      await refreshAdminData();
    } catch (error) {
      const progress = $('adminQuestionProgress');
      if (progress) progress.textContent = `❌ Migrasi berhenti: ${error.message}`;
      toast(`Migrasi semua JSON gagal: ${error.message}`, 'warning', 7000);
    } finally {
      busy(button, '', false);
    }
  }

  async function adminEditQuestion(questionId) {
    const question = adminQuestionsCache.find((item) => item.question_id === questionId);
    if (!question) return;
    const raw = window.prompt('Edit soal dalam JSON. Setelah selesai, tekan OK.\n\nFormat contoh: {"question":"...","options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"answer":"A","discussion":"..."}', JSON.stringify({ question: question.question, options: { A:question.option_a, B:question.option_b, C:question.option_c, D:question.option_d, E:question.option_e }, answer:question.answer, discussion:question.discussion }, null, 2));
    if (raw === null) return;
    try {
      const edited = JSON.parse(raw);
      const payload = { question_id: question.question_id, test_type: question.test_type, package: question.package, no_soal: question.no_soal, question: edited.question, options: edited.options, answer: edited.answer, discussion: edited.discussion };
      await apiChecked('adminSaveQuestions', { token: state.session.token, questions: [payload] });
      toast('Soal berhasil diperbarui.', 'success');
      await adminLoadQuestions();
    } catch (error) { toast(`Soal tidak valid: ${error.message}`, 'warning', 4500); }
  }

  async function adminDeleteQuestion(questionId) {
    const question = adminQuestionsCache.find((item) => item.question_id === questionId);
    if (!question || !window.confirm(`Nonaktifkan soal nomor ${question.no_soal}? Soal tidak akan dipakai peserta, tetapi datanya tetap tersimpan.`)) return;
    try { const response = await apiChecked('adminDeleteQuestion', { token: state.session.token, question_id: questionId }); toast(response.message || 'Soal dinonaktifkan.', 'success'); await adminLoadQuestions(); }
    catch (error) { toast(error.message, 'warning'); }
  }

  function renderAdminLabels() {
    const selected = state.admin.labelTest || 'kuantitatif';
    const labels = state.admin.labels.filter((item) => item.test_type === selected);
    $('adminPanel').innerHTML = `
      <div class="admin-panel-head"><div><div class="eyebrow">PENILAIAN</div><h2>Label kelulusan multi-tingkat</h2><p class="muted">Atur batas nilai masing-masing tes. Rentang 0–100.</p></div></div>
      <div class="admin-card card">
        <div class="admin-filter-grid"><label>Tes<select id="adminLabelTest">${Object.entries(TESTS).map(([id,test]) => `<option value="${id}" ${id===selected?'selected':''}>${escapeHtml(test.name)}</option>`).join('')}</select></label><div class="admin-label-help">Contoh: 90–100 = Sangat Baik, 80–89 = Baik.</div><button type="button" class="secondary-btn" id="adminAddLabel">+ Tambah Label</button><button type="button" class="primary-btn" id="adminSaveLabels">Simpan Label</button></div>
      </div>
      <div class="admin-card card"><div id="adminLabelsList" class="admin-label-list"></div></div>
    `;
    const list = $('adminLabelsList');
    list.innerHTML = labels.map((item, index) => `
      <div class="admin-label-row" data-label-index="${index}"><input class="admin-label-name" value="${escapeHtml(item.label)}" placeholder="Nama label"><input class="admin-label-min" type="number" min="0" max="100" value="${Number(item.min_score)}"><span>hingga</span><input class="admin-label-max" type="number" min="0" max="100" value="${Number(item.max_score)}"><button type="button" class="danger-btn admin-small-btn admin-remove-label">Hapus</button></div>
    `).join('');
    $('adminLabelTest').addEventListener('change', async () => { state.admin.labelTest = $('adminLabelTest').value; await loadAdminLabelsForSelected(); });
    $('adminAddLabel').addEventListener('click', () => {
      const row = document.createElement('div'); row.className='admin-label-row'; row.innerHTML='<input class="admin-label-name" value="Label Baru"><input class="admin-label-min" type="number" min="0" max="100" value="0"><span>hingga</span><input class="admin-label-max" type="number" min="0" max="100" value="100"><button type="button" class="danger-btn admin-small-btn admin-remove-label">Hapus</button>'; list.appendChild(row); bindLabelRemoveButtons();
    });
    $('adminSaveLabels').addEventListener('click', adminSaveLabels);
    bindLabelRemoveButtons();
  }

  function bindLabelRemoveButtons() { document.querySelectorAll('.admin-remove-label').forEach((button) => button.onclick = () => button.closest('.admin-label-row')?.remove()); }

  async function loadAdminLabelsForSelected() {
    try { const response = await apiChecked('adminGetScoreLabels', { token:state.session.token, test_type:state.admin.labelTest }); state.admin.labels = [...state.admin.labels.filter((x)=>x.test_type!==state.admin.labelTest), ...(response.labels||[])]; renderAdminLabels(); }
    catch(error){toast(error.message,'warning');}
  }

  async function adminSaveLabels() {
    const type = $('adminLabelTest').value;
    const labels = Array.from(document.querySelectorAll('.admin-label-row')).map((row, index) => ({ label:row.querySelector('.admin-label-name').value.trim(), min_score:Number(row.querySelector('.admin-label-min').value), max_score:Number(row.querySelector('.admin-label-max').value), urutan:index+1 }));
    try { const response = await apiChecked('adminSaveScoreLabels', { token:state.session.token, test_type:type, labels }); toast(response.message||'Label tersimpan.','success'); const refreshed=await apiChecked('adminGetScoreLabels',{token:state.session.token,test_type:type}); state.admin.labels=[...state.admin.labels.filter((x)=>x.test_type!==type),...(refreshed.labels||[])]; renderAdminLabels(); }
    catch(error){toast(error.message,'warning');}
  }

  function bindAdminTabButtons() {
    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
      button.addEventListener('click', async () => { state.admin.tab = button.dataset.adminTab; if (state.admin.tab === 'labels' && !state.admin.labelTest) state.admin.labelTest='kuantitatif'; renderAdmin(); });
    });
  }


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
        if (icon) icon.textContent = visible ? '👁' : '🙈';
      });
    });
  }

  // ============================================================
  // EVENT BINDING
  // ============================================================

  function bind() {
    bindPasswordToggles();
// About page
document.querySelectorAll('[data-goto="about"]').forEach((el) => {
  el.addEventListener('click', () => { showView('about'); loadStats(); });
});
$('backFromAboutBtn')?.addEventListener('click', () => showView('landing'));
$('aboutRegisterBtn')?.addEventListener('click', () => showAuth('register'));
$('aboutGuestBtn')?.addEventListener('click', () => { $('guestModal').hidden = false; });
       $('landingLoginBtn').addEventListener('click', () => showAuth('login'));
    $('landingRegisterBtn').addEventListener('click', () => showAuth('register'));
    $('landingGuestBtn')?.addEventListener('click', () => { $('guestModal').hidden = false; });
    $('landingGuestBtnHero')?.addEventListener('click', () => { $('guestModal').hidden = false; });
    $('landingRegisterBtnHero')?.addEventListener('click', () => showAuth('register'));
    $('landingRegisterBtnKraepelin')?.addEventListener('click', () => showAuth('register'));
    $('landingRegisterBtnCv')?.addEventListener('click', () => showAuth('register'));
    $('landingRegisterBtnFinal')?.addEventListener('click', () => showAuth('register'));
// Interest modal
document.querySelectorAll('[data-interest]').forEach((btn) => {
  btn.addEventListener('click', () => openInterestModal(btn.dataset.interest));
});
$('cancelInterestBtn')?.addEventListener('click', closeInterestModal);
$('interestForm')?.addEventListener('submit', submitInterest);
$('interestModal')?.addEventListener('click', (e) => {
  if (e.target === $('interestModal')) closeInterestModal();
});
    $('cancelGuestBtn').addEventListener('click', () => { $('guestModal').hidden = true; });
    $('confirmGuestBtn').addEventListener('click', () => {
      $('guestModal').hidden = true;
      enterGuest();
      toast('Mode tamu aktif.', 'info');
    });

    $('backToLandingBtn').addEventListener('click', () => showView('landing'));
    $('openRegisterFromLogin').addEventListener('click', () => showAuth('register'));
    $('openLoginFromRegister').addEventListener('click', () => showAuth('login'));
    $('openForgotFromLogin')?.addEventListener('click', () => showAuth('forgot'));
    $('backToLoginFromForgot')?.addEventListener('click', () => showAuth('login'));

    $('forgotForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      requestReset();
    });

    $('resetForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const params = new URLSearchParams(location.search);
      const token = params.get('reset');
      if (!token) {
        $('resetError').textContent = 'Token reset tidak ditemukan di URL.';
        return;
      }
      submitNewPassword(token);
    });

    $('backFromInstructionBtn').addEventListener('click', () => showView('dashboard'));
    $('startTestBtn').addEventListener('click', startTest);

    $('testHomeBtn').addEventListener('click', openEndTestModal);
    $('cancelEndTestBtn').addEventListener('click', () => { $('confirmModal').hidden = true; });
    $('confirmEndTestBtn').addEventListener('click', abandonTest);

    $('downloadPdfBtn').addEventListener('click', downloadPdf);
    $('resultHistoryBtn').addEventListener('click', async () => {
      if (!state.isGuest) {
        try { await refreshHistory(); } catch (error) { toast(error.message, 'warning'); }
      }
      renderHistory();
      showView('history');
    });

    $('finishBtn').addEventListener('click', async () => {
      if (state.isGuest) {
        leaveGuest();
        showView('landing');
        return;
      }
      await goDashboard();
    });

    $('viewHistoryBtn').addEventListener('click', async () => {
      if (!state.isGuest) {
        try { await refreshHistory(); } catch (error) { toast(error.message, 'warning'); }
      }
      renderHistory();
      showView('history');
    });

    $('backDashboardBtn').addEventListener('click', () => goDashboard());
    $('logoutBtn').addEventListener('click', logout);
    $('adminLogoutBtn')?.addEventListener('click', logout);

    $('loginForm').addEventListener('submit', (event) => {
      event.preventDefault();
      login();
    });

    $('registerForm').addEventListener('submit', (event) => {
  event.preventDefault();
  register();
});

    $('resumeTestBtn')?.addEventListener('click', resumePersistedTest);
    $('startPracticeBtn')?.addEventListener('click', () => openInstruction('kraepelin', 1));

    window.addEventListener('keydown', (event) => {
      if (document.body.dataset.view !== 'test') return;
      if (TESTS[state.test]?.kind !== 'kraepelin') return;
      if (/^[0-9]$/.test(event.key)) {
        answerKraepelin(Number(event.key));
      }
    });
  }

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
    loadStats();  // ← pindah ke luar, biar selalu dipanggil

    if (state.session) {
      $('welcomeName').textContent = state.session.username;

      if (isAdmin()) {
        try {
          await openAdminDashboard('overview');
        } catch (error) {
          toast(`Dashboard admin belum dapat dibuka: ${error.message}`, 'warning', 4500);
        }
        return;
      }

      // Setelah renderCatalog() dan sebelum showView
loadStats();
      showView('dashboard');

      try {
        await refreshHistory();
      } catch (error) {
        toast(`Belum dapat mengambil histori: ${error.message}`, 'warning', 4500);
      }

      if (loadPersistedTest()) {
        // Dashboard Fase 4 tetap ringan; user memilih lanjutkan dari data lokal.
        toast('Ada progress tes yang tersimpan. Kamu bisa melanjutkannya dari sesi ini.', 'info', 4200);
      }
    } else {
      showView('landing');
    }
  }

  init();
})();
