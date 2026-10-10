/**
 * greenhouse.js - The Greenhouse
 *
 * A painted Victorian glasshouse: a cedar bench of terracotta pots, a back
 * shelf, a hanging basket, light falling through the panes.
 *
 * The heart of this world is real time:
 *  - soil dries over about a day; plants droop when thirsty, never die
 *  - plants only grow while their soil is moist; time away is caught up hour
 *    by hour, so care you gave yesterday shows today
 *  - growth is visible: new leaves unfurl, the vines trail further, the
 *    fern sends up fronds, the orchid grows a spike and opens its buds
 *  - coming back shows what changed while you were away
 *
 * Watering is physical: a can follows the pointer and pours where you aim.
 * Soil darkens, drooping plants slowly lift, extra water spills into the
 * saucer. The mister beads leaves with dew.
 *
 * Used full-screen by scene.js and as a live preview on the homepage
 * (the preview shows your own greenhouse, read-only).
 */

const GH_MOODS = {
  morning: {
    label: 'Morning', icon: '🌅', sky: ['#9fc2d6', '#d9e4dc', '#f3e6cf'], light: 'rgba(255, 236, 205, A)', beams: 0.55,
    garden: ['#8fae94', '#6f9478'], frame: '#ece7dc', haze: 'rgba(230, 240, 235, 0.08)', condensation: 0.8, lamp: 0
  },
  midday: {
    label: 'Midday', icon: '☀️', sky: ['#6fb0dc', '#a9d3ee', '#e3f1f8'], light: 'rgba(255, 250, 232, A)', beams: 0.7,
    garden: ['#86ac7c', '#5f8f5a'], frame: '#f2efe8', haze: null, condensation: 0.25, lamp: 0
  },
  golden: {
    label: 'Golden hour', icon: '🌇', sky: ['#7a5a86', '#d98a66', '#f6c27e'], light: 'rgba(255, 196, 128, A)', beams: 0.85,
    garden: ['#9a8c5a', '#6f6a42'], frame: '#efd9c0', haze: 'rgba(255, 190, 120, 0.10)', condensation: 0.45, lamp: 0.35
  },
  night: {
    label: 'Night', icon: '🌙', sky: ['#0a1124', '#152040', '#22305a'], light: 'rgba(255, 210, 150, A)', beams: 0,
    garden: ['#1c2a33', '#121c24'], frame: '#b7b2a8', haze: 'rgba(25, 35, 65, 0.32)', condensation: 0.9, lamp: 1
  }
};

/** rate: growth per day of good care; max: growth (in days of care) at maturity. */
const GH_SPECIES = {
  basil:    { name: 'Sweet basil', lower: 'sweet basil',   icon: '🌿', rate: 1.0,  max: 7,  part: 'leaf' },
  monstera: { name: 'Monstera', lower: 'monstera',      icon: '🪴', rate: 0.55, max: 10, part: 'leaf' },
  fern:     { name: 'Boston fern', lower: 'Boston fern',   icon: '🌱', rate: 0.8,  max: 9,  part: 'frond' },
  orchid:   { name: 'Moth orchid', lower: 'moth orchid',   icon: '🌸', rate: 0.6,  max: 10, part: 'leaf' },
  snake:    { name: 'Snake plant', lower: 'snake plant',   icon: '🌵', rate: 0.4,  max: 8,  part: 'leaf' },
  pothos:   { name: 'Marble pothos', lower: 'marble pothos', icon: '🍃', rate: 0.9,  max: 10, part: 'leaf' },
  ivy:      { name: 'English ivy', lower: 'English ivy',   icon: '☘️', rate: 0.85, max: 10, part: 'leaf' }
};

const GH_DRY_HOURS = 28;      // moist soil dries out in a little over a day
const GH_MOIST = 0.25;        // plants grow only above this
const GH_TAU = Math.PI * 2;
const ghClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ghLerp = (a, b, t) => a + (b - a) * t;
const ghRand = (a, b) => a + Math.random() * (b - a);
const ghEase = (u) => 1 - Math.pow(1 - ghClamp(u, 0, 1), 3);

// ============================================================================
// PLANT: state, real-time care, growth stages
// ============================================================================
class GhPlant {
  constructor(species, slot, data = {}) {
    this.species = species;
    this.slot = slot;
    this.planted = data.planted || Date.now();
    this.water = typeof data.water === 'number' ? data.water : 0.7;
    this.growth = typeof data.growth === 'number' ? data.growth : 2;
    this.seed = data.seed || Math.floor(Math.random() * 1e6);
    this.turgorShown = this.turgorTarget;     // eases toward the target: the slow "perk up"
    this.sway = 0; this.swayVel = 0; this.nudge = 0;
    this.born = {};                           // organ key -> time it appeared (for unfurling)
    this.dew = [];
    this.puddle = 0;
    this.shownCounts = this.counts();
  }

  get spec() { return GH_SPECIES[this.species]; }
  get g() { return ghClamp(this.growth / this.spec.max, 0, 1); }   // 0 seedling … 1 mature
  get turgorTarget() { return ghClamp(0.2 + this.water * 1.1, 0.2, 1); }

  /** Visible organs for a growth level. */
  counts(growth = this.growth) {
    const g = ghClamp(growth / this.spec.max, 0, 1);
    switch (this.species) {
      case 'basil': return { leaves: 4 + Math.floor(g * 18), blooms: 0, spike: 0 };
      case 'monstera': return { leaves: 2 + Math.floor(g * 5), blooms: 0, spike: 0 };
      case 'fern': return { leaves: 5 + Math.floor(g * 10), blooms: 0, spike: 0 };
      case 'snake': return { leaves: 3 + Math.floor(g * 6), blooms: 0, spike: 0 };
      case 'pothos':
      case 'ivy': return { leaves: 6 + Math.floor(g * 26), blooms: 0, spike: 0 };
      case 'orchid': return {
        leaves: 3 + Math.floor(g * 2),
        blooms: g < 0.55 ? 0 : Math.min(6, 1 + Math.floor((g - 0.55) / 0.075)),
        spike: ghClamp((g - 0.3) / 0.25, 0, 1)
      };
    }
    return { leaves: 3, blooms: 0, spike: 0 };
  }

  /** Advance real time: soil dries; growth happens only while the soil is moist. */
  advance(hours) {
    let left = hours;
    while (left > 1e-6) {
      const step = Math.min(1, left);
      const w0 = this.water, w1 = Math.max(0, w0 - step / GH_DRY_HOURS);
      let moist = 0;
      if (w1 >= GH_MOIST) moist = 1;
      else if (w0 > GH_MOIST) moist = (w0 - GH_MOIST) / (w0 - w1);
      this.growth = Math.min(this.spec.max * 1.15, this.growth + (step / 24) * this.spec.rate * moist);
      this.water = w1;
      left -= step;
    }
  }

  /** Returns true if this made the pot overflow into the saucer. */
  addWater(amount) {
    const over = this.water + amount - 1;
    this.water = Math.min(1, this.water + amount);
    if (over > 0) this.puddle = Math.min(1, this.puddle + over * 3);
    return over > 0;
  }

