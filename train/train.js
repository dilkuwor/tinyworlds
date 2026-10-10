/**
 * train.js - Night Train
 *
 * The view from a cabin window at night. The world slides past in layers,
 * each at its own speed (parallax): distant hills and town lights barely
 * move, fields and farmhouses glide, hedges hurry, and telegraph poles
 * flash by with their wires dipping between them. Now and then a tunnel
 * swallows the view (and your own reflection appears in the glass),
 * a station drifts past, or another train rushes by the other way.
 *
 * Used full-screen by scene.js and as a live preview on the homepage.
 */

const TRAIN_ROUTES = {
  countryside: {
    label: 'Countryside', icon: '🌾',
    sky: ['#050a1c', '#0e1838', '#1c2a52', '#2e3a62'], moon: [0.74, 0.17],
    far: '#1b2346', mid: '#0f162d', near: '#070b16', windows: ['255, 206, 140', '255, 228, 170'],
    trees: '#0a1022', ground: null, snow: false, sea: false, skyline: false
  },
  coast: {
    label: 'Coast', icon: '🌊',
    sky: ['#040918', '#0b1736', '#182b55', '#2a406a'], moon: [0.32, 0.2],
    far: '#121b38', mid: '#0a1226', near: '#060a14', windows: ['255, 214, 150'],
    trees: '#0a1020', sea: ['#16284e', '#060c1c'], lighthouse: true
  },
  snow: {
    label: 'Snow', icon: '❄️',
    sky: ['#0a1226', '#18264a', '#2c3d66', '#46587e'], moon: [0.6, 0.15],
    far: '#3c4c6e', mid: '#6f83a8', near: '#b8c8e0', windows: ['255, 200, 130'],
    trees: '#0c1324', snow: true
  },
  city: {
    label: 'City', icon: '🌃',
    sky: ['#0b0d1e', '#1a1d3a', '#2f2d55', '#4a3d66'], moon: [0.84, 0.14],
    far: '#151735', mid: '#0d0f25', near: '#07080f', windows: ['255, 200, 120', '150, 200, 255', '255, 238, 200'],
    trees: '#0a0c1c', skyline: true
  }
};

const TRAIN_SPEEDS = {
  slow: { label: 'Slow', kmh: 55 },
  cruise: { label: 'Cruise', kmh: 110 },
  fast: { label: 'Fast', kmh: 190 }
};

const STATION_NAMES = ['Ashwell', 'Brooke Halt', 'Cold Harbour', 'Dunmere', 'Elm Crossing', 'Fernley', 'Glenmoor', 'Holloway', 'Iverness Rd', 'Juniper', 'Kestrel Bay', 'Lark Hill', 'Millbrook', 'Northfield', 'Owlpen', 'Pinecroft'];

const TTAU = Math.PI * 2;
const trand = (a, b) => a + Math.random() * (b - a);
const tclamp = (v, a, b) => Math.max(a, Math.min(b, v));

class TrainWorld {
  constructor(canvas, { preview = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = preview;
    this.route = 'countryside';
    this.speedKey = 'cruise';
    this.kmh = TRAIN_SPEEDS.cruise.kmh;
    this.reflection = true;
    this.t = 0;
    this.d = 0;               // distance travelled (px at the nearest layer)
    this.layers = {};
    this.tunnel = null;       // { x0, x1 } in near-layer world space
    this.station = null;      // { x0, x1, name }
    this.passing = null;      // another train, in screen space
    this.flakes = [];
    this.bump = 0;
    this.nextEvent = trand(18, 35);
    this.onJoint = null;      // () => void   each rail joint
    this.onEvent = null;      // (type) => void   'tunnel-in' | 'tunnel-out' | 'station' | 'passing'
    this.jointAcc = 0;
  }

  // ---------- Layout ----------
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.S = tclamp(Math.min(w, h) / 700, 0.55, 1.5);
    const S = this.S;
    this.margin = this.preview ? Math.max(10, w * 0.025) : Math.max(18, w * 0.028);
    this.tableH = this.preview ? h * 0.12 : Math.max(70, h * 0.13);
    this.win = { x: this.margin, y: this.margin * 1.4, w: w - this.margin * 2, h: h - this.tableH - this.margin * 1.6 };
    this.horizon = this.win.y + this.win.h * (h > w ? 0.44 : 0.58); // more land on tall screens
    this.stars = Array.from({ length: 240 }, () => ({ x: Math.random() * w, y: Math.pow(Math.random(), 1.4) * this.horizon * 0.95, r: trand(0.4, 1.3), tw: Math.random() * 10 }));
    this.resetLayers();
  }

  setRoute(r) {
    if (!TRAIN_ROUTES[r]) return;
    this.route = r;
    this.resetLayers();
    this.flakes = [];
  }

