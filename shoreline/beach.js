/**
 * beach.js - The Shoreline
 *
 * A beach seen from above. Waves wash up the sand in lobed sheets of
 * water, pause, and slide back, leaving a dark band of wet sand and a lace
 * of foam that fades. Every few waves one reaches further.
 *
 * Anything drawn or written in the sand is cut into two layers (a lit
 * rim and a shaded groove), and wherever water covers it, both layers are
 * worn away a little each moment, so one wave softens it and the next
 * takes it. Waves leave shells behind; a small crab minds its business
 * and runs from your hand; a gull passes over now and then. The colours
 * and the tide follow your local time.
 */

const SH_TAU = Math.PI * 2;
const shClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shRand = (a, b) => a + Math.random() * (b - a);
/** Stable pseudo-random 0 … 1 for a pair of numbers (no flicker between frames). */
const shHash = (a, b = 0) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const SH_PALETTES = {
  day: {
    deep: '#0d5876', mid: '#1b8aa2', shallow: '#5fc9bf', swash: '108, 204, 196',
    sand: '#e9d5ab', sandLow: '#e2c99a', wet: '96, 72, 40', foam: '255, 255, 255', glint: '255, 255, 240',
    groove: 'rgb(112, 80, 44)', rim: 'rgb(255, 248, 230)', grooveA: 0.5, rimA: 0.65
  },
  dusk: {
    deep: '#2a3d68', mid: '#56699a', shallow: '#c79fa5', swash: '196, 168, 178',
    sand: '#dcb894', sandLow: '#cfa983', wet: '82, 55, 52', foam: '255, 240, 235', glint: '255, 210, 170',
    groove: 'rgb(100, 64, 50)', rim: 'rgb(255, 236, 214)', grooveA: 0.5, rimA: 0.5
  },
  night: {
    deep: '#06101f', mid: '#0f2742', shallow: '#2a5b73', swash: '64, 116, 140',
    sand: '#9294a6', sandLow: '#7f8194', wet: '12, 18, 40', foam: '205, 222, 240', glint: '228, 234, 255',
    groove: 'rgb(30, 32, 50)', rim: 'rgb(210, 216, 236)', grooveA: 0.5, rimA: 0.35
  }
};

const SH_SHELLS = ['scallop', 'scallop', 'whelk', 'pebble', 'pebble', 'star'];
const SH_SHELL_COLOURS = {
  scallop: ['#f2c1b0', '#f4e3c8', '#efc79a', '#e9b8c4'],
  whelk: ['#efe6da', '#e8d6be'],
  pebble: ['#a8a39b', '#8f8b86', '#bdb4a6'],
  star: ['#e07a4a', '#d9935c']
};
const SH_WORDS = ['hello', 'breathe', 'stay a while', '♡', 'slow down', 'here'];

class ShorelineWorld {
  constructor(canvas, { preview = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = preview;
    this.t = 0;
    this.N = 120;
    this.waves = [];
    this.waveCount = 0;
    this.nextWave = 0.3;
    this.trails = [];
    this.ripples = [];
    this.shells = [];
    this.pointer = null;
    this.drawing = null;
    this.swash = 0;
    this.back = 0;
    this.crab = { x: 0, y: 0, vx: 0, walk: 0, hide: 0, legs: 0, face: 0 };
    this.gull = null;
    this.nextGull = shRand(6, 16);
    this.autoWrite = 2;

    this.onPick = null;
    this.onGull = null;
    this.onSplash = null;
    this.updatePhase();
  }

  updatePhase() {
    const d = new Date();
    const h = d.getHours() + d.getMinutes() / 60;
    const phase = (h >= 7.5 && h < 17) ? 'day' : ((h >= 6 && h < 7.5) || (h >= 17 && h < 19.5)) ? 'dusk' : 'night';
    if (phase !== this.phase) {
      this.phase = phase;
      this.sand = null;
    }
  }

  get P() {
    return SH_PALETTES[this.phase];
  }

  /** The tide, from a 12.42-hour cycle: -1 low … 1 high, and whether it is rising. */
  get tide() {
    const a = (Date.now() / 36e5 / 12.42) * SH_TAU;
    return { level: Math.sin(a), rising: Math.cos(a) > 0 };
  }

  get shoreY() {
    return this.baseY + this.tide.level * this.h * 0.035;
  }

  // ---------- Layout ----------
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    const portrait = h > w;
    this.S = shClamp(Math.min(w / 1000, h / 700), 0.45, 1.6);
    this.baseY = h * (this.preview ? 0.36 : portrait ? 0.33 : 0.37);
    this.front = new Float32Array(this.N).fill(this.baseY);
    this.wet = new Float32Array(this.N).fill(this.baseY);
    this.layerRim = this.makeLayer();
    this.layerGroove = this.makeLayer();
    this.sand = null;
    this.glints = Array.from({ length: 60 }, () => ({ u: Math.random(), v: Math.random(), ph: shRand(0, SH_TAU), rate: shRand(0.8, 2) }));
    this.shells = [];
    for (let i = 0; i < (this.preview ? 3 : 5); i++) this.addShell(shRand(0.08, 0.92) * w, shRand(this.baseY + h * 0.12, h * 0.92));
    Object.assign(this.crab, { x: w * 0.72, y: this.baseY + h * 0.24, vx: 0, hide: 0 });
  }

