/**
 * rain.js - Rain on the glass
 *
 * A soft-focus city seen through a fogged, rain-streaked window. Drops act as
 * tiny lenses (they show the view behind them, flipped), slide down in fits
 * and starts, merge, and leave clear trails through the fog. Wiping clears the
 * fog, which slowly mists over again.
 *
 * Layers, back to front:
 *   bg       - the city, drawn once per mood at half resolution (soft focus)
 *   lights   - moving car lights and a blinking tower light
 *   fog      - a heavily blurred copy of the view, masked by fogMask
 *   droplets - tiny beads, then larger lens drops
 *   room     - window sill, a steaming mug and a little plant
 *
 * Used full-screen by scene.js and as a live preview on the homepage.
 */

const RAIN_MOODS = {
  day: {
    label: 'Grey day', icon: '🌥️',
    sky: ['#7f8ea1', '#9aa7b6', '#b8c1cb', '#c9cfd5'], far: '#7a8594', near: '#5b6573', street: '#434b55',
    windows: ['#ffe2b0', '#fff1d6'], lit: 0.08,
    bokeh: ['255, 236, 200', '200, 220, 240'], bokehCount: 14, fog: '226, 231, 237', fogTint: 0.42,
    room: 0.25
  },
  dusk: {
    label: 'Dusk', icon: '🌆',
    sky: ['#1f2747', '#4a4f7d', '#a7768a', '#d7a08a'], far: '#2c3159', near: '#161b33', street: '#0f1326',
    windows: ['#ffcf8a', '#ffd9a8', '#ffe6c0'], lit: 0.32,
    bokeh: ['255, 190, 120', '255, 140, 120', '140, 200, 255', '255, 220, 160'], bokehCount: 40, fog: '205, 210, 228', fogTint: 0.32,
    room: 0.55
  },
  night: {
    label: 'Night', icon: '🌙',
    sky: ['#050814', '#0d1430', '#1b2546', '#273156'], far: '#141b36', near: '#0a0f22', street: '#070a17',
    windows: ['#ffd28a', '#9fd4ff', '#ffe2b0'], lit: 0.42,
    bokeh: ['255, 200, 120', '120, 190, 255', '255, 110, 110', '255, 230, 170'], bokehCount: 55, fog: '170, 182, 210', fogTint: 0.27,
    room: 0.75
  },
  storm: {
    label: 'Storm', icon: '⛈️',
    sky: ['#11161d', '#222a33', '#343e49', '#46505a'], far: '#1f262f', near: '#12171d', street: '#0b0f13',
    windows: ['#ffd59a', '#cfe3ff'], lit: 0.2,
    bokeh: ['255, 210, 150', '180, 210, 255'], bokehCount: 24, fog: '160, 170, 182', fogTint: 0.34,
    room: 0.6, lightning: true
  }
};

const RAIN_LEVELS = {
  light: { label: 'Light', icon: '🌦️', drops: 5, beads: 28 },
  steady: { label: 'Steady', icon: '🌧️', drops: 13, beads: 70 },
  heavy: { label: 'Heavy', icon: '💧', drops: 32, beads: 150 }
};

const RAIN_TAU = Math.PI * 2;
const rr = (a, b) => a + Math.random() * (b - a);

