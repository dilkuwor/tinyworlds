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
    this.setupFullscreen();
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

  // ---------- Fullscreen button (for TVs and touch screens, where there's no F key) ----------
  setupFullscreen() {
    const help = document.getElementById('btn-help');
    const el = document.documentElement;
    if (!help || !(el.requestFullscreen || el.webkitRequestFullscreen)) return; // e.g. iPhone Safari
    const btn = document.createElement('button');
    btn.id = 'btn-fullscreen';
    btn.className = 'btn';
    btn.innerHTML = '<span class="btn-icon"></span><span class="btn-label"></span>';
    help.after(btn);
    btn.addEventListener('click', () => this.toggleFullscreen());

    const icon = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="${d}"/></svg>`;
    const expand = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
    const shrink = 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5';
    const sync = () => {
      const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
      btn.querySelector('.btn-icon').innerHTML = icon(on ? shrink : expand);
      btn.querySelector('.btn-label').textContent = on ? 'Exit' : 'Fullscreen';
      btn.title = on ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
      btn.setAttribute('aria-label', btn.title);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
  },

  toggleFullscreen() {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc)?.catch?.(() => {});
    } else {
      const el = doc.documentElement;
      // Browsers can refuse (no user gesture, kiosk mode); nothing to do then
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
    }
  }
};

window.Shell = Shell;
