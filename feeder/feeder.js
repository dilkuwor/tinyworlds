/**
 * feeder.js - The Feeder: a garden bird feeder seen from the window
 *
 * Scatter seed and birds come: they fly in along curved paths, land on
 * perches (the feeder, its tray, the fence, a branch, or the ground among
 * the seed), peck, hop, sing, and leave when they are full. Fast movement
 * startles them and the flock bursts away, drifting back a little later.
 * A blue jay bullies smaller birds off the feeder.
 *
 * Used full-screen by scene.js and as a live preview on the homepage.
 */

const BIRD_SPECIES = {
  sparrow: {
    name: 'House sparrow', size: 1, weight: 5, ground: 0.7,
    body: '#8a6a4a', belly: '#dccbb2', head: '#86684a', cap: '#6b4a2e', cheek: '#cfc2ad',
    wing: '#6e5236', bars: '#efe0c0', tail: '#5a4330', beak: '#5b4a3a'
  },
  goldfinch: {
    name: 'Goldfinch', size: 0.9, weight: 3.5, ground: 0.3,
    body: '#f2c81e', belly: '#f8de5c', head: '#f2c81e', cap: '#1b1b1b',
    wing: '#1f1f1f', bars: '#ffffff', tail: '#262626', beak: '#e9a87a'
  },
  chickadee: {
    name: 'Chickadee', size: 0.85, weight: 3, ground: 0.2,
    body: '#9aa3a8', belly: '#efe6d6', head: '#f4f3ee', cap: '#151515', bib: '#151515',
    wing: '#7b858c', bars: '#e3e7e9', tail: '#6d767c', beak: '#222222'
  },
  cardinal: {
    name: 'Cardinal', size: 1.12, weight: 1.3, ground: 0.6, crest: true,
    body: '#c8102e', belly: '#d93a4e', head: '#cc1531', cap: '#c8102e', mask: '#151012',
    wing: '#a50e26', bars: '#b81a33', tail: '#9a0c22', beak: '#f28a1e'
  },
  bluejay: {
    name: 'Blue jay', size: 1.32, weight: 0.8, ground: 0.5, crest: true, bully: true,
    body: '#5b8fcf', belly: '#eef2f5', head: '#5b8fcf', cap: '#4f82c2', necklace: '#151515', cheek: '#eef2f5',
    wing: '#2f6bb3', bars: '#ffffff', tail: '#3a6fb0', beak: '#1d1d1d'
  },
  robin: {
    name: 'Robin', size: 1, weight: 0.8, ground: 0.8,
    body: '#8a7458', belly: '#efe4d4', breast: '#e8692c', head: '#8a7458', cap: '#7c6850', face: '#e8692c',
    wing: '#7a6448', bars: '#8f7a5e', tail: '#6e5a42', beak: '#2e2a26'
  }
};

const FEEDER_MOODS = {
  morning: {
    label: 'Morning', icon: '🌅', sky: ['#bfdcf2', '#f4e2cf'], sun: [0.2, 0.22, '255, 236, 200'],
    hills: ['#a9c3b8', '#8fb39a'], grass: ['#a2c77f', '#76a35a'], fence: '#c9b49a', leaves: ['#7fae6a', '#6a9a58'],
    grade: 'rgba(255, 230, 200, 0.10)', weights: {}
  },
  midday: {
    label: 'Midday', icon: '☀️', sky: ['#78bcee', '#cfe9fb'], sun: [0.78, 0.12, '255, 250, 230'],
    hills: ['#9cc0a6', '#7fae86'], grass: ['#93c76d', '#5f9a48'], fence: '#cdb89c', leaves: ['#78ad62', '#5f9450'],
    grade: null, weights: {}
  },
  golden: {
    label: 'Golden hour', icon: '🌇', sky: ['#f3b673', '#f7dcb2'], sun: [0.84, 0.3, '255, 200, 120'],
    hills: ['#b9a77a', '#9c9a66'], grass: ['#b1b65e', '#8a9446'], fence: '#c99f72', leaves: ['#9aa457', '#7f8c44'],
    grade: 'rgba(255, 170, 90, 0.16)', weights: { cardinal: 2 }
  },
  winter: {
    label: 'Winter', icon: '❄️', sky: ['#c6d4e2', '#eef2f6'], sun: [0.7, 0.18, '245, 248, 255'],
    hills: ['#c9d3dc', '#b7c3cd'], grass: ['#f4f7fa', '#dfe7ee'], fence: '#a99682', leaves: ['#8a9aa6', '#7b8b97'],
    grade: 'rgba(210, 225, 245, 0.10)', snow: true, weights: { goldfinch: 0, robin: 3, chickadee: 4.5, cardinal: 2 }
  }
};

const FTAU = Math.PI * 2;
const frand = (a, b) => a + Math.random() * (b - a);
const fclamp = (v, a, b) => Math.max(a, Math.min(b, v));

