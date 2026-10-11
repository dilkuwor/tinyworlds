/**
 * globe.js - The Snow Globe
 *
 * A glass globe on a wooden music-box base, with a little snowy village
 * inside: a cottage, pines, and a toy train on a loop of track.
 *
 * The snow is a small particle simulation in the globe's own space (unit
 * sphere, y down). The water inside lags behind the glass: when the globe
 * is pushed, the water keeps going, so any change in the globe's velocity
 * becomes a current (W) and a swirl (omega) in the opposite direction. The
 * flakes drift with that current, sink slowly through it, and settle on the
 * ground and the cottage roof. A strong enough current lifts them again.
 *
 * The sky inside follows your local time, and the cottage lights come on
 * after dark. Winding the key plays a music box that slowly runs down,
 * and the train runs while it plays.
 */

const SG_TAU = Math.PI * 2;
const sgClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sgRand = (a, b) => a + Math.random() * (b - a);

// An original waltz for the music box: [melody, bass] per beat, MIDI notes
const SG_MELODY = [
  [76, 60], [79, null], [84, null], [83, 55], [79, null], [76, null],
  [74, 53], [76, null], [79, null], [76, 60], [null, null], [null, null],
  [76, 60], [79, null], [84, null], [86, 53], [84, null], [81, null],
  [79, 55], [76, null], [74, null], [72, 60], [null, null], [null, null],
  [81, 57], [79, null], [76, null], [79, 52], [76, null], [74, null],
  [76, 53], [74, null], [72, null], [74, 55], [null, null], [null, null],
  [76, 60], [79, null], [84, null], [83, 55], [84, null], [86, null],
  [88, 55], [86, null], [83, null], [84, 60], [null, null], [null, null]
];

const SG_SKIES = {
  night: { top: '#0b1330', bottom: '#2b3c6b', hill: '#1d2a4c', snow: '#d6e0f2', shade: '#7f91b8' },
  dusk: { top: '#2a2a5c', bottom: '#e3a39c', hill: '#4a4878', snow: '#efe0e4', shade: '#9a9ac0' },
  day: { top: '#93bde3', bottom: '#e9eff5', hill: '#a6bad3', snow: '#ffffff', shade: '#b5c6dc' }
};

// The cottage, in globe units
const SG_HOUSE = { x: 0.04, w: 0.18, wall: 0.2, roof: 0.19, eave: 0.23 };

class SnowGlobeWorld {
  constructor(canvas, { preview = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = preview;
    this.t = 0;

    // The globe as an object you can push around (pixels)
    this.off = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.prevVel = { x: 0, y: 0 };
    this.target = null;
    this.drag = null;
    this.shakeT = 0;
    this.shakeDur = 1;
    this.shakePow = 1;

    // The water inside: a current and a swirl, both fading
    this.W = { x: 0, y: 0, z: 0 };
    this.omega = 0;
    this.churn = 0;
    this.spin = 1;
    this.energy = 0;
    this.swishAcc = 0;
    this.lastSwish = 0;

    // Music box, train, cottage
    this.wind = preview ? 1 : 0;
    this.step = 0;
    this.stepAcc = 0;
    this.keyAngle = 0;
    this.trainA = 0.8;
    this.lightsOverride = null;
    this.smoke = [];
    this.smokeAcc = 0;
    this.idle = 0;

    this.onNote = null;
    this.onSwish = null;

    this.flakes = Array.from({ length: preview ? 240 : 560 }, () => this.newFlake());
    this.updatePhase();
    this.buildSprites();
  }

  newFlake() {
    let x, y, z;
    do { x = sgRand(-1, 1); y = sgRand(-0.95, 0.3); z = sgRand(-1, 1); } while (x * x + y * y + z * z > 0.85);
    const glitter = Math.random() < 0.08;
    return {
      x, y, z, vx: 0, vy: 0, vz: 0,
      size: glitter ? sgRand(0.7, 1.2) : sgRand(0.6, 1.8),
      fall: sgRand(0.05, 0.12),
      phase: sgRand(0, SG_TAU),
      rate: sgRand(1, 3),
      glitter,
      settled: false
    };
  }

  buildSprites() {
    const make = (inner, outer) => {
      const s = document.createElement('canvas');
      s.width = s.height = 32;
      const g = s.getContext('2d');
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, inner);
      grad.addColorStop(0.45, outer);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
      return s;
    };
    this.flakeSprite = make('rgba(255,255,255,1)', 'rgba(240,246,255,0.55)');
    this.glitterSprite = make('rgba(255,250,225,1)', 'rgba(255,220,150,0.5)');
    this.smokeSprite = make('rgba(225,228,236,0.9)', 'rgba(210,214,226,0.35)');
  }

  /** Which sky to paint inside, from the local time. */
  updatePhase() {
    const d = new Date();
    const h = d.getHours() + d.getMinutes() / 60;
    const phase = (h >= 8 && h < 16) ? 'day' : ((h >= 6.5 && h < 8) || (h >= 16 && h < 18.5)) ? 'dusk' : 'night';
    if (phase !== this.phase) {
      this.phase = phase;
      this.sky = null;
    }
  }