class RainWorld {
  constructor(canvas, { preview = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = preview;
    const hr = new Date().getHours();
    this.mood = hr >= 7 && hr < 16 ? 'day' : hr >= 16 && hr < 20 ? 'dusk' : 'night';
    this.level = 'steady';
    this.t = 0;
    this.drops = [];
    this.beads = [];
    this.cars = [];
    this.flash = 0;
    this.nextStrike = 8;
    this.dropAcc = 0;
    this.beadAcc = 0;
    this.carTimer = 1;
    this.dropScale = 1;       // the realistic renderer uses larger drops
    this.onDrip = null;       // (x) => void, a drop reached the sill
    this.onLightning = null;  // (strength) => void

    const mk = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
    [this.bg, this.bgCtx] = mk();
    [this.mid, this.midCtx] = mk();
    [this.blur, this.blurCtx] = mk();
    [this.fogMask, this.fogMaskCtx] = mk();
    [this.fogLayer, this.fogLayerCtx] = mk();
    this.sprite = this.makeDropSprite();
  }

  // ---------- Setup ----------
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.S = Math.max(0.55, Math.min(1.3, Math.min(w, h) / 800));
    this.area = (w * h) / 1e6;
    this.sillH = this.preview ? h * 0.13 : Math.max(64, h * 0.12);
    this.glassBottom = h - this.sillH;
    this.bs = 0.5;   // background resolution
    this.fs = 0.25;  // fog resolution
    this.bg.width = Math.max(2, Math.round(w * this.bs));
    this.bg.height = Math.max(2, Math.round(h * this.bs));
    this.mid.width = Math.max(2, Math.round(w / 4));
    this.mid.height = Math.max(2, Math.round(h / 4));
    this.blur.width = Math.max(2, Math.round(w / 22));
    this.blur.height = Math.max(2, Math.round(h / 22));
    this.fogMask.width = this.fogLayer.width = Math.max(2, Math.round(w * this.fs));
    this.fogMask.height = this.fogLayer.height = Math.max(2, Math.round(h * this.fs));
    this.buildBackground();
    this.resetFog();
    this.drops = this.drops.filter(d => d.x < w && d.y < this.glassBottom);
    this.beads = this.beads.filter(b => b.x < w && b.y < this.glassBottom);
    if (!this.drops.length) this.seedGlass();
  }

  setMood(mood) {
    if (!RAIN_MOODS[mood]) return;
    this.mood = mood;
    this.nextStrike = this.t + rr(3, 8);
    if (this.w) this.buildBackground();
  }

  setLevel(level) {
    if (RAIN_LEVELS[level]) this.level = level;
  }

  /** Start with some rain already on the window. */
  seedGlass() {
    const n = Math.round(RAIN_LEVELS[this.level].drops * this.area * 5);
    for (let i = 0; i < n; i++) this.spawnDrop();
    const m = Math.round(RAIN_LEVELS[this.level].beads * this.area * 6);
    for (let i = 0; i < m; i++) this.spawnBead();
  }

