/**
 * scene.js - The Desk: hover, nudge and click the objects; each one opens a world.
 */

class DeskScene {
  constructor() {
    this.world = document.getElementById('world');
    this.canvas = document.getElementById('desk-canvas');
    this.label = document.getElementById('desk-label');
    this.desk = new DeskWorld(this.canvas);
    this.pointer = { x: -999, y: -999, inside: false };
    this.keyIndex = -1;

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('tinyworlds.desk.state') || '{}'); } catch (_) {}
    if (saved.lamp === false) { this.desk.lampOn = false; this.desk.lampLevel = 0; }

    this.stage = createStage(this.canvas, (stage) => {
      this.stage = stage;
      this.desk.resize(stage.width, stage.height, stage.dpr);
    });

    this.desk.onHoverChange = (it) => {
      if (it.id === 'tank') window.soundManager.bubble();
    };

    this.buildLinks();
    this.bindInput();
    this.bindUI();
    this.updateLabels();
    this.updateClock();
    setInterval(() => this.updateClock(), 15000);
    startLoop((dt) => this.frame(dt));
  }

  /** Real links for keyboard and screen readers, mirrored by the objects on the desk. */
  buildLinks() {
    const nav = document.getElementById('desk-links');
    DESK_ITEMS.forEach((d, i) => {
      const a = document.createElement('a');
      a.href = `/${d.slug}/`;
      a.textContent = `${d.label}`;
      a.addEventListener('focus', () => { this.keyIndex = i; this.desk.setHover(this.desk.items[i]); });
      a.addEventListener('blur', () => { if (this.keyIndex === i) this.desk.setHover(null); });
      a.addEventListener('click', (e) => { e.preventDefault(); this.open(this.desk.items[i]); });
      nav.appendChild(a);
    });
  }

  bindInput() {
    const p = this.pointer;
    window.addEventListener('pointermove', (e) => {
      if (Shell.isUIEvent(e)) { p.inside = false; this.desk.setHover(null); return; }
      const dx = e.clientX - p.x;
      p.x = e.clientX; p.y = e.clientY; p.inside = true;
      const it = this.desk.nudge(p.x, p.y, Math.abs(dx) < 200 ? dx : 0);
      if (it && Math.abs(dx) > 14 && Math.random() < 0.3) window.soundManager.wobble();
      this.desk.setHover(it);
      this.world.classList.toggle('pointing', !!it || this.desk.hitLamp(p.x, p.y));
    });
    document.addEventListener('pointerleave', () => { p.inside = false; this.desk.setHover(null); });

    this.world.addEventListener('click', (e) => {
      if (Shell.isUIEvent(e)) return;
      if (this.desk.hitLamp(e.clientX, e.clientY)) { this.toggleLamp(); return; }
      const it = this.desk.itemAt(e.clientX, e.clientY);
      if (it) this.open(it);
    });

    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      const k = e.key.toLowerCase();
      if (k === 'l') this.toggleLamp();
      else if (k === 'm') this.toggleSound();
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const n = DESK_ITEMS.length;
        this.keyIndex = (this.keyIndex + (e.key === 'ArrowRight' ? 1 : n - 1) + (this.keyIndex < 0 && e.key === 'ArrowLeft' ? 1 : 0)) % n;
        document.querySelectorAll('#desk-links a')[this.keyIndex]?.focus();
        e.preventDefault();
      }
    });
  }

  bindUI() {
    document.getElementById('btn-lamp')?.addEventListener('click', () => this.toggleLamp());
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
  }

  /** Step into a world: a soft chime and a fade. */
  open(it) {
    if (this.leaving) return;
    this.leaving = true;
    window.soundManager.chime();
    document.getElementById('fade').classList.add('on');
    setTimeout(() => { location.href = `/${it.slug}/`; }, 550);
  }

  toggleLamp() {
    const on = this.desk.toggleLamp();
    window.soundManager.click();
    try { localStorage.setItem('tinyworlds.desk.state', JSON.stringify({ lamp: on })); } catch (_) {}
    this.updateLabels();
  }

  toggleSound() {
    const muted = window.soundManager.toggleMute();
    document.getElementById('sound-icon').textContent = muted ? '🔇' : '🔊';
    document.getElementById('sound-label').textContent = muted ? 'Off' : 'On';
  }

  updateLabels() {
    document.getElementById('lamp-label').textContent = this.desk.lampOn ? 'Lamp on' : 'Lamp off';
    document.getElementById('btn-lamp').classList.toggle('active-tool', this.desk.lampOn);
  }

  updateClock() {
    const el = document.getElementById('stat-time');
    if (el) el.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  frame(dt) {
    const d = this.desk;
    d.update(dt);
    d.draw();

    // Floating label above whatever you're pointing at
    const it = d.hovered;
    if (it) {
      this.label.textContent = `${it.icon} ${it.label}  →`;
      const top = it.id === 'window' ? d.win.y + 14 : it.y - it.hh - 18 * d.S - it.lift * 8 * d.S;
      this.label.style.transform = `translate(${Math.round(it.x)}px, ${Math.round(top)}px) translate(-50%, -100%)`;
      this.label.classList.add('show');
    } else {
      this.label.classList.remove('show');
    }

    // Purr while the cat is under the pointer; the clock keeps time
    window.soundManager.purr(it && it.id === 'cat');
    if (it && it.id === 'cat' && Math.random() < dt * 0.5) d.cat?.twitchEar();
    this.tickAcc = (this.tickAcc || 0) + dt;
    if (this.tickAcc >= 1) {
      this.tickAcc -= 1;
      this.tock = !this.tock;
      if (window.soundManager.audible) window.soundManager.tick(this.tock);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Shell.init({ storageKey: 'tinyworlds.desk' });
  window.deskScene = new DeskScene();
});
