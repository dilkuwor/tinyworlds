/**
 * scene.js - The Snow Globe: drag or shake it, wind the music box, tap the cottage.
 */

class SnowGlobeScene {
  constructor() {
    this.world = document.getElementById('world');
    this.canvas = document.getElementById('globe-canvas');
    this.globe = new SnowGlobeWorld(this.canvas);
    this.sound = window.soundManager;

    this.stage = createStage(this.canvas, (stage) => {
      this.globe.resize(stage.width, stage.height, stage.dpr);
    });

    this.globe.onNote = (m, b, speed) => this.sound.note(m, b, speed);
    this.globe.onSwish = (s) => this.sound.swish(s);

    this.bindInput();
    this.bindUI();
    this.updateLabels();
    this.statAcc = 0;
    startLoop((dt) => this.frame(dt));
  }

  bindInput() {
    const g = this.globe;
    this.world.addEventListener('pointerdown', (e) => {
      if (Shell.isUIEvent(e)) return;
      this.askForMotion();
      if (g.pointerDown(e.clientX, e.clientY)) {
        this.world.setPointerCapture?.(e.pointerId);
        this.world.classList.add('grabbing');
      }
    });
    window.addEventListener('pointermove', (e) => {
      g.pointerMove(e.clientX, e.clientY);
      if (g.drag) return;
      const hit = Shell.isUIEvent(e) ? null : g.hitTest(e.clientX, e.clientY);
      this.world.classList.toggle('pointing', hit === 'key' || hit === 'cottage');
      this.world.classList.toggle('grab', hit === 'globe' || hit === 'base');
    });
    const up = () => {
      this.world.classList.remove('grabbing');
      const tapped = g.pointerUp();
      if (tapped === 'key') this.windUp();
      else if (tapped === 'cottage') this.toggleLights();
      else if (tapped === 'globe' || tapped === 'base') { g.tap(); this.sound.tink(); }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      const k = e.key.toLowerCase();
      if (e.key === ' ') { e.preventDefault(); this.shake(); }
      else if (k === 'w') this.windUp();
      else if (k === 'l') this.toggleLights();
      else if (k === 'm') this.toggleSound();
    });
  }

  bindUI() {
    document.getElementById('btn-shake')?.addEventListener('click', () => this.shake());
    document.getElementById('btn-wind')?.addEventListener('click', () => this.windUp());
    document.getElementById('btn-lights')?.addEventListener('click', () => this.toggleLights());
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
  }

  /** On phones, shaking the phone shakes the globe (iOS asks first). */
  askForMotion() {
    if (this.motionAsked) return;
    this.motionAsked = true;
    const listen = () => window.addEventListener('devicemotion', (e) => {
      const a = e.acceleration;
      if (!a || a.x == null) return;
      if (Math.hypot(a.x, a.y) > 3) this.globe.jolt(-a.x * 60, a.y * 60);
    });
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(r => { if (r === 'granted') listen(); }).catch(() => {});
    } else if ('ondevicemotion' in window) {
      listen();
    }
  }

  shake() {
    this.globe.shake(1);
  }

  windUp() {
    this.globe.windUp();
    this.sound.ratchet();
    this.updateLabels();
  }

  toggleLights() {
    this.globe.toggleLights();
    this.sound.click();
    this.updateLabels();
  }

  toggleSound() {
    const muted = this.sound.toggleMute();
    document.getElementById('sound-icon').textContent = muted ? '🔇' : '🔊';
    document.getElementById('sound-label').textContent = muted ? 'Off' : 'On';
  }

  updateLabels() {
    const on = this.globe.lightsOn;
    document.getElementById('lights-label').textContent = on ? 'Lights on' : 'Lights off';
    document.getElementById('btn-lights').classList.toggle('active-tool', on);
    document.getElementById('btn-wind').classList.toggle('active-tool', this.globe.playing);
  }

  frame(dt) {
    const g = this.globe;
    g.update(dt);
    g.draw();

    // A crackle from the fire now and then
    if (this.sound.audible && Math.random() < dt * 0.8) this.sound.crackle();

    this.statAcc += dt;
    if (this.statAcc > 0.5) {
      this.statAcc = 0;
      document.getElementById('stat-snow').textContent = `${Math.round(g.airborne * 100)}%`;
      document.getElementById('stat-music').textContent = g.playing ? `${Math.ceil(g.wind * 45)}s` : 'Still';
      this.updateLabels();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Shell.init({ storageKey: 'tinyworlds.snowglobe' });
  window.snowGlobeScene = new SnowGlobeScene();
});