  setSpeed(k) {
    if (TRAIN_SPEEDS[k]) this.speedKey = k;
  }

  get pxPerSec() {
    return this.kmh * 4 * this.S;
  }

  // ---------- Procedural layers ----------
  resetLayers() {
    if (!this.w) return;
    const S = this.S, R = TRAIN_ROUTES[this.route];
    this.layers = {
      far: { p: 0.05, items: [], next: 0, gap: () => trand(500, 1400) * S },
      mid: { p: 0.22, items: [], next: 0, gap: () => trand(70, 260) * S },
      near: { p: 0.6, items: [], next: 0, gap: () => trand(40, 160) * S },
      poles: { p: 1, items: [], next: 0, gap: () => 420 * S }
    };
    if (R.skyline) this.layers.far.gap = () => trand(30, 70) * S;
    this.fill();
  }

  ridge(xw, base, amp, f, ph) {
    return base + Math.sin(xw * f + ph) * amp + Math.sin(xw * f * 2.7 + ph * 1.9) * amp * 0.35;
  }

  farY(xw) { return this.ridge(xw, this.horizon - 10 * this.S, 26 * this.S, 0.0021, 0.5); }
  midY(xw) { return this.ridge(xw, this.horizon + this.win.h * 0.14, 16 * this.S, 0.0042, 2.1); }
  nearY(xw) { return this.ridge(xw, this.win.y + this.win.h * 0.84, 10 * this.S, 0.009, 4.2); }

  spawn(name, x) {
    const S = this.S, R = TRAIN_ROUTES[this.route];
    const r = Math.random();
    if (name === 'far') {
      if (R.skyline) {
        const bw = trand(24, 70) * S, bh = trand(40, 170) * S;
        const lights = [];
        for (let yy = 6; yy < bh - 6; yy += 9 * S) for (let xx = 4; xx < bw - 4; xx += 7 * S) if (Math.random() < 0.35) lights.push([xx, yy, Math.floor(Math.random() * R.windows.length)]);
        return { kind: 'building', x, w: bw, h: bh, lights };
      }
      if (R.lighthouse && r < 0.35) return { kind: 'lighthouse', x, w: 20 * S };
      const n = Math.round(trand(5, 22));
      return { kind: 'town', x, w: trand(60, 200) * S, lights: Array.from({ length: n }, () => [Math.random(), trand(0, 14) * S, Math.random()]) };
    }
    if (name === 'mid') {
      if (R.sea) return { kind: r < 0.12 ? 'boat' : 'none', x, w: 30 * S };
      if (R.skyline) return r < 0.5 ? { kind: 'block', x, w: trand(50, 110) * S, h: trand(50, 120) * S, lit: Array.from({ length: 12 }, () => Math.random() < 0.45) } : { kind: 'lamp', x, w: 8 * S };
      if (r < 0.14) return { kind: 'house', x, w: 44 * S, lit: Math.random() < 0.8 };
      return { kind: R.snow ? 'fir' : 'tree', x, w: trand(18, 40) * S, h: trand(26, 70) * S };
    }
    if (name === 'near') {
      const blades = Array.from({ length: 5 }, () => trand(10, 18) * S);
      if (R.sea) return { kind: r < 0.5 ? 'rock' : 'grass', x, w: trand(20, 60) * S, blades };
      return { kind: r < 0.35 ? 'post' : r < 0.8 ? 'bush' : 'grass', x, w: trand(20, 70) * S, blades };
    }
    return { kind: 'pole', x };
  }

  fill() {
    for (const [name, L] of Object.entries(this.layers)) {
      const off = this.d * L.p;
      while (L.next < off + this.w + 300 * this.S) {
        L.items.push(this.spawn(name, L.next));
        L.next += L.gap();
      }
      L.items = L.items.filter(it => it.x - off > -400 * this.S);
    }
  }