  /** Per-frame animation (state itself changes only via advance/addWater). */
  animate(dt, breeze, now) {
    // The slow, satisfying perk-up (and an even slower droop)
    const target = this.turgorTarget;
    const rate = target > this.turgorShown ? 0.3 : 0.05;
    this.turgorShown += (target - this.turgorShown) * Math.min(1, dt * rate);

    // Springy sway from breeze and brushing
    const force = (breeze + this.nudge - this.sway) * 18 - this.swayVel * 3.6;
    this.swayVel += force * dt;
    this.sway += this.swayVel * dt;
    this.nudge *= Math.exp(-5 * dt);

    this.puddle = Math.max(0, this.puddle - dt * 0.02);
    this.dew = this.dew.filter(d => (d.life -= dt) > 0);

    // New leaves or blooms since we last looked: let them unfurl
    const c = this.counts();
    for (let i = this.shownCounts.leaves; i < c.leaves; i++) if (!this.born['l' + i]) this.born['l' + i] = now;
    for (let i = this.shownCounts.blooms; i < c.blooms; i++) if (!this.born['b' + i]) this.born['b' + i] = now;
    this.shownCounts = c;
  }

  /** 0 … 1 how far an organ has unfurled. */
  appear(key, now) {
    const t = this.born[key];
    return t ? ghEase((now - t) / 3500) : 1;
  }

  get stage() {
    const c = this.counts(), g = this.g;
    if (this.species === 'orchid' && c.blooms > 0) return 'Flowering';
    if (this.species === 'orchid' && c.spike > 0) return 'Spike growing';
    return g < 0.25 ? 'Young' : g < 0.6 ? 'Growing' : g < 0.95 ? 'Lush' : 'Mature';
  }

  toJSON() {
    return { species: this.species, slot: this.slot, planted: this.planted, water: this.water, growth: this.growth, seed: this.seed };
  }
}