  makeLayer() {
    const cv = document.createElement('canvas');
    cv.width = Math.round(this.w * this.dpr);
    cv.height = Math.round(this.h * this.dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return { cv, ctx };
  }

  addShell(x, y) {
    const type = SH_SHELLS[Math.floor(Math.random() * SH_SHELLS.length)];
    const cols = SH_SHELL_COLOURS[type];
    this.shells.push({
      x, y, type, col: cols[Math.floor(Math.random() * cols.length)],
      rot: shRand(0, SH_TAU), size: shRand(0.8, 1.25) * (type === 'pebble' ? 0.8 : 1),
      pick: 0, picked: false, fade: 1, leaving: false
    });
  }

  colX(i) {
    return (i / (this.N - 1)) * this.w;
  }

  frontAt(x) {
    const i = shClamp(Math.round((x / this.w) * (this.N - 1)), 0, this.N - 1);
    return this.front[i];
  }

  // ---------- Waves ----------
  spawnWave(power) {
    const big = power || ((++this.waveCount % 4 === 0) ? 1.45 : 1);
    this.waves.push({
      t0: this.t,
      dur: shRand(6.5, 8.5) * (big > 1.3 ? 1.15 : 1),
      R: this.h * shRand(0.1, 0.17) * big,
      s1: shRand(0, SH_TAU), s2: shRand(0, SH_TAU), s3: shRand(0, SH_TAU),
      k1: shRand(0.9, 1.6), k2: shRand(2.4, 3.6),
      seed: Math.random() * 100,
      peaked: false
    });
  }

  /** How far up the sand a wave is, as a share of its reach: rushes up, then slides back. */
  waveExt(p) {
    if (p < 0.3) {
      const q = p / 0.3;
      return -0.18 + 1.18 * (1 - Math.pow(1 - q, 3));
    }
    const q = (p - 0.3) / 0.7;
    return 1 - 1.18 * q * q * (3 - 2 * q);
  }

  waveProfile(wv, u) {
    return 1 + 0.16 * Math.sin(u * SH_TAU * wv.k1 + wv.s1) + 0.09 * Math.sin(u * SH_TAU * wv.k2 + wv.s2) + 0.04 * Math.sin(u * SH_TAU * 7.3 + wv.s3);
  }

  /** A big wave on request: it washes far up and smooths most of the beach. */
  callWave() {
    this.spawnWave(2.3);
    this.nextWave = Math.max(this.nextWave, 6);
  }

  // ---------- Interaction ----------
  setPointer(x, y) {
    this.pointer = x == null ? null : { x, y };
  }

  shellAt(x, y) {
    const S = this.S;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      if (!s.picked && !s.leaving && Math.hypot(x - s.x, y - s.y) < 18 * S * s.size + 6) return s;
    }
    return null;
  }

