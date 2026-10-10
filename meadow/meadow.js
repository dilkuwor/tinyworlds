/**
 * meadow.js - Night Meadow
 *
 * Tall grass under a starry sky, a pond holding the moon, and fireflies.
 * Each firefly blinks on its own clock; when one flashes, its neighbours'
 * clocks are nudged forward a little (pulse-coupled oscillators), so over a
 * minute or two the whole meadow drifts into blinking together, the way real
 * synchronous fireflies do. Hold the pointer still and they gather around it;
 * click to call them like a lantern; sudden movement scatters them.
 *
 * Used full-screen by scene.js and as a live preview on the homepage.
 */

const MEADOW_MOODS = {
  dusk: {
    label: 'Dusk', icon: '🌆',
    sky: ['#161c42', '#353668', '#74567f', '#cf8a78'], stars: 70, starAlpha: 0.6,
    moon: { x: 0.18, y: 0.3, r: 0.022, halo: 0.18 }, milky: false,
    trees: '#141a33', grass: ['#2c3552', '#1a2133', '#0c1018'], floor: ['#353d5a', '#151a28'], pond: ['#4b4e7a', '#232848'],
    fog: 0, firefly: '255, 214, 120'
  },
  night: {
    label: 'Night', icon: '🌙',
    sky: ['#02040d', '#081130', '#131e48', '#1f2c58'], stars: 280, starAlpha: 1,
    moon: { x: 0.78, y: 0.18, r: 0.03, halo: 0.32 }, milky: true,
    trees: '#060a16', grass: ['#0d1824', '#08111a', '#03070b'], floor: ['#1a2a3c', '#0a121b'], pond: ['#1b2650', '#0a1028'],
    fog: 0, firefly: '214, 255, 140'
  },
  mist: {
    label: 'Misty', icon: '🌫️',
    sky: ['#0b1220', '#17233a', '#2c3b53', '#4a5a72'], stars: 90, starAlpha: 0.45,
    moon: { x: 0.66, y: 0.22, r: 0.028, halo: 0.45 }, milky: false,
    trees: '#141d2c', grass: ['#1c2836', '#121b26', '#080e15'], floor: ['#2d3b4e', '#141d29'], pond: ['#3a4a64', '#1c263a'],
    fog: 1, firefly: '230, 255, 170'
  }
};

const MTAU = Math.PI * 2;
const mrand = (a, b) => a + Math.random() * (b - a);
const mclamp = (v, a, b) => Math.max(a, Math.min(b, v));

