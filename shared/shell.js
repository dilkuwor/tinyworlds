/**
 * shell.js - Shared scene chrome for Tiny Worlds
 * Collapsible toolbar, distraction-free idle fade, fading hint banner,
 * dropdown menus, guide modal and the shortcuts every scene shares
 * (T toolbar, F fullscreen, ? / H guide, Esc close).
 *
 * Expected markup ids: world, toolbar-container, toolbar-handle, btn-collapse,
 * hint-banner, help-modal, btn-help, btn-close-help. Dropdowns are `.dropdown`
 * elements containing a `[data-dropdown-toggle]` button and `.dropdown-item`s.
 */
const Shell = {
  world: null,
  storageKey: 'tinyworlds',

  init({ storageKey = 'tinyworlds', idleDelay = 3500 } = {}) {
    this.storageKey = storageKey;
    this.world = document.getElementById('world');

    this.setupToolbar();
    this.setupDropdowns();
    this.setupHelp();
    this.setupHint();
    this.setupIdleFade(idleDelay);
    this.setupKeys();
    return this;
  },

  /** True when an event started on scene chrome rather than in the world itself. */
  isUIEvent(e) {
    return !!(e.target.closest && e.target.closest('.glass-panel, .modal-overlay, a, button'));
  },

  /** True when a key event should be left to the browser (typing, shortcuts). */
  isModifiedKey(e) {
    return e.metaKey || e.ctrlKey || e.altKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName));
  },

  // ---------- Toolbar ----------
  setupToolbar() {
    const collapseBtn = document.getElementById('btn-collapse');
    const handle = document.getElementById('toolbar-handle');
    if (collapseBtn) collapseBtn.addEventListener('click', () => this.toggleToolbar(true));
    if (handle) handle.addEventListener('click', () => this.toggleToolbar(false));

    let startCollapsed = false;
    try { startCollapsed = localStorage.getItem(`${this.storageKey}.toolbarCollapsed`) === '1'; } catch (_) {}
    if (startCollapsed) this.toggleToolbar(true);
  },

  toggleToolbar(collapsed) {
    const toolbar = document.getElementById('toolbar-container');
    const handle = document.getElementById('toolbar-handle');
    if (!toolbar || !handle) return;
    const isCollapsed = toolbar.classList.toggle('collapsed', collapsed);
    handle.classList.toggle('visible', isCollapsed);
    this.closeDropdowns();
    try { localStorage.setItem(`${this.storageKey}.toolbarCollapsed`, isCollapsed ? '1' : '0'); } catch (_) {}
  },

  // ---------- Dropdowns ----------
  setupDropdowns() {
    document.querySelectorAll('.dropdown').forEach(dropdown => {
      const toggle = dropdown.querySelector('[data-dropdown-toggle]');
      if (!toggle) return;
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = dropdown.classList.contains('open');
        this.closeDropdowns();
        dropdown.classList.toggle('open', !wasOpen);
      });
      dropdown.querySelectorAll('.dropdown-item').forEach(item =>
        item.addEventListener('click', () => dropdown.classList.remove('open')));
    });
    window.addEventListener('click', () => this.closeDropdowns());
  },

  closeDropdowns() {
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  },

  // ---------- Guide modal ----------
  setupHelp() {
    const modal = document.getElementById('help-modal');
    document.getElementById('btn-help')?.addEventListener('click', () => this.toggleHelp());
    document.getElementById('btn-close-help')?.addEventListener('click', () => this.toggleHelp(false));
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.toggleHelp(false);
    });
  },

  toggleHelp(open) {
    document.getElementById('help-modal')?.classList.toggle('open', open);
  },

  // ---------- Hint banner ----------
  setupHint() {
    const hint = document.getElementById('hint-banner');
    if (!hint) return;
    const hideHint = () => hint.classList.add('hidden');
    setTimeout(hideHint, 6000);
    ['mousedown', 'keydown', 'touchstart'].forEach(evt =>
      window.addEventListener(evt, hideHint, { once: true, passive: true }));
  },

  // ---------- Distraction-free idle fade ----------
  setupIdleFade(delay) {
    if (!this.world) return;
    let idleTimer = null;
    const wake = () => {
      this.world.classList.remove('ui-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        const busy = document.querySelector('.dropdown.open, .modal-overlay.open, .glass-panel:hover');
        if (busy) wake();
        else this.world.classList.add('ui-idle');
      }, delay);
    };
    ['mousemove', 'mousedown', 'click', 'touchstart', 'keydown', 'wheel'].forEach(evt =>
      window.addEventListener(evt, wake, { passive: true }));
    wake();
  },

  // ---------- Shared shortcuts ----------
  setupKeys() {
    window.addEventListener('keydown', (e) => {
      if (this.isModifiedKey(e)) return;
      if (e.key === 'Escape') {
        this.closeDropdowns();
        this.toggleHelp(false);
      } else if (e.key === 't' || e.key === 'T') {
        this.toggleToolbar();
      } else if (e.key === 'f' || e.key === 'F') {
        this.toggleFullscreen();
      } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        this.toggleHelp();
      }
    });
  },

  toggleFullscreen() {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
    } else {
      const el = doc.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  }
};

window.Shell = Shell;