class FeederWorld {
  constructor(canvas, { preview = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = preview;
    const now = new Date(), hr = now.getHours(), mo = now.getMonth();
    this.mood = [11, 0, 1].includes(mo) ? 'winter' : hr >= 10 && hr < 16 ? 'midday' : hr >= 16 && hr < 21 ? 'golden' : 'morning';
    this.t = 0;
    this.birds = [];
    this.seeds = [];        // on the ground
    this.falling = [];      // seeds in the air
    this.snow = [];
    this.feederSeed = 0.65; // 0 … 1
    this.seen = new Set();
    this.arrivalTimer = 1.5;
    this.onSong = null;     // (species) => void
    this.onFlutter = null;  // (count) => void
  }

  // ---------- Layout ----------
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    const S = this.S = fclamp(Math.min(w, h) / 640, 0.55, 1.5) * (this.preview ? 0.9 : 1);
    this.groundY = this.preview ? h * 0.84 : h - Math.max(105, h * 0.2);
    this.fenceTop = this.groundY - 74 * S;
    this.fenceBottom = this.groundY - 4 * S;

    // Branch from the tree on the right, reaching across to hold the feeder
    const fx = this.preview ? w * 0.62 : w * 0.64;
    this.branch = { x0: w + 30, y0: h * 0.08, x1: fx - 150 * S, y1: h * 0.2 };
    this.feeder = {
      x: fx,
      hangY: this.branchY(fx),
      top: this.branchY(fx) + 80 * S + (h > w ? h * 0.12 : 0), // hang lower on tall screens
      tubeH: 175 * S,
      tubeW: 40 * S
    };
    const F = this.feeder;
    F.bottom = F.top + F.tubeH;
    F.trayY = F.bottom + 10 * S;

    // Perches: places a bird can land
    const P = [];
    [0.32, 0.74].forEach(u => {
      const y = F.top + F.tubeH * u;
      P.push({ x: F.x - F.tubeW / 2 - 30 * S, y, kind: 'feeder', face: 1 });
      P.push({ x: F.x + F.tubeW / 2 + 30 * S, y, kind: 'feeder', face: -1 });
    });
    P.push({ x: F.x - 62 * S, y: F.trayY, kind: 'tray', face: 1 });
    P.push({ x: F.x + 62 * S, y: F.trayY, kind: 'tray', face: -1 });
    [0.22, 0.5, 0.8].forEach(u => {
      const x = this.branch.x1 + (w - this.branch.x1) * u;
      if (Math.abs(x - F.x) > 50 * S) P.push({ x, y: this.branchY(x) - 3 * S, kind: 'branch', face: null });
    });
    this.posts = [];
    for (let x = 16 * S; x < w; x += 58 * S) this.posts.push(x);
    this.posts.forEach((x, i) => {
      if (i % 2 === 0 && x < w * 0.5) P.push({ x, y: this.fenceTop - 2 * S, kind: 'fence', face: null });
    });
    P.forEach(p => { p.bird = null; });
    this.perches = P;

    // Re-seat birds after a resize
    this.birds = [];
    this.seeds = this.seeds.filter(s => s.x < w).map(s => ({ ...s, y: this.groundY + s.d * 20 * S }));
    this.flowers = Array.from({ length: Math.round(w / (70 * S)) }, () => ({
      x: Math.random() * w, d: Math.random(), c: ['#f7a8b8', '#ffffff', '#f9d65c', '#b9a2f2'][Math.floor(Math.random() * 4)], h: frand(10, 26)
    }));
    this.blades = Array.from({ length: Math.round(w / (6 * S)) }, (_, i) => ({ x: i * 6 * S + frand(-3, 3), h: frand(10, 26), ph: Math.random() * 6 }));
    this.clouds = Array.from({ length: Math.max(3, Math.round(w / 380)) }, () => ({
      x: Math.random() * w, y: h * frand(0.06, 0.32), s: frand(0.7, 1.3), v: frand(4, 10)
    }));
    this.hillTrees = Array.from({ length: Math.round(w / (120 * S)) }, () => ({ x: Math.random() * w, r: frand(14, 26) * S }));
    this.leafClusters = Array.from({ length: 9 }, (_, i) => {
      const u = i / 8;
      const x = this.branch.x1 + (w + 30 - this.branch.x1) * (0.15 + u * 0.85);
      return { x, y: this.branchY(x) - frand(10, 40) * S, r: frand(26, 46) * S };
    });
  }

  branchY(x) {
    const B = this.branch;
    const u = fclamp((x - B.x1) / (B.x0 - B.x1), 0, 1);
    return B.y1 + (B.y0 - B.y1) * u + Math.sin(u * Math.PI) * -12 * (this.S || 1);
  }

  setMood(m) {
    if (FEEDER_MOODS[m]) this.mood = m;
  }

  // ---------- Seed ----------
  scatter(x, y, n = 26) {
    const S = this.S;
    for (let i = 0; i < n; i++) {
      this.falling.push({
        x: x + frand(-14, 14) * S, y: Math.min(y, this.groundY - 10 * S),
        vx: frand(-90, 90) * S, vy: frand(-160, -20) * S,
        d: Math.random(), c: Math.random() < 0.35 ? '#2b2622' : Math.random() < 0.5 ? '#c9a46a' : '#a77c47'
      });
    }
  }

  refill() {
    this.feederSeed = 1;
  }