class MeadowWorld {
  constructor(canvas, { preview = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = preview;
    const hr = new Date().getHours();
    this.mood = hr >= 17 && hr < 21 ? 'dusk' : hr >= 4 && hr < 8 ? 'mist' : 'night';
    this.t = 0;
    this.flies = [];
    this.attractor = null;  // { x, y, strength }
    this.call = null;       // lantern call { x, y, t, dur }
    this.scatterAt = null;
    this.sync = 0.15;       // coupling builds while the meadow is left in peace
    this.harmony = 0;       // measured synchrony 0 … 1
    this.shooting = null;
    this.nextShooting = mrand(6, 14);
    this.onShootingStar = null;
    this.glow = this.makeGlowSprite();
  }

  makeGlowSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.12, 'rgba(255, 255, 255, 0.9)');
    g.addColorStop(0.35, 'rgba(255, 255, 255, 0.28)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  }

  /** Tint the glow sprite for the current mood (cached per colour). */
  tintedGlow() {
    const col = MEADOW_MOODS[this.mood].firefly;
    if (this._glowCol === col) return this._glowTinted;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.drawImage(this.glow, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = `rgb(${col})`;
    x.fillRect(0, 0, 64, 64);
    this._glowCol = col;
    this._glowTinted = c;
    return c;
  }

  // ---------- Layout ----------
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    const S = this.S = mclamp(Math.min(w, h) / 700, 0.55, 1.5);
    this.horizon = h * (this.preview ? 0.55 : 0.56);
    this.pond = { x: w * 0.7, y: this.horizon + (h - this.horizon) * 0.24, rx: Math.min(w * 0.2, 340 * S), ry: 22 * S };

    // Stars (denser and brighter high up)
    this.stars = Array.from({ length: 320 }, () => {
      const v = Math.pow(Math.random(), 1.4);
      return { x: Math.random() * w, y: v * this.horizon * 0.95, r: Math.random() < 0.06 ? 1.5 : mrand(0.4, 1.1), tw: Math.random() * 10, sp: mrand(0.5, 2) };
    });
    this.milky = Array.from({ length: 220 }, () => {
      const u = Math.random();
      return { x: u * w, y: this.horizon * (0.95 - u * 0.75) + mrand(-40, 40) * S, r: mrand(0.3, 0.8) };
    });

    // Treeline silhouette
    this.trees = [];
    for (let x = -20; x < w + 40; x += mrand(14, 30) * S) {
      this.trees.push({ x, h: mrand(18, 58) * S * (Math.random() < 0.15 ? 1.5 : 1), r: mrand(12, 26) * S });
    }

    // Grass in three depth bands
    const band = (count, baseY, spread, hMin, hMax, wid) => Array.from({ length: count }, () => ({
      x: Math.random() * w, y: baseY + Math.random() * spread, h: mrand(hMin, hMax) * S, ph: Math.random() * MTAU, w: wid * S, lean: mrand(-0.25, 0.25)
    })).sort((a, b) => a.y - b.y);
    const k = this.preview ? 0.5 : 1;
    this.grassFar = band(Math.round(w / 3 * k), this.horizon + 2 * S, (h - this.horizon) * 0.14, 8, 20, 1);
    this.grassMid = band(Math.round(w / 3.5 * k), this.horizon + (h - this.horizon) * 0.42, (h - this.horizon) * 0.2, 30, 70, 1.6);
    this.grassFront = band(Math.round(w / 7 * k), h - (h - this.horizon) * 0.06, (h - this.horizon) * 0.08, 45, 105, 2.4);
    this.flowers = Array.from({ length: Math.round(w / (50 * S) * k) }, () => {
      const blade = this.grassMid[Math.floor(Math.random() * this.grassMid.length)];
      return { blade, r: mrand(1.4, 2.6) * S, c: ['rgba(220, 225, 245, 0.28)', 'rgba(200, 180, 240, 0.25)', 'rgba(240, 230, 200, 0.25)'][Math.floor(Math.random() * 3)] };
    });

    // Fireflies
    const n = Math.round(mclamp((w * h) / 16000, 30, 110) * (this.preview ? 0.6 : 1));
    if (this.flies.length !== n) {
      this.flies = Array.from({ length: n }, () => this.makeFly());
    } else {
      this.flies.forEach(f => { f.x = Math.min(f.x, w); f.y = mclamp(f.y, this.horizon + 10, h - 10); });
    }
    this.fogBands = Array.from({ length: 5 }, (_, i) => ({ y: this.horizon + (h - this.horizon) * (0.05 + i * 0.18), x: Math.random() * w, s: mrand(0.8, 1.4), v: mrand(6, 14) }));
  }

  makeFly() {
    const x = Math.random() * this.w, y = mrand(this.horizon + 14, this.h * 0.94);
    return {
      x, y, vx: 0, vy: 0, tx: x, ty: y, wander: mrand(1, 5),
      phase: Math.random(), period: 2, basePeriod: mrand(1.88, 2.04), bright: 0,
      orbit: Math.random() * MTAU, orbitR: mrand(30, 110), spin: Math.random() < 0.5 ? 1 : -1
    };
  }

  setMood(m) {
    if (MEADOW_MOODS[m]) this.mood = m;
  }

  // ---------- Interaction ----------
  /** Steady pointer: fireflies drift over and circle it. */
  setAttractor(x, y, strength) {
    this.attractor = strength > 0 ? { x, y, strength } : null;
  }

  /** Raise a lantern: every firefly comes for a little while. */
  callAt(x, y) {
    this.call = { x, y, t: 0, dur: 7 };
  }

  /** Sudden movement: nearby fireflies dart away and the rhythm loosens. */
  scatter(x, y) {
    const R = 220 * this.S;
    for (const f of this.flies) {
      const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy);
      if (d < R) {
        const k = (1 - d / R) * 240 * this.S;
        f.vx += (dx / (d || 1)) * k;
        f.vy += (dy / (d || 1)) * k;
        f.phase = Math.random();
      }
    }
    this.sync = Math.max(0.1, this.sync - 0.2);
  }

