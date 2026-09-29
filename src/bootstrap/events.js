'use strict';

// ============================================================
  // EVENT BINDING
  // ============================================================

  function bind() {
    bindPasswordToggles();

    $('backFromSkdBtn')?.addEventListener('click', () => { goDashboard(); });

    $('startSkdCompleteBtn')?.addEventListener('click', () => {
      const packageNumber = Number($('skdCompletePackage')?.value) || 1;
      openInstruction('skd_lengkap', packageNumber);
    });

    document.querySelectorAll('[data-skd-start]').forEach((button) => {
      button.addEventListener('click', () => {
        const testId = button.dataset.skdStart;
        const select = document.querySelector(`[data-skd-package="${testId}"]`);
        openInstruction(testId, Number(select?.value) || 1);
      });
    });

    // Navigation for the new sidebar shell.
    document.querySelectorAll('[data-app-nav]').forEach((item) => {
      item.addEventListener('click', async () => {
        const target = item.dataset.appNav;
        item.blur();
        closeSidebar_();

        if (target === 'dashboard') {
          await goDashboard();
          return;
        }

        if (target === 'history') {
          if (!state.isGuest) {
            try { await refreshHistory(); } catch (error) { toast(error.message, 'warning'); }
          }
          renderHistory();
          showView('history');
          return;
        }

        if (target === 'skd') {
          showView('skd');
          return;
        }

        if (target === 'cv') {
          showView('cv');
          return;
        }

        if (target === 'psikotes') {
          renderCatalog();
          showView('psikotes');
          return;
        }
      });
    });

    document.querySelectorAll('[data-test]').forEach((item) => {
      item.addEventListener('click', () => {
        const testId = item.dataset.test;
        if (!TESTS[testId]) return;
        closeSidebar_();
        if (testId === 'kraepelin') state.kraepelinSecondsChoice = 15;
        openInstruction(testId, 1);
      });
    });

    const hamburger = $('hamburger');
    hamburger?.addEventListener('click', () => toggleSidebar_());

    $('dashboardOpenMenuBtn')?.addEventListener('click', () => openSidebar_());
    $('dashboardOpenMenuBtnSecondary')?.addEventListener('click', () => openSidebar_());
    $('sidebarOverlay')?.addEventListener('click', closeSidebar_);

    const sidebar = $('sidebar');
    sidebar?.addEventListener('pointerenter', () => {
      if (isDesktopRail_()) {
        sidebar.classList.add('is-expanded');
      }
    });

    sidebar?.addEventListener('pointerleave', () => {
      if (isDesktopRail_()) {
        sidebar.classList.remove('is-expanded');
      }
    });

    window.addEventListener('resize', () => {
      if (!isDesktopRail_()) {
        sidebar?.classList.remove('is-expanded');
      } else {
        sidebar?.classList.remove('open');
        $('sidebarOverlay')?.classList.remove('open');
      }
    });
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

    $('backFromInstructionBtn').addEventListener('click', () => returnToTestOrigin_());
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
      await returnToTestOrigin_();
    });

    $('viewHistoryBtn').addEventListener('click', async () => {
      if (!state.isGuest) {
        try { await refreshHistory(); } catch (error) { toast(error.message, 'warning'); }
      }
      renderHistory();
      showView('history');
    });

    $('backDashboardBtn').addEventListener('click', () => goDashboard());
    $('backFromPsikotesBtn')?.addEventListener('click', () => goDashboard());
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

    window.addEventListener('keydown', (event) => {
      if (document.body.dataset.view !== 'test') return;
      if (TESTS[state.test]?.kind !== 'kraepelin') return;
      if (/^[0-9]$/.test(event.key)) {
        answerKraepelin(Number(event.key));
      }
    });
  }
