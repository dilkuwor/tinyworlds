/**
 * scene.js - The Greenhouse: input, controls and the loop
 *
 * The watering can follows the pointer; hold to pour exactly where you aim.
 * The mister beads leaves with dew. Hover a plant to see how it is doing.
 * Coming back after a while shows what grew.
 */

class GreenhouseScene {
  constructor() {
    this.world = document.getElementById('world');
    this.canvas = document.getElementById('greenhouse-canvas');
    this.gh = new GreenhouseWorld(this.canvas);
    this.focus = this.gh.plants[0];
    this.pourHits = 0;

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('tinyworlds.greenhouse.prefs') || '{}'); } catch (_) {}
    if (saved.mood) this.gh.setMood(saved.mood);
    if (saved.vent) this.gh.ventOpen = true;

    this.stage = createStage(this.canvas, (stage) => {
      this.stage = stage;
      this.gh.resize(stage.width, stage.height, stage.dpr);
    });

    this.gh.onPourHit = (plant, spilled) => {
      this.focus = plant;
      if (++this.pourHits % 9 === 0) window.soundManager?.drip?.(spilled ? 1.6 : 1);
    };

    this.bindInput();
    this.bindUI();
    this.updateLabels();
    this.updateStats();
    this.showArrival();
    setInterval(() => this.gh.save(), 10000);
    window.addEventListener('pagehide', () => this.gh.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.gh.save(); });
    startLoop((dt) => this.frame(dt));
  }

  // ---------- Input ----------
  bindInput() {
    const toWorld = (e) => !Shell.isUIEvent(e);
    window.addEventListener('pointermove', (e) => {
      const inside = toWorld(e);
      this.gh.setPointer(e.clientX, e.clientY, inside);
      this.world.classList.toggle('tool-active', inside);
      if (inside) {
        const p = this.gh.plantAt(e.clientX, e.clientY) || this.gh.plantBelow(e.clientX, e.clientY);
        if (p) this.focus = p;
      }
    });
    document.addEventListener('pointerleave', () => { this.gh.setPointer(-999, -999, false); this.stopPouring(); });

    this.world.addEventListener('pointerdown', (e) => {
      if (Shell.isUIEvent(e)) return;
      if (this.gh.hitVent(e.clientX, e.clientY)) {
        this.toggleVent();
        return;
      }
      this.gh.setPointer(e.clientX, e.clientY, true);
      this.gh.setPouring(true);
      if (this.gh.tool === 'water') window.soundManager?.setWaterStream?.(0.8);
      else window.soundManager?.mist?.();
    });
    window.addEventListener('pointerup', () => this.stopPouring());
    window.addEventListener('pointercancel', () => this.stopPouring());

    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat && this.gh.pointer.inside) {
          this.gh.setPouring(true);
          if (this.gh.tool === 'water') window.soundManager?.setWaterStream?.(0.8);
        }
      } else if (k === 'w') this.setTool('water');
      else if (k === 'e') this.setTool('mist');
      else if (k === 'v') this.toggleVent();
      else if (k === 'd') this.cycleMood();
      else if (k === 'm') this.toggleSound();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.stopPouring();
    });
  }

  stopPouring() {
    if (!this.gh.pointer.down) return;
    this.gh.setPouring(false);
    window.soundManager?.setWaterStream?.(0);
    this.gh.save();
  }

  bindUI() {
    document.getElementById('btn-water')?.addEventListener('click', () => this.setTool('water'));
    document.getElementById('btn-mist')?.addEventListener('click', () => this.setTool('mist'));
    document.getElementById('btn-vent')?.addEventListener('click', () => this.toggleVent());
    document.getElementById('btn-mood')?.addEventListener('click', () => this.cycleMood());
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
    document.getElementById('away-card')?.addEventListener('click', () => this.hideArrival());
  }

  setTool(tool) {
    this.gh.setTool(tool);
    this.updateLabels();
  }

  toggleVent() {
    this.gh.toggleVent();
    this.savePrefs();
    this.updateLabels();
  }

  cycleMood() {
    const order = ['morning', 'midday', 'golden', 'night'];
    this.gh.setMood(order[(order.indexOf(this.gh.moodKey) + 1) % order.length]);
    this.savePrefs();
    this.updateLabels();
  }

  toggleSound() {
    const sm = window.soundManager;
    if (!sm) return;
    const muted = sm.toggleMute();
    sm.applyAtmosphere?.(this.gh.moodKey, this.gh.ventOpen);
    document.getElementById('sound-icon').textContent = muted ? '🔇' : '🔊';
    document.getElementById('sound-label').textContent = muted ? 'Off' : 'On';
  }

  savePrefs() {
    try { localStorage.setItem('tinyworlds.greenhouse.prefs', JSON.stringify({ mood: this.gh.moodKey, vent: this.gh.ventOpen })); } catch (_) {}
  }

  updateLabels() {
    const M = GH_MOODS[this.gh.moodKey];
    document.getElementById('mood-icon').textContent = M.icon;
    document.getElementById('mood-label').textContent = M.label;
    document.getElementById('vent-label').textContent = this.gh.ventOpen ? 'Vent open' : 'Vent closed';
    document.getElementById('btn-vent').classList.toggle('active-tool', this.gh.ventOpen);
    document.getElementById('btn-water').classList.toggle('active-tool', this.gh.tool === 'water');
    document.getElementById('btn-mist').classList.toggle('active-tool', this.gh.tool === 'mist');
  }

  updateStats() {
    const p = this.focus;
    if (!p) return;
    document.getElementById('stat-plant').textContent = `${p.spec.icon} ${p.spec.name}`;
    const pct = Math.round(p.water * 100);
    const bar = document.getElementById('stat-water-bar');
    bar.style.width = `${Math.max(4, pct)}%`;
    bar.classList.toggle('dry', pct < 30);
    document.getElementById('stat-water').textContent = pct > 65 ? 'Moist' : pct > 30 ? 'Drying' : 'Thirsty';
    const days = Math.max(1, Math.floor((Date.now() - p.planted) / 864e5) + 1);
    document.getElementById('stat-age').textContent = `Day ${days} · ${p.stage}`;
  }

  // ---------- Arrival ----------
  showArrival() {
    const card = document.getElementById('away-card');
    if (!card) return;
    let title = null, lines = null;
    if (this.gh.awaySummary) {
      ({ title, lines } = this.gh.awaySummary);
    } else if (this.gh.firstVisit) {
      title = 'Your greenhouse';
      lines = [
        '🪴 Seven plants, a few of them thirsty.',
        '💧 Hold to pour where you aim the can.',
        '🌱 They grow only while their soil is moist. Come back tomorrow to see what grew.'
      ];
    }
    if (!title) return;
    card.querySelector('.away-title').textContent = title;
    const ul = card.querySelector('.away-lines');
    ul.innerHTML = '';
    lines.forEach(l => { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); });
    setTimeout(() => card.classList.add('show'), 600);
    this.arrivalTimer = setTimeout(() => this.hideArrival(), 11000);
  }

  hideArrival() {
    document.getElementById('away-card')?.classList.remove('show');
    clearTimeout(this.arrivalTimer);
  }

  frame(dt) {
    this.gh.update(dt);
    this.gh.draw();
    this.statsTimer = (this.statsTimer || 0) - dt;
    if (this.statsTimer <= 0) {
      this.statsTimer = 0.25;
      this.updateStats();
    }
    // A bird outside now and then on bright days
    this.birdTimer = (this.birdTimer || 6) - dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 8 + Math.random() * 14;
      if (this.gh.moodKey !== 'night') window.soundManager?.birdChirp?.();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Shell.init({ storageKey: 'tinyworlds.greenhouse' });
  window.greenhouseScene = new GreenhouseScene();
});