  get palette() {
    return SG_SKIES[this.phase];
  }

  get lightsOn() {
    return this.lightsOverride ?? this.phase !== 'day';
  }

  /** Share of the snow still in the water (0 … 1). */
  get airborne() {
    let n = 0;
    for (const f of this.flakes) if (!f.settled) n++;
    return n / this.flakes.length;
  }

  get playing() {
    return this.wind > 0;
  }

  // ---------- Layout ----------
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    const portrait = h > w * 1.1;
    this.R = this.preview ? Math.min(w * 0.27, h * 0.33)
      : portrait ? Math.min(w * 0.4, h * 0.26) : Math.min(w * 0.24, h * 0.31);
    this.cx = w / 2;
    this.cy = h * (this.preview ? 0.42 : 0.43);
    this.tableY = this.cy + this.R * 0.95;
    this.room = null;
    this.sky = null;
  }

  // ---------- Shape of the inside ----------
  /** Height of the snowy ground (globe units, y down). */
  groundY(x) {
    return 0.36 + 0.14 * x * x;
  }

  roofY(x) {
    const H = SG_HOUSE, base = this.groundY(H.x);
    return base - H.wall - H.roof - 0.012 + (Math.abs(x - H.x) / H.eave) * H.roof;
  }

  /** Where a falling flake comes to rest. */
  surfaceY(x, z) {
    let y = this.groundY(x);
    if (Math.abs(z) < 0.35 && Math.abs(x - SG_HOUSE.x) < SG_HOUSE.eave) y = Math.min(y, this.roofY(x));
    return y;
  }

  trainPos(a) {
    const x = SG_HOUSE.x + 0.6 * Math.cos(a), z = Math.sin(a);
    return { x, z, y: this.groundY(x) + 0.035 + 0.045 * z };
  }

  // ---------- Interaction ----------
  /** What is under a point on the canvas: 'key', 'cottage', 'globe', 'base' or null. */
  hitTest(px, py) {
    const R = this.R;
    const dx = px - (this.cx + this.off.x), dy = py - (this.cy + this.off.y);
    if (Math.hypot(dx - 0.93 * R, dy - 1.0 * R) < 0.13 * R) return 'key';
    if (dx * dx + dy * dy < R * R) {
      const ux = dx / R, uy = dy / R, H = SG_HOUSE, base = this.groundY(H.x);
      if (Math.abs(ux - H.x) < H.eave && uy > base - H.wall - H.roof && uy < base + 0.02) return 'cottage';
      return 'globe';
    }
    if (Math.abs(dx) < 0.86 * R && dy > 0.75 * R && dy < 1.24 * R) return 'base';
    return null;
  }

  pointerDown(px, py) {
    const hit = this.hitTest(px, py);
    if (hit) this.drag = { sx: px, sy: py, ox: this.off.x, oy: this.off.y, moved: 0, hit };
    return hit;
  }

  pointerMove(px, py) {
    const d = this.drag;
    if (!d) return;
    let tx = d.ox + (px - d.sx), ty = d.oy + (py - d.sy);
    // Soft limit so the globe can't be dragged off the table
    const lim = this.R * 0.45, len = Math.hypot(tx, ty);
    if (len > lim) { const k = (lim + (len - lim) * 0.25) / len; tx *= k; ty *= k; }
    this.target = { x: tx, y: ty };
    d.moved = Math.max(d.moved, Math.hypot(px - d.sx, py - d.sy));
  }

  /** Let go. Returns what was tapped if the pointer barely moved. */
  pointerUp() {
    const d = this.drag;
    this.drag = null;
    this.target = null;
    return d && d.moved < 6 ? d.hit : null;
  }

  /** A good shake, as if picked up and turned over. */
  shake(power = 1) {
    this.shakeT = this.shakeDur = 1.1;
    this.shakePow = power;
  }

  /** A jolt from outside (phone motion), in pixels per second. */
  jolt(vx, vy) {
    this.vel.x += sgClamp(vx, -900, 900);
    this.vel.y += sgClamp(vy, -900, 900);
  }

  /** A gentle stir from a hovering pointer (homepage preview). */
  stir(px, py) {
    if (px == null) { this.lastStir = null; return; }
    if (this.lastStir) {
      this.vel.x += sgClamp(px - this.lastStir.x, -30, 30) * 5;
      this.vel.y += sgClamp(py - this.lastStir.y, -30, 30) * 3;
    }
    this.lastStir = { x: px, y: py };
  }

  /** A soft tap on the glass. */
  tap() {
    this.vel.x += sgRand(-60, 60);
    this.vel.y += sgRand(20, 50);
  }

  windUp() {
    this.wind = Math.min(1, this.wind + 0.4);
    this.keyAngle += 1.4;
  }

  toggleLights() {
    this.lightsOverride = !this.lightsOn;
    return this.lightsOn;
  }

  // ---------- Simulation ----------
  update(dt) {
    this.t += dt;
    if (Math.floor(this.t / 30) !== Math.floor((this.t - dt) / 30)) this.updatePhase();
    this.updateGlobe(dt);
    this.updateFlakes(dt);
    this.updateMusicBox(dt);
    this.updateSmoke(dt);

    // The homepage preview gives itself a shake when the snow has settled
    if (this.preview) {
      this.idle = this.airborne < 0.12 ? this.idle + dt : 0;
      if (this.idle > 3.5) { this.idle = 0; this.shake(0.8); }
    }
  }

  updateGlobe(dt) {
    const R = this.R;
    let tx = 0, ty = 0;
    if (this.target) {
      tx = this.target.x; ty = this.target.y;
    } else if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const p = 1 - this.shakeT / this.shakeDur, fade = 1 - p;
      tx = Math.sin(p * SG_TAU * 4.5) * R * 0.16 * fade * this.shakePow;
      ty = -Math.abs(Math.sin(p * SG_TAU * 4.5)) * R * 0.12 * fade * this.shakePow;
    }
    // A spring: stiff while held, bouncy when let go
    const held = !!this.target || this.shakeT > 0;
    const k = held ? 420 : 110, c = held ? 34 : 9;
    this.vel.x += ((tx - this.off.x) * k - this.vel.x * c) * dt;
    this.vel.y += ((ty - this.off.y) * k - this.vel.y * c) * dt;
    this.off.x += this.vel.x * dt;
    this.off.y += this.vel.y * dt;

    // The water lags behind the glass
    const dvx = this.vel.x - this.prevVel.x, dvy = this.vel.y - this.prevVel.y;
    this.prevVel.x = this.vel.x;
    this.prevVel.y = this.vel.y;
    const ix = -dvx / R * 0.5, iy = -dvy / R * 0.5, imp = Math.hypot(ix, iy);
    this.W.x += ix;
    this.W.y += iy;
    this.W.z += (Math.random() - 0.5) * imp * 0.8;
    // Back-and-forth cancels out in the current, but not in the water's
    // churn and swirl, which keep going after the glass stops
    if (this.churn < 0.05 && imp > 0.02) this.spin = Math.random() < 0.5 ? -1 : 1;
    this.churn = Math.min(2.5, this.churn + imp * 0.7);
    this.omega += imp * 0.9 * this.spin;

    const wl = Math.hypot(this.W.x, this.W.y, this.W.z);
    if (wl > 3) { this.W.x *= 3 / wl; this.W.y *= 3 / wl; this.W.z *= 3 / wl; }
    this.omega = sgClamp(this.omega, -2.5, 2.5);
    const fw = Math.exp(-dt / 1.4), fo = Math.exp(-dt / 3), fc = Math.exp(-dt / 2.2);
    this.W.x *= fw; this.W.y *= fw; this.W.z *= fw;
    this.omega *= fo;
    this.churn *= fc;
    this.energy = Math.hypot(this.W.x, this.W.y, this.W.z) + Math.abs(this.omega) * 0.4 + this.churn;
    this.tilt = sgClamp(this.off.x / R * 0.35, -0.2, 0.2);

    // Report a swish of water when the globe is shaken hard
    this.swishAcc = this.swishAcc * Math.exp(-dt * 4) + imp;
    if (this.swishAcc > 0.5 && this.t - this.lastSwish > 0.3) {
      this.lastSwish = this.t;
      this.onSwish?.(Math.min(1, this.swishAcc / 2));
      this.swishAcc = 0;
    }
  }

  updateFlakes(dt) {
    const W = this.W, om = this.omega, E = this.energy;
    const turb = Math.min(1.5, this.churn + Math.hypot(W.x, W.y) * 0.5);
    const k = Math.min(1, dt * 2.5);
    const lim = 0.949;
    for (const f of this.flakes) {
      if (f.settled) {
        if (E > 0.22 && Math.random() < (E - 0.2) * dt * 8) {
          f.settled = false;
          f.vx = W.x * sgRand(0.5, 1.2) + sgRand(-1, 1) * E * 0.5;
          f.vy = -sgRand(0.6, 1.8) * Math.min(E, 2);
          f.vz = sgRand(-1, 1) * E * 0.5;
        }
        continue;
      }
      // Drift with the water, sink slowly, flutter a little
      const flutter = Math.sin(this.t * f.rate + f.phase);
      const tx = W.x - om * f.y + flutter * 0.03;
      const ty = W.y + om * f.x + f.fall;
      const tz = W.z + Math.cos(this.t * f.rate * 0.7 + f.phase) * 0.02;
      // Eddies: random kicks while the water is still moving
      f.vx += (tx - f.vx) * k + (Math.random() - 0.5) * turb * dt * 7;
      f.vy += (ty - f.vy) * k + (Math.random() - 0.5) * turb * dt * 7;
      f.vz += (tz - f.vz) * k + (Math.random() - 0.5) * turb * dt * 7;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;

      // Stay inside the glass, sliding along it
      const r2 = f.x * f.x + f.y * f.y + f.z * f.z;
      if (r2 > lim * lim) {
        const r = Math.sqrt(r2), nx = f.x / r, ny = f.y / r, nz = f.z / r;
        f.x = nx * lim; f.y = ny * lim; f.z = nz * lim;
        const vn = f.vx * nx + f.vy * ny + f.vz * nz;
        if (vn > 0) { f.vx -= vn * nx; f.vy -= vn * ny; f.vz -= vn * nz; }
      }

      // Land on the ground or the roof, or bounce if the water is rough
      const sy = this.surfaceY(f.x, f.z);
      if (f.y >= sy) {
        if (E < 0.6 && f.vy > -0.05) {
          f.y = sy - Math.random() * 0.012;
          f.settled = true;
          f.vx = f.vy = f.vz = 0;
        } else {
          f.y = sy;
          f.vy = -Math.abs(f.vy) * 0.5;
        }
      }
    }
  }

  updateMusicBox(dt) {
    if (this.preview) this.wind = 1;
    if (this.wind <= 0) return;
    this.wind = Math.max(0, this.wind - dt / 45);
    const speed = sgClamp(this.wind / 0.2, 0.2, 1); // it slows as it runs down
    this.keyAngle += dt * 2 * speed;
    this.trainA += dt * 0.32 * speed;
    this.stepAcc += dt * speed;
    while (this.stepAcc >= 0.34) {
      this.stepAcc -= 0.34;
      const [m, b] = SG_MELODY[this.step % SG_MELODY.length];
      this.step++;
      if (m || b) this.onNote?.(m, b, speed);
    }
  }

  updateSmoke(dt) {
    const H = SG_HOUSE, base = this.groundY(H.x);
    if (this.lightsOn) {
      this.smokeAcc += dt;
      if (this.smokeAcc > 0.45) {
        this.smokeAcc = 0;
        this.smoke.push({ x: H.x + H.w * 0.59, y: base - H.wall - H.roof * 1.1, life: 0, r: sgRand(0.02, 0.035) });
      }
    }
    for (const s of this.smoke) {
      s.life += dt;
      s.x += (this.W.x * 0.8 + Math.sin(s.life * 1.3) * 0.01) * dt;
      s.y += (this.W.y * 0.8 - 0.05) * dt;
      s.r += dt * 0.02;
    }
    this.smoke = this.smoke.filter(s => s.life < 4.5 && s.y > -0.95);
  }

  // ---------- Drawing ----------
  draw() {
    const c = this.ctx, R = this.R;
    c.clearRect(0, 0, this.w, this.h);
    if (!this.room) this.room = this.paintRoom();
    c.drawImage(this.room, 0, 0, this.w, this.h);

    // Shadow and lamplight on the table
    const sx = this.cx + this.off.x * 0.6, sy = this.cy + R * 1.2;
    const sh = c.createRadialGradient(sx, sy, 0, sx, sy, R * 1.2);
    sh.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = sh;
    c.beginPath();
    c.ellipse(sx, sy, R * 1.2, R * 0.16, 0, 0, SG_TAU);
    c.fill();

    c.save();
    c.translate(this.cx + this.off.x, this.cy + this.off.y);
    c.translate(0, R * 1.2);
    c.rotate(this.tilt || 0);
    c.translate(0, -R * 1.2);

    // A soft halo of light around the glass
    const halo = c.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 1.5);
    halo.addColorStop(0, this.lightsOn ? 'rgba(255, 210, 150, 0.1)' : 'rgba(170, 200, 255, 0.08)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = halo;
    c.fillRect(-R * 1.5, -R * 1.5, R * 3, R * 3);

    this.drawInside(c);
    this.drawGlass(c);
    this.drawBase(c);
    c.restore();
  }

  paintRoom() {
    const { w, h, dpr } = this;
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);

    const wall = c.createLinearGradient(0, 0, 0, this.tableY);
    wall.addColorStop(0, '#16131f');
    wall.addColorStop(1, '#2a2130');
    c.fillStyle = wall;
    c.fillRect(0, 0, w, this.tableY);

    // A window far behind, out of focus, snowing outside
    const wx = w * 0.08, wy = h * 0.1, ww = w * 0.22, wh = this.tableY - h * 0.16;
    const win = c.createLinearGradient(0, wy, 0, wy + wh);
    win.addColorStop(0, 'rgba(70, 95, 150, 0.22)');
    win.addColorStop(1, 'rgba(120, 140, 190, 0.12)');
    c.save();
    c.filter = `blur(${Math.max(4, w * 0.008)}px)`;
    c.fillStyle = win;
    c.fillRect(wx, wy, ww, wh);
    c.restore();

    // Fairy lights strung across the wall, blurred into bokeh
    const bulbs = 16, sag = h * 0.08;
    for (let i = 0; i < bulbs; i++) {
      const u = i / (bulbs - 1);
      const x = w * (0.04 + u * 0.92);
      const y = h * 0.1 + Math.sin(u * Math.PI) * sag + Math.sin(i * 2.3) * 4;
      const r = sgRand(10, 24) * Math.max(0.6, Math.min(1.4, w / 1200));
      const col = ['255, 207, 138', '255, 176, 112', '255, 226, 168'][i % 3];
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${col}, 0.55)`);
      g.addColorStop(0.6, `rgba(${col}, 0.18)`);
      g.addColorStop(1, `rgba(${col}, 0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, SG_TAU);
      c.fill();
    }
    for (let i = 0; i < 7; i++) {
      const x = sgRand(0, w), y = sgRand(h * 0.05, this.tableY * 0.9), r = sgRand(30, 70);
      c.fillStyle = Math.random() < 0.5 ? 'rgba(255, 200, 140, 0.05)' : 'rgba(150, 180, 255, 0.04)';
      c.beginPath();
      c.arc(x, y, r, 0, SG_TAU);
      c.fill();
    }

    // The table
    const table = c.createLinearGradient(0, this.tableY, 0, h);
    table.addColorStop(0, '#3d2b20');
    table.addColorStop(1, '#170f0a');
    c.fillStyle = table;
    c.fillRect(0, this.tableY, w, h - this.tableY);
    c.strokeStyle = 'rgba(255, 220, 180, 0.08)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, this.tableY + 0.5);
    c.lineTo(w, this.tableY + 0.5);
    c.stroke();
    c.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    for (let i = 1; i < 9; i++) {
      const y = this.tableY + (h - this.tableY) * (i / 9) ** 1.4;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(w * 0.3, y + 3, w * 0.6, y - 3, w, y + 1);
      c.stroke();
    }
    // Lamplight pooling on the table around the globe
    const pool = c.createRadialGradient(this.cx, this.cy + this.R * 1.2, 0, this.cx, this.cy + this.R * 1.2, this.R * 2.4);
    pool.addColorStop(0, 'rgba(255, 200, 140, 0.12)');
    pool.addColorStop(1, 'rgba(255, 200, 140, 0)');
    c.fillStyle = pool;
    c.fillRect(0, this.tableY, w, h - this.tableY);
    return cv;
  }

  /** The sky behind the village, cached until the time of day changes. */
  paintSky() {
    const R = this.R, dpr = this.dpr, P = this.palette;
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.round(R * 2 * dpr);
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.translate(R, R);

    const sky = c.createLinearGradient(0, -R, 0, R * 0.4);
    sky.addColorStop(0, P.top);
    sky.addColorStop(1, P.bottom);
    c.fillStyle = sky;
    c.fillRect(-R, -R, R * 2, R * 2);

    if (this.phase !== 'day') {
      const stars = this.phase === 'night' ? 70 : 25;
      for (let i = 0; i < stars; i++) {
        const x = sgRand(-0.9, 0.9) * R, y = sgRand(-0.95, 0.15) * R;
        c.fillStyle = `rgba(255, 255, 255, ${sgRand(0.25, 0.85) * (this.phase === 'night' ? 1 : 0.5)})`;
        c.fillRect(x, y, sgRand(0.6, 1.6), sgRand(0.6, 1.6));
      }
      // The moon
      const mx = R * 0.45, my = -R * 0.45, mr = R * 0.08;
      const mg = c.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4);
      mg.addColorStop(0, 'rgba(255, 250, 230, 0.25)');
      mg.addColorStop(1, 'rgba(255, 250, 230, 0)');
      c.fillStyle = mg;
      c.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      c.fillStyle = '#f4efdc';
      c.beginPath();
      c.arc(mx, my, mr, 0, SG_TAU);
      c.fill();
    } else {
      const sg = c.createRadialGradient(-R * 0.4, -R * 0.4, 0, -R * 0.4, -R * 0.4, R * 0.8);
      sg.addColorStop(0, 'rgba(255, 255, 240, 0.5)');
      sg.addColorStop(1, 'rgba(255, 255, 240, 0)');
      c.fillStyle = sg;
      c.fillRect(-R, -R, R * 2, R * 2);
    }

    // Distant hills
    c.fillStyle = P.hill;
    c.beginPath();
    c.moveTo(-R, R * 0.3);
    for (let x = -1; x <= 1.001; x += 0.05) {
      const y = 0.18 - 0.1 * Math.sin(x * 3.1 + 1) - 0.05 * Math.sin(x * 7.3);
      c.lineTo(x * R, y * R);
    }
    c.lineTo(R, R);
    c.lineTo(-R, R);
    c.closePath();
    c.fill();
    return cv;
  }

  drawInside(c) {
    const R = this.R, P = this.palette;
    if (!this.sky) this.sky = this.paintSky();
    c.save();
    c.beginPath();
    c.arc(0, 0, R * 0.985, 0, SG_TAU);
    c.clip();
    c.drawImage(this.sky, -R, -R, R * 2, R * 2);

    this.drawFlakes(c, f => !f.settled && f.z < 0);

    // The snowy ground
    const gr = c.createLinearGradient(0, R * 0.34, 0, R);
    gr.addColorStop(0, P.snow);
    gr.addColorStop(1, P.shade);
    c.fillStyle = gr;
    c.beginPath();
    c.moveTo(-R, this.groundY(-1) * R);
    for (let x = -1; x <= 1.001; x += 0.05) c.lineTo(x * R, this.groundY(x) * R);
    c.lineTo(R, R);
    c.lineTo(-R, R);
    c.closePath();
    c.fill();

    this.drawTrack(c, false);
    this.drawTrain(c, false);
    [[-0.72, 0.28], [-0.5, 0.44], [-0.32, 0.24], [0.56, 0.38], [0.75, 0.24]].forEach(([x, hgt]) => this.drawTree(c, x, hgt));
    this.drawCottage(c);
    this.drawSmoke(c);
    this.drawTrack(c, true);
    this.drawTrain(c, true);
    this.drawFlakes(c, f => f.settled);
    this.drawFlakes(c, f => !f.settled && f.z >= 0);
    c.restore();
  }

  drawFlakes(c, which) {
    const R = this.R, base = R / 220;
    for (const f of this.flakes) {
      if (!which(f)) continue;
      const X = f.x * R, Y = f.y * R;
      const s = f.size * base * (1 + 0.35 * f.z) * 2.2;
      if (f.glitter) {
        const tw = Math.pow(Math.max(0, Math.sin(this.t * f.rate * 3 + f.phase)), 4);
        c.globalAlpha = 0.35 + 0.65 * tw;
        c.drawImage(this.glitterSprite, X - s, Y - s, s * 2, s * 2);
        if (tw > 0.7) {
          c.strokeStyle = `rgba(255, 245, 210, ${(tw - 0.7) * 2})`;
          c.lineWidth = 0.8;
          c.beginPath();
          c.moveTo(X - s * 2, Y); c.lineTo(X + s * 2, Y);
          c.moveTo(X, Y - s * 2); c.lineTo(X, Y + s * 2);
          c.stroke();
        }
      } else {
        c.globalAlpha = f.settled ? 0.85 : 0.5 + 0.22 * (f.z + 1);
        c.drawImage(this.flakeSprite, X - s, Y - s, s * 2, s * 2);
      }
    }
    c.globalAlpha = 1;
  }

  drawTrack(c, front) {
    const R = this.R;
    c.strokeStyle = 'rgba(70, 60, 70, 0.55)';
    c.lineWidth = Math.max(1, R * 0.008);
    c.beginPath();
    let started = false;
    for (let a = 0; a <= SG_TAU + 0.01; a += 0.05) {
      const p = this.trainPos(a);
      if ((p.z >= 0) !== front) { started = false; continue; }
      if (!started) { c.moveTo(p.x * R, p.y * R); started = true; } else c.lineTo(p.x * R, p.y * R);
    }
    c.stroke();
  }

  drawTrain(c, front) {
    const R = this.R;
    for (let i = 3; i >= 0; i--) {
      const a = this.trainA - i * 0.26;
      const p = this.trainPos(a);
      if ((p.z >= 0) !== front) continue;
      const depth = 0.85 + 0.15 * p.z;
      const len = (0.035 + 0.08 * Math.abs(Math.sin(a))) * R * depth;
      const ht = 0.055 * R * depth;
      const X = p.x * R, Y = p.y * R;
      c.fillStyle = i === 0 ? '#8c2f2f' : '#2f5a46';
      c.fillRect(X - len / 2, Y - ht, len, ht);
      if (i === 0) c.fillRect(X - len * 0.1, Y - ht * 1.5, len * 0.22, ht * 0.5);
      // Lit windows and a cap of snow
      c.fillStyle = this.lightsOn ? '#ffd27a' : '#41506e';
      if (i > 0 && len > R * 0.05) c.fillRect(X - len * 0.3, Y - ht * 0.75, len * 0.6, ht * 0.3);
      c.fillStyle = 'rgba(255, 255, 255, 0.9)';
      c.fillRect(X - len / 2, Y - ht - R * 0.008, len, R * 0.01);
      c.fillStyle = '#1b1b22';
      c.beginPath();
      c.arc(X - len * 0.3, Y, R * 0.009, 0, SG_TAU);
      c.arc(X + len * 0.3, Y, R * 0.009, 0, SG_TAU);
      c.fill();
    }
  }

  drawTree(c, x, hgt) {
    const R = this.R, by = this.groundY(x) * R + R * 0.01, X = x * R, H = hgt * R;
    c.fillStyle = '#4a3428';
    c.fillRect(X - H * 0.04, by - H * 0.15, H * 0.08, H * 0.16);
    for (let i = 0; i < 3; i++) {
      const top = by - H * (0.45 + i * 0.27) - H * 0.12, bot = by - H * (0.1 + i * 0.27), half = H * (0.34 - i * 0.08);
      c.fillStyle = this.phase === 'day' ? '#2f5747' : '#24413a';
      c.beginPath();
      c.moveTo(X, top);
      c.lineTo(X + half, bot);
      c.lineTo(X - half, bot);
      c.closePath();
      c.fill();
      // Snow along the lower edge of each tier
      c.strokeStyle = 'rgba(250, 252, 255, 0.92)';
      c.lineWidth = H * 0.035;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(X - half * 0.95, bot - H * 0.01);
      c.quadraticCurveTo(X, bot - H * 0.05, X + half * 0.95, bot - H * 0.01);
      c.stroke();
    }
  }

  drawCottage(c) {
    const R = this.R, H = SG_HOUSE, P = this.palette;
    const base = this.groundY(H.x) * R + R * 0.01;
    const X = H.x * R, hw = H.w * R, wall = H.wall * R, roof = H.roof * R, eave = H.eave * R;
    const lit = this.lightsOn;

    // Warm light spilling on the snow
    if (lit) {
      const g = c.createRadialGradient(X, base, 0, X, base, R * 0.35);
      g.addColorStop(0, 'rgba(255, 200, 120, 0.35)');
      g.addColorStop(1, 'rgba(255, 200, 120, 0)');
      c.fillStyle = g;
      c.fillRect(X - R * 0.4, base - R * 0.3, R * 0.8, R * 0.45);
    }

    // Walls with a shaded right side
    const wg = c.createLinearGradient(X - hw, 0, X + hw, 0);
    wg.addColorStop(0, '#9a6448');
    wg.addColorStop(1, '#6e4232');
    c.fillStyle = wg;
    c.fillRect(X - hw, base - wall, hw * 2, wall);

    // Chimney
    c.fillStyle = '#5b3a33';
    c.fillRect(X + hw * 0.45, base - wall - roof * 1.05, hw * 0.28, roof * 0.6);
    c.fillStyle = P.snow;
    c.fillRect(X + hw * 0.42, base - wall - roof * 1.1, hw * 0.34, roof * 0.1);

    // Roof and its cap of snow
    c.fillStyle = '#463438';
    c.beginPath();
    c.moveTo(X - eave, base - wall + R * 0.01);
    c.lineTo(X, base - wall - roof);
    c.lineTo(X + eave, base - wall + R * 0.01);
    c.closePath();
    c.fill();
    c.fillStyle = P.snow;
    c.beginPath();
    c.moveTo(X - eave * 1.02, base - wall + R * 0.005);
    c.lineTo(X, base - wall - roof - R * 0.014);
    c.lineTo(X + eave * 1.02, base - wall + R * 0.005);
    c.lineTo(X + eave * 0.9, base - wall + R * 0.022);
    c.lineTo(X, base - wall - roof + R * 0.03);
    c.lineTo(X - eave * 0.9, base - wall + R * 0.022);
    c.closePath();
    c.fill();

    // Door and windows
    c.fillStyle = '#3a2620';
    c.fillRect(X - hw * 0.62, base - wall * 0.62, hw * 0.36, wall * 0.62);
    const winCol = lit ? '#ffd27a' : '#2c3550';
    const windows = [[X + hw * 0.08, base - wall * 0.7], [X - hw * 0.12, base - wall - roof * 0.55]];
    windows.forEach(([wx, wy], i) => {
      const s = i === 0 ? hw * 0.42 : hw * 0.26;
      if (lit) {
        const g = c.createRadialGradient(wx + s / 2, wy + s / 2, 0, wx + s / 2, wy + s / 2, s * 1.6);
        g.addColorStop(0, 'rgba(255, 210, 130, 0.45)');
        g.addColorStop(1, 'rgba(255, 210, 130, 0)');
        c.fillStyle = g;
        c.fillRect(wx - s, wy - s, s * 3, s * 3);
      }
      c.fillStyle = winCol;
      c.fillRect(wx, wy, s, s * 0.85);
      c.strokeStyle = '#3a2620';
      c.lineWidth = Math.max(1, s * 0.08);
      c.strokeRect(wx, wy, s, s * 0.85);
      c.beginPath();
      c.moveTo(wx + s / 2, wy);
      c.lineTo(wx + s / 2, wy + s * 0.85);
      c.stroke();
    });
  }

  drawSmoke(c) {
    const R = this.R;
    for (const s of this.smoke) {
      const a = Math.min(1, s.life * 2) * (1 - s.life / 4.5) * 0.35;
      if (a <= 0) continue;
      c.globalAlpha = a;
      const r = s.r * R;
      c.drawImage(this.smokeSprite, s.x * R - r, s.y * R - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
  }

  drawGlass(c) {
    const R = this.R;
    // Thicker, darker glass towards the rim
    const rim = c.createRadialGradient(-R * 0.15, -R * 0.2, R * 0.55, 0, 0, R);
    rim.addColorStop(0, 'rgba(255, 255, 255, 0)');
    rim.addColorStop(0.85, 'rgba(180, 210, 255, 0.07)');
    rim.addColorStop(0.95, 'rgba(190, 215, 255, 0.18)');
    rim.addColorStop(1, 'rgba(20, 30, 60, 0.4)');
    c.fillStyle = rim;
    c.beginPath();
    c.arc(0, 0, R, 0, SG_TAU);
    c.fill();

    c.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    c.lineWidth = Math.max(1, R * 0.006);
    c.stroke();

    // Big soft reflection of the room, upper left
    c.save();
    c.translate(-R * 0.42, -R * 0.48);
    c.rotate(-0.65);
    const hl = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.34);
    hl.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = hl;
    c.scale(1, 0.45);
    c.beginPath();
    c.arc(0, 0, R * 0.34, 0, SG_TAU);
    c.fill();
    c.restore();

    // Warm light caught along the right edge
    c.strokeStyle = 'rgba(255, 225, 180, 0.16)';
    c.lineWidth = R * 0.035;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, R * 0.92, -0.35, 0.75);
    c.stroke();

    // A small glint
    const gl = c.createRadialGradient(-R * 0.5, -R * 0.6, 0, -R * 0.5, -R * 0.6, R * 0.04);
    gl.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    gl.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = gl;
    c.fillRect(-R * 0.55, -R * 0.65, R * 0.1, R * 0.1);

    // Fairy lights reflected small in the top of the glass
    for (let i = 0; i < 6; i++) {
      const a = -2.4 + i * 0.28;
      const tw = 0.4 + 0.3 * Math.sin(this.t * 1.5 + i * 1.7);
      c.fillStyle = `rgba(255, 215, 150, ${tw})`;
      c.beginPath();
      c.arc(Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88, R * 0.008, 0, SG_TAU);
      c.fill();
    }
  }

  drawBase(c) {
    const R = this.R;
    const top = R * 0.8, bot = R * 1.2, tw = R * 0.68, bw = R * 0.86;

    // Wooden body
    const wood = c.createLinearGradient(-bw, 0, bw, 0);
    wood.addColorStop(0, '#3e2617');
    wood.addColorStop(0.4, '#8a5a36');
    wood.addColorStop(0.55, '#7a4d2d');
    wood.addColorStop(1, '#311d11');
    c.fillStyle = wood;
    c.beginPath();
    c.moveTo(-tw, top);
    c.bezierCurveTo(-tw * 1.05, top + (bot - top) * 0.5, -bw, bot - R * 0.06, -bw, bot);
    c.ellipse(0, bot, bw, R * 0.08, 0, Math.PI, 0, true);
    c.bezierCurveTo(bw, bot - R * 0.06, tw * 1.05, top + (bot - top) * 0.5, tw, top);
    c.closePath();
    c.fill();

    // Brass band where the glass meets the wood
    const brass = c.createLinearGradient(-tw, 0, tw, 0);
    brass.addColorStop(0, '#7a5a20');
    brass.addColorStop(0.35, '#f1d58a');
    brass.addColorStop(0.6, '#c9a24a');
    brass.addColorStop(1, '#6b4e1a');
    c.fillStyle = brass;
    c.beginPath();
    c.ellipse(0, top + R * 0.04, tw * 1.01, R * 0.075, 0, 0, Math.PI);
    c.lineTo(-tw * 1.01, top - R * 0.005);
    c.ellipse(0, top - R * 0.005, tw * 1.01, R * 0.06, 0, Math.PI, 0, true);
    c.closePath();
    c.fill();

    // A small brass plaque
    c.fillStyle = 'rgba(241, 213, 138, 0.75)';
    c.beginPath();
    c.ellipse(0, R * 1.02, R * 0.12, R * 0.045, 0, 0, SG_TAU);
    c.fill();
    c.fillStyle = 'rgba(90, 60, 20, 0.7)';
    c.font = `${Math.max(7, R * 0.05)}px serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('❄', 0, R * 1.022);

    // The winding key on the side, turning while the music plays
    const kx = R * 0.93, ky = R * 1.0, spin = Math.cos(this.keyAngle);
    c.strokeStyle = '#b8913d';
    c.lineWidth = R * 0.022;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(R * 0.84, ky);
    c.lineTo(kx, ky);
    c.stroke();
    c.fillStyle = '#d9b562';
    c.strokeStyle = '#8a6a26';
    c.lineWidth = Math.max(1, R * 0.008);
    // Two wings that narrow to an edge as the key turns
    const wing = Math.max(R * 0.005, R * 0.032 * Math.abs(spin));
    [-1, 1].forEach(side => {
      c.beginPath();
      c.ellipse(kx + R * 0.02, ky + side * R * 0.034, wing, R * 0.03, 0, 0, SG_TAU);
      c.fill();
      c.stroke();
    });
    c.beginPath();
    c.arc(kx + R * 0.02, ky, R * 0.014, 0, SG_TAU);
    c.fill();
    c.stroke();
  }
}
