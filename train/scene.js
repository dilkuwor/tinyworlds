/**
 * scene.js - Night Train: controls and the loop
 * Mostly you just watch. Change the speed and the route, toggle your
 * reflection in the glass, and sound the horn now and then.
 */

class TrainScene {
  constructor() {
    this.world = document.getElementById('world');
    this.canvas = document.getElementById('train-canvas');
    this.train = new TrainWorld(this.canvas);

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('tinyworlds.train.state') || '{}'); } catch (_) {}
    if (saved.route) this.train.route = saved.route;
    if (saved.speed) { this.train.setSpeed(saved.speed); this.train.kmh = TRAIN_SPEEDS[saved.speed].kmh; }
    if (saved.reflection === false) this.train.reflection = false;

    this.stage = createStage(this.canvas, (stage) => {
      this.stage = stage;
      this.train.resize(stage.width, stage.height, stage.dpr);
    });

    this.train.onJoint = () => window.soundManager.clack(this.train.kmh / 200);
    this.train.onEvent = (type) => {
      const sm = window.soundManager;
      if (type === 'tunnel-in') sm.whoosh(true);
      else if (type === 'passing') sm.whoosh(false);
      else if (type === 'station') sm.chime();
    };

    this.bindInput();
    this.bindUI();
    this.updateLabels();
    startLoop((dt) => this.frame(dt));
  }

  bindInput() {
    this.world.addEventListener('pointerdown', (e) => {
      if (Shell.isUIEvent(e)) return;
      window.soundManager.horn();
    });
    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') { e.preventDefault(); window.soundManager.horn(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') this.shiftSpeed(1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') this.shiftSpeed(-1);
      else if (k === 's') this.shiftSpeed(1, true);
      else if (k === 'r') this.cycleRoute();
      else if (k === 'l') this.toggleReflection();
      else if (k === 'm') this.toggleSound();
    });
  }

  bindUI() {
    document.getElementById('btn-speed')?.addEventListener('click', () => this.shiftSpeed(1, true));
    document.getElementById('btn-route')?.addEventListener('click', () => this.cycleRoute());
    document.getElementById('btn-reflection')?.addEventListener('click', () => this.toggleReflection());
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
  }

  shiftSpeed(dir, wrap = false) {
    const order = ['slow', 'cruise', 'fast'];
    let i = order.indexOf(this.train.speedKey) + dir;
    if (wrap) i = (i + order.length) % order.length;
    i = Math.max(0, Math.min(order.length - 1, i));
    this.train.setSpeed(order[i]);
    this.save();
    this.updateLabels();
  }

  cycleRoute() {
    const order = ['countryside', 'coast', 'snow', 'city'];
    this.train.setRoute(order[(order.indexOf(this.train.route) + 1) % order.length]);
    this.save();
    this.updateLabels();
  }

  toggleReflection() {
    this.train.reflection = !this.train.reflection;
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
      localStorage.setItem('tinyworlds.train.state', JSON.stringify({ route: this.train.route, speed: this.train.speedKey, reflection: this.train.reflection }));
    } catch (_) {}
  }

  updateLabels() {
    const R = TRAIN_ROUTES[this.train.route], V = TRAIN_SPEEDS[this.train.speedKey];
    document.getElementById('route-icon').textContent = R.icon;
    document.getElementById('route-label').textContent = R.label;
    document.getElementById('speed-label').textContent = V.label;
    document.getElementById('reflection-label').textContent = this.train.reflection ? 'Reflection' : 'Clear glass';
    document.getElementById('stat-route').textContent = R.label;
  }

  frame(dt) {
    const t = this.train;
    t.update(dt);
    t.draw();
    window.soundManager.setMotion(t.kmh / 200, t.tunnelCover());
    this.statsTimer = (this.statsTimer || 0) - dt;
    if (this.statsTimer <= 0) {
      this.statsTimer = 0.3;
      document.getElementById('stat-speed').textContent = `${Math.round(t.kmh)} km/h`;
      const st = t.station;
      document.getElementById('stat-next').textContent = st ? st.name : '—';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Shell.init({ storageKey: 'tinyworlds.train' });
  window.trainScene = new TrainScene();
});
