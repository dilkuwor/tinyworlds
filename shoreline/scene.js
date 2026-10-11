/**
 * scene.js - The Shoreline: draw and write in the sand, collect shells, call a big wave.
 */

class ShoreScene {
  constructor() {
    this.world = document.getElementById('world');
    this.canvas = document.getElementById('shore-canvas');
    this.beach = new ShorelineWorld(this.canvas);
    this.sound = window.soundManager;
    this.panel = document.getElementById('write-panel');
    this.input = document.getElementById('write-input');

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('tinyworlds.shoreline') || '{}'); } catch (_) {}
    this.collected = saved.shells || 0;

    this.stage = createStage(this.canvas, (stage) => {
      this.beach.resize(stage.width, stage.height, stage.dpr);
    });

    this.beach.onPick = () => {
      this.collected++;
      this.sound.clink();
      this.save();
      this.updateStats();
    };
    this.beach.onGull = () => this.sound.gull();
    this.beach.onSplash = () => this.sound.splash();

    this.bindInput();
    this.bindUI();
    this.updateStats();
    this.statAcc = 0;
    startLoop((dt) => this.frame(dt));
  }

  save() {
    try { localStorage.setItem('tinyworlds.shoreline', JSON.stringify({ shells: this.collected })); } catch (_) {}
  }

  bindInput() {
    const b = this.beach;
    this.world.addEventListener('pointerdown', (e) => {
      if (Shell.isUIEvent(e)) return;
      this.closeWrite();
      const hit = b.pointerDown(e.clientX, e.clientY);
      if (hit === 'sand' || hit === 'water') {
        this.world.setPointerCapture?.(e.pointerId);
        this.world.classList.add('drawing');
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (Shell.isUIEvent(e) && !b.drawing) { b.setPointer(null); return; }
      const moved = b.pointerMove(e.clientX, e.clientY);
      if (moved && this.sound.audible && Math.random() < 0.25) this.sound.scratch(Math.min(1, moved / 20));
      this.world.classList.toggle('pointing', !b.drawing && !!b.shellAt(e.clientX, e.clientY));
    });
    const up = () => {
      b.pointerUp();
      this.world.classList.remove('drawing');
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.addEventListener('pointerleave', () => b.setPointer(null));

    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      const k = e.key.toLowerCase();
      if (e.key === ' ') { e.preventDefault(); this.callWave(); }
      else if (k === 'w') { e.preventDefault(); this.openWrite(); }
      else if (k === 'm') this.toggleSound();
    });
  }

  bindUI() {
    document.getElementById('btn-write')?.addEventListener('click', () => this.panel.classList.contains('open') ? this.closeWrite() : this.openWrite());
    document.getElementById('btn-wave')?.addEventListener('click', () => this.callWave());
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
    this.panel.addEventListener('submit', (e) => {
      e.preventDefault();
      this.beach.writeWord(this.input.value);
      this.input.value = '';
      this.closeWrite();
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.closeWrite(); }
    });
  }

  openWrite() {
    this.panel.classList.add('open');
    document.getElementById('btn-write').classList.add('active-tool');
    setTimeout(() => this.input.focus(), 30);
  }

  closeWrite() {
    if (!this.panel.classList.contains('open')) return;
    this.panel.classList.remove('open');
    document.getElementById('btn-write').classList.remove('active-tool');
    this.input.blur();
  }

  callWave() {
    this.beach.callWave();
  }

  toggleSound() {
    const muted = this.sound.toggleMute();
    document.getElementById('sound-icon').textContent = muted ? '🔇' : '🔊';
    document.getElementById('sound-label').textContent = muted ? 'Off' : 'On';
  }

  updateStats() {
    document.getElementById('stat-shells').textContent = this.collected;
    const tide = this.beach.tide;
    document.getElementById('stat-tide').textContent = tide.level > 0.85 ? 'High' : tide.level < -0.85 ? 'Low' : tide.rising ? 'Rising' : 'Falling';
  }

  frame(dt) {
    const b = this.beach;
    b.update(dt);
    b.draw();
    this.sound.water(b.swash, b.back);
    this.statAcc += dt;
    if (this.statAcc > 5) { this.statAcc = 0; this.updateStats(); }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Shell.init({ storageKey: 'tinyworlds.shoreline' });
  window.shoreScene = new ShoreScene();
});
