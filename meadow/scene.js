/**
 * scene.js - Night Meadow: input, controls and the loop
 * Hold the pointer still and fireflies gather; click to call them;
 * sudden movement scatters them. Crickets and frogs keep time.
 */

class MeadowScene {
  constructor() {
    this.world = document.getElementById('world');
    this.canvas = document.getElementById('meadow-canvas');
    this.meadow = new MeadowWorld(this.canvas);
    this.pointer = { x: 0, y: 0, t: 0, speed: 0, inside: false, still: 0 };
    this.crickets = [
      { pitch: 4300, gain: 0.016, every: 0.55, next: 0.2, pulses: 3 },
      { pitch: 4700, gain: 0.011, every: 0.71, next: 0.5, pulses: 4 },
      { pitch: 3900, gain: 0.008, every: 0.93, next: 0.8, pulses: 2 }
    ];
    this.frogTimer = 6;
    this.wasHarmony = false;

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('tinyworlds.meadow.state') || '{}'); } catch (_) {}
    if (saved.mood) this.meadow.setMood(saved.mood);

    this.stage = createStage(this.canvas, (stage) => {
      this.stage = stage;
      this.meadow.resize(stage.width, stage.height, stage.dpr);
    });
    this.meadow.onShootingStar = () => window.soundManager.shimmer();

    this.bindInput();
    this.bindUI();
    this.updateLabels();
    startLoop((dt) => this.frame(dt));
  }

  bindInput() {
    const p = this.pointer;
    window.addEventListener('pointermove', (e) => {
      if (Shell.isUIEvent(e)) { p.inside = false; return; }
      const now = performance.now() / 1000;
      const dt = Math.max(0.008, now - p.t);
      const v = Math.hypot(e.clientX - p.x, e.clientY - p.y) / dt;
      p.speed = p.speed * 0.7 + Math.min(v, 6000) * 0.3;
      p.x = e.clientX; p.y = e.clientY; p.t = now; p.inside = true;
      if (p.speed > 2200) this.meadow.scatter(p.x, p.y);
    });
    document.addEventListener('pointerleave', () => { p.inside = false; });
    window.addEventListener('blur', () => { p.inside = false; });

    this.world.addEventListener('pointerdown', (e) => {
      if (Shell.isUIEvent(e)) return;
      this.callAt(e.clientX, e.clientY);
    });

    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') {
        e.preventDefault();
        const p2 = this.pointer;
        this.callAt(p2.inside ? p2.x : this.stage.width / 2, p2.inside ? p2.y : this.meadow.horizon + (this.stage.height - this.meadow.horizon) * 0.4);
      } else if (k === 'd') this.cycleMood();
      else if (k === 'm') this.toggleSound();
    });
  }

  bindUI() {
    document.getElementById('btn-call')?.addEventListener('click', () =>
      this.callAt(this.stage.width / 2, this.meadow.horizon + (this.stage.height - this.meadow.horizon) * 0.4));
    document.getElementById('btn-mood')?.addEventListener('click', () => this.cycleMood());
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
  }

  callAt(x, y) {
    this.meadow.callAt(x, y);
    window.soundManager.chime();
  }

  cycleMood() {
    const order = ['dusk', 'night', 'mist'];
    this.meadow.setMood(order[(order.indexOf(this.meadow.mood) + 1) % order.length]);
    try { localStorage.setItem('tinyworlds.meadow.state', JSON.stringify({ mood: this.meadow.mood })); } catch (_) {}
    this.updateLabels();
  }

  toggleSound() {
    const muted = window.soundManager.toggleMute();
    document.getElementById('sound-icon').textContent = muted ? '🔇' : '🔊';
    document.getElementById('sound-label').textContent = muted ? 'Off' : 'On';
  }

  updateLabels() {
    const M = MEADOW_MOODS[this.meadow.mood];
    document.getElementById('mood-icon').textContent = M.icon;
    document.getElementById('mood-label').textContent = M.label;
  }

  frame(dt) {
    const p = this.pointer, m = this.meadow;

    // A still pointer slowly draws fireflies in
    if (p.inside && p.speed < 500) p.still = Math.min(1, p.still + dt * 0.5);
    else p.still = Math.max(0, p.still - dt * 2);
    p.speed *= Math.exp(-4 * dt);
    m.setAttractor(p.x, p.y, p.inside && p.y > m.horizon - 60 ? p.still : 0);

    m.update(dt);
    m.draw();

    // Night sounds: crickets keep their own time; frogs now and then
    const sm = window.soundManager;
    if (sm.audible) {
      const tempo = m.mood === 'dusk' ? 0.85 : m.mood === 'mist' ? 1.25 : 1;
      for (const c of this.crickets) {
        c.next -= dt;
        if (c.next <= 0) {
          c.next = c.every * tempo * (0.9 + Math.random() * 0.2);
          sm.cricket(c.pitch, c.gain, c.pulses);
        }
      }
      this.frogTimer -= dt;
      if (this.frogTimer <= 0) {
        this.frogTimer = 5 + Math.random() * 12;
        sm.frog();
      }
    }

    this.statsTimer = (this.statsTimer || 0) - dt;
    if (this.statsTimer <= 0) {
      this.statsTimer = 0.4;
      document.getElementById('stat-flies').textContent = p.inside ? m.gatheredNear(p.x, p.y) : 0;
      const pct = Math.round(m.harmony * 100);
      document.getElementById('stat-harmony').textContent = `${pct}%`;
      document.getElementById('stat-harmony-bar').style.width = `${pct}%`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Shell.init({ storageKey: 'tinyworlds.meadow' });
  window.meadowScene = new MeadowScene();
});