  /** Press: pick a shell, touch the water, or start drawing in the sand. */
  pointerDown(x, y) {
    this.setPointer(x, y);
    const s = this.shellAt(x, y);
    if (s) {
      s.picked = true;
      this.onPick?.(s);
      return 'shell';
    }
    if (y < this.frontAt(x) - 2) {
      this.ripples.push({ x, y, r: 2, life: 0 });
      this.onSplash?.();
      this.drawing = { x, y, water: true };
      return 'water';
    }
    this.drawing = { x, y, water: false };
    this.carve(x, y, x + 0.01, y + 0.01);
    return 'sand';
  }

  pointerMove(x, y) {
    this.setPointer(x, y);
    const d = this.drawing;
    if (!d) return 0;
    const len = Math.hypot(x - d.x, y - d.y);
    if (len < 1.5) return 0;
    if (y < this.frontAt(x) - 2) {
      if (Math.random() < 0.3) this.ripples.push({ x, y, r: 2, life: 0 });
    } else {
      this.carve(d.x, d.y, x, y);
    }
    d.x = x; d.y = y;
    return len;
  }

  pointerUp() {
    this.drawing = null;
  }

  /** Cut a groove from one point to another: a lit rim below, the shaded channel on top. */
  carve(x1, y1, x2, y2, width = 7) {
    const w = width * this.S, o = w * 0.32;
    const r = this.layerRim.ctx, g = this.layerGroove.ctx;
    r.strokeStyle = this.P.rim;
    r.lineWidth = w;
    r.beginPath();
    r.moveTo(x1 + o, y1 + o);
    r.lineTo(x2 + o, y2 + o);
    r.stroke();
    g.strokeStyle = this.P.groove;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }

  /** Hovering on the homepage leaves a light finger trail. */
  trace(x, y) {
    if (x == null) { this.lastTrace = null; return; }
    if (this.lastTrace && y > this.frontAt(x) + 2) this.carve(this.lastTrace.x, this.lastTrace.y, x, y, 5);
    this.lastTrace = { x, y };
    this.setPointer(x, y);
  }

  /** Write a word in the sand near the water, in a loose hand. */
  writeWord(text, x = this.w / 2, y = this.shoreY + this.h * 0.17) {
    text = String(text || '').trim().slice(0, 40);
    if (!text) return;
    let size = shClamp(this.w * 0.075, 26, 84) * (this.preview ? 1.3 : 1);
    const font = (s) => `italic ${s}px "Snell Roundhand", "Segoe Script", "Bradley Hand", "Brush Script MT", cursive`;
    const g = this.layerGroove.ctx, r = this.layerRim.ctx;
    g.font = font(size);
    const width = g.measureText(text).width;
    if (width > this.w * 0.84) size *= (this.w * 0.84) / width;
    [r, g].forEach(c => { c.font = font(size); c.textAlign = 'center'; c.textBaseline = 'middle'; });
    const o = Math.max(1, size * 0.045);
    r.fillStyle = this.P.rim;
    r.fillText(text, x + o, y + o);
    g.fillStyle = this.P.groove;
    g.fillText(text, x, y);
  }

  // ---------- Simulation ----------
  update(dt) {
    this.t += dt;
    if (Math.floor(this.t / 30) !== Math.floor((this.t - dt) / 30)) this.updatePhase();
    const { N, w, h } = this;
    const shore = this.shoreY;

    this.nextWave -= dt;
    if (this.nextWave <= 0) {
      this.spawnWave();
      this.nextWave = shRand(4.2, 6.2);
    }

    // Where the water reaches across the beach
    let before = 0, after = 0;
    for (let i = 0; i < N; i++) before += this.front[i];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      let y = shore - h * 0.03;
      for (const wv of this.waves) {
        const p = (this.t - wv.t0) / wv.dur;
        if (p >= 1) continue;
        y = Math.max(y, shore + this.waveExt(p) * wv.R * this.waveProfile(wv, u));
      }
      this.front[i] = y;
      this.wet[i] = Math.max(Math.max(this.wet[i] - dt * h * 0.004, y), shore);
      after += y;
    }
    const v = (after - before) / N / Math.max(dt, 1e-3);
    this.swash = shClamp(v / (h * 0.08), 0, 1);
    this.back = shClamp(-v / (h * 0.08), 0, 1);