// ============================================================================
// WORLD
// ============================================================================
class GreenhouseWorld {
  constructor(canvas, { preview = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = preview;
    this.t = 0;
    const hr = new Date().getHours();
    this.moodKey = hr >= 5 && hr < 10 ? 'morning' : hr >= 10 && hr < 17 ? 'midday' : hr >= 17 && hr < 20 ? 'golden' : 'night';
    this.ventOpen = false;
    this.ventAngle = 0;
    this.tool = 'water';           // 'water' | 'mist'
    this.pointer = { x: -999, y: -999, inside: false, down: false };
    this.canTilt = 0;
    this.drops = [];
    this.splashes = [];
    this.mist = [];
    this.motes = [];
    this.awaySummary = null;
    this.onPourHit = null;         // (plant, spilled) => void
    this.load();
  }

  // ---------- Persistence & catch-up ----------
  defaultGarden() {
    const now = Date.now(), day = 864e5;
    const mk = (species, slot, ageDays, water, growth) => new GhPlant(species, slot, { planted: now - ageDays * day, water, growth });
    return [
      mk('basil', 'b0', 4, 0.62, 3.2),
      mk('fern', 'b1', 9, 0.3, 4.6),
      mk('monstera', 'b2', 18, 0.75, 5.2),
      mk('orchid', 'b3', 21, 0.2, 6.4),
      mk('snake', 's0', 30, 0.5, 4),
      mk('pothos', 's1', 12, 0.8, 5.5),
      mk('ivy', 'h0', 14, 0.35, 5)
    ];
  }

  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem('tinyworlds.greenhouse.v2') || 'null'); } catch (_) {}
    this.lastTick = Date.now();
    if (!data || !Array.isArray(data.plants)) {
      this.plants = this.defaultGarden();
      this.firstVisit = !this.preview;
      return;
    }
    this.plants = data.plants.map(p => new GhPlant(p.species, p.slot, p));
    const hours = Math.min(24 * 30, Math.max(0, (Date.now() - (data.saved || Date.now())) / 36e5));
    const before = this.plants.map(p => p.counts());
    this.plants.forEach(p => p.advance(hours));
    if (!this.preview && hours > 0.33) this.awaySummary = this.summarize(hours, before);
    // Whatever grew while you were away unfurls as you arrive
    const now = performance.now();
    this.plants.forEach((p, i) => {
      const a = before[i], c = p.counts();
      for (let k = a.leaves; k < c.leaves; k++) p.born['l' + k] = now + 900 + (k - a.leaves) * 250;
      for (let k = a.blooms; k < c.blooms; k++) p.born['b' + k] = now + 1600 + (k - a.blooms) * 600;
      p.shownCounts = c;
      p.turgorShown = p.turgorTarget;
    });
  }

  save() {
    if (this.preview) return;
    try {
      localStorage.setItem('tinyworlds.greenhouse.v2', JSON.stringify({ saved: Date.now(), plants: this.plants.map(p => p.toJSON()) }));
    } catch (_) {}
  }

  summarize(hours, before) {
    const lines = [];
    this.plants.forEach((p, i) => {
      const a = before[i], c = p.counts(), name = p.spec.lower;
      const leaves = c.leaves - a.leaves, blooms = c.blooms - a.blooms;
      if (blooms > 0) lines.push(`${p.spec.icon} The ${name} opened ${blooms === 1 ? 'a new bloom' : blooms + ' new blooms'}.`);
      else if (c.spike > a.spike + 0.05) lines.push(`${p.spec.icon} The ${name}'s flower spike grew taller.`);
      if (leaves > 0) {
        const part = p.spec.part;
        const plural = part === 'leaf' ? 'leaves' : part + 's';
        lines.push(`${p.spec.icon} The ${name} grew ${leaves === 1 ? 'a new ' + part : leaves + ' new ' + plural}.`);
      }
    });
    const thirsty = this.plants.filter(p => p.water < 0.3).map(p => p.spec.lower);
    if (thirsty.length) lines.push(`💧 ${thirsty.length === 1 ? 'The ' + thirsty[0] + ' is' : thirsty.length === this.plants.length ? 'Every plant is' : thirsty.length + ' plants are'} thirsty.`);
    if (!lines.length) lines.push('🌙 Everything rested quietly while you were away.');
    const n = hours < 24 ? Math.max(1, Math.round(hours)) : Math.round(hours / 24);
    const unit = hours < 24 ? 'hour' : 'day';
    return { title: `While you were away · ${n} ${unit}${n === 1 ? '' : 's'}`, lines: lines.slice(0, 5) };
  }

  // ---------- Layout ----------
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    const S = this.S = ghClamp(Math.min(w, h) / 760, 0.5, 1.5) * (this.preview ? 1.05 : 1);
    const portrait = h > w;
    this.roofY = h * (portrait ? 0.12 : 0.16);
    this.shelfY = h * (portrait ? 0.5 : 0.47);
    this.benchY = this.preview ? h * 0.8 : h - Math.max(120, h * 0.22);
    this.shelf = { x0: w * 0.04, x1: w * (portrait ? 0.62 : 0.5) };
    const bx = portrait ? [0.14, 0.38, 0.62, 0.86] : [0.15, 0.37, 0.6, 0.83];
    this.slots = {
      b0: { x: w * bx[0], y: this.benchY, k: S, kind: 'bench' },
      b1: { x: w * bx[1], y: this.benchY, k: S, kind: 'bench' },
      b2: { x: w * bx[2], y: this.benchY, k: S * 1.1, kind: 'bench' },
      b3: { x: w * bx[3], y: this.benchY, k: S, kind: 'bench' },
      s0: { x: ghLerp(this.shelf.x0, this.shelf.x1, 0.25), y: this.shelfY, k: S * 0.72, kind: 'shelf' },
      s1: { x: ghLerp(this.shelf.x0, this.shelf.x1, 0.72), y: this.shelfY, k: S * 0.72, kind: 'shelf' },
      h0: { x: w * (portrait ? 0.8 : 0.78), y: this.roofY + h * 0.17, k: S * 0.8, kind: 'hang' }
    };
    this.mullions = [];
    const n = Math.max(3, Math.round(w / (230 * S)));
    for (let i = 1; i < n; i++) this.mullions.push(w * i / n);
    this.condensation = Array.from({ length: Math.round(w * h / 2600) }, () => ({ x: Math.random() * w, y: ghRand(this.roofY, this.benchY), r: ghRand(0.6, 2.2) * S, a: Math.random() }));
    this.trails = Array.from({ length: Math.round(w / 90) }, () => ({ x: Math.random() * w, y: ghRand(this.roofY, this.shelfY), len: ghRand(40, 160) * S }));
    this.gardenTrees = Array.from({ length: Math.round(w / (90 * S)) }, () => ({ x: Math.random() * w, r: ghRand(26, 60) * S, h: ghRand(0.05, 0.16) }));
    if (!this.motes.length) this.motes = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), r: ghRand(0.6, 1.8), sp: ghRand(0.2, 0.6), ph: Math.random() * 6 }));
  }

  setMood(k) {
    if (!GH_MOODS[k]) return;
    this.moodKey = k;
    if (window.soundManager?.applyAtmosphere) window.soundManager.applyAtmosphere(k, this.ventOpen);
  }

  toggleVent() {
    this.ventOpen = !this.ventOpen;
    if (window.soundManager?.roofVent) window.soundManager.roofVent(this.ventOpen);
    if (window.soundManager?.applyAtmosphere) window.soundManager.applyAtmosphere(this.moodKey, this.ventOpen);
    return this.ventOpen;
  }

  hitVent(x, y) {
    return y < this.roofY && x > this.w * 0.4 && x < this.w * 0.6;
  }

  // ---------- Geometry ----------
  potSize(slot) {
    const s = this.slots[slot];
    if (s.kind === 'hang') return { top: 74 * s.k, bottom: 46 * s.k, h: 36 * s.k };
    return { top: 74 * s.k, bottom: 52 * s.k, h: 64 * s.k };
  }

  /** Soil surface for a plant: where water must land. */
  soil(p) {
    const s = this.slots[p.slot], ps = this.potSize(p.slot);
    return { x: s.x, y: s.y - ps.h + 6 * s.k, rx: ps.top * 0.46, k: s.k };
  }

  /** Rough foliage box, for brushing, misting and hover. */
  foliageBox(p) {
    const s = this.slots[p.slot], ps = this.potSize(p.slot), k = s.k;
    const sizes = { basil: [70, 110], monstera: [130, 170], fern: [120, 110], orchid: [90, 170], snake: [60, 150], pothos: [90, 40], ivy: [80, 30] };
    const [hw, hh] = sizes[p.species];
    const top = s.y - ps.h - hh * k * (0.6 + p.g * 0.5);
    const below = (p.species === 'pothos' || p.species === 'ivy') ? (40 + p.g * 200) * k : 0;
    return { x0: s.x - hw * k, x1: s.x + hw * k, y0: top, y1: s.y + below };
  }

  plantAt(x, y) {
    let best = null, bd = Infinity;
    for (const p of this.plants) {
      const b = this.foliageBox(p);
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) {
        const d = Math.abs(x - this.slots[p.slot].x);
        if (d < bd) { bd = d; best = p; }
      }
    }
    return best;
  }

  /** The plant whose soil is right below a point (what the can is aiming at). */
  plantBelow(x, y) {
    let best = null, bd = Infinity;
    for (const p of this.plants) {
      const s = this.soil(p);
      if (Math.abs(x - s.x) < s.rx * 1.2 && y < s.y + 4) {
        const d = s.y - y;
        if (d < bd) { bd = d; best = p; }
      }
    }
    return best;
  }

  // ---------- Interaction ----------
  setPointer(x, y, inside = true) {
    const P = this.pointer;
    const dx = x - P.x;
    P.x = x; P.y = y; P.inside = inside;
    if (!inside || Math.abs(dx) > 200) return;
    // Brushing through foliage nudges it
    const p = this.plantAt(x, y);
    if (p && Math.abs(dx) > 2) {
      p.nudge += ghClamp(dx * 0.004, -0.25, 0.25);
      if (Math.abs(dx) > 6 && Math.random() < 0.2 && window.soundManager?.leafRustle) window.soundManager.leafRustle(0.6);
    }
  }

  setPouring(on) { this.pointer.down = on; }
  setTool(tool) { this.tool = tool; }

  // ---------- Simulation ----------
  update(dt) {
    this.t += dt;
    const now = performance.now(), S = this.S;

    // Real time: catch up every couple of seconds (soil dries, plants grow)
    const wall = Date.now();
    if (wall - this.lastTick > 2000) {
      this.plants.forEach(p => p.advance((wall - this.lastTick) / 36e5));
      this.lastTick = wall;
    }

    this.ventAngle += ((this.ventOpen ? 1 : 0) - this.ventAngle) * Math.min(1, dt * 2);
    const breeze = (Math.sin(this.t * 0.7) * 0.5 + Math.sin(this.t * 1.9) * 0.2) * (0.015 + this.ventAngle * 0.07);
    this.plants.forEach(p => p.animate(dt, breeze, now));

    // Watering can: tilts while pouring; the stream falls from the rose at the pointer
    const P = this.pointer;
    const pouring = P.down && P.inside && this.tool === 'water';
    this.canTilt += ((pouring ? 1 : 0) - this.canTilt) * Math.min(1, dt * 7);
    if (pouring && this.canTilt > 0.6) {
      const n = Math.max(1, Math.round(110 * dt * (this.preview ? 0.6 : 1)));
      for (let i = 0; i < n; i++) {
        this.drops.push({ x: P.x + ghRand(-7, 7) * S, y: P.y + ghRand(-2, 4) * S, vx: ghRand(-18, 18) * S, vy: ghRand(60, 120) * S, life: 3 });
      }
    }

    // Mister: a fine cloud that beads nearby leaves and moistens their soil
    const misting = P.down && P.inside && this.tool === 'mist';
    if (misting) {
      for (let i = 0; i < Math.round(160 * dt); i++) {
        const a = ghRand(-0.5, 0.5), sp = ghRand(60, 160) * S;
        this.mist.push({ x: P.x, y: P.y, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp * 0.3 + 30 * S, life: ghRand(0.9, 1.6), max: 1.6, r: ghRand(1, 2.5) * S });
      }
      for (const p of this.plants) {
        const b = this.foliageBox(p);
        if (P.x > b.x0 - 60 * S && P.x < b.x1 + 60 * S && P.y > b.y0 - 60 * S && P.y < b.y1) {
          p.addWater(0.05 * dt);
          if (p.dew.length < 40 && Math.random() < dt * 14) p.dew.push({ u: Math.random(), v: Math.random(), r: ghRand(1, 2.4) * S, life: ghRand(18, 40), tw: Math.random() * 6 });
        }
      }
    }

    // Water stream physics: soil (waters the plant), shelf/bench (splashes)
    const grav = 980 * S;
    for (const d of this.drops) {
      d.vy += grav * dt;
      const py = d.y;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
      for (const p of this.plants) {
        const s = this.soil(p);
        if (py <= s.y && d.y >= s.y && Math.abs(d.x - s.x) < s.rx) {
          d.dead = true;
          const spilled = p.addWater(0.0055);
          if (this.onPourHit) this.onPourHit(p, spilled);
          if (Math.random() < 0.25) this.splashes.push({ x: d.x, y: s.y, t: 0, k: s.k });
          break;
        }
      }
      if (d.dead) continue;
      const onShelf = d.x > this.shelf.x0 && d.x < this.shelf.x1 && py <= this.shelfY && d.y >= this.shelfY;
      if (onShelf || (py <= this.benchY && d.y >= this.benchY)) {
        d.dead = true;
        if (Math.random() < 0.3) this.splashes.push({ x: d.x, y: onShelf ? this.shelfY : this.benchY, t: 0, k: S });
      }
      if (d.life <= 0 || d.y > this.h) d.dead = true;
    }
    this.drops = this.drops.filter(d => !d.dead);
    this.splashes.forEach(s => { s.t += dt; });
    this.splashes = this.splashes.filter(s => s.t < 0.35);
    this.mist.forEach(m => { m.x += m.vx * dt; m.y += m.vy * dt; m.vx *= Math.exp(-2 * dt); m.life -= dt; });
    this.mist = this.mist.filter(m => m.life > 0);
  }

  // ---------- Drawing: the house ----------
  drawOutside(c, M) {
    const { w, h, S } = this;
    const sky = c.createLinearGradient(0, 0, 0, this.benchY);
    M.sky.forEach((col, i) => sky.addColorStop(i / (M.sky.length - 1), col));
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    // The garden beyond the glass: soft trees and a hedge
    const ground = this.shelfY + (this.benchY - this.shelfY) * 0.25;
    c.globalAlpha = 0.85;
    c.fillStyle = M.garden[0];
    for (const tr of this.gardenTrees) {
      c.beginPath();
      c.arc(tr.x, ground - h * tr.h, tr.r, 0, GH_TAU);
      c.fill();
    }
    c.fillStyle = M.garden[1];
    c.fillRect(0, ground - 20 * S, w, h);
    c.globalAlpha = 1;
    const haze = c.createLinearGradient(0, this.roofY, 0, this.benchY);
    haze.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    haze.addColorStop(1, 'rgba(255, 255, 255, 0.16)');
    c.fillStyle = haze;
    c.fillRect(0, 0, w, this.benchY);
  }

  drawGlassHouse(c, M) {
    const { w, S } = this;
    c.strokeStyle = M.frame;
    // Roof glass with rafters
    c.fillStyle = 'rgba(255, 255, 255, 0.07)';
    c.fillRect(0, 0, w, this.roofY);
    c.lineWidth = 5 * S;
    for (let x = -w * 0.2; x < w * 1.2; x += 120 * S) {
      c.beginPath();
      c.moveTo(x, this.roofY);
      c.lineTo(x + (x - w / 2) * 0.35, 0);
      c.stroke();
    }
    // The vent pane, hinged at the ridge, lifts when open
    const vx0 = w * 0.42, vx1 = w * 0.58, lift = this.ventAngle * this.roofY * 0.6;
    c.fillStyle = 'rgba(200, 225, 230, 0.22)';
    c.beginPath();
    c.moveTo(vx0, 2);
    c.lineTo(vx1, 2);
    c.lineTo(vx1 + lift * 0.2, this.roofY - 4 - lift);
    c.lineTo(vx0 - lift * 0.2, this.roofY - 4 - lift);
    c.closePath();
    c.fill();
    c.lineWidth = 4 * S;
    c.stroke();
    // Wall glazing bars
    c.lineWidth = 7 * S;
    c.beginPath();
    c.moveTo(0, this.roofY);
    c.lineTo(w, this.roofY);
    c.stroke();
    c.lineWidth = 4 * S;
    for (const x of this.mullions) {
      c.beginPath();
      c.moveTo(x, this.roofY);
      c.lineTo(x, this.benchY);
      c.stroke();
    }
    const midY = (this.roofY + this.benchY) / 2 - 20 * S;
    c.beginPath();
    c.moveTo(0, midY);
    c.lineTo(w, midY);
    c.stroke();
    c.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    c.lineWidth = 1.5 * S;
    for (const x of this.mullions) {
      c.beginPath();
      c.moveTo(x + 2.5 * S, this.roofY);
      c.lineTo(x + 2.5 * S, this.benchY);
      c.stroke();
    }
    // Reflections on the glass
    c.save();
    c.globalCompositeOperation = 'screen';
    c.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 4; i++) {
      const x = w * (0.1 + i * 0.27);
      c.beginPath();
      c.moveTo(x, this.roofY);
      c.lineTo(x + 50 * S, this.roofY);
      c.lineTo(x - 90 * S, this.benchY);
      c.lineTo(x - 140 * S, this.benchY);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  drawCondensation(c, M) {
    if (M.condensation <= 0.05) return;
    c.fillStyle = `rgba(235, 242, 245, ${0.28 * M.condensation})`;
    for (const d of this.condensation) {
      if (d.a > M.condensation) continue;
      c.beginPath();
      c.arc(d.x, d.y, d.r, 0, GH_TAU);
      c.fill();
    }
    c.strokeStyle = `rgba(235, 242, 245, ${0.16 * M.condensation})`;
    c.lineWidth = 1.2 * this.S;
    for (const t of this.trails) {
      c.beginPath();
      c.moveTo(t.x, t.y);
      c.lineTo(t.x + Math.sin(t.y) * 2, t.y + t.len);
      c.stroke();
    }
  }

  drawShelfAndBench(c) {
    const { w, h, S } = this;
    const sh = this.shelf;
    c.fillStyle = 'rgba(0, 0, 0, 0.12)';
    c.fillRect(sh.x0, this.shelfY + 8 * S, sh.x1 - sh.x0, 10 * S);
    const sg = c.createLinearGradient(0, this.shelfY, 0, this.shelfY + 12 * S);
    sg.addColorStop(0, '#9b7352');
    sg.addColorStop(1, '#6e4e36');
    c.fillStyle = sg;
    c.fillRect(sh.x0, this.shelfY, sh.x1 - sh.x0, 12 * S);
    c.fillStyle = '#5a3f2b';
    for (const u of [0.08, 0.92]) {
      const x = ghLerp(sh.x0, sh.x1, u);
      c.fillRect(x - 4 * S, this.shelfY + 12 * S, 8 * S, 38 * S);
    }
    // Potting bench
    const top = this.benchY;
    const bg = c.createLinearGradient(0, top, 0, h);
    bg.addColorStop(0, '#a37a56');
    bg.addColorStop(0.08, '#8a6445');
    bg.addColorStop(0.2, '#6e4e35');
    bg.addColorStop(1, '#2d2018');
    c.fillStyle = bg;
    c.fillRect(0, top, w, h - top);
    c.strokeStyle = 'rgba(40, 25, 15, 0.3)';
    c.lineWidth = 1;
    for (let y = top + 14 * S; y < top + 40 * S; y += 13 * S) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(255, 230, 200, 0.18)';
    c.fillRect(0, top, w, 2 * S);
    // A trowel and a seed packet
    const tx = w * 0.27, ty = top + 22 * S;
    c.fillStyle = '#7d8a90';
    c.beginPath();
    c.ellipse(tx, ty, 18 * S, 6 * S, -0.15, 0, GH_TAU);
    c.fill();
    c.fillStyle = '#8a5a34';
    c.fillRect(tx + 16 * S, ty - 3 * S, 24 * S, 5 * S);
    c.save();
    c.translate(w * 0.72, top + 26 * S);
    c.rotate(0.12);
    c.fillStyle = '#e9dcc2';
    c.fillRect(-14 * S, -10 * S, 28 * S, 20 * S);
    c.fillStyle = '#d97a5a';
    c.beginPath();
    c.arc(0, -1 * S, 5 * S, 0, GH_TAU);
    c.fill();
    c.restore();
  }

  drawBeams(c, M) {
    if (!M.beams) return;
    const { w, S } = this;
    c.save();
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const x = w * (0.05 + i * 0.22) + Math.sin(this.t * 0.1 + i) * 10 * S;
      const g = c.createLinearGradient(x, 0, x + 260 * S, this.benchY);
      g.addColorStop(0, M.light.replace('A', (0.12 * M.beams).toFixed(3)));
      g.addColorStop(1, M.light.replace('A', '0'));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 70 * S, 0);
      c.lineTo(x + 330 * S, this.benchY);
      c.lineTo(x + 230 * S, this.benchY);
      c.closePath();
      c.fill();
    }
    c.fillStyle = M.light.replace('A', (0.55 * M.beams).toFixed(3));
    for (const m of this.motes) {
      const y = ((m.y + this.t * 0.01 * m.sp) % 1) * this.benchY;
      const x = m.x * w + Math.sin(this.t * 0.4 + m.ph) * 14 * S;
      c.beginPath();
      c.arc(x, y, m.r * S, 0, GH_TAU);
      c.fill();
    }
    c.restore();
  }

  drawLamp(c, M) {
    if (!M.lamp) return;
    const { w, S } = this;
    const lx = w * 0.5, ly = this.roofY + 46 * S;
    c.strokeStyle = '#2a2420';
    c.lineWidth = 1.5 * S;
    c.beginPath();
    c.moveTo(lx, 0);
    c.lineTo(lx, ly - 10 * S);
    c.stroke();
    c.save();
    c.globalCompositeOperation = 'screen';
    const g = c.createRadialGradient(lx, ly, 0, lx, ly, 520 * S);
    g.addColorStop(0, `rgba(255, 200, 130, ${0.5 * M.lamp})`);
    g.addColorStop(0.3, `rgba(255, 180, 110, ${0.16 * M.lamp})`);
    g.addColorStop(1, 'rgba(255, 170, 100, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, this.h);
    c.restore();
    c.fillStyle = `rgba(255, 228, 170, ${0.6 + 0.4 * M.lamp})`;
    c.beginPath();
    c.arc(lx, ly, 7 * S, 0, GH_TAU);
    c.fill();
  }

  // ---------- Drawing: pots ----------
  drawPot(c, p) {
    const s = this.slots[p.slot], ps = this.potSize(p.slot), k = s.k;
    const x = s.x, base = s.y;
    if (s.kind === 'hang') {
      c.strokeStyle = '#4a4038';
      c.lineWidth = 1.4 * k;
      for (const dx of [-0.42, 0.42]) {
        c.beginPath();
        c.moveTo(x + dx * ps.top, base - ps.h);
        c.lineTo(x, this.roofY - 6);
        c.stroke();
      }
      c.fillStyle = '#6b4b2e';
      c.beginPath();
      c.moveTo(x - ps.top / 2, base - ps.h);
      c.quadraticCurveTo(x, base + ps.h * 0.4, x + ps.top / 2, base - ps.h);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(30, 20, 10, 0.35)';
      c.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        c.beginPath();
        c.moveTo(x + i * ps.top / 8, base - ps.h);
        c.lineTo(x + i * ps.top / 14, base - ps.h * 0.1);
        c.stroke();
      }
    } else {
      c.fillStyle = 'rgba(30, 18, 10, 0.28)';
      c.beginPath();
      c.ellipse(x + 6 * k, base + 2 * k, ps.top * 0.62, 7 * k, 0, 0, GH_TAU);
      c.fill();
      c.fillStyle = '#b5623e';
      c.beginPath();
      c.ellipse(x, base - 2 * k, ps.bottom * 0.72, 6 * k, 0, 0, GH_TAU);
      c.fill();
      if (p.puddle > 0.02) {
        c.fillStyle = `rgba(150, 190, 210, ${(0.5 * p.puddle).toFixed(3)})`;
        c.beginPath();
        c.ellipse(x, base - 3 * k, ps.bottom * 0.62 * Math.min(1, 0.5 + p.puddle), 3.5 * k, 0, 0, GH_TAU);
        c.fill();
      }
      const bx0 = x - ps.top / 2, bx1 = x + ps.top / 2, top = base - ps.h;
      const g = c.createLinearGradient(bx0, 0, bx1, 0);
      g.addColorStop(0, '#9c4f30');
      g.addColorStop(0.35, '#d27a50');
      g.addColorStop(0.7, '#c06a43');
      g.addColorStop(1, '#8a4429');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(bx0 + 3 * k, top + 10 * k);
      c.lineTo(bx1 - 3 * k, top + 10 * k);
      c.lineTo(x + ps.bottom / 2, base - 4 * k);
      c.lineTo(x - ps.bottom / 2, base - 4 * k);
      c.closePath();
      c.fill();
      // A little mineral bloom on the clay
      c.fillStyle = 'rgba(235, 228, 210, 0.16)';
      c.beginPath();
      c.ellipse(x - ps.top * 0.18 + (p.seed % 7) * k, top + ps.h * 0.62, ps.top * 0.16, 6 * k, 0.3, 0, GH_TAU);
      c.fill();
      const rg = c.createLinearGradient(bx0, 0, bx1, 0);
      rg.addColorStop(0, '#a85634');
      rg.addColorStop(0.4, '#df8a5f');
      rg.addColorStop(1, '#94472b');
      c.fillStyle = rg;
      c.fillRect(bx0, top, ps.top, 11 * k);
    }
    // Soil: dark when wet, pale and cracked when dry
    const sl = this.soil(p), wet = p.water;
    const r = Math.round(ghLerp(150, 52, wet)), gg = Math.round(ghLerp(118, 36, wet)), b = Math.round(ghLerp(88, 24, wet));
    c.fillStyle = `rgb(${r}, ${gg}, ${b})`;
    c.beginPath();
    c.ellipse(sl.x, sl.y, sl.rx, 5.5 * k, 0, 0, GH_TAU);
    c.fill();
    if (wet < 0.3) {
      c.strokeStyle = 'rgba(80, 60, 40, 0.5)';
      c.lineWidth = 0.8 * k;
      c.beginPath();
      c.moveTo(sl.x - sl.rx * 0.5, sl.y);
      c.lineTo(sl.x - sl.rx * 0.1, sl.y + 1.5 * k);
      c.lineTo(sl.x + sl.rx * 0.3, sl.y - 1 * k);
      c.stroke();
    } else if (wet > 0.85) {
      c.fillStyle = 'rgba(255, 255, 255, 0.12)';
      c.beginPath();
      c.ellipse(sl.x - sl.rx * 0.3, sl.y - 1.5 * k, sl.rx * 0.3, 1.6 * k, 0, 0, GH_TAU);
      c.fill();
    }
  }

  // ---------- Drawing: leaves and plants ----------
  /** A leaf from (x,y) along angle a, with a soft two-tone fill and a midrib. */
  leaf(c, x, y, a, len, wid, light, dark, opts = {}) {
    if (len < 0.5) return;
    c.save();
    c.translate(x, y);
    c.rotate(a);
    const g = c.createLinearGradient(0, -wid, 0, wid);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    if (opts.heart) {
      c.bezierCurveTo(len * 0.1, -wid * 1.2, len * 0.75, -wid * 0.9, len, 0);
      c.bezierCurveTo(len * 0.75, wid * 0.9, len * 0.1, wid * 1.2, 0, 0);
    } else {
      c.quadraticCurveTo(len * 0.45, -wid, len, 0);
      c.quadraticCurveTo(len * 0.45, wid, 0, 0);
    }
    c.fill();
    if (opts.vein !== false) {
      c.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      c.lineWidth = Math.max(0.6, wid * 0.1);
      c.beginPath();
      c.moveTo(len * 0.05, 0);
      c.lineTo(len * 0.88, 0);
      c.stroke();
    }
    if (opts.variegate) {
      c.strokeStyle = 'rgba(240, 232, 170, 0.55)';
      c.lineWidth = Math.max(0.6, wid * 0.14);
      c.beginPath();
      c.moveTo(len * 0.25, -wid * 0.25);
      c.quadraticCurveTo(len * 0.5, -wid * 0.55, len * 0.7, -wid * 0.2);
      c.moveTo(len * 0.35, wid * 0.3);
      c.lineTo(len * 0.6, wid * 0.4);
      c.stroke();
    }
    c.restore();
  }

  /** Thirsty plants look a little dull. */
  tint(p, hex) {
    const dry = 1 - ghClamp(p.turgorShown, 0, 1);
    if (dry < 0.05) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const y = (r + g + b) / 3, k = dry * 0.45;
    return `rgb(${Math.round(ghLerp(r, y + 20, k))}, ${Math.round(ghLerp(g, y + 10, k))}, ${Math.round(ghLerp(b, y - 10, k))})`;
  }

  drawPlant(c, p, now) {
    const s = this.slots[p.slot], ps = this.potSize(p.slot), k = s.k;
    const ox = s.x, oy = s.y - ps.h + 6 * k;
    const droop = 1 - p.turgorShown;
    c.save();
    c.translate(ox, oy);
    c.lineCap = 'round';
    const fn = {
      basil: this.drawBasil, monstera: this.drawMonstera, fern: this.drawFern, orchid: this.drawOrchid,
      snake: this.drawSnake, pothos: this.drawTrailing, ivy: this.drawTrailing
    }[p.species];
    fn.call(this, c, p, k, droop, p.sway, now);
    // Dew from the mister
    if (p.dew.length) {
      const b = this.foliageBox(p);
      for (const d of p.dew) {
        const x = ghLerp(b.x0, b.x1, d.u) - ox, y = ghLerp(b.y0, Math.min(b.y1, s.y - ps.h), d.v) - oy;
        c.fillStyle = `rgba(230, 245, 255, ${(0.55 + 0.3 * Math.sin(this.t * 3 + d.tw)).toFixed(3)})`;
        c.beginPath();
        c.arc(x, y, d.r, 0, GH_TAU);
        c.fill();
      }
    }
    c.restore();
  }

  drawBasil(c, p, k, droop, sway, now) {
    const { leaves } = p.counts();
    const stems = 3;
    const H = (40 + p.g * 80) * k;
    let idx = 0;
    for (let si = 0; si < stems; si++) {
      const spread = (si - 1) * 0.32;
      const h = H * (si === 1 ? 1 : 0.78);
      const lean = spread + sway * 0.8 + droop * 0.35 * (si === 0 ? -1 : 1);
      const tipX = Math.sin(lean) * h * 0.55, tipY = -h * (1 - droop * 0.35);
      const cx = tipX * 0.3, cy = tipY * 0.6;
      c.strokeStyle = this.tint(p, '#5b8a3c');
      c.lineWidth = 3 * k;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(cx, cy, tipX, tipY);
      c.stroke();
      const pairs = Math.ceil(leaves / 2 / stems);
      for (let j = 0; j < pairs; j++) {
        if (idx >= leaves) break;
        const u = (j + 1) / (pairs + 0.6);
        const ix = 2 * (1 - u) * u * cx + u * u * tipX;
        const iy = 2 * (1 - u) * u * cy + u * u * tipY;
        const size = (9 + (1 - u) * 7) * k * (0.7 + p.g * 0.4);
        for (const side of [-1, 1]) {
          if (idx >= leaves) break;
          const ap = p.appear('l' + idx, now);
          const a = -Math.PI / 2 + side * (0.95 + droop * 0.9) + lean * 0.4;
          this.leaf(c, ix, iy, a, size * 1.6 * ap, size * 0.75 * ap, this.tint(p, '#8fd06a'), this.tint(p, '#3f8a35'));
          idx++;
        }
      }
      for (const sd of [-1, 1]) {
        this.leaf(c, tipX, tipY, -Math.PI / 2 + lean * 0.4 + sd * 0.3, 9 * k, 4.5 * k, this.tint(p, '#a7e07c'), this.tint(p, '#5aa548'));
      }
    }
  }

  drawMonstera(c, p, k, droop, sway, now) {
    const { leaves } = p.counts();
    for (let i = 0; i < leaves; i++) {
      const ap = p.appear('l' + i, now);
      const fan = leaves === 1 ? 0 : (i / (leaves - 1) - 0.5) * 2.2;
      const order = ((i * 7) % leaves) / leaves;
      const plen = (60 + order * 70 + p.g * 30) * k * (0.5 + 0.5 * ap);
      const sgn = Math.sign(fan) || 1;
      const ang = -Math.PI / 2 + fan * 0.55 + sway * 0.6 + droop * 0.5 * sgn;
      const ex = Math.cos(ang) * plen, ey = Math.sin(ang) * plen * (1 - droop * 0.3);
      c.strokeStyle = this.tint(p, '#4f7d39');
      c.lineWidth = 3.2 * k;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(ex * 0.2, ey * 0.75, ex, ey);
      c.stroke();
      const size = (30 + order * 22 + p.g * 14) * k;
      const leafAng = ang + Math.PI * 0.35 * sgn + droop * 0.8 * sgn + 0.25;
      this.splitLeaf(c, p, ex, ey, leafAng, size, ap, i >= 2);
    }
  }

  /**
   * A monstera leaf: a broad heart with lobes at the base. Mature leaves have
   * splits running in from the edge (the middle stays whole). A new leaf is
   * still rolled up and opens as it unfurls.
   */
  splitLeaf(c, p, x, y, a, size, unfurl, fenestrated) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    const L = size * 1.45, W = size * 0.8 * (0.12 + 0.88 * unfurl);
    const hw = (u) => W * Math.pow(Math.sin(Math.PI * ghClamp(u, 0, 1)), 0.65) * (1 + 0.35 * Math.max(0, 0.3 - u) / 0.3);
    const xAt = (u) => -L * 0.12 + u * L * 1.12;
    const N = 24;
    const outline = (side, frac) => {
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        c.lineTo(xAt(u), side * hw(u) * frac);
      }
    };
    const light = this.tint(p, '#5fa64b'), dark = this.tint(p, '#2c6a2a');
    for (const side of [-1, 1]) {
      const g = c.createLinearGradient(0, 0, 0, side * W);
      g.addColorStop(0, light);
      g.addColorStop(1, dark);
      c.fillStyle = g;
      if (!fenestrated) {
        c.beginPath();
        c.moveTo(xAt(0), 0);
        outline(side, 1);
        c.closePath();
        c.fill();
        continue;
      }
      // Solid middle
      c.beginPath();
      c.moveTo(xAt(0), 0);
      outline(side, 0.45);
      c.closePath();
      c.fill();
      // Outer blade in slices, separated by the characteristic splits
      const cuts = 7;
      for (let j = 0; j < cuts; j++) {
        const u0 = j / cuts + 0.012, u1 = (j + 1) / cuts - 0.012;
        c.beginPath();
        c.moveTo(xAt(u0), side * hw(u0) * 0.42);
        for (let i = 0; i <= 6; i++) {
          const u = u0 + (u1 - u0) * i / 6;
          c.lineTo(xAt(u) + L * 0.03 * (i / 6), side * hw(u));
        }
        c.lineTo(xAt(u1), side * hw(u1) * 0.42);
        c.closePath();
        c.fill();
      }
    }
    // Midrib and a few veins
    c.strokeStyle = 'rgba(215, 240, 195, 0.4)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(xAt(0), 0);
    c.lineTo(xAt(0.97), 0);
    c.stroke();
    c.restore();
  }

  drawFern(c, p, k, droop, sway, now) {
    const { leaves } = p.counts();
    for (let i = 0; i < leaves; i++) {
      const ap = p.appear('l' + i, now);
      const spread = ((i / Math.max(1, leaves - 1)) - 0.5) * 2.6;
      const len = (55 + ((i * 37) % 50) + p.g * 40) * k * ap;
      const arch = 0.9 + droop * 1.3;
      const steps = 14;
      let x = 0, y = 0, a = -Math.PI / 2 + spread * 0.5 + sway;
      const pts = [];
      for (let s = 0; s < steps; s++) {
        pts.push([x, y, a]);
        a += (spread >= 0 ? 1 : -1) * arch * 0.09 * (s / steps + 0.3);
        x += Math.cos(a) * len / steps;
        y += Math.sin(a) * len / steps;
      }
      c.strokeStyle = this.tint(p, '#4a7f36');
      c.lineWidth = 1.6 * k;
      c.beginPath();
      c.moveTo(0, 0);
      pts.forEach(([px, py]) => c.lineTo(px, py));
      c.stroke();
      for (let s = 1; s < steps; s++) {
        const [px, py, pa] = pts[s];
        const ll = ((1 - s / steps) * 11 + 2) * k;
        for (const sd of [-1, 1]) this.leaf(c, px, py, pa + sd * 1.1, ll * ap, ll * 0.32, this.tint(p, '#86c35e'), this.tint(p, '#3f7d32'), { vein: false });
      }
    }
  }

  drawOrchid(c, p, k, droop, sway, now) {
    const cnt = p.counts();
    for (let i = 0; i < cnt.leaves; i++) {
      const side = i % 2 ? 1 : -1;
      const a = side > 0 ? -0.35 + droop * 0.6 : Math.PI + 0.35 - droop * 0.6;
      this.leaf(c, 0, -2 * k, a + sway * 0.3, (40 + i * 6) * k * p.appear('l' + i, now), 13 * k, this.tint(p, '#5f9a4c'), this.tint(p, '#2c5a2a'));
    }
    if (cnt.spike <= 0) return;
    // The flower spike rises and arches; buds open into blooms one by one
    const H = 150 * k * cnt.spike;
    const steps = 18;
    let x = 0, y = -4 * k, a = -Math.PI / 2 + 0.08 + sway * 0.5;
    const pts = [];
    for (let s = 0; s <= steps; s++) {
      pts.push([x, y]);
      if (s > steps * 0.55) a += 0.07 + droop * 0.04;
      x += Math.cos(a) * H / steps;
      y += Math.sin(a) * H / steps;
    }
    c.strokeStyle = '#7a5a3a';
    c.lineWidth = 2 * k;
    c.beginPath();
    c.moveTo(-3 * k, 0);
    c.lineTo(-3 * k, -H * 0.55);
    c.stroke();
    c.strokeStyle = this.tint(p, '#5e7d3a');
    c.beginPath();
    pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.stroke();
    for (let b = 0; b < 7; b++) {
      const pt = pts[Math.min(pts.length - 1, Math.round(steps * 0.55) + b)];
      if (b < cnt.blooms) this.bloom(c, pt[0], pt[1] + 8 * k, 15 * k * p.appear('b' + b, now), droop);
      else if (cnt.spike >= 1) {
        c.fillStyle = this.tint(p, '#a9c27a');
        c.beginPath();
        c.ellipse(pt[0], pt[1] + 4 * k, 3.4 * k, 4.5 * k, 0, 0, GH_TAU);
        c.fill();
      }
    }
  }

  bloom(c, x, y, r, droop) {
    if (r < 1) return;
    c.save();
    c.translate(x, y);
    c.rotate(droop * 0.4);
    c.fillStyle = '#fbf6fb';
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * GH_TAU - Math.PI / 2;
      c.beginPath();
      c.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * (i % 2 ? 0.48 : 0.62), r * 0.42, a, 0, GH_TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(236, 160, 200, 0.5)';
    c.beginPath();
    c.arc(0, 0, r * 0.45, 0, GH_TAU);
    c.fill();
    c.fillStyle = '#c43a7a';
    c.beginPath();
    c.ellipse(0, r * 0.22, r * 0.24, r * 0.2, 0, 0, GH_TAU);
    c.fill();
    c.fillStyle = '#f2c84b';
    c.beginPath();
    c.arc(0, -r * 0.05, r * 0.08, 0, GH_TAU);
    c.fill();
    c.restore();
  }

  drawSnake(c, p, k, droop, sway, now) {
    const { leaves } = p.counts();
    for (let i = 0; i < leaves; i++) {
      const ap = p.appear('l' + i, now);
      const off = (i - (leaves - 1) / 2) * 7 * k;
      const H = (70 + ((i * 41) % 60) + p.g * 50) * k * ap;
      const lean = (i - (leaves - 1) / 2) * 0.07 + sway * 0.4 + droop * 0.12 * (Math.sign(off) || 1);
      c.save();
      c.translate(off, 0);
      c.rotate(lean);
      const wd = 9 * k;
      const g = c.createLinearGradient(-wd, 0, wd, 0);
      g.addColorStop(0, this.tint(p, '#c9c76a'));
      g.addColorStop(0.12, this.tint(p, '#2f5a33'));
      g.addColorStop(0.5, this.tint(p, '#4a7d45'));
      g.addColorStop(0.88, this.tint(p, '#2f5a33'));
      g.addColorStop(1, this.tint(p, '#c9c76a'));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-wd * 0.6, 0);
      c.quadraticCurveTo(-wd, -H * 0.6, 0, -H);
      c.quadraticCurveTo(wd, -H * 0.6, wd * 0.6, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(20, 45, 25, 0.35)';
      c.lineWidth = 1.2 * k;
      for (let y = -10 * k; y > -H * 0.85; y -= 11 * k) {
        c.beginPath();
        c.moveTo(-wd * 0.55, y);
        c.quadraticCurveTo(0, y - 4 * k, wd * 0.55, y);
        c.stroke();
      }
      c.restore();
    }
  }

  drawTrailing(c, p, k, droop, sway, now) {
    const { leaves } = p.counts();
    const ivy = p.species === 'ivy';
    const vines = 4, per = Math.ceil(leaves / vines);
    const lightC = this.tint(p, ivy ? '#4f8a45' : '#79b65a'), darkC = this.tint(p, ivy ? '#234f2a' : '#3f7d32');
    let idx = 0;
    for (let v = 0; v < vines; v++) {
      const side = v % 2 ? 1 : -1;
      const L = (30 + p.g * 220) * k * (0.6 + ((v * 29) % 40) / 100);
      const steps = 22;
      let x = side * (14 + v * 4) * k, y = -4 * k, a = side > 0 ? -0.3 : Math.PI + 0.3;
      const pts = [];
      for (let s = 0; s < steps; s++) {
        pts.push([x, y]);
        // Over the rim, then hanging down and swaying
        const want = Math.PI / 2 + Math.sin(this.t * 0.6 + v) * 0.05 + sway * 0.6 - side * (0.12 - droop * 0.05);
        a += (want - a) * 0.22;
        x += Math.cos(a) * L / steps;
        y += Math.sin(a) * L / steps;
      }
      c.strokeStyle = this.tint(p, ivy ? '#5a4a2a' : '#5c8a3a');
      c.lineWidth = 1.5 * k;
      c.beginPath();
      pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
      c.stroke();
      for (let j = 0; j < per; j++) {
        if (idx >= leaves) break;
        const [px, py] = pts[Math.min(steps - 1, Math.round((j + 0.5) / per * (steps - 1)))];
        const ap = p.appear('l' + idx, now);
        const ls = (ivy ? 10 : 12) * k * (0.6 + 0.4 * (1 - j / per)) * ap;
        const la = (j % 2 ? 0.4 : Math.PI - 0.4) + droop * 0.6 * (j % 2 ? 1 : -1);
        this.leaf(c, px, py, la, ls * 1.5, ls * 0.75, lightC, darkC, { heart: true, variegate: !ivy });
        idx++;
      }
    }
    // A crown of leaves around the rim
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + i / 5 * Math.PI;
      this.leaf(c, Math.cos(a) * 20 * k, -4 * k, a - 0.4 + droop * 0.4, 16 * k, 8 * k, lightC, darkC, { heart: true, variegate: !ivy });
    }
  }

  // ---------- Drawing: water, can, mist ----------
  drawWater(c) {
    const S = this.S;
    if (this.drops.length) {
      // Water has a darker edge and a bright core so it reads against sky and leaves
      c.lineCap = 'round';
      const pass = (style, width, len) => {
        c.strokeStyle = style;
        c.lineWidth = width;
        c.beginPath();
        for (const d of this.drops) {
          c.moveTo(d.x, d.y);
          c.lineTo(d.x - d.vx * len, d.y - d.vy * len);
        }
        c.stroke();
      };
      pass('rgba(70, 120, 160, 0.45)', 3.2 * S, 0.02);
      pass('rgba(225, 242, 255, 0.95)', 1.4 * S, 0.016);
    }
    c.strokeStyle = 'rgba(210, 235, 250, 0.6)';
    c.lineWidth = 1.2 * S;
    for (const s of this.splashes) {
      const u = s.t / 0.35;
      c.globalAlpha = 1 - u;
      c.beginPath();
      c.ellipse(s.x, s.y, (4 + u * 10) * s.k, (1.5 + u * 3) * s.k, 0, Math.PI, GH_TAU);
      c.stroke();
    }
    c.globalAlpha = 1;
    for (const m of this.mist) {
      c.fillStyle = `rgba(225, 240, 250, ${(0.35 * m.life / m.max).toFixed(3)})`;
      c.beginPath();
      c.arc(m.x, m.y, m.r, 0, GH_TAU);
      c.fill();
    }
  }

  drawTool(c) {
    const P = this.pointer;
    if (!P.inside) return;
    const S = this.S * (this.preview ? 0.8 : 1);
    c.save();
    c.translate(P.x, P.y);
    if (this.tool === 'water') {
      // Watering can: the rose (spout head) is at the pointer, the body up and to the left
      c.rotate(-0.15 + this.canTilt * 0.55);
      c.translate(-70 * S, -46 * S);
      const body = c.createLinearGradient(-30 * S, 0, 30 * S, 0);
      body.addColorStop(0, '#5f8076');
      body.addColorStop(0.45, '#8fb3a8');
      body.addColorStop(1, '#4d6a61');
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(-28 * S, -18 * S);
      c.lineTo(26 * S, -18 * S);
      c.lineTo(30 * S, 26 * S);
      c.lineTo(-32 * S, 26 * S);
      c.closePath();
      c.fill();
      c.strokeStyle = '#4d6a61';
      c.lineWidth = 5 * S;
      c.beginPath();
      c.arc(-2 * S, -22 * S, 22 * S, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
      c.lineWidth = 6 * S;
      c.beginPath();
      c.moveTo(24 * S, 16 * S);
      c.lineTo(64 * S, 40 * S);
      c.stroke();
      c.fillStyle = '#4d6a61';
      c.beginPath();
      c.ellipse(70 * S, 45 * S, 6 * S, 9 * S, -0.9, 0, GH_TAU);
      c.fill();
      c.fillStyle = 'rgba(255, 255, 255, 0.25)';
      c.fillRect(-20 * S, -14 * S, 6 * S, 36 * S);
    } else {
      // Mister: the nozzle is at the pointer
      c.translate(-6 * S, -10 * S);
      c.fillStyle = 'rgba(200, 230, 225, 0.75)';
      c.fillRect(-14 * S, 0, 24 * S, 46 * S);
      c.fillStyle = '#e8e4d8';
      c.fillRect(-10 * S, -14 * S, 16 * S, 14 * S);
      c.fillRect(6 * S, -12 * S, 10 * S, 5 * S);
      c.fillStyle = '#7fb39f';
      c.fillRect(-14 * S, 26 * S, 24 * S, 20 * S);
    }
    c.restore();
  }

  draw() {
    const c = this.ctx, M = GH_MOODS[this.moodKey], now = performance.now();
    c.clearRect(0, 0, this.w, this.h);
    this.drawOutside(c, M);
    this.drawGlassHouse(c, M);
    this.drawCondensation(c, M);
    this.drawShelfAndBench(c);
    // Back shelf and hanging basket first (further away), then the bench
    for (const slot of ['s0', 's1', 'h0', 'b0', 'b1', 'b2', 'b3']) {
      const p = this.plants.find(q => q.slot === slot);
      if (!p) continue;
      if (p.species === 'pothos' || p.species === 'ivy') { this.drawPot(c, p); this.drawPlant(c, p, now); }
      else { this.drawPlant(c, p, now); this.drawPot(c, p); }
    }
    this.drawWater(c);
    this.drawBeams(c, M);
    this.drawLamp(c, M);
    if (M.haze) {
      c.fillStyle = M.haze;
      c.fillRect(0, 0, this.w, this.h);
    }
    this.drawTool(c);
    const vg = c.createRadialGradient(this.w / 2, this.h * 0.45, Math.min(this.w, this.h) * 0.4, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.8);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(10, 20, 10, 0.3)');
    c.fillStyle = vg;
    c.fillRect(0, 0, this.w, this.h);
  }
}

window.GreenhouseWorld = GreenhouseWorld;
window.GH_MOODS = GH_MOODS;
window.GH_SPECIES = GH_SPECIES;