  hitFeeder(x, y) {
    const F = this.feeder;
    return Math.abs(x - F.x) < F.tubeW * 0.9 && y > F.top - 20 * this.S && y < F.trayY + 10 * this.S;
  }

  // ---------- Birds ----------
  pickSpecies() {
    const M = FEEDER_MOODS[this.mood];
    const entries = Object.entries(BIRD_SPECIES).map(([k, s]) => [k, M.weights[k] ?? s.weight]);
    const total = entries.reduce((a, [, wgt]) => a + wgt, 0);
    let r = Math.random() * total;
    for (const [k, wgt] of entries) { r -= wgt; if (r <= 0) return k; }
    return 'sparrow';
  }

  maxBirds() {
    return this.preview ? 6 : Math.round(fclamp(this.w / 140, 5, 12));
  }

  /** Choose somewhere to land: food first, otherwise a resting spot. */
  choosePerch(sp, wantFood = true) {
    const groundy = BIRD_SPECIES[sp].ground;
    const freeFeeder = this.perches.filter(p => !p.bird && (p.kind === 'feeder' || p.kind === 'tray'));
    const rest = this.perches.filter(p => !p.bird && (p.kind === 'fence' || p.kind === 'branch'));
    if (wantFood) {
      if (this.seeds.length > 3 && Math.random() < groundy) {
        const spot = this.freeGroundSpot();
        if (spot) return spot;
      }
      if (this.feederSeed > 0.02 && freeFeeder.length) return freeFeeder[Math.floor(Math.random() * freeFeeder.length)];
      if (this.seeds.length > 0) {
        const spot = this.freeGroundSpot();
        if (spot) return spot;
      }
    }
    return rest.length ? rest[Math.floor(Math.random() * rest.length)] : null;
  }

  spawnBird(sp = this.pickSpecies(), perch = null) {
    perch = perch || this.choosePerch(sp, this.hasFood());
    if (!perch) return null;
    const S = this.S;
    const fromLeft = perch.x > this.w * 0.5 ? Math.random() < 0.3 : Math.random() < 0.7;
    const b = {
      sp, x: fromLeft ? -40 : this.w + 40, y: frand(this.h * 0.05, this.h * 0.4),
      dir: fromLeft ? 1 : -1, state: 'flying', t: 0, flap: Math.random() * 6,
      k: BIRD_SPECIES[sp].size * S * 1.3 * (perch.kind === 'fence' ? 0.9 : 1),
      satiety: 0, full: frand(6, 14), nextAct: frand(0.4, 1.2), peck: 0, hop: null, look: 0,
      perch: null, id: Math.random()
    };
    this.flyTo(b, perch);
    this.birds.push(b);
    if (perch.kind !== 'ground') perch.bird = b;
    return b;
  }

  flyTo(b, perch, speed = 300) {
    const S = this.S;
    const x1 = perch.x, y1 = perch.y;
    const dist = Math.hypot(x1 - b.x, y1 - b.y);
    b.path = {
      x0: b.x, y0: b.y, x1, y1,
      cx: (b.x + x1) / 2 + frand(-60, 60) * S,
      cy: Math.min(b.y, y1) - frand(40, 120) * S,
      dur: Math.max(0.6, dist / (speed * S)), u: 0
    };
    b.state = b.state === 'startled' ? 'startled' : 'flying';
    b.target = perch;
    b.dir = x1 >= b.x ? 1 : -1;
  }

  leave(b, startled = false) {
    if (b.perch && b.perch.bird === b) b.perch.bird = null;
    if (b.target && b.target.bird === b) b.target.bird = null;
    b.perch = null;
    const exitLeft = startled ? b.x < this.w / 2 : Math.random() < 0.5;
    const exit = { x: exitLeft ? -60 : this.w + 60, y: frand(-40, this.h * 0.25), kind: 'exit', bird: null };
    b.state = startled ? 'startled' : 'leaving';
    this.flyTo(b, exit, startled ? 620 : 300);
    b.state = startled ? 'startled' : 'leaving';
    if (this.onFlutter) this.onFlutter(startled ? 2 : 1);
  }

