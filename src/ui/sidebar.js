'use strict';

// ============================================================
  // SIDEBAR / APP SHELL
  // ============================================================

  function isDesktopRail_() {
    return window.matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)').matches;
  }

  function setSidebar_(open) {
    const sidebar = $('sidebar');
    const overlay = $('sidebarOverlay');
    if (!sidebar) return;

    if (isDesktopRail_()) {
      sidebar.classList.toggle('is-expanded', Boolean(open));
      sidebar.classList.remove('open');
      overlay?.classList.remove('open');
      return;
    }

    sidebar.classList.toggle('open', Boolean(open));
    overlay?.classList.toggle('open', Boolean(open));
    sidebar.classList.remove('is-expanded');
  }

  function openSidebar_() {
    setSidebar_(true);
  }

  function toggleSidebar_() {
    const sidebar = $('sidebar');
    if (!sidebar) return;

    if (isDesktopRail_()) {
      setSidebar_(!sidebar.classList.contains('is-expanded'));
      return;
    }

    setSidebar_(!sidebar.classList.contains('open'));
  }

  function closeSidebar_() {
    const sidebar = $('sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('open', 'is-expanded');
    $('sidebarOverlay')?.classList.remove('open');
  }