  resetFog() {
    const c = this.fogMaskCtx, fw = this.fogMask.width, fh = this.fogMask.height;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, fw, fh);
    const g = c.createLinearGradient(0, 0, 0, fh);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.96)');
    c.fillStyle = g;
    c.fillRect(0, 0, fw, fh);
  }

  /** One shading sprite (dark rim, highlights) reused for every drop. */
  makeDropSprite() {
    const c = document.createElement('canvas');
    const W = 64, H = 72;
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.translate(W / 2, H / 2);
    x.scale(1, H / W);
    const rim = x.createRadialGradient(0, 3, 4, 0, 0, 32);
    rim.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    rim.addColorStop(0.72, 'rgba(0, 0, 0, 0.04)');
    rim.addColorStop(0.92, 'rgba(0, 0, 0, 0.22)');
    rim.addColorStop(1, 'rgba(0, 0, 0, 0)');
    x.fillStyle = rim;
    x.beginPath();
    x.arc(0, 0, 32, 0, RAIN_TAU);
    x.fill();
    // Bright crescent along the bottom (light gathered by the lens)
    x.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    x.lineWidth = 5;
    x.lineCap = 'round';
    x.beginPath();
    x.arc(0, 0, 24, 0.18 * Math.PI, 0.82 * Math.PI);
    x.stroke();
    // Specular highlight
    x.fillStyle = 'rgba(255, 255, 255, 0.75)';
    x.beginPath();
    x.ellipse(-10, -13, 6, 4, -0.5, 0, RAIN_TAU);
    x.fill();
    return c;
  }

  // ---------- The view outside ----------
  buildBackground() {
    const M = RAIN_MOODS[this.mood];
    const { w, h, S } = this;
    const c = this.bgCtx;
    c.setTransform(this.bs, 0, 0, this.bs, 0, 0);
    c.globalCompositeOperation = 'source-over';

    const sky = c.createLinearGradient(0, 0, 0, h * 0.8);
    M.sky.forEach((col, i) => sky.addColorStop(i / (M.sky.length - 1), col));
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    const horizon = h * 0.7, street = h * 0.8;
    const lit = (p) => Math.random() < p;

    // Far skyline
    let x = -20;
    while (x < w + 20) {
      const bw = rr(30, 90) * S, bh = h * rr(0.12, 0.34);
      c.fillStyle = M.far;
      c.fillRect(x, horizon - bh, bw, bh + h * 0.12);
      for (let wy = horizon - bh + 6 * S; wy < horizon; wy += 8 * S) {
        for (let wx = x + 4 * S; wx < x + bw - 4 * S; wx += 7 * S) {
          if (lit(M.lit * 0.55)) {
            c.fillStyle = M.windows[Math.floor(Math.random() * M.windows.length)];
            c.globalAlpha = rr(0.35, 0.8);
            c.fillRect(wx, wy, 3 * S, 4 * S);
            c.globalAlpha = 1;
          }
        }
      }
      x += bw + rr(0, 10) * S;
    }

    // Near buildings
    this.towerLight = null;
    x = -30;
    while (x < w + 30) {
      const bw = rr(70, 170) * S, bh = h * rr(0.26, 0.6);
      const top = street - bh;
      c.fillStyle = M.near;
      c.fillRect(x, top, bw, bh + 4);
      if (!this.towerLight && bh > h * 0.5 && x > w * 0.1) this.towerLight = { x: x + bw / 2, y: top - 10 * S };
      for (let wy = top + 10 * S; wy < street - 8 * S; wy += 18 * S) {
        for (let wx = x + 8 * S; wx < x + bw - 10 * S; wx += 14 * S) {
          if (lit(M.lit)) {
            c.fillStyle = M.windows[Math.floor(Math.random() * M.windows.length)];
            c.globalAlpha = rr(0.55, 0.95);
            c.fillRect(wx, wy, 6 * S, 9 * S);
            c.globalAlpha = 1;
          }
        }
      }
      x += bw + rr(6, 26) * S;
    }
    if (!this.towerLight) this.towerLight = { x: w * 0.7, y: h * 0.3 };

    // Wet street
    const sg = c.createLinearGradient(0, street, 0, h);
    sg.addColorStop(0, M.street);
    sg.addColorStop(1, '#05060a');
    c.fillStyle = sg;
    c.fillRect(0, street, w, h - street);

    // Street lamps with long wet reflections
    this.lamps = [];
    const lampCount = Math.max(3, Math.round(w / (260 * S)));
    for (let i = 0; i < lampCount; i++) {
      const lx = (i + 0.5) * (w / lampCount) + rr(-30, 30) * S;
      const ly = street - 70 * S;
      this.lamps.push({ x: lx, y: ly });
      c.strokeStyle = 'rgba(10, 12, 20, 0.9)';
      c.lineWidth = 3 * S;
      c.beginPath();
      c.moveTo(lx, street + 4);
      c.lineTo(lx, ly);
      c.stroke();
      c.globalCompositeOperation = 'lighter';
      const glow = c.createRadialGradient(lx, ly, 2, lx, ly, 70 * S);
      glow.addColorStop(0, `rgba(255, 210, 150, ${0.75 * (M.room > 0.4 ? 1 : 0.6)})`);
      glow.addColorStop(1, 'rgba(255, 190, 120, 0)');
      c.fillStyle = glow;
      c.fillRect(lx - 80 * S, ly - 80 * S, 160 * S, 160 * S);
      const refl = c.createLinearGradient(0, street, 0, h);
      refl.addColorStop(0, 'rgba(255, 200, 140, 0.35)');
      refl.addColorStop(1, 'rgba(255, 200, 140, 0)');
      c.fillStyle = refl;
      c.fillRect(lx - 6 * S, street, 12 * S, h - street);
      c.globalCompositeOperation = 'source-over';
    }

    // Out-of-focus city lights (bokeh)
    c.globalCompositeOperation = 'lighter';
    const nb = Math.round(M.bokehCount * Math.max(0.6, this.area));
    for (let i = 0; i < nb; i++) {
      const bx = Math.random() * w, by = h * rr(0.3, 0.95);
      const r = rr(8, 34) * S;
      const col = M.bokeh[Math.floor(Math.random() * M.bokeh.length)];
      const a = rr(0.1, 0.3);
      const g = c.createRadialGradient(bx, by, r * 0.55, bx, by, r);
      g.addColorStop(0, `rgba(${col}, ${a})`);
      g.addColorStop(0.85, `rgba(${col}, ${a * 0.8})`);
      g.addColorStop(1, `rgba(${col}, 0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(bx, by, r, 0, RAIN_TAU);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';

    // Heavily blurred copy for the fogged glass (downsample twice)
    this.midCtx.drawImage(this.bg, 0, 0, this.mid.width, this.mid.height);
    this.blurCtx.drawImage(this.mid, 0, 0, this.blur.width, this.blur.height);
  }

  // ---------- Rain ----------
  spawnDrop(x = Math.random() * this.w, y = Math.random() * this.glassBottom * 0.96, r = null) {
    const S = this.S;
    this.drops.push({
      x, y,
      r: r ?? (Math.pow(Math.random(), 1.7) * 8 + 2) * S * this.dropScale,
      vy: 0, sliding: false, stall: 0, trail: 0, seed: Math.random() * 10, dead: false
    });
    const cap = (this.preview ? 70 : 240) * Math.max(0.5, this.area);
    if (this.drops.length > cap) {
      const i = this.drops.findIndex(d => !d.sliding);
      if (i >= 0) this.drops.splice(i, 1);
    }
  }

  spawnBead(x = Math.random() * this.w, y = Math.random() * this.glassBottom, r = null) {
    this.beads.push({ x, y, r: r ?? (0.5 + Math.random() * 1.6) * this.S, dead: false });
    const cap = (this.preview ? 500 : 1500) * Math.max(0.5, this.area);
    if (this.beads.length > cap) this.beads.splice(0, this.beads.length - cap);
  }

  /** Clear a soft circle of fog (in CSS px). */
  clearFog(x, y, r, strength = 1) {
    const c = this.fogMaskCtx, fs = this.fs;
    c.globalCompositeOperation = 'destination-out';
    const g = c.createRadialGradient(x * fs, y * fs, 0, x * fs, y * fs, r * fs);
    g.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
    g.addColorStop(0.6, `rgba(0, 0, 0, ${strength * 0.85})`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(x * fs, y * fs, r * fs, 0, RAIN_TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }

  /** Wipe the glass along a stroke: clears fog and smears away drops. Returns stroke length. */
  wipe(x0, y0, x1, y1, radius = 34) {
    const R = radius * this.S;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / (R * 0.3)));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      this.clearFog(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, R, 1);
    }
    const segD = (px, py) => {
      const dx = x1 - x0, dy = y1 - y0;
      const L2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L2));
      return Math.hypot(px - (x0 + dx * u), py - (y0 + dy * u));
    };
    for (const d of this.drops) if (segD(d.x, d.y) < R * 0.85) d.dead = true;
    for (const b of this.beads) if (segD(b.x, b.y) < R * 0.9) b.dead = true;
    // A few beads left behind at the edge of the stroke, like a real finger mark
    if (len > 2 && Math.random() < 0.5) {
      const a = Math.random() * RAIN_TAU;
      this.spawnBead(x1 + Math.cos(a) * R, y1 + Math.sin(a) * R, rr(0.5, 1.4) * this.S);
    }
    this.drops = this.drops.filter(d => !d.dead);
    this.beads = this.beads.filter(b => !b.dead);
    return len;
  }

  /** Wipe a vertical band (the squeegee). */
  wipeBand(x0, x1) {
    const c = this.fogMaskCtx, fs = this.fs;
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = 'rgba(0, 0, 0, 1)';
    c.fillRect(Math.min(x0, x1) * fs, 0, Math.abs(x1 - x0) * fs + 1, this.fogMask.height);
    c.globalCompositeOperation = 'source-over';
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    this.drops = this.drops.filter(d => d.x < lo || d.x > hi);
    this.beads = this.beads.filter(b => b.x < lo || b.x > hi);
  }

  update(dt) {
    this.t += dt;
    const L = RAIN_LEVELS[this.level];
    const M = RAIN_MOODS[this.mood];
    const S = this.S;

    // Fog slowly returns
    const regrow = this.preview ? 0.22 : 0.1;
    // Tiny per-frame amounts round to nothing in an 8-bit canvas, so let the
    // mist build up and lay it down in steps the canvas can actually store
    this.fogAcc = (this.fogAcc || 0) + (1 - Math.exp(-regrow * dt));
    if (this.fogAcc >= 0.03) {
      const c = this.fogMaskCtx;
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = `rgba(0, 0, 0, ${this.fogAcc.toFixed(4)})`;
      c.fillRect(0, 0, this.fogMask.width, this.fogMask.height);
      this.fogAcc = 0;
    }

    // New rain
    const scale = Math.max(0.4, this.area) * (this.preview ? 0.8 : 1);
    this.dropAcc += L.drops * scale * dt;
    while (this.dropAcc >= 1) { this.dropAcc--; this.spawnDrop(); }
    this.beadAcc += L.beads * scale * dt;
    while (this.beadAcc >= 1) { this.beadAcc--; this.spawnBead(); }

    // Lightning in a storm
    if (M.lightning && this.t > this.nextStrike) {
      this.nextStrike = this.t + rr(7, 18);
      this.flash = rr(0.7, 1);
      this.flashT = 0;
      if (this.onLightning) this.onLightning(this.flash);
    }
    if (this.flash > 0) {
      this.flashT += dt;
      const flicker = this.flashT < 0.08 ? 1 : this.flashT < 0.14 ? 0.3 : this.flashT < 0.22 ? 0.85 : 1;
      this.flash = Math.max(0, this.flash - dt * 1.6);
      this.flashNow = this.flash * flicker;
    } else {
      this.flashNow = 0;
    }

    // Cars on the street
    this.carTimer -= dt;
    if (this.carTimer <= 0) {
      this.carTimer = rr(1.2, 4) * (this.preview ? 1.4 : 1);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.cars.push({ x: dir > 0 ? -60 : this.w + 60, y: this.h * rr(0.83, 0.9), dir, v: rr(60, 140) * S });
    }
    this.cars.forEach(car => { car.x += car.dir * car.v * dt; });
    this.cars = this.cars.filter(car => car.x > -100 && car.x < this.w + 100);

    // Drops: slide, stall, merge, leave beads and clear trails
    const cell = 48 * S;
    const grid = new Map();
    const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    const add = (o, kind) => {
      const k = key(o.x, o.y);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push([o, kind]);
    };
    this.drops.forEach(d => add(d, 0));
    this.beads.forEach(b => add(b, 1));

    for (const d of this.drops) {
      if (d.dead) continue;
      if (!d.sliding) {
        if (d.r > 4.2 * S * this.dropScale && Math.random() < dt * (d.r / (6 * S)) * 0.3) d.sliding = true;
        else continue;
      }
      if (d.stall > 0) {
        d.stall -= dt;
        d.vy *= Math.exp(-10 * dt);
      } else {
        const target = (55 + (d.r / S) * 20) * S;
        d.vy += (target - d.vy) * Math.min(1, dt * 3);
        if (Math.random() < dt * 0.7) d.stall = Math.random() * 0.45;
      }
      const dy = d.vy * dt;
      d.y += dy;
      d.x += (Math.sin(this.t * 2.1 + d.seed) * 0.12 + (Math.random() - 0.5) * 0.25) * S;
      d.trail += dy;
      if (d.trail > d.r * 1.3) {
        d.trail = 0;
        if (Math.random() < 0.85) this.beads.push({ x: d.x + (Math.random() - 0.5) * d.r * 0.3, y: d.y - d.r * 1.2, r: d.r * rr(0.18, 0.34), dead: false });
        d.r *= 0.986;
      }
      this.clearFog(d.x, d.y, d.r * 0.75 / this.dropScale, 0.06 / (this.dropScale * this.dropScale));
      if (d.r < 2.6 * S * this.dropScale) d.sliding = false;

      // Merge with whatever is in the way
      const cx = Math.floor(d.x / cell), cy = Math.floor(d.y / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const list = grid.get(`${gx},${gy}`);
          if (!list) continue;
          for (const [o, kind] of list) {
            if (o === d || o.dead) continue;
            const dist = Math.hypot(o.x - d.x, o.y - d.y);
            if (kind === 1) {
              if (dist < d.r) { o.dead = true; d.r = Math.min(13 * S * this.dropScale, d.r + o.r * 0.06); }
            } else if (dist < d.r + o.r * 0.7) {
              d.r = Math.min(13 * S * this.dropScale, Math.sqrt(d.r * d.r + o.r * o.r));
              o.dead = true;
            }
          }
        }
      }

      if (d.y - d.r > this.glassBottom) {
        d.dead = true;
        if (this.onDrip) this.onDrip(d.x, d.r / S);
      }
    }
    this.drops = this.drops.filter(d => !d.dead);
    this.beads = this.beads.filter(b => !b.dead);
  }

  // ---------- Drawing ----------
  drawLights(c, scale, blurry) {
    // Cars: warm headlights one way, red tail lights the other, smeared reflections
    const S = this.S * scale;
    c.globalCompositeOperation = 'lighter';
    for (const car of this.cars) {
      const col = car.dir > 0 ? '255, 236, 200' : '255, 70, 60';
      const x = car.x * scale, y = car.y * scale;
      const r = (blurry ? 26 : 9) * S;
      for (const off of [-9, 9]) {
        const g = c.createRadialGradient(x + off * S, y, 0, x + off * S, y, r);
        g.addColorStop(0, `rgba(${col}, ${blurry ? 0.35 : 0.9})`);
        g.addColorStop(1, `rgba(${col}, 0)`);
        c.fillStyle = g;
        c.fillRect(x + off * S - r, y - r, r * 2, r * 2);
      }
      const refl = c.createLinearGradient(0, y, 0, y + 60 * S);
      refl.addColorStop(0, `rgba(${col}, 0.25)`);
      refl.addColorStop(1, `rgba(${col}, 0)`);
      c.fillStyle = refl;
      c.fillRect(x - 12 * S, y, 24 * S, 60 * S);
    }
    // Blinking aircraft-warning light
    const tl = this.towerLight;
    if (tl && Math.sin(this.t * 2.4) > 0.6) {
      const x = tl.x * scale, y = tl.y * scale, r = (blurry ? 22 : 8) * S;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255, 60, 60, 0.9)');
      g.addColorStop(1, 'rgba(255, 60, 60, 0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over';
  }

  drawFogLayer() {
    const M = RAIN_MOODS[this.mood];
    const c = this.fogLayerCtx, fw = this.fogLayer.width, fh = this.fogLayer.height;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, fw, fh);
    c.drawImage(this.blur, 0, 0, fw, fh);
    this.drawLights(c, this.fs, true);
    c.fillStyle = `rgba(${M.fog}, ${M.fogTint})`;
    c.fillRect(0, 0, fw, fh);
    if (this.flashNow > 0) {
      c.fillStyle = `rgba(230, 235, 255, ${this.flashNow * 0.5})`;
      c.fillRect(0, 0, fw, fh);
    }
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(this.fogMask, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  drawDrop(c, d) {
    const { bs } = this;
    const k = 9; // how much of the view each lens gathers
    const R = d.r * k;
    const sw = Math.min(this.bg.width - 1, 2 * R * bs);
    const sx = Math.max(0, Math.min(this.bg.width - sw, (d.x - R) * bs));
    // Lenses gather light from slightly below, where the city glows
    const sy = Math.max(0, Math.min(this.bg.height - sw, (d.y - R * 0.4) * bs));
    c.save();
    c.beginPath();
    c.ellipse(d.x, d.y, d.r, d.r * 1.12, 0, 0, RAIN_TAU);
    c.clip();
    c.translate(d.x, d.y);
    c.scale(1, -1); // a lens shows the world upside down
    c.drawImage(this.bg, sx, sy, sw, sw, -d.r * 1.15, -d.r * 1.25, d.r * 2.3, d.r * 2.5);
    c.globalCompositeOperation = 'screen';
    c.fillStyle = `rgba(${RAIN_MOODS[this.mood].fog}, 0.16)`; // a little room light caught in the water
    c.fillRect(-d.r * 1.2, -d.r * 1.3, d.r * 2.4, d.r * 2.6);
    c.restore();
    c.drawImage(this.sprite, d.x - d.r, d.y - d.r * 1.12, d.r * 2, d.r * 2.24);
  }

  drawRoom(c) {
    const M = RAIN_MOODS[this.mood];
    const { w, h, S } = this;
    const top = this.glassBottom;
    const s = this.preview ? S * 0.8 : S;

    // Frame edges
    const frame = 10 * s;
    c.fillStyle = '#2a1d16';
    c.fillRect(0, 0, frame, top);
    c.fillRect(w - frame, 0, frame, top);
    const inner = c.createLinearGradient(0, 0, frame * 3, 0);
    inner.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    inner.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = inner;
    c.fillRect(frame, 0, frame * 3, top);
    c.save();
    c.translate(w, 0);
    c.scale(-1, 1);
    c.fillRect(frame, 0, frame * 3, top);
    c.restore();

    // Sill
    const sill = c.createLinearGradient(0, top, 0, h);
    sill.addColorStop(0, '#6b4a33');
    sill.addColorStop(0.12, '#5a3d29');
    sill.addColorStop(1, '#2b1c13');
    c.fillStyle = sill;
    c.fillRect(0, top, w, h - top);
    c.fillStyle = 'rgba(255, 220, 180, 0.18)';
    c.fillRect(0, top, w, 2 * s);
    // Warm room light falling on the sill
    const lamp = c.createRadialGradient(w * 0.7, h + 40 * s, 10, w * 0.7, h, w * 0.6);
    lamp.addColorStop(0, `rgba(255, 190, 120, ${0.35 * M.room})`);
    lamp.addColorStop(1, 'rgba(255, 190, 120, 0)');
    c.fillStyle = lamp;
    c.fillRect(0, top, w, h - top);

    // A little succulent
    const px = w * 0.13, base = top + 6 * s;
    c.fillStyle = '#b4613f';
    c.beginPath();
    c.moveTo(px - 22 * s, base - 30 * s);
    c.lineTo(px + 22 * s, base - 30 * s);
    c.lineTo(px + 17 * s, base);
    c.lineTo(px - 17 * s, base);
    c.closePath();
    c.fill();
    c.fillStyle = '#9c5235';
    c.fillRect(px - 24 * s, base - 34 * s, 48 * s, 7 * s);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.34;
      c.save();
      c.translate(px, base - 34 * s);
      c.rotate(a + Math.PI / 2);
      c.fillStyle = i % 2 ? '#7fae86' : '#6a9a73';
      c.beginPath();
      c.ellipse(0, -14 * s, 6 * s, 15 * s, 0, 0, RAIN_TAU);
      c.fill();
      c.restore();
    }

    // A mug of something warm
    const mx = w * 0.82, my = top + 8 * s;
    c.fillStyle = '#efe6da';
    c.beginPath();
    c.moveTo(mx - 20 * s, my - 44 * s);
    c.lineTo(mx + 20 * s, my - 44 * s);
    c.quadraticCurveTo(mx + 21 * s, my, mx + 14 * s, my);
    c.lineTo(mx - 14 * s, my);
    c.quadraticCurveTo(mx - 21 * s, my, mx - 20 * s, my - 44 * s);
    c.fill();
    c.strokeStyle = '#efe6da';
    c.lineWidth = 5 * s;
    c.beginPath();
    c.ellipse(mx + 22 * s, my - 24 * s, 9 * s, 11 * s, 0, -Math.PI / 2, Math.PI / 2);
    c.stroke();
    c.fillStyle = '#6b4329';
    c.beginPath();
    c.ellipse(mx, my - 44 * s, 19 * s, 4 * s, 0, 0, RAIN_TAU);
    c.fill();
    c.fillStyle = 'rgba(0, 0, 0, 0.12)';
    c.fillRect(mx + 4 * s, my - 42 * s, 15 * s, 40 * s);

    // Steam
    c.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    c.lineWidth = 3 * s;
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = this.t * 0.8 + i * 2.1;
      const sx = mx + (i - 1) * 8 * s;
      c.beginPath();
      c.moveTo(sx, my - 50 * s);
      for (let k = 1; k <= 6; k++) {
        c.lineTo(sx + Math.sin(ph + k * 0.9) * 6 * s * (k / 6), my - 50 * s - k * 10 * s);
      }
      c.globalAlpha = 0.6 + Math.sin(ph) * 0.3;
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  draw() {
    const c = this.ctx, { w, h } = this;
    c.clearRect(0, 0, w, h);

    // The view through clear glass
    c.drawImage(this.bg, 0, 0, w, h);
    this.drawLights(c, 1, false);
    if (this.flashNow > 0) {
      c.fillStyle = `rgba(225, 232, 255, ${this.flashNow * 0.35})`;
      c.fillRect(0, 0, w, h);
    }

    // Fog
    this.drawFogLayer();
    c.drawImage(this.fogLayer, 0, 0, w, h);

    // Beads and drops (only on the glass)
    c.save();
    c.beginPath();
    c.rect(0, 0, w, this.glassBottom);
    c.clip();
    c.globalAlpha = 0.85;
    for (const b of this.beads) c.drawImage(this.sprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2.2);
    c.globalAlpha = 1;
    for (const d of this.drops) this.drawDrop(c, d);
    c.restore();

    this.drawRoom(c);
    this.drawVignette(c);
  }

  drawVignette(c) {
    const { w, h } = this;
    const vg = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
  }

  // ---------- Layers for the WebGL renderer (glass-gl.js) ----------

  /** The view outside (city + moving lights), drawn at `scale` of CSS size. */
  drawSceneLayer(c, scale, blurry = false) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.drawImage(blurry ? this.mid : this.bg, 0, 0, this.w * scale, this.h * scale);
    this.drawLights(c, scale, blurry);
  }

  /** One sprite encoding a drop's surface: R,G = normal, B = thickness, A = coverage. */
  makeNormalSprite() {
    const N = 64, c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    const img = x.createImageData(N, N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const dx = (i + 0.5) / N * 2 - 1, dy = (j + 0.5) / N * 2 - 1;
        const r2 = dx * dx + dy * dy, k = (j * N + i) * 4;
        if (r2 >= 1) { img.data[k + 3] = 0; continue; }
        const z = Math.sqrt(1 - r2);
        img.data[k] = Math.round((dx * 0.5 + 0.5) * 255);
        img.data[k + 1] = Math.round((dy * 0.5 + 0.5) * 255);
        img.data[k + 2] = Math.round(z * 255);
        img.data[k + 3] = Math.round(Math.min(1, (1 - r2) * 5) * 255);
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  /** Draw every bead and drop into a water map at `scale` of CSS size. */
  drawWaterMap(c, scale) {
    if (!this.normalSprite) this.normalSprite = this.makeNormalSprite();
    const sp = this.normalSprite, gb = this.glassBottom;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    for (const b of this.beads) {
      if (b.y > gb) continue;
      c.drawImage(sp, (b.x - b.r) * scale, (b.y - b.r * 1.1) * scale, b.r * 2 * scale, b.r * 2.2 * scale);
    }
    for (const d of this.drops) {
      if (d.y > gb) continue;
      c.drawImage(sp, (d.x - d.r) * scale, (d.y - d.r * 1.12) * scale, d.r * 2 * scale, d.r * 2.24 * scale);
    }
  }

  /** The room in front of the glass, on a transparent overlay. */
  drawOverlay(c) {
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    this.drawRoom(c);
    this.drawVignette(c);
  }
}

window.RainWorld = RainWorld;
window.RAIN_MOODS = RAIN_MOODS;
window.RAIN_LEVELS = RAIN_LEVELS;