    // A wave at its furthest leaves a line of foam, and sometimes a shell
    for (const wv of this.waves) {
      const p = (this.t - wv.t0) / wv.dur;
      if (!wv.peaked && p >= 0.3) {
        wv.peaked = true;
        const pts = new Float32Array(N);
        for (let i = 0; i < N; i++) pts[i] = shore + wv.R * this.waveProfile(wv, i / (N - 1));
        this.trails.push({ pts, life: 0, seed: wv.seed });
        const live = this.shells.filter(s => !s.picked && !s.leaving).length;
        if (live < 12 && Math.random() < 0.4) {
          const i = Math.floor(shRand(0.06, 0.94) * N);
          this.addShell(this.colX(i), pts[i] - shRand(6, 24) * this.S);
        }
      }
    }
    this.waves = this.waves.filter(wv => this.t - wv.t0 < wv.dur);
    this.trails.forEach(tr => { tr.life += dt; });
    this.trails = this.trails.filter(tr => tr.life < 5);

    // Water wears away whatever is written under it
    const wear = 1 - Math.exp(-dt * 1.1);
    for (const L of [this.layerRim.ctx, this.layerGroove.ctx]) {
      L.save();
      L.globalCompositeOperation = 'destination-out';
      L.fillStyle = `rgba(0, 0, 0, ${wear})`;
      L.beginPath();
      L.moveTo(0, 0);
      for (let i = 0; i < N; i++) L.lineTo(this.colX(i), this.front[i] + 2);
      L.lineTo(w, 0);
      L.closePath();
      L.fill();
      L.restore();
    }

    // Shells: picked ones float up; the backwash takes the odd one out to sea
    for (const s of this.shells) {
      if (s.picked) s.pick += dt * 2;
      else if (s.leaving) s.fade -= dt;
      else if (this.back > 0.2 && s.y < this.frontAt(s.x) - 4 && Math.random() < dt * 0.15) s.leaving = true;
    }
    this.shells = this.shells.filter(s => s.pick < 1 && s.fade > 0);

    this.ripples.forEach(r => { r.life += dt; r.r += 34 * this.S * dt; });
    this.ripples = this.ripples.filter(r => r.life < 1.6);

    this.updateCrab(dt);
    this.updateGull(dt);

