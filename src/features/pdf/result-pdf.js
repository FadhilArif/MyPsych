'use strict';

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
        try {
        await api('trackPdfDownload', {
          token: state.session?.token || '',
          test_id: result.testId || state.currentTestId || ''
        });
      } catch (_) {
        // Silent — tracking bukan critical
      }
    } catch (error) {
      console.error('PDF error:', error);
      toast('PDF gagal dibuat.', 'warning', 4500);
    } finally {
      busy(button, '', false);
    }
  }