  /** How many fireflies are near a point (for the stats). */
  gatheredNear(x, y, r = 140) {
    return this.flies.filter(f => Math.hypot(f.x - x, f.y - y) < r * this.S).length;
  }

  // ---------- Simulation ----------
  update(dt) {
    this.t += dt;
    const S = this.S, w = this.w, h = this.h;

    // Calm builds coupling; the meadow slowly finds its rhythm
    this.sync = Math.min(1, this.sync + dt / (this.preview ? 40 : 75));
    const eps = 0.012 + 0.085 * this.sync;

    if (this.call) {
      this.call.t += dt;
      if (this.call.t > this.call.dur) this.call = null;
    }
    const pull = this.call
      ? { x: this.call.x, y: this.call.y, strength: 1, range: Infinity }
      : this.attractor ? { ...this.attractor, range: 320 * S } : null;

    const flashed = [];
    for (const f of this.flies) {
      // Wander toward a slowly changing spot in the meadow
      f.wander -= dt;
      if (f.wander <= 0) {
        f.wander = mrand(2, 6);
        f.tx = mclamp(f.x + mrand(-160, 160) * S, 0, w);
        f.ty = mclamp(f.y + mrand(-70, 70) * S, this.horizon + 12, h * 0.95);
      }
      let tx = f.tx, ty = f.ty, k = 0.5;

      if (pull) {
        const d = Math.hypot(pull.x - f.x, pull.y - f.y);
        if (d < pull.range) {
          f.orbit += dt * f.spin * (0.6 + 40 / (f.orbitR + 20));
          const r = f.orbitR * S * (this.call ? 0.9 : 0.75);
          tx = pull.x + Math.cos(f.orbit) * r;
          ty = pull.y + Math.sin(f.orbit) * r * 0.6;
          k = 1.6 * pull.strength;
        }
      }

      f.vx += (tx - f.x) * k * dt + mrand(-1, 1) * 18 * S * dt;
      f.vy += (ty - f.y) * k * dt + mrand(-1, 1) * 14 * S * dt + Math.sin(this.t * 2 + f.orbit) * 4 * S * dt;
      const damp = Math.exp(-1.6 * dt);
      f.vx *= damp; f.vy *= damp;
      const sp = Math.hypot(f.vx, f.vy), max = (pull ? 150 : 60) * S;
      if (sp > max) { f.vx *= max / sp; f.vy *= max / sp; }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.y = mclamp(f.y, this.horizon - 40 * S, h * 0.97);

      // Blink clock
      f.phase += dt / f.period;
      if (f.phase >= 1) {
        f.phase -= 1;
        f.period = f.basePeriod * mrand(0.975, 1.025); // no two blinks quite the same
        flashed.push(f);
      }
    }

    // Each flash nudges nearby clocks forward: the source of synchrony
    const R = 360 * S;
    for (const f of flashed) {
      for (const o of this.flies) {
        if (o === f) continue;
        if (Math.abs(o.x - f.x) > R || Math.abs(o.y - f.y) > R) continue;
        o.phase = Math.min(0.999, o.phase + eps * (0.4 + o.phase));
      }
    }

    // Measured harmony (Kuramoto order parameter)
    let cx = 0, cy = 0;
    for (const f of this.flies) { cx += Math.cos(f.phase * MTAU); cy += Math.sin(f.phase * MTAU); }
    const r = Math.hypot(cx, cy) / (this.flies.length || 1);
    this.harmony += (r - this.harmony) * Math.min(1, dt * 2);

    // Shooting stars
    this.nextShooting -= dt;
    if (this.nextShooting <= 0 && !this.shooting) {
      this.nextShooting = mrand(14, 34);
      this.shooting = { x: mrand(0.35, 1) * w, y: mrand(0.05, 0.35) * this.horizon, t: 0, dur: 0.9 };
      if (this.onShootingStar) this.onShootingStar();
    }
    if (this.shooting) {
      this.shooting.t += dt;
      if (this.shooting.t > this.shooting.dur) this.shooting = null;
    }
  }