  /** Startle birds near a point; strength 0 … 1. Fear spreads through the flock. */
  startle(x, y, radius = 160, strength = 1) {
    const S = this.S;
    let n = 0;
    for (const b of this.birds) {
      if (b.state === 'leaving' || b.state === 'startled') continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < radius * S || (n > 0 && d < radius * 2.2 * S && Math.random() < 0.6 * strength)) {
        this.leave(b, true);
        n++;
      }
    }
    if (n) this.arrivalTimer = frand(3.5, 7);
    return n;
  }

  /** A landing spot among the seed that is not already taken by another bird. */
  freeGroundSpot() {
    const S = this.S;
    const onGround = this.birds.filter(b => b.target && b.target.kind === 'ground' && b.state !== 'leaving' && b.state !== 'startled');
    for (let tries = 0; tries < 8; tries++) {
      const s = this.seeds[Math.floor(Math.random() * this.seeds.length)];
      const x = s.x + frand(-18, 18) * S;
      if (onGround.every(b => Math.abs(b.target.x - x) > 46 * S)) {
        return { x, y: this.groundY + s.d * 20 * S, kind: 'ground', face: null, bird: null, temp: true, d: s.d };
      }
    }
    return null;
  }

  hasFood() {
    return this.seeds.length > 0 || this.feederSeed > 0.02;
  }

  nearestSeed(b, maxD) {
    let best = null, bd = maxD;
    for (const s of this.seeds) {
      const d = Math.abs(s.x - b.x) + Math.abs(this.groundY + s.d * 20 * this.S - b.y) * 0.5;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  updateBird(b, dt) {
    const S = this.S;
    b.t += dt;
    b.flap += dt * (b.state === 'startled' ? 34 : 24);

    if (b.state === 'flying' || b.state === 'leaving' || b.state === 'startled') {
      const P = b.path;
      P.u = Math.min(1, P.u + dt / P.dur);
      const u = b.state === 'flying' ? 1 - Math.pow(1 - P.u, 1.6) : P.u; // arrivals ease in to land
      const iu = 1 - u;
      b.x = iu * iu * P.x0 + 2 * iu * u * P.cx + u * u * P.x1;
      b.y = iu * iu * P.y0 + 2 * iu * u * P.cy + u * u * P.y1;
      if (P.u >= 1) {
        if (b.state !== 'flying') { b.gone = true; return; }
        b.state = 'perched';
        b.perch = b.target;
        this.seen.add(b.sp); // only counts once it has actually visited
        b.t = 0;
        b.dir = b.perch.face ?? (Math.random() < 0.5 ? 1 : -1);
        if (b.perch.kind === 'fence') b.k = BIRD_SPECIES[b.sp].size * S * 1.3 * 0.9;
        if (BIRD_SPECIES[b.sp].bully) {
          // The jay muscles in: small birds close by give way
          for (const o of this.birds) {
            if (o !== b && o.state === 'perched' && BIRD_SPECIES[o.sp].size < 1.1 && Math.hypot(o.x - b.x, o.y - b.y) < 150 * S) this.leave(o, false);
          }
        }
      }
      return;
    }

    // Perched
    const p = b.perch;
    if (b.hop) {
      const H = b.hop;
      H.u = Math.min(1, H.u + dt / 0.22);
      b.x = H.x0 + (H.x1 - H.x0) * H.u;
      b.y = H.y0 + (H.y1 - H.y0) * H.u - Math.sin(H.u * Math.PI) * 9 * S;
      if (H.u >= 1) { b.hop = null; p.x = b.x; p.y = b.y; }
      return;
    }
    b.peck = Math.max(0, b.peck - dt);
    b.nextAct -= dt;
    if (b.nextAct > 0) return;
    b.nextAct = frand(0.5, 1.3);

    const atFeeder = p.kind === 'feeder' || p.kind === 'tray';
    if (atFeeder && this.feederSeed > 0.01) {
      b.peck = 0.26;
      this.feederSeed = Math.max(0, this.feederSeed - 0.006);
      b.satiety++;
    } else if (p.kind === 'ground') {
      const s = this.nearestSeed(b, 160 * S);
      if (s && Math.abs(s.x - b.x) < 16 * S) {
        b.peck = 0.26;
        this.seeds.splice(this.seeds.indexOf(s), 1);
        b.satiety++;
        b.dir = s.x >= b.x ? b.dir : -b.dir;
      } else if (s) {
        const step = fclamp(s.x - b.x, -34 * S, 34 * S);
        b.dir = step >= 0 ? 1 : -1;
        b.hop = { x0: b.x, y0: b.y, x1: b.x + step, y1: this.groundY + s.d * 20 * S, u: 0 };
        b.nextAct = 0.25;
      } else {
        b.satiety = b.full; // nothing left here
      }
    } else {
      // Resting: look around, sometimes sing, then go feed or leave
      if (Math.random() < 0.35) b.dir = -b.dir;
      if (Math.random() < 0.18 && this.onSong) this.onSong(b.sp);
      if (b.t > frand(4, 9)) {
        const next = this.hasFood() && b.satiety < b.full ? this.choosePerch(b.sp, true) : null;
        if (next && next.kind !== 'fence' && next.kind !== 'branch') {
          if (p.bird === b) p.bird = null;
          b.perch = null;
          b.state = 'flying';
          this.flyTo(b, next, 260);
          if (next.kind !== 'ground') next.bird = b;
        } else {
          this.leave(b);
        }
        return;
      }
    }
    if (Math.random() < 0.06 && this.onSong) this.onSong(b.sp);
    if (b.satiety >= b.full || (atFeeder && this.feederSeed <= 0.01)) {
      // Full, or the feeder ran dry: rest on the fence for a while, or go
      const rest = this.perches.filter(q => !q.bird && (q.kind === 'fence' || q.kind === 'branch'));
      if (rest.length && Math.random() < 0.45) {
        if (p.bird === b) p.bird = null;
        const q = rest[Math.floor(Math.random() * rest.length)];
        b.perch = null;
        b.state = 'flying';
        this.flyTo(b, q, 240);
        q.bird = b;
        b.satiety = b.full + 1;
      } else {
        this.leave(b);
      }
    }
  }

  update(dt) {
    this.t += dt;
    const S = this.S;

    // Seed in the air lands on the ground (or the tray)
    for (const s of this.falling) {
      s.vy += 1400 * S * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const floor = this.groundY + s.d * 20 * S;
      if (s.y >= floor) { s.y = floor; s.landed = true; }
    }
    this.falling = this.falling.filter(s => {
      if (s.landed) { if (this.seeds.length < 320) this.seeds.push({ x: s.x, d: s.d, c: s.c, y: s.y }); return false; }
      return true;
    });

    // Arrivals
    this.arrivalTimer -= dt;
    const active = this.birds.filter(b => b.state !== 'leaving' && b.state !== 'startled').length;
    if (this.arrivalTimer <= 0) {
      const food = this.hasFood();
      this.arrivalTimer = food ? frand(0.8, 2.6) / (1 + this.seeds.length / 120) : frand(5, 12);
      if (active < this.maxBirds() && (food || Math.random() < 0.5)) this.spawnBird();
    }

    this.birds.forEach(b => this.updateBird(b, dt));
    this.birds = this.birds.filter(b => !b.gone);

    // Snow
    const M = FEEDER_MOODS[this.mood];
    if (M.snow) {
      if (this.snow.length < (this.preview ? 60 : 160)) this.snow.push({ x: Math.random() * this.w, y: -10, r: frand(1, 3) * S, v: frand(20, 50) * S, ph: Math.random() * 6 });
      this.snow.forEach(f => { f.y += f.v * dt; f.x += Math.sin(this.t + f.ph) * 10 * S * dt; });
      this.snow = this.snow.filter(f => f.y < this.h);
    } else {
      this.snow.length = 0;
    }
  }

  // ---------- Drawing ----------
  drawBackground(c) {
    const M = FEEDER_MOODS[this.mood];
    const { w, h, S } = this;
    const sky = c.createLinearGradient(0, 0, 0, this.groundY);
    sky.addColorStop(0, M.sky[0]);
    sky.addColorStop(1, M.sky[1]);
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    // Sun
    const [sx, sy, sc] = M.sun;
    const glow = c.createRadialGradient(w * sx, h * sy, 4, w * sx, h * sy, 260 * S);
    glow.addColorStop(0, `rgba(${sc}, 0.9)`);
    glow.addColorStop(0.15, `rgba(${sc}, 0.45)`);
    glow.addColorStop(1, `rgba(${sc}, 0)`);
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);

    // Drifting clouds
    c.fillStyle = M.snow ? 'rgba(240, 244, 248, 0.85)' : 'rgba(255, 255, 255, 0.82)';
    for (const cl of this.clouds) {
      const x = ((cl.x + this.t * cl.v) % (w + 300)) - 150, y = cl.y, k = cl.s * S;
      c.beginPath();
      c.ellipse(x, y, 70 * k, 20 * k, 0, 0, FTAU);
      c.ellipse(x - 30 * k, y - 10 * k, 32 * k, 22 * k, 0, 0, FTAU);
      c.ellipse(x + 16 * k, y - 18 * k, 38 * k, 28 * k, 0, 0, FTAU);
      c.ellipse(x + 50 * k, y - 5 * k, 26 * k, 17 * k, 0, 0, FTAU);
      c.fill();
    }

    // Rolling hills and a soft hedge
    const hill = (base, amp, freq, seed, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, this.groundY);
      for (let x = 0; x <= w + 8; x += 8) c.lineTo(x, base + Math.sin(x / w * freq * FTAU + seed) * amp);
      c.lineTo(w, this.groundY);
      c.closePath();
      c.fill();
    };
    hill(this.groundY - 150 * S, 24 * S, 1.2, 0.8, M.hills[0]);
    // Little round trees on the far hill
    for (const tr of this.hillTrees) {
      const ty = this.groundY - 150 * S + Math.sin(tr.x / w * 1.2 * FTAU + 0.8) * 24 * S;
      c.fillStyle = M.hills[1];
      c.fillRect(tr.x - 1.5 * S, ty - tr.r * 0.4, 3 * S, tr.r * 0.6);
      c.beginPath();
      c.arc(tr.x, ty - tr.r * 0.9, tr.r * 0.75, 0, FTAU);
      c.fill();
    }
    hill(this.groundY - 105 * S, 18 * S, 2.1, 2.3, M.hills[1]);
    c.fillStyle = M.leaves[1];
    for (let x = -20; x < w + 40; x += 46 * S) {
      c.beginPath();
      c.arc(x, this.fenceTop + 10 * S + Math.sin(x * 0.05) * 6 * S, 34 * S, Math.PI, 0);
      c.fill();
    }

    // Fence
    const F = M.fence;
    c.fillStyle = F;
    c.fillRect(0, this.fenceTop + 16 * S, w, 7 * S);
    c.fillRect(0, this.fenceTop + 46 * S, w, 7 * S);
    for (const x of this.posts) {
      c.fillStyle = F;
      c.beginPath();
      c.moveTo(x - 8 * S, this.fenceBottom);
      c.lineTo(x - 8 * S, this.fenceTop + 6 * S);
      c.lineTo(x, this.fenceTop - 2 * S);
      c.lineTo(x + 8 * S, this.fenceTop + 6 * S);
      c.lineTo(x + 8 * S, this.fenceBottom);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(0, 0, 0, 0.08)';
      c.fillRect(x + 3 * S, this.fenceTop + 6 * S, 5 * S, this.fenceBottom - this.fenceTop - 6 * S);
    }

    // Lawn
    const g = c.createLinearGradient(0, this.groundY - 10 * S, 0, h);
    g.addColorStop(0, M.grass[0]);
    g.addColorStop(1, M.grass[1]);
    c.fillStyle = g;
    c.fillRect(0, this.groundY - 6 * S, w, h);
    // Mowing stripes
    c.fillStyle = M.snow ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.06)';
    for (let x = -h; x < w; x += 90 * S) {
      c.beginPath();
      c.moveTo(x, h);
      c.lineTo(x + 45 * S, h);
      c.lineTo(x + 45 * S + (h - this.groundY) * 0.6, this.groundY);
      c.lineTo(x + (h - this.groundY) * 0.6, this.groundY);
      c.closePath();
      c.fill();
    }

    // Flowers along the fence
    if (!M.snow) {
      for (const f of this.flowers) {
        const fy = this.groundY - 2 * S + f.d * 6 * S;
        c.strokeStyle = '#5f8a4a';
        c.lineWidth = 1.5 * S;
        c.beginPath();
        c.moveTo(f.x, fy);
        c.lineTo(f.x, fy - f.h * S);
        c.stroke();
        c.fillStyle = f.c;
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * FTAU + this.t * 0.2;
          c.beginPath();
          c.arc(f.x + Math.cos(a) * 3 * S, fy - f.h * S + Math.sin(a) * 3 * S, 2.6 * S, 0, FTAU);
          c.fill();
        }
        c.fillStyle = '#f2c14e';
        c.beginPath();
        c.arc(f.x, fy - f.h * S, 1.8 * S, 0, FTAU);
        c.fill();
      }
    }
  }

  drawTreeAndFeeder(c) {
    const M = FEEDER_MOODS[this.mood];
    const { w, S } = this;
    const B = this.branch, F = this.feeder;

    // Branch
    c.strokeStyle = '#5b4332';
    c.lineCap = 'round';
    c.lineWidth = 16 * S;
    c.beginPath();
    c.moveTo(B.x0, B.y0);
    for (let x = B.x0; x >= B.x1; x -= 10) c.lineTo(x, this.branchY(x));
    c.stroke();
    c.lineWidth = 6 * S;
    c.beginPath();
    c.moveTo(B.x1 + 30 * S, this.branchY(B.x1 + 30 * S));
    c.lineTo(B.x1 - 30 * S, this.branchY(B.x1) - 26 * S);
    c.stroke();

    // Leaves
    for (const L of this.leafClusters) {
      c.fillStyle = M.snow ? 'rgba(244, 247, 250, 0.9)' : M.leaves[0];
      c.beginPath();
      c.arc(L.x, L.y, L.r, 0, FTAU);
      c.arc(L.x + L.r * 0.7, L.y + L.r * 0.3, L.r * 0.8, 0, FTAU);
      c.fill();
      if (!M.snow) {
        c.fillStyle = M.leaves[1];
        c.beginPath();
        c.arc(L.x + L.r * 0.2, L.y + L.r * 0.45, L.r * 0.6, 0, FTAU);
        c.fill();
      }
    }

    // Feeder: rope, lid, glass tube with seed, ports, perches, tray
    const sway = Math.sin(this.t * 0.9) * 0.02;
    c.save();
    c.translate(F.x, F.hangY);
    c.rotate(sway);
    c.translate(-F.x, -F.hangY);
    c.strokeStyle = '#6b5a48';
    c.lineWidth = 2 * S;
    c.beginPath();
    c.moveTo(F.x, F.hangY);
    c.lineTo(F.x, F.top - 14 * S);
    c.stroke();
    const tw = F.tubeW;
    c.fillStyle = '#3f6b4f';
    c.beginPath();
    c.moveTo(F.x - tw * 0.85, F.top);
    c.lineTo(F.x, F.top - 18 * S);
    c.lineTo(F.x + tw * 0.85, F.top);
    c.closePath();
    c.fill();
    // Tube glass
    c.fillStyle = 'rgba(225, 240, 245, 0.55)';
    c.fillRect(F.x - tw / 2, F.top, tw, F.tubeH);
    // Seed inside
    const fillH = F.tubeH * this.feederSeed;
    const sg = c.createLinearGradient(F.x - tw / 2, 0, F.x + tw / 2, 0);
    sg.addColorStop(0, '#9d7646');
    sg.addColorStop(0.5, '#c9a46a');
    sg.addColorStop(1, '#8c6a3e');
    c.fillStyle = sg;
    c.fillRect(F.x - tw / 2 + 2, F.bottom - fillH, tw - 4, fillH);
    c.fillStyle = 'rgba(40, 30, 25, 0.35)';
    for (let i = 0; i < fillH / (5 * S); i++) {
      c.fillRect(F.x - tw / 2 + 4 + ((i * 7) % (tw - 8)), F.bottom - i * 5 * S - 3, 2.5 * S, 1.8 * S);
    }
    // Glass shine
    c.fillStyle = 'rgba(255, 255, 255, 0.45)';
    c.fillRect(F.x - tw / 2 + 4 * S, F.top + 4 * S, 3 * S, F.tubeH - 8 * S);
    c.strokeStyle = 'rgba(60, 80, 70, 0.5)';
    c.lineWidth = 1.2;
    c.strokeRect(F.x - tw / 2, F.top, tw, F.tubeH);
    // Ports and perches
    for (const p of this.perches) {
      if (p.kind !== 'feeder') continue;
      const side = p.x < F.x ? -1 : 1;
      c.fillStyle = '#3f6b4f';
      c.beginPath();
      c.arc(F.x + side * tw / 2, p.y - 8 * S, 5 * S, 0, FTAU);
      c.fill();
      c.strokeStyle = '#7a6a58';
      c.lineWidth = 3 * S;
      c.beginPath();
      c.moveTo(F.x + side * tw / 2, p.y + 1 * S);
      c.lineTo(p.x + side * 8 * S, p.y + 1 * S);
      c.stroke();
    }
    // Tray
    c.fillStyle = '#3f6b4f';
    c.fillRect(F.x - 78 * S, F.trayY, 156 * S, 6 * S);
    c.fillRect(F.x - 4 * S, F.bottom, 8 * S, F.trayY - F.bottom);
    if (this.feederSeed > 0.05) {
      c.fillStyle = '#b38c58';
      c.beginPath();
      c.ellipse(F.x, F.trayY, 64 * S, 3 * S, 0, Math.PI, 0);
      c.fill();
    }
    c.restore();
  }

  drawSeeds(c) {
    const S = this.S;
    for (const s of [...this.seeds, ...this.falling]) {
      c.fillStyle = s.c;
      c.beginPath();
      c.ellipse(s.x, s.y, 2.4 * S, 1.5 * S, s.x % 3, 0, FTAU);
      c.fill();
    }
  }

  drawBird(c, b) {
    const sp = BIRD_SPECIES[b.sp];
    const flying = b.state !== 'perched';
    const k = b.k;
    c.save();
    c.translate(b.x, b.y);
    c.scale(b.dir * k, k);

    // Shadow when on the ground
    if (!flying && b.perch && b.perch.kind === 'ground') {
      c.fillStyle = 'rgba(30, 40, 20, 0.18)';
      c.beginPath();
      c.ellipse(0, 1, 16, 3.5, 0, 0, FTAU);
      c.fill();
    }

    let tilt = -0.18, hx = 0, hy = 0;
    if (flying) tilt = (b.path && b.path.y1 > b.y ? 0.12 : -0.1);
    if (b.peck > 0) {
      const u = Math.sin((1 - b.peck / 0.26) * Math.PI);
      tilt += 0.55 * u;
      hx = 3 * u; hy = 8 * u;
    }
    if (b.hop) tilt = -0.3;
    const bob = flying ? 0 : Math.sin(this.t * 3 + b.id * 10) * 0.4;

    c.save();
    c.translate(0, flying ? 14 : 0);
    c.rotate(tilt);

    // Legs
    if (!flying) {
      c.strokeStyle = '#4a3a30';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-1, -6); c.lineTo(-3, 0);
      c.moveTo(4, -6); c.lineTo(4, 0);
      c.stroke();
    }

    const flapA = flying ? Math.sin(b.flap) * 1.1 : 0;

    // Far wing (behind the body) while flying
    if (flying) {
      c.save();
      c.translate(-2, -20);
      c.rotate(-0.4 - flapA);
      c.fillStyle = sp.wing;
      c.globalAlpha = 0.85;
      c.beginPath();
      c.ellipse(-12, 0, 16, 5.5, 0, 0, FTAU);
      c.fill();
      c.restore();
      c.globalAlpha = 1;
    }

    // Tail
    c.fillStyle = sp.tail;
    c.beginPath();
    c.moveTo(-12, -17 + bob);
    c.lineTo(-30, flying ? -16 : -10);
    c.lineTo(-29, flying ? -10 : -5);
    c.lineTo(-11, -12 + bob);
    c.closePath();
    c.fill();

    // Body and belly
    c.fillStyle = sp.body;
    c.beginPath();
    c.ellipse(0, -16 + bob, 16, 11, -0.2, 0, FTAU);
    c.fill();
    c.fillStyle = sp.belly;
    c.beginPath();
    c.ellipse(3, -11.5 + bob, 12, 6.5, -0.15, 0, FTAU);
    c.fill();
    if (sp.breast) {
      c.fillStyle = sp.breast;
      c.beginPath();
      c.ellipse(9, -17 + bob, 8, 8, 0, 0, FTAU);
      c.fill();
    }

    // Folded near wing, or flapping wing
    if (flying) {
      c.save();
      c.translate(-2, -20);
      c.rotate(-0.2 + flapA);
      c.fillStyle = sp.wing;
      c.beginPath();
      c.ellipse(-13, 0, 18, 6, 0, 0, FTAU);
      c.fill();
      c.strokeStyle = sp.bars;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(-22, -1); c.lineTo(-6, -1);
      c.stroke();
      c.restore();
    } else {
      c.fillStyle = sp.wing;
      c.beginPath();
      c.ellipse(-3, -17 + bob, 12, 7, -0.25, 0, FTAU);
      c.fill();
      c.strokeStyle = sp.bars;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(-11, -15 + bob); c.lineTo(1, -18 + bob);
      c.moveTo(-10, -12 + bob); c.lineTo(2, -14.5 + bob);
      c.stroke();
    }

    // Head
    c.save();
    c.translate(hx, hy + bob);
    const hX = 13, hY = -27;
    c.fillStyle = sp.head;
    c.beginPath();
    c.arc(hX, hY, 8.5, 0, FTAU);
    c.fill();
    if (sp.cheek) {
      c.fillStyle = sp.cheek;
      c.beginPath();
      c.ellipse(hX + 1, hY + 3, 5, 3.6, 0, 0, FTAU);
      c.fill();
    }
    if (sp.face) {
      c.fillStyle = sp.face;
      c.beginPath();
      c.ellipse(hX + 3, hY + 2, 5.5, 5, 0, 0, FTAU);
      c.fill();
    }
    // Cap
    c.fillStyle = sp.cap;
    c.beginPath();
    c.arc(hX, hY, 8.6, Math.PI * 1.02, Math.PI * 1.98);
    c.fill();
    if (sp.crest) {
      c.fillStyle = sp.cap;
      c.beginPath();
      c.moveTo(hX - 7, hY - 4);
      c.quadraticCurveTo(hX - 9, hY - 16, hX - 1, hY - 14);
      c.lineTo(hX + 3, hY - 6);
      c.closePath();
      c.fill();
    }
    if (sp.mask) {
      c.fillStyle = sp.mask;
      c.beginPath();
      c.ellipse(hX + 5, hY + 1.5, 4.5, 3.5, 0, 0, FTAU);
      c.fill();
    }
    if (sp.bib) {
      c.fillStyle = sp.bib;
      c.beginPath();
      c.ellipse(hX + 3, hY + 7, 4, 3, 0, 0, FTAU);
      c.fill();
    }
    if (sp.necklace) {
      c.strokeStyle = sp.necklace;
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(hX - 1, hY + 1, 8, 0.2 * Math.PI, 0.75 * Math.PI);
      c.stroke();
    }
    // Beak
    c.fillStyle = sp.beak;
    c.beginPath();
    c.moveTo(hX + 7, hY - 1.5);
    c.lineTo(hX + 14, hY + 0.8);
    c.lineTo(hX + 7, hY + 2.8);
    c.closePath();
    c.fill();
    // Eye
    c.fillStyle = '#111';
    c.beginPath();
    c.arc(hX + 3.5, hY - 1.5, 1.7, 0, FTAU);
    c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.9)';
    c.beginPath();
    c.arc(hX + 4, hY - 2.1, 0.6, 0, FTAU);
    c.fill();
    c.restore();

    c.restore();
    c.restore();
  }

  drawForeground(c) {
    const M = FEEDER_MOODS[this.mood];
    const { w, h, S } = this;
    // Grass blades along the bottom, swaying
    c.strokeStyle = M.snow ? 'rgba(220, 230, 238, 0.9)' : M.grass[1];
    c.lineWidth = 2 * S;
    c.lineCap = 'round';
    const base = this.groundY + 30 * S;
    for (const b of this.blades) {
      if (b.x > w) break;
      const sway = Math.sin(this.t * 1.3 + b.ph) * 3 * S;
      c.beginPath();
      c.moveTo(b.x, base);
      c.quadraticCurveTo(b.x + sway * 0.5, base - b.h * S * 0.6, b.x + sway, base - b.h * S);
      c.stroke();
    }
    c.fillStyle = M.grass[1];
    c.fillRect(0, base, w, h - base);

    // Snowfall
    if (M.snow) {
      c.fillStyle = 'rgba(255, 255, 255, 0.9)';
      for (const f of this.snow) {
        c.beginPath();
        c.arc(f.x, f.y, f.r, 0, FTAU);
        c.fill();
      }
    }

    // Colour grade for the time of day
    if (M.grade) {
      c.fillStyle = M.grade;
      c.fillRect(0, 0, w, h);
    }

    // Soft window vignette
    const vg = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(40, 30, 20, 0.22)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
  }

  draw() {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    this.drawBackground(c);
    this.drawSeeds(c);
    // Birds on the fence sit behind the feeder; everyone else is drawn after it
    const behind = this.birds.filter(b => b.state === 'perched' && b.perch && b.perch.kind === 'fence');
    const front = this.birds.filter(b => !behind.includes(b)).sort((a, b) => a.y - b.y);
    behind.forEach(b => this.drawBird(c, b));
    this.drawTreeAndFeeder(c);
    front.forEach(b => this.drawBird(c, b));
    this.drawForeground(c);
  }
}

window.FeederWorld = FeederWorld;
window.BIRD_SPECIES = BIRD_SPECIES;
window.FEEDER_MOODS = FEEDER_MOODS;
