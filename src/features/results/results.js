'use strict';

// ============================================================
  // RESULT + CHART
  // ============================================================

  function renderResult(result) {
    const name = state.isGuest ? 'Tamu' : state.session?.username || 'Peserta';
    $('resultTitle').textContent = `${TESTS[result.type].name} selesai`;


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
