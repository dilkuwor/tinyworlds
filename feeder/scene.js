/**
 * scene.js - The Feeder: input, controls and the loop
 * Click to scatter seed, click the feeder to refill it (or let auto-fill keep
 * it topped up), move gently or the birds take fright. Mood, auto-fill and the
 * birds you have seen are remembered.
 */

class FeederScene {
  constructor() {
    this.world = document.getElementById('world');
    this.canvas = document.getElementById('feeder-canvas');
    this.garden = new FeederWorld(this.canvas);
    this.pointer = { x: 0, y: 0, t: 0, speed: 0 };
    this.lastSong = 0;
    this.ambientTimer = 3;

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('tinyworlds.feeder.state') || '{}'); } catch (_) {}
    if (saved.mood) this.garden.setMood(saved.mood);
    this.autoFill = !!saved.autoFill;
    this.lowFor = 0; // seconds the feeder has been nearly empty
    (saved.seen || []).forEach(s => this.garden.seen.add(s));
    this.seenBefore = new Set(this.garden.seen);

    this.stage = createStage(this.canvas, (stage) => {
      this.stage = stage;
      this.garden.resize(stage.width, stage.height, stage.dpr);
    });
    // A little seed already down so the first visit is lively
    this.garden.scatter(this.stage.width * 0.32, this.garden.groundY - 40, 30);

    this.garden.onSong = (sp) => {
      if (this.garden.t - this.lastSong > 0.6) {
        this.lastSong = this.garden.t;
        window.soundManager.song(sp);
      }
    };
    this.garden.onFlutter = (n) => window.soundManager.flutter(n);

    this.bindInput();
    this.bindUI();
    this.updateLabels();
    startLoop((dt) => this.frame(dt));
  }

  bindInput() {
    const p = this.pointer;
    window.addEventListener('pointermove', (e) => {
      if (Shell.isUIEvent(e)) return;
      const now = performance.now() / 1000;
      const dt = Math.max(0.008, now - p.t);
      const v = Math.hypot(e.clientX - p.x, e.clientY - p.y) / dt;
      p.speed = p.speed * 0.7 + Math.min(v, 6000) * 0.3;
      p.x = e.clientX; p.y = e.clientY; p.t = now;
      // Sudden movement nearby frightens them
      if (p.speed > 1900) this.garden.startle(p.x, p.y, 120, 0.7);
    });

    this.world.addEventListener('pointerdown', (e) => {
      if (Shell.isUIEvent(e)) return;
      const g = this.garden;
      if (g.hitFeeder(e.clientX, e.clientY)) {
        this.refill();
        return;
      }
      // Clicking right on top of a bird spooks it; elsewhere, scatter seed
      const near = g.birds.some(b => b.state === 'perched' && Math.hypot(b.x - e.clientX, b.y - 14 * g.S - e.clientY) < 30 * g.S);
      if (near) {
        g.startle(e.clientX, e.clientY, 90, 1);
      } else {
        g.scatter(e.clientX, e.clientY);
        window.soundManager.scatter();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') { e.preventDefault(); this.scatterRandom(); }
      else if (k === 'r') this.refill();
      else if (k === 'a') this.toggleAutoFill();
      else if (k === 'd') this.cycleMood();
      else if (k === 'm') this.toggleSound();
    });
  }

  bindUI() {
    document.getElementById('btn-seed')?.addEventListener('click', () => this.scatterRandom());
    document.getElementById('btn-refill')?.addEventListener('click', () => this.refill());
    document.getElementById('btn-autofill')?.addEventListener('click', () => this.toggleAutoFill());
    document.getElementById('btn-mood')?.addEventListener('click', () => this.cycleMood());
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
  }

  scatterRandom() {
    const g = this.garden;
    g.scatter(g.w * (0.12 + Math.random() * 0.5), g.groundY - 120 * g.S);
    window.soundManager.scatter();
  }

  refill() {
    this.garden.refill();
    window.soundManager.pour();
  }

  toggleAutoFill() {
    this.autoFill = !this.autoFill;
    this.lowFor = 0;
    if (this.autoFill && this.garden.feederSeed < 0.15) this.refill();
    this.save();
    this.updateLabels();
  }

  /** With auto-fill on, top the feeder up a moment after it runs low. */
  checkAutoFill(dt) {
    if (!this.autoFill) return;
    this.lowFor = this.garden.feederSeed < 0.12 ? this.lowFor + dt : 0;
    if (this.lowFor > 1.5) {
      this.lowFor = 0;
      this.refill();
    }
  }

  cycleMood() {
    const order = ['morning', 'midday', 'golden', 'winter'];
    this.garden.setMood(order[(order.indexOf(this.garden.mood) + 1) % order.length]);
    this.save();
    this.updateLabels();
  }

  toggleSound() {
    const muted = window.soundManager.toggleMute();
    document.getElementById('sound-icon').textContent = muted ? '🔇' : '🔊';
    document.getElementById('sound-label').textContent = muted ? 'Off' : 'On';
  }

  save() {
    try {
      localStorage.setItem('tinyworlds.feeder.state', JSON.stringify({ mood: this.garden.mood, autoFill: this.autoFill, seen: [...this.garden.seen] }));
    } catch (_) {}
  }

  updateLabels() {
    const M = FEEDER_MOODS[this.garden.mood];
    document.getElementById('mood-icon').textContent = M.icon;
    document.getElementById('mood-label').textContent = M.label;
    const auto = document.getElementById('btn-autofill');
    auto?.classList.toggle('btn-active', this.autoFill);
    auto?.setAttribute('aria-pressed', String(this.autoFill));
    document.getElementById('autofill-label').textContent = this.autoFill ? 'Auto-fill on' : 'Auto-fill';
  }

  updateStats() {
    const g = this.garden;
    const visiting = g.birds.filter(b => b.state === 'perched').length;
    document.getElementById('stat-birds').textContent = visiting;
    document.getElementById('stat-seed').textContent = `${Math.round(g.feederSeed * 100)}%`;
    const total = Object.keys(BIRD_SPECIES).length;
    document.getElementById('stat-seen').textContent = `${g.seen.size}/${total}`;
    document.getElementById('stat-seen-item').title = 'Species seen: ' + ([...g.seen].map(s => BIRD_SPECIES[s].name).join(', ') || 'none yet');
    // Remember newly spotted species
    if (g.seen.size !== this.seenBefore.size) {
      this.seenBefore = new Set(g.seen);
      this.save();
    }
  }

  frame(dt) {
    this.garden.update(dt);
    this.checkAutoFill(dt);
    this.garden.draw();

    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 4 + Math.random() * 7;
      window.soundManager.ambientChirp();
    }
    this.statsTimer = (this.statsTimer || 0) - dt;
    if (this.statsTimer <= 0) {
      this.statsTimer = 0.4;
      this.updateStats();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Shell.init({ storageKey: 'tinyworlds.feeder' });
  window.feederScene = new FeederScene();
});
