'use strict';

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

     function shortenText_(text, max = 68) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1).trim() + '…';
  }

  function getWrongLinesForPdf(result, maxLines = 5) {
    const lines = [];

    // MCQ: tampilkan "No. X: teks soal"
    if (Array.isArray(result.wrongDetails) && result.wrongDetails.length) {
      result.wrongDetails.slice(0, maxLines).forEach((w) => {
        lines.push(`No. ${w.no}: ${shortenText_(w.text)}`);
      });
      const extra = result.wrongDetails.length - maxLines;
      if (extra > 0) lines.push(`+ ${extra} soal lainnya (lihat di website)`);
      return lines;
    }

    // Fallback: kalau wrongDetails tidak ada tapi wrongNumbers ada
    if (Array.isArray(result.wrongNumbers) && result.wrongNumbers.length) {
      const list = result.wrongNumbers.slice(0, 20);
      const extra = result.wrongNumbers.length - list.length;
      let text = `No. ${list.join(', ')}`;
      if (extra > 0) text += `, + ${extra} lainnya`;
      lines.push(text);
      return lines;
    }

    // Kraepelin: kolom lemah
    if (Array.isArray(result.correctPerColumn) && result.correctPerColumn.length) {
      const weak = [];
      result.correctPerColumn.forEach((correct, idx) => {
        if (correct / 26 < 0.6) weak.push(`Kolom ${idx + 1} (${correct}/26 benar)`);
      });
      if (!weak.length) return lines;
      weak.slice(0, 6).forEach((w) => lines.push(w));
      const extra = weak.length - 6;
      if (extra > 0) lines.push(`+ ${extra} kolom lainnya`);
      return lines;
    }

    return lines;
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

    // ---- Perlu Diperbaiki (di bawah Catatan) ----
    const wrongLines = getWrongLinesForPdf(result, 5);

    if (wrongLines.length) {
      // Garis pemisah
      lines.push('0.85 0.89 0.94 RG');
      drawPdfLine(lines, 52, 165, 543, 165);

      // Header
      lines.push('0.80 0.20 0.20 rg');
      drawPdfText(lines, 'Perlu Diperbaiki', 52, 148, 10);

      // Daftar soal yang salah (multi-baris)
      lines.push('0.38 0.43 0.50 rg');
      let yPos = 132;
      wrongLines.forEach((lineText) => {
        drawPdfText(lines, lineText, 52, yPos, 9);
        yPos -= 13;
      });
    }
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