  brightness(f) {
    // A quick bright flash at the start of each cycle, then dark
    const u = f.phase;
    return u < 0.3 ? Math.pow(1 - u / 0.3, 1.4) : 0;
  }

  // ---------- Drawing ----------
  drawSky(c) {
    const M = MEADOW_MOODS[this.mood];
    const { w, h, S } = this;
    const sky = c.createLinearGradient(0, 0, 0, this.horizon);
    M.sky.forEach((col, i) => sky.addColorStop(i / (M.sky.length - 1), col));
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    // Milky Way
    if (M.milky) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const band = c.createLinearGradient(0, this.horizon, w, 0);
      band.addColorStop(0, 'rgba(160, 170, 220, 0)');
      band.addColorStop(0.45, 'rgba(170, 175, 230, 0.07)');
      band.addColorStop(0.55, 'rgba(200, 190, 240, 0.09)');
      band.addColorStop(1, 'rgba(160, 170, 220, 0)');
      c.fillStyle = band;
      c.fillRect(0, 0, w, this.horizon);
      c.fillStyle = 'rgba(220, 225, 255, 0.5)';
      for (const m of this.milky) {
        c.fillRect(m.x, m.y, m.r, m.r);
      }
      c.restore();
    }

    // Stars
    const count = Math.min(this.stars.length, M.stars);
    for (let i = 0; i < count; i++) {
      const st = this.stars[i];
      const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * st.sp + st.tw))) * M.starAlpha * (1 - st.y / this.horizon * 0.6);
      c.fillStyle = `rgba(255, 250, 235, ${a.toFixed(3)})`;
      c.beginPath();
      c.arc(st.x, st.y, st.r, 0, MTAU);
      c.fill();
    }

    // Moon
    const mo = M.moon, mx = w * mo.x, my = this.horizon * mo.y * 1.6, mr = Math.max(14, Math.min(w, h) * mo.r);
    const halo = c.createRadialGradient(mx, my, mr, mx, my, mr * 9);
    halo.addColorStop(0, `rgba(230, 236, 255, ${mo.halo})`);
    halo.addColorStop(1, 'rgba(230, 236, 255, 0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, w, this.horizon);
    c.fillStyle = '#f3f0e3';
    c.beginPath();
    c.arc(mx, my, mr, 0, MTAU);
    c.fill();
    c.fillStyle = 'rgba(180, 175, 160, 0.25)';
    c.beginPath();
    c.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, MTAU);
    c.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.15, 0, MTAU);
    c.fill();
    this.moonPos = { x: mx, y: my, r: mr };

    // Shooting star: a bright head sliding down-left with a fading tail
    if (this.shooting) {
      const st = this.shooting, u = st.t / st.dur;
      const dx = -0.88, dy = 0.47, travel = 420 * S, len = 150 * S;
      const hx = st.x + dx * u * travel, hy = st.y + dy * u * travel;
      const g = c.createLinearGradient(hx, hy, hx - dx * len, hy - dy * len);
      g.addColorStop(0, `rgba(255, 255, 255, ${((1 - u) * 0.9).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      c.strokeStyle = g;
      c.lineWidth = 1.6 * S;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(hx, hy);
      c.lineTo(hx - dx * len, hy - dy * len);
      c.stroke();
    }

    // Horizon glow
    const hg = c.createLinearGradient(0, this.horizon - 80 * S, 0, this.horizon + 10);
    hg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    hg.addColorStop(1, this.mood === 'dusk' ? 'rgba(240, 150, 120, 0.25)' : 'rgba(120, 140, 200, 0.12)');
    c.fillStyle = hg;
    c.fillRect(0, this.horizon - 80 * S, w, 90 * S);
  }

  drawTreeline(c) {
    const M = MEADOW_MOODS[this.mood];
    c.fillStyle = M.trees;
    c.beginPath();
    c.moveTo(0, this.horizon + 6);
    for (const t of this.trees) {
      c.lineTo(t.x - t.r, this.horizon - t.h * 0.4);
      c.quadraticCurveTo(t.x, this.horizon - t.h - t.r * 0.6, t.x + t.r, this.horizon - t.h * 0.4);
    }
    c.lineTo(this.w, this.horizon + 6);
    c.closePath();
    c.fill();
    c.fillRect(0, this.horizon, this.w, this.h - this.horizon);
  }

  windAt(x) {
    return Math.sin(this.t * 0.9 + x * 0.006) * 0.12 + Math.sin(this.t * 0.37 + x * 0.002) * 0.1;
  }

  drawGrass(c, blades, color, edge) {
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.beginPath();
    for (const b of blades) {
      if (b.x > this.w + 20) continue;
      const sway = (this.windAt(b.x) + b.lean) * b.h + Math.sin(this.t * 1.6 + b.ph) * 2 * this.S;
      c.moveTo(b.x, b.y);
      c.quadraticCurveTo(b.x + sway * 0.3, b.y - b.h * 0.55, b.x + sway, b.y - b.h);
    }
    c.lineWidth = blades[0] ? blades[0].w : 1;
    c.stroke();
    if (edge) {
      // Moonlit tips
      c.strokeStyle = edge;
      c.lineWidth = (blades[0] ? blades[0].w : 1) * 0.5;
      c.beginPath();
      for (const b of blades) {
        const sway = (this.windAt(b.x) + b.lean) * b.h + Math.sin(this.t * 1.6 + b.ph) * 2 * this.S;
        c.moveTo(b.x + sway * 0.7, b.y - b.h * 0.8);
        c.lineTo(b.x + sway, b.y - b.h);
      }
      c.stroke();
    }
  }

  drawFlowers(c) {
    for (const f of this.flowers) {
      c.fillStyle = f.c;
      const b = f.blade;
      const sway = (this.windAt(b.x) + b.lean) * b.h;
      c.beginPath();
      c.arc(b.x + sway, b.y - b.h, f.r, 0, MTAU);
      c.fill();
    }
  }

  drawPond(c) {
    const M = MEADOW_MOODS[this.mood];
    const P = this.pond;
    c.save();
    c.beginPath();
    c.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, MTAU);
    c.clip();
    const g = c.createLinearGradient(0, P.y - P.ry, 0, P.y + P.ry);
    g.addColorStop(0, M.pond[0]);
    g.addColorStop(1, M.pond[1]);
    c.fillStyle = g;
    c.fillRect(P.x - P.rx, P.y - P.ry, P.rx * 2, P.ry * 2);
    // Moon reflection: a wavering column of light
    if (this.moonPos) {
      const mx = this.moonPos.x;
      if (Math.abs(mx - P.x) < P.rx) {
        for (let i = 0; i < 7; i++) {
          const y = P.y - P.ry + (i + 0.5) * (P.ry * 2 / 7);
          const wob = Math.sin(this.t * 2 + i) * 4 * this.S;
          c.fillStyle = `rgba(240, 240, 225, ${0.35 - i * 0.03})`;
          c.fillRect(mx - (10 - i) * this.S + wob, y, (20 - i * 2) * this.S, 1.6 * this.S);
        }
      }
    }
    // Firefly reflections
    c.globalCompositeOperation = 'lighter';
    const sprite = this.tintedGlow();
    for (const f of this.flies) {
      const b = this.brightness(f);
      if (b < 0.05 || Math.abs(f.x - P.x) > P.rx) continue;
      const ry = P.y + (P.y - f.y) * 0.25;
      const s = 18 * this.S;
      c.globalAlpha = b * 0.35;
      c.drawImage(sprite, f.x - s / 2, ry - s / 2, s, s);
    }
    c.globalAlpha = 1;
    c.restore();
    c.strokeStyle = 'rgba(200, 210, 240, 0.12)';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(P.x, P.y, P.rx, P.ry, 0, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
  }

  drawFlies(c) {
    const sprite = this.tintedGlow();
    const S = this.S;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const f of this.flies) {
      const depth = mclamp((f.y - this.horizon) / (this.h - this.horizon), 0, 1);
      const b = this.brightness(f);
      const base = 0.14; // a faint ember between flashes
      const size = (18 + depth * 30) * S * (0.55 + b * 0.9);
      c.globalAlpha = Math.min(1, base + b);
      c.drawImage(sprite, f.x - size / 2, f.y - size / 2, size, size);
    }
    c.restore();
  }

  drawFog(c) {
    const M = MEADOW_MOODS[this.mood];
    if (!M.fog) return;
    const { w, S } = this;
    for (const b of this.fogBands) {
      const x = ((b.x + this.t * b.v) % (w + 600)) - 300;
      const R = 420 * S * b.s;
      // A soft, flattened patch that fades out in every direction (no hard edges)
      c.save();
      c.translate(x, b.y);
      c.scale(1, 0.28);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, 'rgba(190, 205, 225, 0.16)');
      g.addColorStop(1, 'rgba(190, 205, 225, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, R, 0, MTAU);
      c.fill();
      c.restore();
    }
    const low = c.createLinearGradient(0, this.horizon - 30 * S, 0, this.horizon + 120 * S);
    low.addColorStop(0, 'rgba(190, 205, 225, 0)');
    low.addColorStop(0.5, 'rgba(190, 205, 225, 0.22)');
    low.addColorStop(1, 'rgba(190, 205, 225, 0)');
    c.fillStyle = low;
    c.fillRect(0, this.horizon - 30 * S, w, 150 * S);
  }

  drawCall(c) {
    if (!this.call) return;
    const L = this.call, u = L.t / L.dur;
    const a = Math.sin(Math.min(1, u * 6) * Math.PI / 2) * (1 - u);
    const r = (60 + u * 120) * this.S;
    const g = c.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
    g.addColorStop(0, `rgba(255, 228, 160, ${0.35 * a})`);
    g.addColorStop(1, 'rgba(255, 228, 160, 0)');
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = g;
    c.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    c.restore();
  }

  draw() {
    const M = MEADOW_MOODS[this.mood];
    const c = this.ctx, { w, h } = this;
    c.clearRect(0, 0, w, h);
    this.drawSky(c);
    this.drawTreeline(c);
    // Meadow floor
    const floor = c.createLinearGradient(0, this.horizon, 0, h);
    floor.addColorStop(0, M.floor[0]);
    floor.addColorStop(1, M.floor[1]);
    c.fillStyle = floor;
    c.fillRect(0, this.horizon + 4, w, h - this.horizon);
    this.drawGrass(c, this.grassFar, M.grass[0], null);
    this.drawPond(c);
    this.drawFog(c);
    this.drawCall(c);
    this.drawGrass(c, this.grassMid, M.grass[1], 'rgba(170, 190, 230, 0.22)');
    this.drawFlowers(c);
    this.drawFlies(c);
    this.drawGrass(c, this.grassFront, M.grass[2], 'rgba(170, 190, 230, 0.14)');

    // Vignette
    const vg = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(0, 0, 8, 0.4)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
  }
}

window.MeadowWorld = MeadowWorld;
window.MEADOW_MOODS = MEADOW_MOODS;