    if (this.preview) {
      this.autoWrite -= dt;
      if (this.autoWrite <= 0) {
        this.autoWrite = shRand(10, 14);
        this.writeWord(SH_WORDS[Math.floor(Math.random() * SH_WORDS.length)], this.w * shRand(0.4, 0.6));
      }
    }
  }

  updateCrab(dt) {
    const c = this.crab, S = this.S;
    if (c.hide > 0) {
      c.hide -= dt;
      if (c.y < this.frontAt(c.x) + 8 * S) c.hide = Math.max(c.hide, 0.6);
      return;
    }
    // Dig in when the water arrives
    if (c.y < this.frontAt(c.x) + 4 * S) { c.hide = shRand(2, 4); c.vx = 0; return; }
    const p = this.pointer;
    if (p && Math.hypot(p.x - c.x, p.y - c.y) < 100 * S) {
      c.vx = Math.sign(c.x - p.x || 1) * 170 * S;
      c.walk = 0.5;
    } else {
      c.walk -= dt;
      if (c.walk <= 0) {
        c.vx = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? -1 : 1) * shRand(25, 60) * S;
        c.walk = shRand(0.6, 1.8);
      }
    }
    c.x += c.vx * dt;
    if (c.x < 30 * S || c.x > this.w - 30 * S) { c.vx *= -1; c.x = shClamp(c.x, 30 * S, this.w - 30 * S); }
    c.y = shClamp(c.y, this.shoreY + this.h * 0.1, this.h * 0.9);
    c.legs += Math.abs(c.vx) * dt * 0.25;
  }

  updateGull(dt) {
    const S = this.S;
    if (!this.gull) {
      this.nextGull -= dt;
      if (this.nextGull <= 0) {
        this.nextGull = shRand(18, 40);
        const fromLeft = Math.random() < 0.5;
        this.gull = {
          x: fromLeft ? -60 * S : this.w + 60 * S,
          y: shRand(0.1, 0.6) * this.h,
          vx: (fromLeft ? 1 : -1) * shRand(110, 170) * S,
          vy: shRand(-30, 30) * S,
          flap: 0
        };
        this.onGull?.();
      }
      return;
    }
    const g = this.gull;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.flap += dt * 7;
    if (g.x < -100 * S || g.x > this.w + 100 * S) this.gull = null;
  }

  // ---------- Drawing ----------
  draw() {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    if (!this.sand) this.sand = this.paintSand();
    c.drawImage(this.sand, 0, 0, this.w, this.h);
    this.drawWet(c);
    // Grooves are cut opaque so overlapping strokes don't darken; the alpha goes on here
    c.globalAlpha = this.P.rimA;
    c.drawImage(this.layerRim.cv, 0, 0, this.w, this.h);
    c.globalAlpha = this.P.grooveA;
    c.drawImage(this.layerGroove.cv, 0, 0, this.w, this.h);
    c.globalAlpha = 1;
    this.drawShells(c);
    this.drawCrab(c);
    this.drawTrails(c);
    this.drawSea(c);
    this.drawRipples(c);
    this.drawGull(c);
    if (this.phase === 'night') this.drawMoonlight(c);
  }

  /** A pale wash of moonlight from over the sea, brightest on the water below the moon. */
  drawMoonlight(c) {
    const { w, h } = this, mx = w * 0.7;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(mx, -h * 0.1, 0, mx, -h * 0.1, h * 1.1);
    g.addColorStop(0, 'rgba(150, 170, 220, 0.22)');
    g.addColorStop(0.5, 'rgba(110, 130, 190, 0.08)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const path = c.createLinearGradient(mx - w * 0.1, 0, mx + w * 0.1, 0);
    path.addColorStop(0, 'rgba(180, 200, 255, 0)');
    path.addColorStop(0.5, 'rgba(180, 200, 255, 0.1)');
    path.addColorStop(1, 'rgba(180, 200, 255, 0)');
    c.fillStyle = path;
    c.fillRect(mx - w * 0.1, 0, w * 0.2, this.shoreY);
    c.restore();
  }

  paintSand() {
    const { w, h, dpr } = this, P = this.P;
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    const g = c.createLinearGradient(0, this.baseY, 0, h);
    g.addColorStop(0, P.sandLow);
    g.addColorStop(1, P.sand);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    // Grain
    const n = Math.min(16000, Math.round(w * h * 0.012));
    for (let i = 0; i < n; i++) {
      const dark = Math.random() < 0.55;
      c.fillStyle = dark ? `rgba(90, 70, 40, ${shRand(0.05, 0.16)})` : `rgba(255, 252, 240, ${shRand(0.08, 0.25)})`;
      const s = shRand(0.6, 1.6);
      c.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    // Wind ripples on the dry sand
    c.strokeStyle = 'rgba(120, 90, 50, 0.06)';
    c.lineWidth = 1.5;
    for (let y = this.baseY + h * 0.3; y < h + 10; y += shRand(9, 16) * this.S) {
      const ph = Math.random() * 10;
      c.beginPath();
      for (let x = -10; x <= w + 10; x += 12) c.lineTo(x, y + Math.sin(x * 0.012 + ph) * 5 * this.S + Math.sin(x * 0.05 + ph) * 1.5);
      c.stroke();
    }
    // Scattered tiny pebbles
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(${Math.random() < 0.5 ? '140, 120, 100' : '200, 180, 150'}, 0.5)`;
      c.beginPath();
      c.ellipse(Math.random() * w, shRand(this.baseY + h * 0.1, h), shRand(1, 2.5), shRand(0.8, 2), Math.random() * 3, 0, SH_TAU);
      c.fill();
    }
    return cv;
  }

  /** The dark, glossy band the water has wet and the sun hasn't dried yet. */
  drawWet(c) {
    const { N, h } = this, P = this.P, shore = this.shoreY;
    c.beginPath();
    c.moveTo(0, shore - h * 0.05);
    for (let i = 0; i < N; i++) c.lineTo(this.colX(i), this.wet[i]);
    c.lineTo(this.w, shore - h * 0.05);
    c.closePath();
    const g = c.createLinearGradient(0, shore, 0, shore + h * 0.35);
    g.addColorStop(0, `rgba(${P.wet}, 0.34)`);
    g.addColorStop(1, `rgba(${P.wet}, 0.22)`);
    c.fillStyle = g;
    c.fill();
    // Sky sheen on the wettest sand
    const s = c.createLinearGradient(0, shore, 0, shore + h * 0.12);
    s.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    s.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = s;
    c.fill();
  }

  drawShells(c) {
    const S = this.S;
    for (const s of this.shells) {
      const k = s.size * S;
      c.save();
      c.translate(s.x, s.y - s.pick * 30 * S);
      c.globalAlpha = Math.max(0, s.picked ? 1 - s.pick : s.fade);
      c.rotate(s.rot);
      c.scale(1 + s.pick * 0.5, 1 + s.pick * 0.5);
      // Shadow
      c.fillStyle = 'rgba(40, 30, 20, 0.18)';
      c.beginPath();
      c.ellipse(2 * k, 2.5 * k, 11 * k, 8 * k, 0, 0, SH_TAU);
      c.fill();
      if (s.type === 'scallop') {
        c.fillStyle = s.col;
        c.beginPath();
        c.moveTo(0, 8 * k);
        c.arc(0, 8 * k, 16 * k, -Math.PI * 0.82, -Math.PI * 0.18);
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(120, 70, 50, 0.35)';
        c.lineWidth = Math.max(0.6, 0.9 * k);
        for (let a = -0.78; a <= -0.2; a += 0.08) {
          c.beginPath();
          c.moveTo(0, 8 * k);
          c.lineTo(Math.cos(a * Math.PI) * 15 * k, 8 * k + Math.sin(a * Math.PI) * 15 * k);
          c.stroke();
        }
        c.fillStyle = s.col;
        c.fillRect(-4 * k, 6 * k, 8 * k, 4 * k);
      } else if (s.type === 'whelk') {
        c.fillStyle = s.col;
        c.beginPath();
        c.ellipse(0, 0, 6 * k, 13 * k, 0, 0, SH_TAU);
        c.fill();
        c.strokeStyle = 'rgba(130, 100, 70, 0.4)';
        c.lineWidth = Math.max(0.6, k);
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.ellipse(0, -8 * k + i * 5 * k, 5.5 * k - i * 0.4 * k, 2 * k, 0.3, 0, Math.PI);
          c.stroke();
        }
      } else if (s.type === 'pebble') {
        const g = c.createRadialGradient(-3 * k, -3 * k, 1, 0, 0, 11 * k);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        g.addColorStop(0.4, s.col);
        g.addColorStop(1, s.col);
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, 10 * k, 7 * k, 0, 0, SH_TAU);
        c.fill();
      } else {
        c.fillStyle = s.col;
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * SH_TAU - Math.PI / 2, r = (i % 2 ? 5 : 14) * k;
          c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(255, 230, 200, 0.6)';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * SH_TAU - Math.PI / 2;
          c.beginPath();
          c.arc(Math.cos(a) * 7 * k, Math.sin(a) * 7 * k, 1 * k, 0, SH_TAU);
          c.fill();
        }
      }
      c.restore();
    }
  }

  drawCrab(c) {
    const cr = this.crab, S = this.S;
    if (cr.hide > 0) {
      // Just a little mound and two eyes when it has dug in
      c.fillStyle = 'rgba(90, 70, 40, 0.25)';
      c.beginPath();
      c.ellipse(cr.x, cr.y, 9 * S, 5 * S, 0, 0, SH_TAU);
      c.fill();
      if (cr.hide < 1) {
        c.fillStyle = '#1b1b1b';
        c.fillRect(cr.x - 3 * S, cr.y - 2 * S, 1.6 * S, 1.6 * S);
        c.fillRect(cr.x + 1.5 * S, cr.y - 2 * S, 1.6 * S, 1.6 * S);
      }
      return;
    }
    c.save();
    c.translate(cr.x, cr.y);
    // Shadow
    c.fillStyle = 'rgba(40, 30, 20, 0.2)';
    c.beginPath();
    c.ellipse(2 * S, 3 * S, 13 * S, 8 * S, 0, 0, SH_TAU);
    c.fill();
    // Legs, scuttling
    c.strokeStyle = '#b5482f';
    c.lineWidth = 1.6 * S;
    c.lineCap = 'round';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const sw = Math.sin(cr.legs + i * 2 + (side > 0 ? 1 : 0)) * 3 * S;
        c.beginPath();
        c.moveTo(side * 7 * S, (i - 1) * 3.5 * S);
        c.lineTo(side * 13 * S, (i - 1) * 5 * S + sw);
        c.lineTo(side * 16 * S, (i - 1) * 6 * S + sw + 2 * S);
        c.stroke();
      }
    }
    // Body and claws
    c.fillStyle = '#d0603e';
    c.beginPath();
    c.ellipse(0, 0, 10 * S, 7 * S, 0, 0, SH_TAU);
    c.fill();
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(side * 8 * S, -9 * S, 4 * S, 3 * S, side * 0.5, 0, SH_TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(255, 220, 190, 0.35)';
    c.beginPath();
    c.ellipse(-2 * S, -2 * S, 5 * S, 2.5 * S, 0, 0, SH_TAU);
    c.fill();
    c.fillStyle = '#1b1b1b';
    c.beginPath();
    c.arc(-3 * S, -6.5 * S, 1.3 * S, 0, SH_TAU);
    c.arc(3 * S, -6.5 * S, 1.3 * S, 0, SH_TAU);
    c.fill();
    c.restore();
  }

  /** Lace of foam left where each wave turned back. */
  drawTrails(c) {
    const { N, S } = this, P = this.P;
    for (const tr of this.trails) {
      const a = (1 - tr.life / 5) * 0.55;
      c.fillStyle = `rgba(${P.foam}, ${a})`;
      for (let i = 0; i < N; i++) {
        const x = this.colX(i);
        if (tr.pts[i] < this.frontAt(x)) continue;
        for (let k = 0; k < 3; k++) {
          const jx = (shHash(i, k + tr.seed) - 0.5) * 10 * S, jy = -shHash(k, i + tr.seed) * 8 * S;
          c.fillRect(x + jx, tr.pts[i] + jy, 1.6 * S, 1.6 * S);
        }
      }
    }
  }

  drawSea(c) {
    const { N, w, h, S, t } = this, P = this.P, shore = this.shoreY;

    // Open water, out past the break
    const edge = (x) => shore - h * 0.035 + Math.sin(x * 0.01 + t * 0.4) * 4 * S;
    const sea = c.createLinearGradient(0, 0, 0, shore);
    sea.addColorStop(0, P.deep);
    sea.addColorStop(0.6, P.mid);
    sea.addColorStop(1, P.shallow);
    c.fillStyle = sea;
    c.beginPath();
    c.moveTo(0, 0);
    for (let x = 0; x <= w + 20; x += 20) c.lineTo(x, edge(x));
    c.lineTo(w, 0);
    c.closePath();
    c.fill();

    // Lines of surf rolling in toward the beach
    for (let j = 0; j < 4; j++) {
      const ph = ((t / 6.5) + j / 4) % 1;
      const y0 = shore - h * 0.04 - (1 - ph) * h * 0.3;
      const a = Math.pow(ph, 2) * 0.5 * (ph > 0.9 ? (1 - ph) * 10 : 1);
      c.strokeStyle = `rgba(${P.foam}, ${a})`;
      c.lineWidth = (1 + ph * 2.5) * S;
      c.beginPath();
      for (let x = -10; x <= w + 10; x += 14) c.lineTo(x, y0 + Math.sin(x * 0.008 + j * 3 + t * 0.3) * 6 * S + Math.sin(x * 0.03 + j) * 2 * S);
      c.stroke();
    }

    // Sun (or moon) glints on the water
    for (const g of this.glints) {
      const tw = Math.pow(Math.max(0, Math.sin(t * g.rate + g.ph)), 8);
      if (tw < 0.05) continue;
      let gx = g.u * w;
      if (this.phase === 'night') gx = w * 0.7 + (g.u - 0.5) * w * 0.18;
      const gy = g.v * (shore - h * 0.08);
      c.fillStyle = `rgba(${P.glint}, ${tw * 0.8})`;
      c.fillRect(gx, gy, 3 * S, 1.2 * S);
    }

    // The sheet of water washing up the sand, starting where the open water
    // ends (so there is no seam) and clear at its thin edge
    c.beginPath();
    for (let x = w + 20; x > 0; x -= 20) c.lineTo(x, edge(x) - 1);
    c.lineTo(0, edge(0) - 1);
    for (let i = 0; i < N; i++) c.lineTo(this.colX(i), Math.max(this.front[i], edge(this.colX(i))));
    c.closePath();
    let deepest = shore;
    for (let i = 0; i < N; i++) deepest = Math.max(deepest, this.front[i]);
    const sw = c.createLinearGradient(0, shore - h * 0.035, 0, deepest + 1);
    sw.addColorStop(0, `rgba(${P.swash}, 0.6)`);
    sw.addColorStop(0.5, `rgba(${P.swash}, 0.55)`);
    sw.addColorStop(1, `rgba(${P.swash}, 0.25)`);
    c.fillStyle = sw;
    c.fill();

    // Foam: a bright edge while rushing up, lace behind it
    const rush = 0.45 + this.swash * 0.5;
    c.strokeStyle = `rgba(${P.foam}, ${rush})`;
    c.lineWidth = (1.5 + this.swash * 2) * S;
    c.beginPath();
    for (let i = 0; i < N; i++) c.lineTo(this.colX(i), this.front[i]);
    c.stroke();
    c.fillStyle = `rgba(${P.foam}, ${0.25 + this.swash * 0.3})`;
    const drift = Math.floor(t * 2);
    for (let i = 0; i < N; i++) {
      const x = this.colX(i);
      for (let k = 0; k < 4; k++) {
        const d = shHash(i, k + drift * 0.37) * 26 * S;
        c.fillRect(x + (shHash(k, i) - 0.5) * 8 * S, this.front[i] - d, 1.8 * S, 1.8 * S);
      }
    }
  }

  drawRipples(c) {
    for (const r of this.ripples) {
      const a = (1 - r.life / 1.6) * 0.6;
      c.strokeStyle = `rgba(255, 255, 255, ${a})`;
      c.lineWidth = 1.2 * this.S;
      c.beginPath();
      c.ellipse(r.x, r.y, r.r, r.r * 0.75, 0, 0, SH_TAU);
      c.stroke();
    }
  }

  drawGull(c) {
    const g = this.gull;
    if (!g) return;
    const S = this.S, span = 26 * S, beat = Math.sin(g.flap) * 0.35;
    const draw = (x, y, body, wing) => {
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan2(g.vy, g.vx));
      c.fillStyle = wing;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(-2 * S, 0);
        c.quadraticCurveTo(-6 * S, side * span * 0.5, -12 * S, side * span * (0.9 - beat));
        c.quadraticCurveTo(2 * S, side * span * 0.4, 5 * S, 0);
        c.closePath();
        c.fill();
      }
      c.fillStyle = body;
      c.beginPath();
      c.ellipse(0, 0, 10 * S, 3.6 * S, 0, 0, SH_TAU);
      c.fill();
      c.restore();
    };
    // Shadow far below on the sand, then the bird
    draw(g.x + 40 * S, g.y + 70 * S, 'rgba(30, 25, 20, 0.16)', 'rgba(30, 25, 20, 0.16)');
    draw(g.x, g.y, '#f4f4f2', '#cfd3d8');
  }
}
