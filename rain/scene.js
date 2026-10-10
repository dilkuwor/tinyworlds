/**
 * scene.js - Rain on the Glass: input, controls and the loop
 * Drag to wipe the fog, tap to add a drop, squeegee the whole window,
 * change the rain and the time of day.
 */

class RainScene {
  constructor() {
    this.world = document.getElementById('world');
    this.canvas = document.getElementById('rain-canvas');
    this.rain = new RainWorld(this.canvas);
    this.sweep = null;
    this.wiping = null;
    this.wipeSpeed = 0;
    this.lastDrip = 0;

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('tinyworlds.rain.state') || '{}'); } catch (_) {}
    if (saved.mood) this.rain.setMood(saved.mood);
    if (saved.level) this.rain.setLevel(saved.level);

    this.stage = createStage(this.canvas, (stage) => {
      this.stage = stage;
      this.rain.resize(stage.width, stage.height, stage.dpr);
    });

    this.rain.onDrip = (x, size) => {
      if (this.rain.t - this.lastDrip > 0.08) {
        this.lastDrip = this.rain.t;
        window.soundManager.drip(size);
      }
    };
    this.rain.onLightning = (strength) => window.soundManager.thunder(strength);

    this.bindInput();
    this.bindUI();
    this.updateLabels();
    this.updateClock();
    setInterval(() => this.updateClock(), 15000);
    startLoop((dt) => this.frame(dt));
  }

  // ---------- Input ----------
  bindInput() {
    this.world.addEventListener('pointerdown', (e) => {
      if (Shell.isUIEvent(e)) return;
      this.wiping = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() };
      this.world.setPointerCapture?.(e.pointerId);
    });
    this.world.addEventListener('pointermove', (e) => {
      if (!this.wiping) return;
      const w = this.wiping;
      const len = this.rain.wipe(w.x, w.y, e.clientX, e.clientY, 34);
      w.moved += len;
      const now = performance.now();
      this.wipeSpeed = Math.min(1, len / Math.max(1, now - w.t) / 2);
      w.x = e.clientX; w.y = e.clientY; w.t = now;
    });
    const end = (e) => {
      if (!this.wiping) return;
      // A tap (no real drag) adds a fat drop that soon slides away
      if (this.wiping.moved < 6 && e && e.type === 'pointerup') {
        this.rain.spawnDrop(e.clientX, e.clientY, (7 + Math.random() * 3) * this.rain.S);
        const d = this.rain.drops[this.rain.drops.length - 1];
        d.sliding = true;
      }
      this.wiping = null;
      this.wipeSpeed = 0;
    };
    this.world.addEventListener('pointerup', end);
    this.world.addEventListener('pointercancel', end);

    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || e.code === 'Space') { e.preventDefault(); this.squeegee(); }
      else if (k === 'r') this.cycleLevel();
      else if (k === 'd') this.cycleMood();
      else if (k === 'm') this.toggleSound();
    });
  }

  bindUI() {
    document.getElementById('btn-wipe')?.addEventListener('click', () => this.squeegee());
    document.getElementById('btn-level')?.addEventListener('click', () => this.cycleLevel());
    document.getElementById('btn-mood')?.addEventListener('click', () => this.cycleMood());
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
  }

  // ---------- Actions ----------
  squeegee() {
    if (this.sweep) return;
    this.sweep = { x: -40, last: -40 };
    window.soundManager.setWipe(0.6);
  }

  cycleLevel() {
    const order = ['light', 'steady', 'heavy'];
    const next = order[(order.indexOf(this.rain.level) + 1) % order.length];
    this.rain.setLevel(next);
    window.soundManager.setLevel(next);
    this.save();
    this.updateLabels();
  }

  cycleMood() {
    const order = ['day', 'dusk', 'night', 'storm'];
    const next = order[(order.indexOf(this.rain.mood) + 1) % order.length];
    this.rain.setMood(next);
    if (next === 'storm' && this.rain.level !== 'heavy') {
      this.rain.setLevel('heavy');
      window.soundManager.setLevel('heavy');
    }
    this.save();
    this.updateLabels();
  }

  toggleSound() {
    const sm = window.soundManager;
    sm.level = this.rain.level;
    const muted = sm.toggleMute();
    sm.setLevel(this.rain.level);
    document.getElementById('sound-icon').textContent = muted ? '🔇' : '🔊';
    document.getElementById('sound-label').textContent = muted ? 'Off' : 'On';
  }

  save() {
    try { localStorage.setItem('tinyworlds.rain.state', JSON.stringify({ mood: this.rain.mood, level: this.rain.level })); } catch (_) {}
  }

  updateLabels() {
    const M = RAIN_MOODS[this.rain.mood], L = RAIN_LEVELS[this.rain.level];
    document.getElementById('mood-icon').textContent = M.icon;
    document.getElementById('mood-label').textContent = M.label;
    document.getElementById('level-icon').textContent = L.icon;
    document.getElementById('level-label').textContent = L.label;
    document.getElementById('stat-rain').textContent = L.label;
  }

  updateClock() {
    const el = document.getElementById('stat-time');
    if (el) el.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // ---------- Loop ----------
  frame(dt) {
    if (this.sweep) {
      const sw = this.sweep;
      sw.x += dt * this.stage.width * 0.9;
      this.rain.wipeBand(sw.last, sw.x);
      sw.last = sw.x;
      if (sw.x > this.stage.width + 40) {
        this.sweep = null;
        window.soundManager.setWipe(0);
      }
    } else if (!this.wiping) {
      window.soundManager.setWipe(0);
    } else {
      window.soundManager.setWipe(this.wipeSpeed);
      this.wipeSpeed *= Math.exp(-6 * dt);
    }

    this.rain.update(dt);
    this.rain.draw();
    if (this.sweep) this.drawSqueegee(this.sweep.x);
  }

  drawSqueegee(x) {
    const c = this.stage.ctx, h = this.rain.glassBottom;
    c.save();
    const g = c.createLinearGradient(x - 18, 0, x + 6, 0);
    g.addColorStop(0, 'rgba(255, 255, 255, 0)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0.18)');
    c.fillStyle = g;
    c.fillRect(x - 18, 0, 24, h);
    c.fillStyle = '#20252c';
    c.fillRect(x + 2, 0, 7, h);
    c.fillStyle = 'rgba(255, 255, 255, 0.25)';
    c.fillRect(x + 2, 0, 1.5, h);
    c.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Shell.init({ storageKey: 'tinyworlds.rain' });
  window.rainScene = new RainScene();
});