  // ---------- Simulation ----------
  update(dt) {
    this.t += dt;
    const S = this.S, R = TRAIN_ROUTES[this.route];

    // Ease toward the chosen speed (slower while passing a station)
    let target = TRAIN_SPEEDS[this.speedKey].kmh;
    if (this.station) {
      const sx = this.station.x0 - this.d;
      if (sx < this.w * 1.2 && this.station.x1 - this.d > -this.w * 0.2) target *= 0.55;
    }
    this.kmh += (target - this.kmh) * Math.min(1, dt * 0.35);
    const v = this.pxPerSec;
    this.d += v * dt;
    this.fill();

    // Rail joints: a clack every few metres, and a small bump through the carriage
    this.jointAcc += v * dt;
    const joint = 260 * S;
    while (this.jointAcc >= joint) {
      this.jointAcc -= joint;
      this.bump = 1;
      if (this.onJoint) this.onJoint();
    }
    this.bump = Math.max(0, this.bump - dt * 6);

    // Events: tunnels, stations, passing trains
    this.nextEvent -= dt;
    if (this.nextEvent <= 0 && !this.tunnel && !this.station && !this.passing) {
      this.nextEvent = trand(25, 55) * (this.preview ? 0.6 : 1);
      const roll = Math.random();
      const ahead = this.d + this.w + 200 * S;
      if (roll < 0.36 && !R.skyline) {
        this.tunnel = { x0: ahead, x1: ahead + v * trand(4, 7), entered: false, left: false };
      } else if (roll < 0.7) {
        this.station = { x0: ahead, x1: ahead + 1400 * S, name: STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)], announced: false };
      } else {
        this.passing = this.makePassing(v);
        if (this.onEvent) this.onEvent('passing');
      }
    }
    if (this.tunnel) {
      const T = this.tunnel;
      if (!T.entered && T.x0 - this.d < this.w * 0.5) { T.entered = true; if (this.onEvent) this.onEvent('tunnel-in'); }
      if (!T.left && T.x1 - this.d < this.w * 0.5) { T.left = true; if (this.onEvent) this.onEvent('tunnel-out'); }
      if (T.x1 - this.d < -50) this.tunnel = null;
    }
    if (this.station) {
      if (!this.station.announced && this.station.x0 - this.d < this.w) { this.station.announced = true; if (this.onEvent) this.onEvent('station'); }
      if (this.station.x1 - this.d < -100) this.station = null;
    }
    if (this.passing) {
      this.passing.x -= this.passing.v * dt;
      if (this.passing.x + this.passing.len < -50) this.passing = null;
    }

    // Snow streaks past the window
    if (R.snow) {
      const want = this.preview ? 70 : 180;
      while (this.flakes.length < want) this.flakes.push({ x: Math.random() * this.w * 1.4, y: Math.random() * this.h, r: trand(0.8, 2.4) * S, vy: trand(30, 70) * S, z: trand(0.3, 1) });
      for (const f of this.flakes) {
        f.x -= (v * 0.5 * f.z + 20 * S) * dt;
        f.y += f.vy * dt;
        if (f.x < -20 || f.y > this.h) { f.x = this.w + Math.random() * 200; f.y = Math.random() * this.h * 0.8; }
      }
    }
  }

  makePassing(v) {
    const S = this.S;
    const len = trand(1800, 3000) * S;
    const wins = [];
    for (let x = 30 * S; x < len - 40 * S; x += 46 * S) {
      if ((x / (46 * S)) % 9 > 7.5) continue; // gaps between carriages
      wins.push({ x, lit: Math.random() < 0.75, warm: Math.random() < 0.8 });
    }
    return { x: this.w + 60, len, v: v + 900 * S, wins };
  }

  /** How dark it is outside right now (for the reflection): 0 open country … 1 deep in a tunnel. */
  tunnelCover() {
    if (!this.tunnel) return 0;
    const a = this.tunnel.x0 - this.d, b = this.tunnel.x1 - this.d;
    const covered = Math.max(0, Math.min(this.w, b) - Math.max(0, a));
    return covered / this.w;
  }

  // ---------- Drawing ----------
  drawSky(c) {
    const R = TRAIN_ROUTES[this.route], { w, h } = this;
    const g = c.createLinearGradient(0, 0, 0, this.horizon);
    R.sky.forEach((col, i) => g.addColorStop(i / (R.sky.length - 1), col));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (const st of this.stars) {
      const a = (0.45 + 0.55 * Math.sin(this.t * 1.3 + st.tw)) * (1 - st.y / this.horizon * 0.7) * (R.skyline ? 0.4 : 1);
      if (a <= 0) continue;
      c.fillStyle = `rgba(255, 250, 235, ${a.toFixed(3)})`;
      c.fillRect(st.x, st.y, st.r, st.r);
    }
    const [mxu, myu] = R.moon;
    const mx = w * mxu, my = this.win.y + (this.horizon - this.win.y) * myu * 1.6, mr = Math.max(12, Math.min(w, h) * 0.028);
    this.moon = { x: mx, y: my, r: mr };
    const halo = c.createRadialGradient(mx, my, mr, mx, my, mr * 8);
    halo.addColorStop(0, 'rgba(230, 236, 255, 0.28)');
    halo.addColorStop(1, 'rgba(230, 236, 255, 0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, w, this.horizon);
    c.fillStyle = '#f2efe2';
    c.beginPath();
    c.arc(mx, my, mr, 0, TTAU);
    c.fill();
  }

  drawFar(c) {
    const R = TRAIN_ROUTES[this.route], L = this.layers.far, S = this.S;
    const off = this.d * L.p;
    if (!R.skyline) {
      c.fillStyle = R.far;
      c.beginPath();
      c.moveTo(0, this.h);
      for (let x = 0; x <= this.w + 8; x += 8) c.lineTo(x, this.farY(x + off));
      c.lineTo(this.w, this.h);
      c.closePath();
      c.fill();
    }
    for (const it of L.items) {
      const sx = it.x - off;
      if (sx > this.w + 50 || sx + (it.w || 0) < -50) continue;
      if (it.kind === 'building') {
        const base = this.horizon + 8 * S;
        c.fillStyle = R.far;
        c.fillRect(sx, base - it.h, it.w, it.h);
        for (const [lx, ly, ci] of it.lights) {
          c.fillStyle = `rgba(${R.windows[ci]}, 0.75)`;
          c.fillRect(sx + lx, base - it.h + ly, 2.5 * S, 3.5 * S);
        }
      } else if (it.kind === 'town') {
        const y = this.farY(it.x + it.w / 2);
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (const [u, dy, tw] of it.lights) {
          const a = 0.5 + 0.4 * Math.sin(this.t * 2 + tw * 10);
          c.fillStyle = `rgba(${R.windows[0]}, ${a.toFixed(3)})`;
          c.beginPath();
          c.arc(sx + u * it.w, y + 4 * S + dy, 1.3 * S, 0, TTAU);
          c.fill();
        }
        c.restore();
      } else if (it.kind === 'lighthouse') {
        const y = this.farY(it.x) - 2 * S;
        c.fillStyle = '#dfe4ee';
        c.fillRect(sx - 3 * S, y - 26 * S, 6 * S, 26 * S);
        const ang = this.t * 1.4;
        c.save();
        c.globalCompositeOperation = 'lighter';
        const len = 420 * S;
        for (const sgn of [1, -1]) {
          const a = ang + (sgn > 0 ? 0 : Math.PI);
          const ex = sx + Math.cos(a) * len, ey = y - 28 * S + Math.sin(a) * len * 0.12;
          const g = c.createLinearGradient(sx, y - 28 * S, ex, ey);
          g.addColorStop(0, 'rgba(255, 245, 210, 0.35)');
          g.addColorStop(1, 'rgba(255, 245, 210, 0)');
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(sx, y - 28 * S);
          c.lineTo(ex, ey - 18 * S);
          c.lineTo(ex, ey + 18 * S);
          c.closePath();
          c.fill();
        }
        c.fillStyle = 'rgba(255, 245, 210, 0.95)';
        c.beginPath();
        c.arc(sx, y - 28 * S, 2.5 * S, 0, TTAU);
        c.fill();
        c.restore();
      }
    }
  }

  drawMid(c) {
    const R = TRAIN_ROUTES[this.route], L = this.layers.mid, S = this.S;
    const off = this.d * L.p;
    if (R.sea) {
      // Sea with a glittering path under the moon
      const top = this.horizon + 6 * S;
      const g = c.createLinearGradient(0, top, 0, this.h);
      g.addColorStop(0, R.sea[0]);
      g.addColorStop(1, R.sea[1]);
      c.fillStyle = g;
      c.fillRect(0, top, this.w, this.h - top);
      const mx = this.moon ? this.moon.x : this.w * 0.3;
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const y = top + 4 * S + i * i * 0.6 * S;
        if (y > this.h) break;
        const wid = (6 + i * 3) * S * (0.6 + 0.4 * Math.sin(this.t * 3 + i * 1.7));
        c.fillStyle = `rgba(240, 238, 220, ${(0.45 - i * 0.012).toFixed(3)})`;
        c.fillRect(mx - wid / 2 + Math.sin(this.t * 2 + i) * 6 * S, y, wid, 1.4 * S);
      }
      c.restore();
      for (const it of L.items) {
        if (it.kind !== 'boat') continue;
        const sx = it.x - off;
        if (sx < -40 || sx > this.w + 40) continue;
        const by = top + 18 * S;
        c.fillStyle = '#0a1020';
        c.fillRect(sx - 10 * S, by - 3 * S, 20 * S, 4 * S);
        c.fillStyle = 'rgba(255, 210, 140, 0.9)';
        c.fillRect(sx, by - 6 * S, 2 * S, 2 * S);
      }
      return;
    }
    c.fillStyle = R.mid;
    c.beginPath();
    c.moveTo(0, this.h);
    for (let x = 0; x <= this.w + 8; x += 8) c.lineTo(x, this.midY(x + off));
    c.lineTo(this.w, this.h);
    c.closePath();
    c.fill();
    for (const it of L.items) {
      const sx = it.x - off;
      if (sx > this.w + 60 || sx < -80) continue;
      const y = this.midY(it.x) + 2 * S;
      if (it.kind === 'tree') {
        c.fillStyle = R.trees;
        c.fillRect(sx - 1.5 * S, y - it.h * 0.4, 3 * S, it.h * 0.4);
        c.beginPath();
        c.ellipse(sx, y - it.h * 0.62, it.w * 0.55, it.h * 0.42, 0, 0, TTAU);
        c.fill();
      } else if (it.kind === 'fir') {
        c.fillStyle = R.trees;
        c.beginPath();
        c.moveTo(sx - it.w * 0.5, y);
        c.lineTo(sx, y - it.h);
        c.lineTo(sx + it.w * 0.5, y);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(230, 238, 250, 0.85)';
        c.beginPath();
        c.moveTo(sx - it.w * 0.18, y - it.h * 0.62);
        c.lineTo(sx, y - it.h);
        c.lineTo(sx + it.w * 0.18, y - it.h * 0.62);
        c.closePath();
        c.fill();
      } else if (it.kind === 'house') {
        c.fillStyle = R.trees;
        c.fillRect(sx - 16 * S, y - 18 * S, 32 * S, 18 * S);
        c.beginPath();
        c.moveTo(sx - 20 * S, y - 17 * S);
        c.lineTo(sx, y - 32 * S);
        c.lineTo(sx + 20 * S, y - 17 * S);
        c.fill();
        if (it.lit) {
          c.save();
          c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(sx - 6 * S, y - 10 * S, 0, sx - 6 * S, y - 10 * S, 26 * S);
          g.addColorStop(0, `rgba(${R.windows[0]}, 0.45)`);
          g.addColorStop(1, `rgba(${R.windows[0]}, 0)`);
          c.fillStyle = g;
          c.fillRect(sx - 34 * S, y - 38 * S, 56 * S, 50 * S);
          c.fillStyle = `rgba(${R.windows[0]}, 0.95)`;
          c.fillRect(sx - 9 * S, y - 13 * S, 6 * S, 5 * S);
          c.restore();
        }
      } else if (it.kind === 'block') {
        c.fillStyle = R.mid;
        c.fillRect(sx, y - it.h, it.w, it.h + 4);
        it.lit.forEach((on, i) => {
          if (!on) return;
          const col = i % 3, row = Math.floor(i / 3);
          c.fillStyle = `rgba(${R.windows[i % R.windows.length]}, 0.85)`;
          c.fillRect(sx + 8 * S + col * (it.w - 16 * S) / 3, y - it.h + 10 * S + row * (it.h - 14 * S) / 4, 6 * S, 7 * S);
        });
      } else if (it.kind === 'lamp') {
        c.strokeStyle = R.trees;
        c.lineWidth = 2 * S;
        c.beginPath();
        c.moveTo(sx, y);
        c.lineTo(sx, y - 34 * S);
        c.stroke();
        c.save();
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(sx, y - 34 * S, 0, sx, y - 34 * S, 30 * S);
        g.addColorStop(0, 'rgba(255, 200, 130, 0.7)');
        g.addColorStop(1, 'rgba(255, 200, 130, 0)');
        c.fillStyle = g;
        c.fillRect(sx - 30 * S, y - 64 * S, 60 * S, 60 * S);
        c.restore();
      }
    }
  }

  drawNear(c) {
    const R = TRAIN_ROUTES[this.route], L = this.layers.near, S = this.S;
    const off = this.d * L.p;
    c.fillStyle = R.near;
    c.beginPath();
    c.moveTo(0, this.h);
    for (let x = 0; x <= this.w + 8; x += 8) c.lineTo(x, this.nearY(x + off));
    c.lineTo(this.w, this.h);
    c.closePath();
    c.fill();
    const dark = R.snow ? '#8fa2c2' : R.trees;
    for (const it of L.items) {
      const sx = it.x - off;
      if (sx > this.w + 80 || sx < -80) continue;
      const y = this.nearY(it.x) + 2 * S;
      c.fillStyle = dark;
      if (it.kind === 'post') {
        c.fillRect(sx, y - 26 * S, 4 * S, 26 * S);
      } else if (it.kind === 'bush') {
        c.beginPath();
        c.ellipse(sx, y - 6 * S, it.w * 0.5, 14 * S, 0, Math.PI, 0);
        c.fill();
      } else if (it.kind === 'rock') {
        c.beginPath();
        c.ellipse(sx, y, it.w * 0.5, 9 * S, 0, Math.PI, 0);
        c.fill();
      } else {
        c.strokeStyle = dark;
        c.lineWidth = 1.5 * S;
        c.beginPath();
        for (let k = 0; k < 5; k++) {
          c.moveTo(sx + k * 4 * S, y);
          c.lineTo(sx + k * 4 * S + 3 * S, y - it.blades[k]);
        }
        c.stroke();
      }
    }
  }

  drawPoles(c) {
    const L = this.layers.poles, S = this.S;
    const off = this.d * L.p;
    const top = this.win.y + this.win.h * 0.12, base = this.h;
    const pts = [];
    for (const it of L.items) {
      const sx = it.x - off;
      if (sx < -500 * S || sx > this.w + 500 * S) continue;
      pts.push(sx);
    }
    c.strokeStyle = '#05070d';
    c.fillStyle = '#05070d';
    for (const sx of pts) {
      c.lineWidth = 8 * S;
      c.beginPath();
      c.moveTo(sx, base);
      c.lineTo(sx, top);
      c.stroke();
      c.fillRect(sx - 24 * S, top + 12 * S, 48 * S, 4 * S);
    }
    // Wires sag between poles: they appear to rise and fall as the train runs
    c.lineWidth = 1.3 * S;
    c.strokeStyle = 'rgba(8, 10, 18, 0.9)';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      for (const dx of [-20, 20]) {
        const y = top + 14 * S;
        c.beginPath();
        c.moveTo(a + dx * S, y);
        c.quadraticCurveTo((a + b) / 2, y + 60 * S, b + dx * S, y);
        c.stroke();
      }
    }
  }

  drawStation(c) {
    if (!this.station) return;
    const st = this.station, S = this.S;
    const a = st.x0 - this.d, b = st.x1 - this.d;
    if (b < 0 || a > this.w) return;
    const pTop = this.win.y + this.win.h * 0.68, pBot = this.h;
    const x0 = Math.max(-10, a), x1 = Math.min(this.w + 10, b);
    // Platform
    c.fillStyle = '#2b2f3a';
    c.fillRect(x0, pTop, x1 - x0, pBot - pTop);
    c.fillStyle = '#e8c45a';
    c.fillRect(x0, pTop, x1 - x0, 3 * S);
    // Canopy with lamps
    const roof = this.win.y + this.win.h * 0.18;
    c.fillStyle = '#12151d';
    c.fillRect(x0, roof, x1 - x0, 14 * S);
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let x = a + 60 * S; x < b; x += 160 * S) {
      if (x < -60 || x > this.w + 60) continue;
      const g = c.createRadialGradient(x, roof + 18 * S, 0, x, roof + 18 * S, 150 * S);
      g.addColorStop(0, 'rgba(255, 228, 170, 0.22)');
      g.addColorStop(1, 'rgba(255, 228, 170, 0)');
      c.fillStyle = g;
      c.fillRect(x - 150 * S, roof, 300 * S, pBot - roof);
      c.fillStyle = 'rgba(255, 244, 214, 0.95)';
      c.fillRect(x - 10 * S, roof + 14 * S, 20 * S, 3 * S);
    }
    c.restore();
    // Pillars, benches and the station sign
    c.fillStyle = '#0d1016';
    for (let x = a + 140 * S; x < b; x += 320 * S) {
      if (x < -20 || x > this.w + 20) continue;
      c.fillRect(x - 4 * S, roof + 14 * S, 8 * S, pTop - roof - 14 * S);
      c.fillRect(x + 40 * S, pTop - 22 * S, 50 * S, 5 * S);
      c.fillRect(x + 44 * S, pTop - 17 * S, 4 * S, 17 * S);
      c.fillRect(x + 82 * S, pTop - 17 * S, 4 * S, 17 * S);
    }
    const signX = a + (b - a) * 0.45;
    if (signX > -200 && signX < this.w + 200) {
      c.fillStyle = '#1d3b6b';
      c.fillRect(signX - 90 * S, roof + 46 * S, 180 * S, 34 * S);
      c.fillStyle = '#f4f1e6';
      c.font = `600 ${Math.round(17 * S)}px ui-sans-serif, system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(st.name, signX, roof + 63 * S);
    }
  }

  drawTunnel(c) {
    if (!this.tunnel) return;
    const T = this.tunnel, S = this.S;
    const a = T.x0 - this.d, b = T.x1 - this.d;
    if (b < 0 || a > this.w) return;
    const x0 = Math.max(0, a), x1 = Math.min(this.w, b);
    c.fillStyle = '#030305';
    c.fillRect(x0, 0, x1 - x0, this.h);
    // Portal edges
    c.fillStyle = '#1a1714';
    if (a > 0 && a < this.w) c.fillRect(a - 10 * S, 0, 10 * S, this.h);
    if (b > 0 && b < this.w) c.fillRect(b, 0, 10 * S, this.h);
    // Wall lamps streaking past
    c.save();
    c.globalCompositeOperation = 'lighter';
    const spacing = 380 * S;
    const first = Math.ceil((this.d + x0) / spacing) * spacing;
    for (let wx = first; wx < this.d + x1; wx += spacing) {
      const x = wx - this.d;
      const y = this.win.y + this.win.h * 0.36;
      const g = c.createRadialGradient(x, y, 0, x, y, 90 * S);
      g.addColorStop(0, 'rgba(255, 170, 80, 0.55)');
      g.addColorStop(1, 'rgba(255, 170, 80, 0)');
      c.fillStyle = g;
      c.fillRect(x - 90 * S, y - 90 * S, 180 * S, 180 * S);
      c.fillStyle = 'rgba(255, 200, 120, 0.9)';
      c.fillRect(x - 14 * S, y - 2 * S, 28 * S, 4 * S);
    }
    c.restore();
  }

  drawPassing(c) {
    if (!this.passing) return;
    const P = this.passing, S = this.S;
    const top = this.win.y + this.win.h * 0.3, bot = this.win.y + this.win.h * 0.82;
    const x0 = Math.max(-20, P.x), x1 = Math.min(this.w + 20, P.x + P.len);
    if (x1 < 0 || x0 > this.w) return;
    const body = c.createLinearGradient(0, top, 0, bot);
    body.addColorStop(0, '#20232c');
    body.addColorStop(0.5, '#15171e');
    body.addColorStop(1, '#0c0d12');
    c.fillStyle = body;
    c.fillRect(x0, top, x1 - x0, bot - top);
    c.fillStyle = 'rgba(180, 60, 50, 0.5)';
    c.fillRect(x0, top + (bot - top) * 0.66, x1 - x0, 3 * S);
    // Windows smear sideways at this speed
    const wy = top + (bot - top) * 0.2, wh = (bot - top) * 0.3;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const wdw of P.wins) {
      const x = P.x + wdw.x;
      if (x < -80 || x > this.w + 80 || !wdw.lit) continue;
      const col = wdw.warm ? '255, 222, 160' : '200, 225, 255';
      const g = c.createLinearGradient(x - 20 * S, 0, x + 52 * S, 0);
      g.addColorStop(0, `rgba(${col}, 0)`);
      g.addColorStop(0.3, `rgba(${col}, 0.55)`);
      g.addColorStop(0.75, `rgba(${col}, 0.55)`);
      g.addColorStop(1, `rgba(${col}, 0)`);
      c.fillStyle = g;
      c.fillRect(x - 20 * S, wy, 72 * S, wh);
    }
    c.restore();
  }

  drawFlakes(c) {
    if (!this.flakes.length) return;
    const S = this.S, v = this.pxPerSec;
    c.strokeStyle = 'rgba(240, 245, 255, 0.75)';
    c.lineCap = 'round';
    for (const f of this.flakes) {
      const len = Math.min(40, v * 0.03 * f.z) * S;
      c.lineWidth = f.r;
      c.beginPath();
      c.moveTo(f.x, f.y);
      c.lineTo(f.x + len, f.y - len * 0.15);
      c.stroke();
    }
  }

  drawReflection(c) {
    if (!this.reflection) return;
    const S = this.S, W = this.win;
    const dark = 0.35 + this.tunnelCover() * 0.65;
    c.save();
    c.beginPath();
    c.roundRect ? c.roundRect(W.x, W.y, W.w, W.h, 26 * S) : c.rect(W.x, W.y, W.w, W.h);
    c.clip();
    c.globalCompositeOperation = 'screen';
    // Reading lamp glow and the seat across the aisle, faint in the glass
    const lx = W.x + W.w * 0.2, ly = W.y + W.h * 0.22;
    const g = c.createRadialGradient(lx, ly, 0, lx, ly, W.w * 0.35);
    g.addColorStop(0, `rgba(255, 200, 140, ${0.2 * dark})`);
    g.addColorStop(1, 'rgba(255, 200, 140, 0)');
    c.fillStyle = g;
    c.fillRect(W.x, W.y, W.w, W.h);
    // The seat back across the aisle: a soft ghost, not a shape
    const sx = W.x + W.w * 0.8, sy = W.y + W.h * 0.62;
    c.save();
    c.translate(sx, sy);
    c.scale(1, 2.2);
    const seat = c.createRadialGradient(0, 0, 0, 0, 0, W.w * 0.09);
    seat.addColorStop(0, `rgba(170, 120, 95, ${0.14 * dark})`);
    seat.addColorStop(1, 'rgba(170, 120, 95, 0)');
    c.fillStyle = seat;
    c.beginPath();
    c.arc(0, 0, W.w * 0.09, 0, TTAU);
    c.fill();
    c.restore();
    c.restore();
  }

  drawCabin(c) {
    const { w, h, S } = this, W = this.win;
    const r = 26 * S;
    // Carriage wall around the window
    c.save();
    c.beginPath();
    c.rect(0, 0, w, h);
    if (c.roundRect) c.roundRect(W.x, W.y, W.w, W.h, r);
    else c.rect(W.x, W.y, W.w, W.h);
    const wall = c.createLinearGradient(0, 0, 0, h);
    wall.addColorStop(0, '#2b2420');
    wall.addColorStop(1, '#1d1814');
    c.fillStyle = wall;
    c.fill('evenodd');
    c.restore();
    // Window rubber and rim highlight
    c.strokeStyle = '#0c0a09';
    c.lineWidth = 6 * S;
    c.beginPath();
    c.roundRect ? c.roundRect(W.x, W.y, W.w, W.h, r) : c.rect(W.x, W.y, W.w, W.h);
    c.stroke();
    c.strokeStyle = 'rgba(255, 220, 180, 0.12)';
    c.lineWidth = 1.5 * S;
    c.beginPath();
    c.roundRect ? c.roundRect(W.x - 5 * S, W.y - 5 * S, W.w + 10 * S, W.h + 10 * S, r + 5 * S) : c.rect(W.x - 5 * S, W.y - 5 * S, W.w + 10 * S, W.h + 10 * S);
    c.stroke();

    // Little table with a cup of tea
    const top = h - this.tableH * 0.72;
    const tg = c.createLinearGradient(0, top, 0, h);
    tg.addColorStop(0, '#4a3a2e');
    tg.addColorStop(0.08, '#3a2d24');
    tg.addColorStop(1, '#1e1712');
    c.fillStyle = tg;
    c.fillRect(0, top, w, h - top);
    c.fillStyle = 'rgba(255, 220, 180, 0.18)';
    c.fillRect(0, top, w, 2 * S);
    const lamp = c.createRadialGradient(w * 0.2, top, 4, w * 0.2, top, w * 0.4);
    lamp.addColorStop(0, 'rgba(255, 190, 120, 0.22)');
    lamp.addColorStop(1, 'rgba(255, 190, 120, 0)');
    c.fillStyle = lamp;
    c.fillRect(0, top, w, h - top);

    const s = this.preview ? S * 0.75 : S;
    const mx = w * 0.8, my = top + 6 * s;
    c.fillStyle = '#e9e1d5';
    c.beginPath();
    c.moveTo(mx - 18 * s, my - 38 * s);
    c.lineTo(mx + 18 * s, my - 38 * s);
    c.quadraticCurveTo(mx + 19 * s, my, mx + 12 * s, my);
    c.lineTo(mx - 12 * s, my);
    c.quadraticCurveTo(mx - 19 * s, my, mx - 18 * s, my - 38 * s);
    c.fill();
    c.strokeStyle = '#e9e1d5';
    c.lineWidth = 4 * s;
    c.beginPath();
    c.ellipse(mx + 20 * s, my - 20 * s, 8 * s, 10 * s, 0, -Math.PI / 2, Math.PI / 2);
    c.stroke();
    // Tea ripples with every rail joint
    const rip = this.bump * 2 * s;
    c.fillStyle = '#7a4b2a';
    c.beginPath();
    c.ellipse(mx, my - 38 * s, 17 * s, 3.5 * s + rip * 0.3, 0, 0, TTAU);
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    c.lineWidth = 2.5 * s;
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = this.t * 0.8 + i * 2.1, sx = mx + (i - 1) * 7 * s;
      c.beginPath();
      c.moveTo(sx, my - 44 * s);
      for (let k = 1; k <= 6; k++) c.lineTo(sx + Math.sin(ph + k * 0.9) * 5 * s * (k / 6) - k * 1.5 * s, my - 44 * s - k * 9 * s);
      c.stroke();
    }
  }

  draw() {
    const c = this.ctx, { w, h } = this;
    c.clearRect(0, 0, w, h);
    // The carriage sways a little, with a jolt at each rail joint
    const sway = Math.sin(this.t * 1.7) * 0.8 * this.S + this.bump * 1.4 * this.S;
    c.save();
    c.translate(0, sway);
    this.drawSky(c);
    this.drawFar(c);
    this.drawMid(c);
    this.drawNear(c);
    this.drawStation(c);
    this.drawPoles(c);
    this.drawPassing(c);
    this.drawTunnel(c);
    this.drawFlakes(c);
    c.restore();
    this.drawReflection(c);
    this.drawCabin(c);
  }
}

window.TrainWorld = TrainWorld;
window.TRAIN_ROUTES = TRAIN_ROUTES;
window.TRAIN_SPEEDS = TRAIN_SPEEDS;
