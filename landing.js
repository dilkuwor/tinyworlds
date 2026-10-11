/**
 * landing.js - Tiny Worlds homepage
 * A living night landscape in the hero, one section per world with a live
 * preview that reuses the world's real creatures, a gentle 3D tilt on the
 * preview windows, and reveal-on-scroll.
 */

const reduceMotion = prefersReducedMotion();

// ==========================================
// THEME (day / night)
// ==========================================
const Theme = {
  key: 'tinyworlds.homeTheme',
  get current() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  },
  set(theme, persist = true) {
    document.documentElement.dataset.theme = theme;
    if (persist) { try { localStorage.setItem(this.key, theme); } catch (_) {} }
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      const light = theme === 'light';
      btn.setAttribute('aria-pressed', String(light));
      btn.setAttribute('aria-label', light ? 'Switch to night theme' : 'Switch to day theme');
      btn.title = light ? 'Night theme' : 'Day theme';
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f6f0e6' : '#0b0a24');
  },
  init() {
    this.set(this.current, false);
    document.getElementById('theme-toggle')?.addEventListener('click', () =>
      this.set(this.current === 'light' ? 'dark' : 'light'));
  }
};

// ==========================================
// AMBIENT SOUND (optional, off until asked for)
// ==========================================
/**
 * A soft breeze with wind chimes that ring a little more when it gusts.
 * At night a few distant crickets join in. Everything is synthesised.
 */
// The hero tells the sound what happens on the hill: gusts, the peacock, taps.
// It also keeps the current wind strength here for the breeze to follow.
const HeroEvents = new EventTarget();
HeroEvents.wind = 0;
const heroEvent = (type, detail) => HeroEvents.dispatchEvent(new CustomEvent(type, { detail }));

class HomeSound extends AudioEngine {
  setupAmbient() {
    const c = this.ctx;

    // Breeze: filtered noise whose brightness and loudness drift slowly
    const air = this.loopNoise();
    this.breezeFilter = c.createBiquadFilter();
    this.breezeFilter.type = 'bandpass';
    this.breezeFilter.frequency.value = 420;
    this.breezeFilter.Q.value = 0.6;
    this.breezeGain = c.createGain();
    this.breezeGain.gain.value = 0.02;
    air.connect(this.breezeFilter);
    this.breezeFilter.connect(this.breezeGain);
    this.breezeGain.connect(this.master);

    this.gust = 0.3;
    this.nextChime = 2;
    this.nextCricket = 3;
    this.nextBird = 2;
    HeroEvents.addEventListener('gust', (e) => this.whoosh(e.detail.k));
    HeroEvents.addEventListener('peacock', () => this.peacockCall());
    HeroEvents.addEventListener('flap', () => this.wingbeats());
    HeroEvents.addEventListener('rustle', () => this.rustle());
    HeroEvents.addEventListener('lamp', () => this.lampClick());
    HeroEvents.addEventListener('cluck', () => this.cluck());
    HeroEvents.addEventListener('plop', () => this.plop());
    this.lastTick = performance.now();
    this.timer = setInterval(() => this.tick(), 120);
  }

  /** Called a few times a second: drift the wind and decide what rings. */
  tick() {
    const now = performance.now();
    const dt = Math.min(0.5, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (!this.audible) return;

    // The breeze follows the wind you can see bending the pines
    this.gust += (0.2 + Math.min(1, HeroEvents.wind) * 0.8 - this.gust) * Math.min(1, dt * 2);
    const t = this.ctx.currentTime;
    this.breezeFilter.frequency.setTargetAtTime(300 + this.gust * 500, t, 1.5);
    this.breezeGain.gain.setTargetAtTime(0.012 + this.gust * 0.03, t, 1.5);

    // Chimes: more often when the wind picks up, sometimes two or three together
    this.nextChime -= dt * (0.3 + this.gust * 1.4);
    if (this.nextChime <= 0) {
      const n = Math.random() < this.gust * 0.6 ? 2 + (Math.random() < 0.4 ? 1 : 0) : 1;
      for (let i = 0; i < n; i++) this.chime(i * (0.12 + Math.random() * 0.25));
      this.nextChime = 1.5 + Math.random() * 3.5;
    }

    // Birdsong by day
    if (Theme.current === 'light') {
      this.nextBird -= dt;
      if (this.nextBird <= 0) {
        this.birdsong();
        this.nextBird = 3 + Math.random() * 7;
      }
    }

    // Crickets, only under the night sky
    if (Theme.current !== 'light') {
      this.nextCricket -= dt;
      if (this.nextCricket <= 0) {
        this.cricket();
        this.nextCricket = 0.8 + Math.random() * 2.2;
      }
    }
  }

  /** One rod of a pentatonic wind chime: a pure tone with a faint metallic overtone. */
  chime(delay = 0) {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
    const f = notes[Math.floor(Math.random() * notes.length)];
    const g = 0.012 + Math.random() * 0.012;
    this.tone({ freq: f, dur: 3.5 + Math.random() * 1.5, gain: g, attack: 0.003, delay });
    this.tone({ freq: f * 2.76, dur: 1.2, gain: g * 0.25, attack: 0.002, delay });
  }

  /** A gust sweeping across the hill: a swell of air travelling left to right. */
  whoosh(k = 1) {
    if (!this.audible) return;
    try {
      const c = this.ctx, t0 = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 0.8;
      f.frequency.setValueAtTime(280, t0);
      f.frequency.linearRampToValueAtTime(650 + k * 250, t0 + 1.6);
      f.frequency.linearRampToValueAtTime(320, t0 + 3.8);
      const amp = c.createGain();
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(0.045 * k, t0 + 1.5);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 4);
      src.connect(f);
      f.connect(amp);
      let out = amp;
      if (c.createStereoPanner) {
        const pan = c.createStereoPanner();
        pan.pan.setValueAtTime(-0.7, t0);
        pan.pan.linearRampToValueAtTime(0.7, t0 + 3.8);
        amp.connect(pan);
        out = pan;
      }
      out.connect(this.master);
      src.start(t0, Math.random() * 1.5);
      src.stop(t0 + 4.1);
    } catch (e) {}
  }

  /** A songbird somewhere in the pines: a few quick, bright notes. */
  birdsong() {
    const base = 2600 + Math.random() * 1800;
    const kind = Math.random();
    if (kind < 0.4) {
      // "tee-oo", sometimes twice
      const reps = Math.random() < 0.5 ? 2 : 1;
      for (let r = 0; r < reps; r++) {
        const d = r * 0.45;
        this.tone({ freq: base * 1.2, glide: [[base * 1.35, 0.06]], dur: 0.12, gain: 0.006, attack: 0.01, delay: d });
        this.tone({ freq: base, glide: [[base * 0.8, 0.14]], dur: 0.2, gain: 0.006, attack: 0.01, delay: d + 0.16 });
      }
    } else if (kind < 0.75) {
      // A quick trill
      const n = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        this.tone({ freq: base * (1 + (i % 2) * 0.12), glide: [[base * 1.1, 0.03]], dur: 0.05, gain: 0.0045, attack: 0.005, delay: i * 0.065 });
      }
    } else {
      // Three rising questions
      for (let i = 0; i < 3; i++) {
        this.tone({ freq: base * 0.8, glide: [[base * 1.3, 0.1]], dur: 0.13, gain: 0.005, attack: 0.01, delay: i * 0.22 });
      }
    }
  }

  /** The peacock's far-carrying "may-awe", usually twice. */
  peacockCall() {
    const nasal = { type: 'bandpass', freq: 1300, q: 2.5 };
    for (let r = 0; r < 2; r++) {
      const d = r * 1.1;
      this.tone({ type: 'sawtooth', freq: 700, glide: [[1150, 0.12]], dur: 0.22, gain: 0.014, attack: 0.02, delay: d, filter: nasal });
      this.tone({ type: 'sawtooth', freq: 1250, glide: [[1100, 0.2], [680, 0.65]], dur: 0.75, gain: 0.016, attack: 0.03, delay: d + 0.24, filter: nasal });
    }
  }

  /** Heavy wingbeats as the peacock takes off. */
  wingbeats() {
    for (let i = 0; i < 5; i++) this.noise({ dur: 0.09, gain: 0.02, type: 'lowpass', freq: 500, attack: 0.01, delay: i * 0.12 });
  }

  /** Pine needles rustling. */
  rustle() {
    this.noise({ dur: 0.6, gain: 0.025, type: 'highpass', freq: 2500, q: 0.5, attack: 0.05 });
    this.noise({ dur: 0.4, gain: 0.015, type: 'bandpass', freq: 1500, attack: 0.03, delay: 0.15 });
  }

  /** The cottage lamp's little switch. */
  lampClick() {
    this.tone({ type: 'square', freq: 1800, dur: 0.03, gain: 0.005, attack: 0.002, filter: { type: 'lowpass', freq: 2500 } });
    this.tone({ type: 'square', freq: 1200, dur: 0.03, gain: 0.004, attack: 0.002, delay: 0.05, filter: { type: 'lowpass', freq: 2500 } });
  }

  /** A pebble's worth of pond: a quick falling "plop". */
  plop() {
    this.tone({ freq: 700, glide: [[220, 0.09]], dur: 0.12, gain: 0.03, attack: 0.003 });
    this.noise({ dur: 0.15, gain: 0.008, type: 'bandpass', freq: 1800, attack: 0.005, delay: 0.02 });
  }

  /** The peahen's startled cluck. */
  cluck() {
    this.tone({ type: 'triangle', freq: 650, glide: [[480, 0.08]], dur: 0.1, gain: 0.012, attack: 0.005 });
    this.tone({ type: 'triangle', freq: 600, glide: [[430, 0.08]], dur: 0.1, gain: 0.01, attack: 0.005, delay: 0.14 });
  }

  /** A distant cricket: three quick, very quiet chirps. */
  cricket() {
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: f, dur: 0.045, gain: 0.0035, attack: 0.004, delay: i * 0.07 });
    }
  }
}

function setupHomeSound() {
  const btn = document.getElementById('sound-toggle');
  if (!btn || typeof AudioEngine === 'undefined') { btn?.remove(); return; }
  const sound = new HomeSound();
  btn.addEventListener('click', () => {
    const on = !sound.toggleMute();
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Turn off ambient sound' : 'Play soft ambient sound');
    if (on) sound.chime();
  });
  // Fall silent while the tab is in the background
  document.addEventListener('visibilitychange', () => {
    if (!sound.ctx) return;
    if (document.hidden) sound.ctx.suspend();
    else if (!sound.isMuted) sound.ctx.resume();
  });
}

// ==========================================
// HERO: LIVING LANDSCAPE (night ↔ day)
// ==========================================
const HERO_PALETTES = {
  dark: {
    sky: ['#070823', '#17154a', '#3a2b66', '#7a4a72'],
    glow: [243, 160, 140, 0.22],
    halo: [255, 228, 200, 0.32],
    disc: ['#fffaf0', '#f1dcc0'],
    hills: ['#2c2459', '#1d1946', '#0b0a24'],
    page: '#0b0a24'
  },
  light: {
    sky: ['#8ec5ef', '#bfe0f6', '#f2e7d8', '#f8d9c3'],
    glow: [255, 214, 170, 0.35],
    halo: [255, 222, 150, 0.5],
    disc: ['#fffbe8', '#ffd98a'],
    hills: ['#b7cbdd', '#a3c49b', '#7ea67b'],
    page: '#f6f0e6'
  }
};

const hexRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixHex = (a, b, u) => {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * u)).join(', ')})`;
};
const mixRgba = (a, b, u, alphaScale = 1) => {
  const c = a.map((v, i) => v + (b[i] - v) * u);
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${(c[3] * alphaScale).toFixed(3)})`;
};

function startHero() {
  const canvas = document.getElementById('hero-sky');
  const hero = document.querySelector('.hero');
  const content = document.querySelector('.hero-content');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, sc = 1, stars = [], flies = [], clouds = [], birds = [], t = 0;
  let day = Theme.current === 'light' ? 1 : 0; // 0 night … 1 day, eased
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  const D = HERO_PALETTES.dark, L = HERO_PALETTES.light;

  const layout = () => {
    ({ width: w, height: h } = fitCanvas(canvas, ctx, hero.clientWidth, hero.clientHeight));
    sc = Math.max(0.7, Math.min(1.4, w / 1200));
    const count = Math.round(Math.min(260, (w * h) / 5200));
    stars = Array.from({ length: count }, () => {
      const v = Math.pow(Math.random(), 1.6); // denser near the top
      return { x: Math.random() * w, y: v * h * 0.72, r: Math.random() < 0.08 ? 1.6 : 0.5 + Math.random() * 0.9, tw: Math.random() * 10, sp: 0.6 + Math.random() * 1.8 };
    });
    flies = Array.from({ length: Math.round(Math.min(34, w / 40)) }, () => ({
      x: Math.random() * w, y: h * (0.62 + Math.random() * 0.36), ph: Math.random() * 10, sp: 0.3 + Math.random() * 0.6, r: 1 + Math.random() * 1.6
    }));
    clouds = Array.from({ length: Math.max(4, Math.round(w / 260)) }, (_, i) => ({
      x: Math.random() * w, y: h * (0.08 + Math.random() * 0.42), s: 0.6 + Math.random() * 0.9, sp: 4 + Math.random() * 8
    }));
    birds = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * w, y: h * (0.25 + Math.random() * 0.25), sp: 18 + Math.random() * 14, ph: Math.random() * 10, s: 0.7 + Math.random() * 0.5
    }));
  };

  // Rolling hill silhouette: a sum of slow sines
  const hillY = (x, base, amp, freq, seed, offset) => {
    const u = (x + offset) / w;
    return base + Math.sin(u * freq * 6.283 + seed) * amp + Math.sin(u * freq * 2.7 * 6.283 + seed * 2) * amp * 0.35;
  };
  const hill = (base, amp, freq, seed, offset) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 10; x += 8) ctx.lineTo(x, hillY(x, base, amp, freq, seed, offset));
    ctx.lineTo(w, h);
    ctx.closePath();
  };

  const drawCloud = (x, y, s, alpha) => {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 60 * s, 18 * s, 0, 0, 6.283);
    ctx.ellipse(x - 26 * s, y - 8 * s, 28 * s, 20 * s, 0, 0, 6.283);
    ctx.ellipse(x + 14 * s, y - 16 * s, 34 * s, 26 * s, 0, 0, 6.283);
    ctx.ellipse(x + 44 * s, y - 4 * s, 24 * s, 16 * s, 0, 0, 6.283);
    ctx.fill();
  };

  // A peacock who strolls the cottage's hill, and now and then stops to dance
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pea = {
    x: 0, dir: Math.random() < 0.5 ? -1 : 1, heading: 1, face: 1, alt: 0, flap: 0, flight: null, mode: 'walk',
    timer: rnd(3, 7), phase: 0, raise: 0, bend: 0, clock: 0, turnAt: 0,
    roost: -1, side: 1, hang: 0, sleep: 0, rouse: 0, callWait: rnd(40, 90), noticed: false
  };
  // What the last frame drew, for the creatures to find their way around
  let ground = null, chimney = null, cottage = null, pines = [];
  const rustle = [0, 0, 0, 0, 0];
  const isNight = () => Theme.current !== 'light';
  pea.heading = pea.dir;
  pea.face = pea.dir;

  // Where he sleeps: halfway up a pine, on the side he arrived from, swaying with it
  const perch = (k) => {
    const p = pines[k], f = 0.55;
    const lean = (windAt(p.x) + rustle[k] * Math.sin(t * 15 + k)) * 0.12;
    const x = p.x + lean * p.th * Math.pow(f, 1.5) + pea.side * p.th * 0.05;
    return { x, a: ground(x) - (p.y - p.th * f) };
  };

  const takeOff = (to, then, dur, lift) => {
    pea.flight = { x0: pea.x, a0: pea.alt, to, then, p: 0, dur, h: lift };
    pea.mode = 'fly';
    heroEvent('flap');
  };

  const goRoost = () => {
    // The nearest of the taller pines
    let best = -1;
    pines.forEach((p, k) => {
      if (p.th < 38 * sc) return;
      if (best < 0 || Math.abs(p.x - pea.x) < Math.abs(pines[best].x - pea.x)) best = k;
    });
    if (best < 0) return;
    pea.roost = best;
    pea.heading = Math.sign(pines[best].x - pea.x) || 1;
    pea.mode = 'toRoost';
  };

  const startDance = (towards) => {
    pea.mode = 'dance';
    pea.timer = rnd(6, 10);
    pea.clock = 0;
    pea.turnAt = rnd(1.8, 3);
    if (towards !== undefined) pea.dir = towards;
  };

  // By day he crosses the whole hill edge to edge, stopping on the way to dance
  // or peck, and now and then taking a short, heavy flight. At night he walks to
  // a pine, flies up into it and sleeps there until morning.
  const stepPeacock = (dt) => {
    if (!ground || !pines.length) return;
    const lo = w * 0.03, hi = w * 0.97, speed = 20 * sc;
    const night = isNight();
    pea.timer -= dt;
    pea.clock += dt;

    if (night && ['walk', 'peck', 'dance'].includes(pea.mode)) goRoost();
    if (!night && pea.mode === 'toRoost') pea.mode = 'walk';
    if (!night && pea.mode === 'roost') {
      // Morning: down from the tree and on his way
      const x1 = Math.max(lo, Math.min(hi, pea.x + pea.heading * rnd(40, 70) * sc));
      takeOff(() => ({ x: x1, a: 0 }), 'walk', 1.6, 15 * sc);
      pea.timer = rnd(4, 8);
    }

    const hen_near = hen.on && hen.mode !== 'leave' && Math.abs(hen.x - pea.x) < w * 0.18;

    if (pea.mode === 'fly') {
      const f = pea.flight, end = f.to();
      f.p = Math.min(1, f.p + dt / f.dur);
      const e = f.p - Math.sin(f.p * 6.283) / 6.283;
      pea.x = f.x0 + (end.x - f.x0) * e;
      pea.alt = f.a0 + (end.a - f.a0) * e + f.h * Math.sin(Math.PI * f.p);
      // Hard beats to take off and land, slower ones while gliding
      pea.flap += dt * (f.p < 0.25 || f.p > 0.8 ? 17 : 9);
      if (f.p >= 1) {
        pea.alt = end.a;
        pea.mode = f.then;
        pea.timer = rnd(5, 10);
      }
    } else if (pea.mode === 'roost') {
      ({ x: pea.x, a: pea.alt } = perch(pea.roost));
      pea.rouse = Math.max(0, pea.rouse - dt);
    } else if (pea.mode === 'toRoost') {
      // Hurrying home to his tree
      pea.dir = pea.heading;
      const tx = pines[pea.roost].x;
      pea.x += pea.heading * speed * 1.8 * dt;
      pea.phase += dt * 9;
      if ((tx - pea.x) * pea.heading <= 2) {
        pea.side = pea.heading > 0 ? -1 : 1;
        const k = pea.roost;
        takeOff(() => perch(k), 'roost', 1.8, 20 * sc);
      }
    } else if (pea.mode === 'walk') {
      pea.dir = pea.heading;
      pea.x += pea.heading * speed * dt;
      pea.phase += dt * 6;
      if ((pea.x <= lo && pea.heading < 0) || (pea.x >= hi && pea.heading > 0)) {
        pea.x = Math.max(lo, Math.min(hi, pea.x));
        pea.heading = -pea.heading;
      }
      // The peahen catches his eye: he stops to show off soon
      if (hen_near && !pea.noticed) {
        pea.noticed = true;
        pea.timer = Math.min(pea.timer, rnd(0.5, 2));
      }
      if (pea.timer <= 0) {
        pea.clock = 0;
        const room = pea.heading > 0 ? hi - pea.x : pea.x - lo;
        const r = Math.random();
        if (hen_near && r < 0.8) {
          startDance(Math.sign(hen.x - pea.x) || 1);
          if (Math.random() < 0.5) heroEvent('peacock');
        } else if (r < 0.2 && room > w * 0.15) {
          const dist = Math.min(room, w * rnd(0.18, 0.35));
          const x1 = pea.x + pea.heading * dist;
          takeOff(() => ({ x: x1, a: 0 }), 'walk', 1.4 + dist / 240, rnd(55, 95) * sc);
        } else if (r < 0.65) {
          startDance();
          if (Math.random() < 0.3) heroEvent('peacock');
        } else {
          pea.mode = 'peck';
          pea.timer = rnd(2, 4);
        }
      }
    } else {
      if (pea.mode === 'dance') {
        // Shuffle in place, turning now and then to show off the fan
        pea.phase += dt * 2.5;
        if (pea.clock > pea.turnAt) { pea.dir = -pea.dir; pea.turnAt = pea.clock + rnd(1.6, 3); }
      }
      if (pea.timer <= 0) {
        // Then on his way again, the same way he was going
        pea.mode = 'walk';
        pea.timer = rnd(5, 10);
      }
    }
    if (!hen.on) pea.noticed = false;

    // Now and then he calls across the valley (not in his sleep)
    if (!night) {
      pea.callWait -= dt;
      if (pea.callWait <= 0) { heroEvent('peacock'); pea.callWait = rnd(70, 160); }
    }

    pea.raise += ((pea.mode === 'dance' ? 1 : 0) - pea.raise) * Math.min(1, dt * 1.6);
    const peck = pea.mode === 'peck' && Math.sin(pea.clock * 2.6) > 0.35 ? 1 : 0;
    pea.bend += (peck - pea.bend) * Math.min(1, dt * 7);
    pea.face += (pea.dir - pea.face) * Math.min(1, dt * 4);
    pea.hang += ((pea.mode === 'roost' ? 1 : 0) - pea.hang) * Math.min(1, dt * 2);
    pea.sleep += ((pea.mode === 'roost' && pea.rouse <= 0 ? 1 : 0) - pea.sleep) * Math.min(1, dt * 1.5);
  };

  // The peahen visits by day, pecks about, and pays the peacock no attention at all
  const hen = { on: false, x: 0, dir: 1, face: 1, mode: 'walk', timer: 0, stay: 0, wait: rnd(35, 70), phase: 0, bend: 0, clock: 0, hop: 0, alt: 0 };
  const stepHen = (dt) => {
    if (!ground) return;
    const night = isNight();
    if (!hen.on) {
      hen.wait -= dt;
      if (hen.wait <= 0 && !night) {
        const fromLeft = Math.random() < 0.5;
        Object.assign(hen, { on: true, x: fromLeft ? -20 : w + 20, dir: fromLeft ? 1 : -1, mode: 'walk', timer: rnd(4, 8), stay: rnd(60, 110) });
        hen.face = hen.dir;
      }
      return;
    }
    const speed = 16 * sc;
    hen.timer -= dt;
    hen.clock += dt;
    hen.stay -= dt;
    if ((hen.stay <= 0 || night) && hen.mode !== 'leave') {
      hen.mode = 'leave';
      hen.dir = hen.x < w / 2 ? -1 : 1;
    }
    const showOff = pea.mode === 'dance' && Math.abs(hen.x - pea.x) < w * 0.2;
    if (hen.mode === 'leave') {
      hen.x += hen.dir * speed * 1.6 * dt;
      hen.phase += dt * 8;
      if (hen.x < -30 || hen.x > w + 30) { hen.on = false; hen.wait = rnd(90, 180); }
    } else if (hen.mode === 'walk') {
      hen.x += hen.dir * speed * dt;
      hen.phase += dt * 6.5;
      if ((hen.x < w * 0.05 && hen.dir < 0) || (hen.x > w * 0.95 && hen.dir > 0)) hen.dir = -hen.dir;
      if (hen.timer <= 0 || showOff) {
        hen.clock = 0;
        hen.mode = 'peck';
        hen.timer = rnd(2, 5);
      }
    } else {
      // Pecking; if he's dancing at her, she turns her back on him
      if (showOff) hen.dir = Math.sign(hen.x - pea.x) || 1;
      if (hen.timer <= 0 && !showOff) {
        hen.mode = 'walk';
        hen.timer = rnd(3, 7);
        if (Math.random() < 0.4) hen.dir = -hen.dir;
      }
    }
    hen.hop = Math.max(0, hen.hop - dt * 2.2);
    hen.alt = Math.sin(hen.hop * Math.PI) * 10 * sc;
    const peck = hen.mode === 'peck' && Math.sin(hen.clock * 2.8) > 0.3 ? 1 : 0;
    hen.bend += (peck - hen.bend) * Math.min(1, dt * 7);
    hen.face += (hen.dir - hen.face) * Math.min(1, dt * 4);
  };

  const drawHen = (gy, u) => {
    if (!hen.on) return;
    const x = hen.x, y = gy(x);
    const c = (hex) => mixHex('#1d1946', hex, 0.3 + 0.7 * u);
    const k = sc * 1.05;
    const walking = hen.mode === 'peck' ? 0 : 1;
    const bob = -Math.abs(Math.sin(hen.phase)) * 0.6 * walking;
    const face = Math.sign(hen.face || 1) * Math.max(0.14, Math.abs(hen.face));
    ctx.save();
    ctx.translate(x, y + 1);
    ctx.rotate(Math.atan((gy(x + 4) - gy(x - 4)) / 8) * 0.7);
    ctx.scale(k * face, k);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(-1, 0, 7, 1.2, 0, 0, 6.283);
    ctx.fill();
    ctx.translate(0, -hen.alt / k);

    // A short brown tail
    ctx.fillStyle = c('#6f5f4f');
    for (let j = 0; j < 5; j++) {
      const a = Math.PI * (0.9 + j * 0.03);
      ctx.beginPath();
      ctx.ellipse(-6 + Math.cos(a) * 5, -12 + bob + Math.sin(a) * 5, 6, 1.8, a, 0, 6.283);
      ctx.fill();
    }
    ctx.strokeStyle = c('#8d7b68');
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (let j = 0; j < 2; j++) {
      const ph = hen.phase + j * Math.PI;
      const fx = -1 + Math.sin(ph) * 2.8 * walking;
      const lift = Math.max(0, Math.cos(ph)) * 1.6 * walking;
      ctx.beginPath();
      ctx.moveTo(-1, -8.5 + bob);
      ctx.lineTo((fx - 1) * 0.5, -4.2 - lift * 0.5);
      ctx.lineTo(fx, -lift);
      ctx.stroke();
    }
    ctx.fillStyle = c('#8a7a68');
    ctx.beginPath();
    ctx.ellipse(-1, -12.5 + bob, 7, 4.8, -0.15, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = c('#e6ddcc');
    ctx.beginPath();
    ctx.ellipse(1.5, -10.5 + bob, 3.8, 2.4, -0.2, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = c('#76664f');
    ctx.beginPath();
    ctx.ellipse(-3, -12.8 + bob, 4.8, 2.8, -0.15, 0, 6.283);
    ctx.fill();

    const hx = 6.5 + (11 - 6.5) * hen.bend + Math.sin(hen.phase * 2) * 0.7 * walking;
    const hy = -24.5 + (-5 + 24.5) * hen.bend + bob;
    ctx.strokeStyle = c('#3f8f6a');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(3, -14 + bob);
    ctx.quadraticCurveTo(5.5 + hen.bend * 4, -18 + bob + hen.bend * 9, hx, hy);
    ctx.stroke();
    ctx.fillStyle = c('#7a6a58');
    ctx.beginPath();
    ctx.arc(hx, hy, 2, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = c('#7a6a58');
    ctx.lineWidth = 0.5;
    for (let j = 0; j < 3; j++) {
      const a = -Math.PI / 2 - 0.4 + j * 0.25;
      const ex = hx - 0.4 + Math.cos(a) * 3.6, ey = hy - 1.4 + Math.sin(a) * 3.6;
      ctx.beginPath();
      ctx.moveTo(hx - 0.3, hy - 1.6);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, 0.6, 0, 6.283);
      ctx.fill();
    }
    ctx.fillStyle = c('#bfae90');
    ctx.beginPath();
    ctx.moveTo(hx + 1.6, hy - 0.5);
    ctx.lineTo(hx + 3.8, hy + 0.2);
    ctx.lineTo(hx + 1.6, hy + 0.7);
    ctx.fill();
    ctx.fillStyle = c('#f2f2f2');
    ctx.beginPath();
    ctx.ellipse(hx + 0.5, hy - 0.2, 1, 0.4, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = '#0b0a14';
    ctx.beginPath();
    ctx.arc(hx + 0.7, hy - 0.2, 0.35, 0, 6.283);
    ctx.fill();
    ctx.restore();
  };

  const drawPeacock = (gy, s, u) => {
    const x = pea.x, y = gy(x);
    const lit = 0.3 + 0.7 * u;
    const c = (hex) => mixHex('#1d1946', hex, lit);
    const k = s * 1.15, up = pea.raise;
    const flying = pea.mode === 'fly' ? 1 : 0;
    const walking = pea.mode === 'walk' || pea.mode === 'toRoost' ? 1 : pea.mode === 'dance' ? 0.45 : 0;
    const bob = -Math.abs(Math.sin(pea.phase)) * 0.7 * walking;
    const face = Math.sign(pea.face || 1) * Math.max(0.14, Math.abs(pea.face));

    ctx.save();
    ctx.translate(x, y + 1);
    ctx.rotate(Math.atan((gy(x + 4) - gy(x - 4)) / 8) * 0.7 * (1 - pea.hang));
    ctx.scale(k * face, k);

    // Soft shadow on the grass
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.12 * Math.max(0, 1 - pea.alt / 120)).toFixed(3)})`;
    ctx.beginPath();
    const shadow = 1 - Math.min(0.7, pea.alt / 150);
    ctx.ellipse(-3, 0, (9 + up * 12) * shadow, 1.4 * shadow, 0, 0, 6.283);
    ctx.fill();

    ctx.save();
    ctx.translate(0, -pea.alt / k);
    if (flying) {
      // Nose up to take off, nose down to land
      ctx.translate(0, -12);
      ctx.rotate(-0.3 * Math.cos(Math.PI * pea.flight.p));
      ctx.translate(0, 12);
    }
    ctx.rotate(up * Math.sin(t * 2.4) * 0.05);

    // The train: a long trail of eyespot feathers that rises into a fan
    const cx = -5, cy = -13 + bob, N = 24;
    if (up > 0.05) {
      ctx.globalAlpha = up;
      const fg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30 * up);
      fg.addColorStop(0, c('#1b4f33'));
      fg.addColorStop(0.6, c('#276a44'));
      fg.addColorStop(1, c('#2f7a4d'));
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 30 * up, Math.PI * 1.08, Math.PI * 1.92);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Long feathers first, then a shorter inner ring on top: two rows of eyes
    const order = [...Array(N).keys()].sort((p, q) => (p % 2) - (q % 2));
    for (const i of order) {
      const f = i / (N - 1);
      // Trailing behind him, or hanging straight down from the branch as he sleeps
      const trail = Math.PI * (0.95 + f * 0.05) * (1 - pea.hang) + (Math.PI * (0.55 + f * 0.05) + windAt(pea.x) * 0.04) * pea.hang;
      const fan = Math.PI * (1.08 + 0.84 * f);
      const a = trail + (fan - trail) * up + Math.sin(t * 30 + i * 1.7) * 0.014 * up + Math.sin(t * 9 + f * 4) * 0.03 * flying;
      const len = (14 + ((i * 7) % N) / N * 20) * (1 + pea.hang * 0.3) * (1 - up) + (34 + Math.cos((f - 0.5) * Math.PI) * 6) * (i % 2 ? 0.72 : 1) * up;
      const ca = Math.cos(a), sa = Math.sin(a);
      ctx.strokeStyle = c('#3f7f4a');
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + ca * len, cy + sa * len);
      ctx.stroke();
      ctx.fillStyle = c(i % 2 ? '#2a7d4e' : '#33905a');
      ctx.beginPath();
      ctx.ellipse(cx + ca * len * 0.7, cy + sa * len * 0.7, len * 0.3, 2 + up * 1.6, a, 0, 6.283);
      ctx.fill();
      const ex = cx + ca * len * 0.9, ey = cy + sa * len * 0.9;
      [['#c9a43a', 3.2, 2.4], ['#1f9e8e', 2.4, 1.8], ['#1b3f9a', 1.4, 1.1], ['#0b1430', 0.6, 0.6]].forEach(([col, rx, ry]) => {
        ctx.fillStyle = c(col);
        ctx.beginPath();
        ctx.ellipse(ex, ey, rx, ry, a, 0, 6.283);
        ctx.fill();
      });
    }

    // Legs, stepping as he walks
    ctx.strokeStyle = c('#8d7b68');
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    if (flying) {
      // Legs tucked back in flight
      ctx.beginPath();
      ctx.moveTo(-1, -9);
      ctx.lineTo(-5, -6.5);
      ctx.lineTo(-9, -6.5);
      ctx.stroke();
    }
    for (let j = 0; j < 2 && !flying && pea.mode !== 'roost'; j++) {
      const ph = pea.phase + j * Math.PI;
      const fx = -1 + Math.sin(ph) * 3.2 * walking;
      const lift = Math.max(0, Math.cos(ph)) * 1.8 * walking;
      ctx.beginPath();
      ctx.moveTo(-1, -9 + bob);
      ctx.lineTo((fx - 1) * 0.5, -4.5 - lift * 0.5);
      ctx.lineTo(fx, -lift);
      ctx.stroke();
    }

    // Body: a plump egg-shaped oval, fullest at the breast and only a little
    // narrower at the rump, brighter blue along the back than under the belly
    ctx.save();
    ctx.translate(0, bob);
    const bg = ctx.createLinearGradient(0, -18.5, 0, -7.5);
    bg.addColorStop(0, c('#2a63d4'));
    bg.addColorStop(1, c('#15367f'));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(5.5, -17.2);
    ctx.bezierCurveTo(9.6, -16.2, 10.2, -9.4, 5, -7.9);
    ctx.bezierCurveTo(1, -6.9, -6, -7.6, -9, -10.2);
    ctx.bezierCurveTo(-11.4, -13.2, -7, -17.6, -1, -18.2);
    ctx.bezierCurveTo(1.5, -18.5, 3.8, -18, 5.5, -17.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (flying) {
      // The near wing beating: buff coverts, chestnut flight feathers
      const beat = Math.sin(pea.flap);
      ctx.save();
      ctx.translate(0, -15);
      ctx.rotate(Math.PI + 0.2 + beat * 0.95);
      ctx.scale(1, 0.6 + 0.4 * Math.abs(Math.cos(pea.flap)));
      ctx.fillStyle = c('#9c5a2c');
      ctx.beginPath();
      ctx.ellipse(16, 0.5, 8.5, 3.6, 0, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = c('#b39064');
      ctx.beginPath();
      ctx.ellipse(7.5, 0, 9, 4.6, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
    } else {
      // The folded wing lying along his side: buff, barred with brown
      ctx.save();
      ctx.translate(0, bob);
      ctx.fillStyle = c('#b79468');
      ctx.beginPath();
      ctx.moveTo(3.5, -15.6);
      ctx.bezierCurveTo(-1, -16.8, -6.5, -15.2, -9.2, -11.2);
      ctx.bezierCurveTo(-5.5, -10.2, -1.5, -10.2, 2.5, -11.6);
      ctx.bezierCurveTo(4, -12.6, 4.2, -14.6, 3.5, -15.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c('#7d5b3a');
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const bx = 1.5 - j * 2.6;
        ctx.moveTo(bx, -14.6 + j * 0.5);
        ctx.lineTo(bx - 1.6, -11.6 + j * 0.3);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Neck and head; bobbing on the walk, dipping to peck
    // Neck stretched forward in flight
    // Pecking, the neck reaches forward over the breast and curves down so
    // the beak meets the ground, and the head tips to point at it
    let hx = 7 + (12.5 - 7) * pea.bend - up * 1 + Math.sin(pea.phase * 2) * 0.8 * walking + flying * 3;
    let hy = -27 + (-3.5 + 27) * pea.bend + bob + flying * 4;
    // Asleep: head drawn down onto his shoulders
    hx += (2 - hx) * pea.sleep;
    hy += (-18 - hy) * pea.sleep;
    // The neck: a tapered S-curve, broad at the shoulders and slim at the
    // head, with a sheen down its front
    // Its root stays buried in the shoulders; the curve rises out of the back
    // before arching forward, so a peck is one smooth arc, not a hinge
    const n0 = [3 + pea.bend, -15 + bob - pea.bend * 0.5], n1 = [hx, hy];
    const c1 = [5 + pea.bend * 4, -19 + bob - pea.bend * 2], c2 = [6.5 + pea.bend * 9.5, -23 + bob + pea.bend * 9];
    // Asleep, the curve shortens into a hunch with the head on the shoulders
    for (const [cp, k] of [[c1, 0.5], [c2, 0.8]]) { cp[0] += (n1[0] - cp[0]) * pea.sleep * k; cp[1] += (n1[1] - cp[1]) * pea.sleep * k; }
    const neckAt = (q) => {
      const r = 1 - q;
      return [
        r * r * r * n0[0] + 3 * r * r * q * c1[0] + 3 * r * q * q * c2[0] + q * q * q * n1[0],
        r * r * r * n0[1] + 3 * r * r * q * c1[1] + 3 * r * q * q * c2[1] + q * q * q * n1[1]
      ];
    };
    const sides = [[], []];
    for (let j = 0; j <= 10; j++) {
      const q = j / 10, [px, py] = neckAt(q), [qx, qy] = neckAt(Math.min(1, q + 0.05));
      const dl = Math.hypot(qx - px, qy - py) || 1, nx = -(qy - py) / dl, ny = (qx - px) / dl;
      const hw = 2.3 - 1.1 * q;
      sides[0].push([px + nx * hw, py + ny * hw]);
      sides[1].push([px - nx * hw, py - ny * hw]);
    }
    ctx.fillStyle = c('#2a6fd6');
    ctx.beginPath();
    sides[0].forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    for (let j = sides[1].length - 1; j >= 0; j--) ctx.lineTo(sides[1][j][0], sides[1][j][1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c('#58a0f2');
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    sides[1].forEach(([px, py], j) => { const [qx, qy] = [px * 0.8 + neckAt(j / 10)[0] * 0.2, py * 0.8 + neckAt(j / 10)[1] * 0.2]; j ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); });
    ctx.stroke();
    ctx.globalAlpha = 1;

    // The head: a small oval, white patches above and below the eye, a dark
    // beak, and the crest of wire-stemmed feathers
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(pea.bend * 0.95);
    ctx.translate(-hx, -hy);
    ctx.fillStyle = c('#2a6fd6');
    ctx.beginPath();
    ctx.ellipse(hx + 0.2, hy, 2.5, 2, 0.15, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = c('#2a6fd6');
    ctx.lineWidth = 0.4;
    for (let j = 0; j < 5; j++) {
      const ca = -Math.PI / 2 - 0.6 + j * 0.3;
      const ex = hx - 0.4 + Math.cos(ca) * 5, ey = hy - 1.5 + Math.sin(ca) * 5;
      ctx.beginPath();
      ctx.moveTo(hx - 0.3, hy - 1.8);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = c('#1f8f86');
      ctx.beginPath();
      ctx.ellipse(ex, ey, 0.9, 0.6, ca + Math.PI / 2, 0, 6.283);
      ctx.fill();
    }
    ctx.fillStyle = c('#4a3f33');
    ctx.beginPath();
    ctx.moveTo(hx + 2.2, hy - 0.8);
    ctx.lineTo(hx + 4.6, hy + 0.3);
    ctx.lineTo(hx + 2.2, hy + 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c('#f4f4f4');
    ctx.beginPath();
    ctx.ellipse(hx + 0.7, hy - 1.05, 1.3, 0.42, 0.1, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx + 1, hy + 0.55, 1.1, 0.4, -0.1, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = '#0b0a14';
    ctx.beginPath();
    ctx.arc(hx + 1, hy - 0.3, 0.42, 0, 6.283);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    ctx.restore();
  };

  // Wind: a constant gentle sway, and now and then a gust sweeping left to right
  const gust = { wait: rnd(1.5, 3.5), t: -1, k: 0 };
  const stepWind = (dt) => {
    gust.wait -= dt;
    if (gust.wait <= 0) {
      gust.t = 0;
      gust.k = rnd(0.6, 1);
      gust.wait = rnd(7, 15);
      heroEvent('gust', { k: gust.k });
    }
    if (gust.t >= 0) gust.t = gust.t > 6 ? -1 : gust.t + dt;
    HeroEvents.wind = gustAt(w * 0.5);
    for (let k = 0; k < rustle.length; k++) rustle[k] *= Math.exp(-dt * 1.6);
  };
  const gustAt = (x) => {
    const g = gust.t - (x / w) * 1.2;
    return gust.t >= 0 && g > 0 && g < 3.5 ? gust.k * Math.pow(Math.sin(Math.PI * g / 3.5), 2) * (1 + 0.25 * Math.sin(g * 9)) : 0;
  };
  const windAt = (x) => 0.22 * Math.sin(t * 0.8 + x * 0.01) + 0.1 * Math.sin(t * 1.9 + x * 0.03) + gustAt(x);
  HeroEvents.gustAt = gustAt;

  // Chimney smoke: puffs that rise, spread, and lean over in the wind
  const puffs = [];
  let puffWait = 0;
  const stepSmoke = (dt) => {
    if (chimney) {
      puffWait -= dt;
      if (puffWait <= 0) {
        puffs.push({ x: chimney.x, y: chimney.y, age: 0, life: rnd(5, 7), r: 2.5 * sc, sp: rnd(0.8, 1.2), ph: rnd(0, 6) });
        puffWait = 0.3;
      }
    }
    for (const p of puffs) {
      p.age += dt;
      p.x += (4 + windAt(p.x) * 22 + Math.sin(p.age * 1.3 + p.ph) * 3) * sc * dt;
      p.y -= 14 * sc * p.sp * (1 - (p.age / p.life) * 0.6) * dt;
      p.r += 2.2 * sc * dt;
    }
    while (puffs.length && puffs[0].age > puffs[0].life) puffs.shift();
  };
  const drawSmoke = (n) => {
    const r = Math.round(245 - 60 * n), g = Math.round(245 - 60 * n), b = Math.round(250 - 30 * n);
    for (const p of puffs) {
      const a = 0.3 * (1 - p.age / p.life) * Math.min(1, p.age * 2) * (1 - n * 0.45);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fill();
    }
  };

  // The near hill as a meadow: a soft grassy edge in the hill's own colour,
  // a scatter of wildflowers, and the wind running over it as a light sheen
  const MEADOW_FLOWERS = ['#fff8e7', '#f6d365', '#f2a7c3', '#c7b6f0'];
  const hash = (v) => Math.abs(Math.sin(v * 12.9898) * 43758.5453) % 1;
  const drawMeadow = (gy, hillColor, u, clipHill) => {
    // Wind sheen: a lighter band travelling with the gust, inside the hill only
    if (gust.t >= 0) {
      const front = (gust.t / 1.2) * w, k = gust.k * Math.max(0, 1 - gust.t / 5);
      if (k > 0.01) {
        ctx.save();
        clipHill();
        ctx.clip();
        const g = ctx.createLinearGradient(front - w * 0.3, 0, front + w * 0.05, 0);
        g.addColorStop(0, 'rgba(255, 255, 240, 0)');
        g.addColorStop(0.75, `rgba(255, 255, 240, ${(0.14 * k * (0.3 + 0.7 * u)).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255, 255, 240, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(front - w * 0.3, 0, w * 0.35, h);
        ctx.restore();
      }
    }

    // A dense fringe of tapered blades along the top edge
    const blades = (tone, step, minH, maxH, seed) => {
      ctx.fillStyle = tone;
      ctx.beginPath();
      for (let i = 0; i * step < w + 8; i++) {
        const r = hash(i * 1.37 + seed);
        const x = i * step + (r - 0.5) * step;
        const y = gy(x) + 1.5;
        const hg = (minH + r * (maxH - minH)) * sc;
        const lean = (windAt(x) * 0.6 + Math.sin(t * 2.2 + x * 0.21) * 0.08 + (r - 0.5) * 0.5) * hg;
        const bw = 1.3 * sc;
        ctx.moveTo(x - bw, y);
        ctx.quadraticCurveTo(x - bw * 0.3 + lean * 0.3, y - hg * 0.6, x + lean, y - hg);
        ctx.quadraticCurveTo(x + bw * 0.3 + lean * 0.3, y - hg * 0.6, x + bw, y);
        ctx.closePath();
      }
      ctx.fill();
    };
    blades(hillColor, 3, 3, 8, 0);
    if (u > 0.05) {
      ctx.globalAlpha = u * 0.55;
      blades(mixHex('#7ea67b', '#b5d6a6', 0.6), 7, 2.5, 6, 9);
      ctx.globalAlpha = 1;
    }

    // Wildflowers nodding on their stems
    for (let i = 0; i * 34 < w; i++) {
      const r = hash(i * 7.31 + 3);
      if (r < 0.35) continue;
      const x = i * 34 + r * 20;
      const y = gy(x) + 2;
      const hg = (7 + r * 6) * sc;
      const lean = (windAt(x) * 0.7 + Math.sin(t * 1.8 + i) * 0.1) * hg;
      ctx.strokeStyle = hillColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.3, y - hg * 0.6, x + lean, y - hg);
      ctx.stroke();
      ctx.fillStyle = mixHex('#1d1946', MEADOW_FLOWERS[Math.floor(r * 97) % MEADOW_FLOWERS.length], 0.15 + 0.85 * u);
      ctx.beginPath();
      ctx.arc(x + lean, y - hg, 1.7 * sc, 0, 6.283);
      ctx.fill();
    }
  };

  // Shooting stars, now and then, on clear nights
  const meteors = [];
  let meteorWait = rnd(6, 12);
  const stepMeteors = (dt, n) => {
    if (n > 0.7) {
      meteorWait -= dt;
      if (meteorWait <= 0) {
        const dir = Math.random() < 0.5 ? -1 : 1, ang = rnd(0.3, 0.6), sp = rnd(650, 950) * Math.max(0.6, w / 1500);
        meteors.push({
          x: w * (dir > 0 ? rnd(0.05, 0.6) : rnd(0.4, 0.95)), y: h * rnd(0.04, 0.3),
          vx: Math.cos(ang) * sp * dir, vy: Math.sin(ang) * sp, age: 0, life: rnd(0.7, 1.1), len: rnd(90, 150) * sc
        });
        meteorWait = rnd(25, 60);
      }
    }
    for (const m of meteors) { m.age += dt; m.x += m.vx * dt; m.y += m.vy * dt; }
    while (meteors.length && meteors[0].age > meteors[0].life) meteors.shift();
  };
  const drawMeteors = (n) => {
    for (const m of meteors) {
      const a = Math.sin(Math.PI * m.age / m.life) * n;
      const sp = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / sp) * m.len, ty = m.y - (m.vy / sp) * m.len;
      const g = ctx.createLinearGradient(tx, ty, m.x, m.y);
      g.addColorStop(0, 'rgba(255, 250, 235, 0)');
      g.addColorStop(1, `rgba(255, 250, 235, ${(0.9 * a).toFixed(3)})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 252, 240, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.5, 0, 6.283);
      ctx.fill();
    }
  };

  // The cottage lamp: lit at night by itself, or switched by a tap
  const lamp = { k: isNight() ? 1 : 0, override: null };
  const lampOn = () => (lamp.override === null ? isNight() : lamp.override);

  // A spruce drawn the way one really grows: a tapering trunk you can see
  // between the lower branches, whorls of drooping branches that are long and
  // ragged low down and short and upswept near the leader, each hung with a
  // fringe of needle tips. The foliage is darkest in against the trunk and
  // under each whorl, and the sun catches the top edge of every branch on the
  // right. The higher the tree, the more the wind bends it. Every tree (by
  // seed) differs in width, whorl count, gaps, droop and green.
  const drawPine = (x, y, th, wind, u, seed) => {
    const rand = (k) => Math.abs(Math.sin((seed * 13.7 + k) * 12.9898) * 43758.5453) % 1;
    const c = (hex) => mixHex('#1d1946', hex, u);
    const warm = rand(1) < 0.5;
    const SH = hexRgb(warm ? '#1b3524' : '#183126'), BO = hexRgb(warm ? '#35653e' : '#2f5f3e');
    const LI = hexRgb(warm ? '#86ad66' : '#78a468'), NI = hexRgb('#1d1946');
    // Foliage colour at height g (0 foot … 1 tip), side (-1 shade, 1 sun) and
    // distance q out along the branch (0 at the trunk … 1 at the tip)
    const col = (g, side, q) => {
      const dark = Math.min(1, (1 - g) * 0.3 + (1 - q) * 0.5);
      const light = side > 0 ? 0.18 + 0.5 * q * (0.6 + 0.4 * g) : 0.1 * q;
      const out = BO.map((v, i) => {
        let m = v + (SH[i] - v) * dark;
        m += (LI[i] - m) * light;
        return Math.round(NI[i] + (m - NI[i]) * u);
      });
      return `rgb(${out.join(', ')})`;
    };
    const lean = wind * 0.12;
    const bend = (f) => lean * th * Math.pow(f, 1.6);
    const half = th * (0.34 + rand(2) * 0.1);
    const whorls = 9 + Math.floor(rand(3) * 3);
    const taper = 0.72 + rand(5) * 0.2; // >1: a slimmer, more concave outline
    const f0 = 0.17 + rand(4) * 0.06; // bare trunk below the lowest whorl
    const fTop = 0.9;
    const tw = Math.max(1, th * 0.032);
    const quad = (a, b, cp, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * cp + t * t * b;

    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';

    // Trunk: tapering to the leader, with a sunlit strip down its right side
    const trunk = (xo, ws, color) => {
      ctx.beginPath();
      ctx.moveTo(xo - tw * ws, 1);
      ctx.lineTo(xo + tw * ws, 1);
      ctx.lineTo(bend(fTop) + xo * 0.3 + tw * 0.2 * ws, -th * fTop);
      ctx.lineTo(bend(fTop) + xo * 0.3 - tw * 0.2 * ws, -th * fTop);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    trunk(0, 1, c('#46301f'));
    trunk(tw * 0.6, 0.35, c('#6e5036'));
    ctx.strokeStyle = c('#3b3326');
    ctx.lineWidth = Math.max(0.8, th * 0.014);
    ctx.beginPath();
    ctx.moveTo(bend(fTop), -th * fTop);
    ctx.lineTo(bend(0.98), -th * 0.98);
    ctx.stroke();

    // A bare dead twig or two under the lowest branches
    ctx.strokeStyle = c('#4d3b29');
    ctx.lineWidth = Math.max(0.6, th * 0.01);
    for (let k = 0; k < 2; k++) {
      if (rand(50 + k) < 0.4) continue;
      const side = k ? -1 : 1, fy = -th * f0 * (0.5 + rand(52 + k) * 0.4);
      ctx.beginPath();
      ctx.moveTo(side * tw * 0.5, fy);
      ctx.lineTo(side * half * (0.22 + rand(54 + k) * 0.2), fy + th * 0.035);
      ctx.stroke();
    }

    // One branch: a drooping blade from the trunk out to its tip, bowing up a
    // little first, with needle tufts hanging from its underside
    const branch = (f, side, len, droop, thick, salt, g) => {
      const ox = bend(f), oy = -th * f;
      const drift = lean * th * 0.3 * f; // tips pushed downwind
      const tx = ox + side * len + drift, ty = oy + droop;
      const cx = ox + side * len * 0.5 + drift * 0.4, cy = oy - droop * 0.25 - thick * 0.3;
      const y0 = oy - thick * 0.3;
      const grad = ctx.createLinearGradient(ox, 0, tx, 0);
      grad.addColorStop(0, col(g, side, 0));
      grad.addColorStop(1, col(g, side, 1));
      ctx.beginPath();
      ctx.moveTo(ox, y0);
      ctx.quadraticCurveTo(cx, cy, tx, ty);
      const n = 7;
      for (let i = 1; i <= n; i++) {
        const q = i / n; // tip … trunk
        const px = quad(ox, tx, cx, 1 - q), py = quad(y0, ty, cy, 1 - q);
        const hang = thick * (0.35 + 0.9 * q) * (0.45 + rand(salt + i) * 0.8) + (i % 2 ? thick * 0.35 : 0);
        ctx.lineTo(px + side * thick * 0.3 * (rand(salt + i + 40) - 0.5), py + hang);
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      // Sun along the upper edge of the branches on the right
      if (side > 0 && u > 0.05) {
        ctx.strokeStyle = `rgba(${LI.join(', ')}, ${(0.55 * u).toFixed(2)})`;
        ctx.lineWidth = Math.max(0.6, th * 0.012);
        ctx.beginPath();
        ctx.moveTo(quad(ox, tx, cx, 0.25), quad(y0, ty, cy, 0.25));
        ctx.quadraticCurveTo(quad(ox, tx, cx, 0.6), quad(y0, ty, cy, 0.6) - thick * 0.1, tx, ty);
        ctx.stroke();
      }
    };

    // Whorls from the foot up, so each one hangs over the one below
    for (let j = 0; j < whorls; j++) {
      const g = (j + 0.6) / whorls;
      const f = f0 + (fTop - f0) * Math.pow(g, 0.86);
      const W = half * Math.pow(1 - g, taper) + th * 0.025;
      for (const side of [-1, 1]) {
        const salt = j * 17 + (side > 0 ? 500 : 900);
        if (j < 2 && rand(salt) < 0.12) continue; // a gap low down where a branch was lost
        const len = W * (0.78 + rand(salt + 1) * (0.4 - 0.12 * g)) * (j ? 1 : 0.85);
        // Branches droop, but never far: the lowest tier stays clear of the ground
        const droop = Math.min(th * 0.06, len * (0.3 - 0.2 * g) * (0.7 + rand(salt + 2) * 0.6) + th * 0.008);
        const thick = th * (0.05 + 0.03 * (1 - g)) * (0.85 + rand(salt + 3) * 0.35);
        branch(f + (rand(salt + 4) - 0.5) * 0.02, side, len, droop, thick, salt, g);
      }
      // Now and then a shorter branch between whorls, on one side or the other
      if (j < whorls - 1 && rand(j * 31 + 7) < 0.6) {
        const side = rand(j * 31 + 8) < 0.5 ? -1 : 1;
        const gm = (j + 1.1) / whorls, fm = f0 + (fTop - f0) * Math.pow(gm, 0.78);
        const Wm = (half * Math.pow(1 - gm, taper) + th * 0.015) * (0.45 + rand(j * 31 + 9) * 0.3);
        branch(fm, side, Wm, Wm * 0.35, th * 0.03, j * 31 + 10, gm);
      }
    }
    // The leader: a tuft of the youngest branches around the tip
    branch(fTop + 0.03, -1, th * 0.045, th * 0.014, th * 0.03, 700, 0.97);
    branch(fTop + 0.03, 1, th * 0.05, th * 0.014, th * 0.03, 710, 0.97);
    branch(fTop + 0.07, -1, th * 0.02, th * 0.006, th * 0.018, 720, 1);
    branch(fTop + 0.07, 1, th * 0.022, th * 0.006, th * 0.018, 730, 1);
    ctx.restore();
  };

  // A storybook cottage: a long wall facing us, a sunlit gable end, a tiled roof,
  // brick chimney, flower box, arched door, a bush and a bit of picket fence.
  // At night it all goes to silhouette except the windows, when the lamp is lit.
  const drawCottage = (x, y, s, u, n) => {
    const c = (hex) => mixHex('#1d1946', hex, u);
    const rect = (col, x0, y0, wd, ht) => { ctx.fillStyle = c(col); ctx.fillRect(x0, y0, wd, ht); };
    const poly = (col, pts) => {
      ctx.fillStyle = c(col);
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
    };
    const dot = (col, px, py, r) => { ctx.fillStyle = c(col); ctx.beginPath(); ctx.arc(px, py, r, 0, 6.283); ctx.fill(); };
    const flicker = 0.85 + Math.sin(t * 3.1) * 0.05 + Math.sin(t * 7.3) * 0.04;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // Lamplight spilling out of the windows
    const glow = lamp.k * (0.35 + 0.65 * n);
    if (glow > 0.01) {
      const g = ctx.createRadialGradient(-2, -12, 1, -2, -12, 44);
      g.addColorStop(0, `rgba(255, 200, 120, ${(0.45 * flicker * glow).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255, 200, 120, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-50, -58, 96, 84);
    }

    // A round bush by the long wall
    dot('#4f8257', -31, -3.5, 4.5);
    dot('#5f8f62', -27.5, -5.5, 4.2);
    dot('#6e9e68', -29, -7.5, 3.2);

    // The house is seen straight on and built symmetrically, so every roof
    // angle is honest: a hipped roof over the long wall, and a gable in the
    // middle of it facing us, with the door beneath and a round window in
    // the peak. The gable's rakes run parallel to its wall edges and the tile
    // band straddles the join, so no stray roof shows through beside it.
    // Walls and a stone plinth
    rect('#efe3cf', -26, -22, 48, 22);
    rect('#d8c8ae', -26, -2, 48, 2);

    // The main roof: terracotta tiles, hipped at both ends, with a ridge cap
    const E0 = [-30, -20], E1 = [26, -20], R0 = [-20, -40], R1 = [16, -40];
    poly('#c4704f', [E0, E1, R1, R0]);
    ctx.strokeStyle = c('#a85a3d');
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const f of [0.25, 0.5, 0.75]) {
      const yy = E0[1] + (R0[1] - E0[1]) * f;
      ctx.moveTo(E0[0] + (R0[0] - E0[0]) * f, yy);
      ctx.lineTo(E1[0] + (R1[0] - E1[0]) * f, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = c('#9a4f35');
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(R0[0], R0[1]);
    ctx.lineTo(R1[0], R1[1]);
    ctx.stroke();
    ctx.strokeStyle = c('#b9a587');
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(E0[0], E0[1] + 0.4);
    ctx.lineTo(E1[0], E1[1] + 0.4);
    ctx.stroke();

    // Brick chimney with a cap, straddling the ridge toward the right end
    rect('#a65b3f', 9, -49, 6, 12);
    rect('#7b3f2b', 8, -50.5, 8, 2.2);
    ctx.strokeStyle = c('#8d4a33');
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (const yy of [-46, -43, -40]) { ctx.moveTo(9, yy); ctx.lineTo(15, yy); }
    ctx.stroke();

    // The front gable: its sunlit wall rising to a peak, then the roof edge
    // over it, a thick band of tiles with pale fascia boards along both rakes
    const gx = -2, gw = 9, gh = 15; // centre, half-width, rise of the gable wall
    poly('#fbf4e7', [[gx - gw, 0], [gx - gw, -22], [gx, -22 - gh], [gx + gw, -22], [gx + gw, 0]]);
    rect('#e6d8c0', gx - gw, -2, gw * 2, 2);
    // Rakes run parallel to the wall's edges, o units out from them
    const rake = (o) => {
      const k = Math.hypot(gw, gh), nx = (gh / k) * o, ny = (gw / k) * o; // outward normal
      return [[gx - gw - 3 - nx, -22 + 3 * (gh / gw) - ny], [gx, -22 - gh - o * (k / gw)], [gx + gw + 3 + nx, -22 + 3 * (gh / gw) - ny]];
    };
    const [ia, ib, ic] = rake(-1.2), [oa, ob, oc] = rake(2.2), [fa, fb, fc] = rake(0.2);
    poly('#c4704f', [ia, ib, ic, oc, ob, oa]);
    ctx.strokeStyle = c('#9a4f35');
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(oa[0], oa[1]);
    ctx.lineTo(ob[0], ob[1]);
    ctx.lineTo(oc[0], oc[1]);
    ctx.stroke();
    ctx.strokeStyle = c('#b9a587');
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(fa[0], fa[1]);
    ctx.lineTo(fb[0], fb[1]);
    ctx.lineTo(fc[0], fc[1]);
    ctx.stroke();

    // Windows: framed panes, lit by the lamp, a flower box under each
    const pane = (x0, y0, wd, ht) => {
      rect('#ffffff', x0 - 1, y0 - 1, wd + 2, ht + 2);
      ctx.fillStyle = mixHex('#2a2556', '#7aa6c9', u);
      ctx.fillRect(x0, y0, wd, ht);
      ctx.globalAlpha = lamp.k;
      ctx.fillStyle = `rgba(255, 214, 150, ${(0.85 + 0.15 * flicker).toFixed(3)})`;
      ctx.fillRect(x0, y0, wd, ht);
      ctx.globalAlpha = 1;
      rect('#ffffff', x0 + wd / 2 - 0.4, y0, 0.8, ht);
      rect('#ffffff', x0, y0 + ht / 2 - 0.4, wd, 0.8);
    };
    for (const wx of [-22, 10]) {
      pane(wx, -16, 9, 8);
      rect('#8a5a3c', wx - 1.5, -7.2, 12, 2.4);
      for (const [fx, col] of [[wx + 1, '#f2a7c3'], [wx + 3.5, '#f6d365'], [wx + 6, '#e8798f'], [wx + 8.5, '#f2a7c3']]) dot(col, fx, -8.2, 1.1);
    }
    // A round attic window up in the peak
    dot('#ffffff', gx, -28.5, 2.6);
    ctx.fillStyle = mixHex('#2a2556', '#7aa6c9', u);
    ctx.beginPath();
    ctx.arc(gx, -28.5, 1.9, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = lamp.k;
    ctx.fillStyle = 'rgb(255, 214, 150)';
    ctx.fill();
    ctx.globalAlpha = 1;

    // An arched wooden door with a knob, and a stepping stone
    ctx.fillStyle = c('#8a5a3c');
    ctx.beginPath();
    ctx.moveTo(gx - 3, 0);
    ctx.lineTo(gx - 3, -9);
    ctx.arc(gx, -9, 3, Math.PI, 0);
    ctx.lineTo(gx + 3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c('#6e4630');
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, -12);
    ctx.lineTo(gx, 0);
    ctx.stroke();
    dot('#e8c46a', gx + 2, -5, 0.6);
    rect('#cfc6b8', gx - 4, 0, 8, 1.4);

    // A bit of white picket fence
    ctx.fillStyle = c('#f4ece0');
    ctx.fillRect(30, -5.2, 13, 1);
    ctx.fillRect(30, -2.6, 13, 1);
    for (let px = 31; px <= 42; px += 3) {
      ctx.beginPath();
      ctx.moveTo(px - 0.8, 0.5);
      ctx.lineTo(px - 0.8, -6.5);
      ctx.lineTo(px, -7.8);
      ctx.lineTo(px + 0.8, -6.5);
      ctx.lineTo(px + 0.8, 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  // A range of snowy mountains on the right: a hazy, paler range far behind
  // and a nearer, crisper one in front. Every peak is its own jagged shape
  // with a sunlit right face, a shaded left face, a few gullies running down
  // from the ridge, and a snowcap whose ragged edge follows those gullies.
  // Haze thickens toward their feet. Hazy blue by day, moonlit at night.
  // x is the summit's place across the hero; hgt its height and hl/hr the
  // half-widths of its base to either side, all as fractions of the range's
  // size unit (so a narrow phone gets small mountains, not tall spikes);
  // snow is how far down from the summit the snow reaches, as a fraction of
  // its height.
  const MOUNTAINS = {
    far: [
      { x: 0.83, hgt: 0.08, hl: 0.13, hr: 0.11, snow: 0.32, seed: 5 },
      { x: 0.925, hgt: 0.074, hl: 0.09, hr: 0.11, snow: 0.3, seed: 6 }
    ],
    near: [
      { x: 0.853, hgt: 0.095, hl: 0.086, hr: 0.078, snow: 0.3, seed: 1 },
      { x: 0.8, hgt: 0.071, hl: 0.062, hr: 0.07, snow: 0.26, seed: 2 },
      { x: 0.905, hgt: 0.065, hl: 0.066, hr: 0.073, snow: 0.22, seed: 3 }
    ]
  };
  // One flank of a peak, summit to foot: a run of straight segments of
  // uneven slope, the odd one kicking back up into a little sub-summit.
  // Points are [rx, ry]: rx 0 at the summit … 1 at the foot, ry 1 … 0.
  const flank = (seed, salt) => {
    const rand = (k) => Math.abs(Math.sin((seed * 7.3 + salt + k) * 12.9898) * 43758.5453) % 1;
    const n = 7, dx = [], dy = [];
    for (let i = 0; i < n; i++) { dx.push(0.4 + rand(i) * 1.2); dy.push(0.5 + rand(i + 20) * 1); }
    const sx = dx.reduce((a, b) => a + b), sy = dy.reduce((a, b) => a + b);
    const pts = [];
    let rx = 0, ry = 1;
    for (let i = 0; i < n; i++) {
      rx += dx[i] / sx;
      ry -= dy[i] / sy;
      if (i > 0 && i < n - 2 && rand(i + 40) < 0.35) {
        // a notch, then a sub-summit
        pts.push([rx - 0.03, Math.max(0, ry - 0.03)]);
        pts.push([rx, Math.min(1, ry + 0.05)]);
      } else pts.push([rx, Math.max(0, ry)]);
    }
    pts[pts.length - 1][1] = 0;
    return pts;
  };
  const profiles = {};
  const profileOf = (m) => profiles[m.seed] || (profiles[m.seed] = { left: flank(m.seed, 0), right: flank(m.seed, 100) });

  const drawMountains = (u, off) => {
    // Mountains are sized from the narrower of width and height, and their
    // feet sit just below the crest of the furthest hill
    const S = Math.min(w * 1.3, h * 1.35);
    const baseY = h * 0.7 + S * 0.045;
    const poly = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    };
    const drawRange = (list, tone, parallax) => {
      list.forEach((m) => {
        const cx = w * m.x + off * parallax, H = S * m.hgt, top = baseY - H;
        const { left, right } = profileOf(m);
        const hl = S * m.hl, hr = S * m.hr;
        const L = ([rx, ry]) => [cx - rx * hl, baseY - ry * H];
        const R = ([rx, ry]) => [cx + rx * hr, baseY - ry * H];
        const summit = [cx, top];
        // Outline: up the left flank, over the summit, down the right
        const shape = [...left.map(L).reverse(), summit, ...right.map(R)];
        shape.push([shape[shape.length - 1][0], baseY + 2], [shape[0][0], baseY + 2]);
        const rand = (k) => Math.abs(Math.sin((m.seed * 3.1 + k) * 12.9898) * 43758.5453) % 1;

        ctx.save();
        poly(shape);
        ctx.fillStyle = tone.lit;
        ctx.fill();
        ctx.clip();

        // The shaded left face: everything left of the spine, which runs from
        // the summit down to the foot, drifting a little left as it goes
        const spine = [summit, [cx - hl * 0.1, top + H * 0.45], [cx - hl * 0.2, baseY + 2]];
        poly([[cx - hl * 1.5, top - 5], ...spine, [cx - hl * 1.5, baseY + 2]]);
        ctx.fillStyle = tone.shade;
        ctx.fill();
        // A couple of buttresses on the lit face: narrow shaded wedges
        // running down from points on the right flank
        ctx.fillStyle = tone.mid;
        for (let k = 0; k < 2; k++) {
          const p = right[1 + k * 2];
          if (!p) break;
          const [bx, by] = R(p);
          const wdt = hr * (0.05 + rand(k + 10) * 0.08);
          poly([[bx, by], [bx + wdt * 0.6, baseY + 2], [bx - wdt, baseY + 2]]);
          ctx.fill();
        }
        // Gullies: thin dark lines running down both faces from near the ridge
        ctx.strokeStyle = tone.gully;
        ctx.lineWidth = Math.max(0.6, S * 0.0011);
        ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const side = k % 2 ? -1 : 1, src = side > 0 ? right : left, P = side > 0 ? R : L;
          const p = src[Math.min(src.length - 2, Math.floor(rand(k + 30) * 3))];
          const [gx, gy] = P(p);
          const len = H * (0.2 + rand(k + 50) * 0.2);
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + side * len * (0.15 + rand(k + 60) * 0.2), gy + len);
          ctx.stroke();
        }

        // Snowcap: the peak above a ragged snowline with tongues reaching down
        // the gullies; its left side is in shadow too
        const snowY = top + H * m.snow;
        const snowPoly = [[cx - hl * 1.5, top - 5], [cx + hr * 1.5, top - 5], [cx + hr * 1.5, snowY]];
        const teeth = 8;
        for (let k = teeth; k >= 0; k--) {
          const sx = cx - hl + (hl + hr) * (k / teeth);
          const tongue = (k % 2 ? 0.05 + rand(k + 70) * 0.09 : rand(k + 80) * 0.03) * H;
          snowPoly.push([sx, snowY + tongue]);
        }
        snowPoly.push([cx - hl * 1.5, snowY]);
        poly(snowPoly);
        ctx.fillStyle = tone.snow;
        ctx.fill();
        ctx.clip();
        poly([[cx - hl * 1.5, top - 5], ...spine, [cx - hl * 1.5, baseY + 2]]);
        ctx.fillStyle = tone.snowShade;
        ctx.fill();
        ctx.restore();
      });
    };
    drawRange(MOUNTAINS.far, {
      lit: mixHex('#332b66', '#bccadd', u), shade: mixHex('#2b2459', '#aebfd6', u), mid: mixHex('#2f285f', '#b9c8dc', u),
      gully: `rgba(60, 70, 110, ${(0.1 * u).toFixed(3)})`, snow: mixHex('#a8a5cf', '#eaf0f7', u), snowShade: mixHex('#7f7bb0', '#d0dbea', u)
    }, 0.5);
    drawRange(MOUNTAINS.near, {
      lit: mixHex('#3a3170', '#a3b6d0', u), shade: mixHex('#271f52', '#8196ba', u), mid: mixHex('#30285e', '#9fb2cd', u),
      gully: `rgba(50, 60, 100, ${(0.08 + 0.2 * u).toFixed(3)})`, snow: mixHex('#c3c0e2', '#f8fafd', u), snowShade: mixHex('#8f8bbd', '#cbd7ea', u)
    }, 0.8);
    // Haze gathering at their feet
    const hazeTop = baseY - S * 0.14, haze = ctx.createLinearGradient(0, hazeTop, 0, baseY);
    const hzc = mixHex('#1f1b48', '#dde6f0', u).slice(4, -1);
    const hz = (a) => `rgba(${hzc}, ${a.toFixed(3)})`;
    haze.addColorStop(0, hz(0));
    haze.addColorStop(0.55, hz(0.12));
    haze.addColorStop(1, hz(0.4));
    ctx.fillStyle = haze;
    ctx.fillRect(w * 0.55, hazeTop, w * 0.5, baseY - hazeTop);
  };

  // A little pond below the cottage: sky in the water, reeds and lily pads,
  // a ripple now and then, a shimmer when the wind crosses it. Tap for rings.
  let pond = null;
  const rings = [];
  let ringWait = rnd(1, 3);
  const stepPond = (dt) => {
    ringWait -= dt;
    if (ringWait <= 0) {
      rings.push({ u: rnd(-0.6, 0.6), v: rnd(-0.4, 0.4), age: 0, life: rnd(2.2, 3) });
      ringWait = rnd(2, 5);
    }
    for (const r of rings) r.age += dt;
    while (rings.length && rings[0].age > rings[0].life) rings.shift();
  };
  const drawPond = (gy, s, u, n) => {
    const px = w * 0.24 + 66 * s, rx = 30 * s, ry = 7.5 * s;
    const py = gy(px) + 18 * s;
    const c = (hex) => mixHex('#1d1946', hex, 0.25 + 0.75 * u);
    const ell = (x, y, ex, ey) => { ctx.beginPath(); ctx.ellipse(x, y, ex, ey, 0, 0, 6.283); };

    // An irregular outline (a lopsided lobe, a little bay for the reeds),
    // lying level like real water whatever the slope around it
    const N = 14, pts = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * 6.283;
      const r = 1 + 0.16 * Math.sin(2 * a + 1) + 0.1 * Math.sin(3 * a + 2.4) + 0.06 * Math.sin(5 * a + 0.7);
      const x = px + Math.cos(a) * rx * r;
      pts.push([x, py + Math.sin(a) * ry * r]);
    }
    const shape = new Path2D();
    const mid = (i) => [(pts[i][0] + pts[(i + 1) % N][0]) / 2, (pts[i][1] + pts[(i + 1) % N][1]) / 2];
    shape.moveTo(...mid(N - 1));
    for (let i = 0; i < N; i++) shape.quadraticCurveTo(pts[i][0], pts[i][1], ...mid(i));
    shape.closePath();
    pond = { x: px, y: py, rx, ry, shape };

    // Grassy bank, then the water with the sky in it
    ctx.save();
    ctx.translate(0, 0.8 * s);
    ctx.strokeStyle = c('#8aad7e');
    ctx.lineWidth = 5 * s;
    ctx.lineJoin = 'round';
    ctx.stroke(shape);
    ctx.restore();
    const g = ctx.createLinearGradient(0, py - ry, 0, py + ry);
    g.addColorStop(0, mixHex('#2b2a68', '#6aa6d6', u));
    g.addColorStop(1, mixHex('#3d3c84', '#b4dbf2', u));
    ctx.fillStyle = g;
    ctx.fill(shape);
    ctx.save();
    ctx.clip(shape);
    // A glint of sun or moon on the surface
    const glint = ctx.createRadialGradient(px + rx * 0.35, py - ry * 0.1, 0, px + rx * 0.35, py - ry * 0.1, rx * 0.5);
    glint.addColorStop(0, `rgba(255, 250, 235, ${(0.45 + 0.1 * Math.sin(t * 1.3)).toFixed(3)})`);
    glint.addColorStop(1, 'rgba(255, 250, 235, 0)');
    ctx.fillStyle = glint;
    ctx.fillRect(px - rx, py - ry, rx * 2, ry * 2);
    // Ripple rings
    ctx.lineWidth = 0.8;
    for (const r of rings) {
      const f = r.age / r.life, a = 0.55 * (1 - f);
      ctx.strokeStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
      for (const k of [1, 0.6]) {
        const rr = (3 + f * 16) * s * k;
        ell(px + r.u * rx, py + r.v * ry, rr, rr * 0.3);
        ctx.stroke();
      }
    }
    // Wind shimmer
    const gst = gustAt(px);
    if (gst > 0.05) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.35 * Math.min(1, gst)).toFixed(3)})`;
      for (let k = 0; k < 5; k++) {
        const yy = py - ry * 0.6 + k * ry * 0.3, xx = px - rx + ((t * 30 * s + k * 17 * s) % (rx * 2));
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx + 6 * s, yy);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Lily pads, one in flower
    for (const [lx, ly, lr] of [[0.25, 0.25, 4.2], [0.45, -0.3, 3.4], [-0.05, 0.4, 3.6]]) {
      ctx.fillStyle = c('#4f8a52');
      ctx.beginPath();
      ctx.ellipse(px + lx * rx, py + ly * ry, lr * s, lr * 0.38 * s, 0, 0.35, 6.283 - 0.05);
      ctx.lineTo(px + lx * rx, py + ly * ry);
      ctx.fill();
    }
    ctx.fillStyle = c('#f2a7c3');
    ctx.beginPath();
    ctx.arc(px + 0.25 * rx + 0.5 * s, py + 0.25 * ry - 0.8 * s, 1.4 * s, 0, 6.283);
    ctx.fill();

    // Reeds and cattails at the far end, swaying in the breeze
    const sway = windAt(px - rx) * 0.5;
    ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const bx = px - rx * 0.92 + k * 2.6 * s, by = py + (k % 2 ? 1 : 0) * s;
      const hg = (11 + ((k * 5) % 7)) * s, lean = (sway + Math.sin(t * 1.7 + k) * 0.06) * hg;
      ctx.strokeStyle = c('#5f8f55');
      ctx.lineWidth = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + lean * 0.3, by - hg * 0.6, bx + lean, by - hg);
      ctx.stroke();
      if (k % 2 === 0) {
        ctx.fillStyle = c('#7a5236');
        ctx.beginPath();
        ctx.ellipse(bx + lean * 0.85, by - hg * 0.82, 0.9 * s, 2.4 * s, lean / hg, 0, 6.283);
        ctx.fill();
      }
    }
  };

  const draw = () => {
    const u = day, n = 1 - day;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    [0, 0.45, 0.72, 0.86].forEach((stop, i) => sky.addColorStop(stop, mixHex(D.sky[i], L.sky[i], u)));
    sky.addColorStop(1, mixHex(D.page, L.page, u));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stars fade out by day
    if (n > 0.01) {
      for (const st of stars) {
        const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.sp + st.tw))) * (1 - st.y / (h * 0.8)) * n;
        ctx.fillStyle = `rgba(255, 248, 235, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(st.x + par.x * 4, st.y + par.y * 3, st.r, 0, 6.283);
        ctx.fill();
      }
    }

    drawMeteors(n);

    // Moon by night, sun by day: same place, warmer and bigger halo
    const portrait = h > w;
    const mx = w * (portrait ? 0.74 : 0.78) + par.x * 8, my = h * (portrait ? 0.15 : 0.2) + par.y * 6;
    const mr = Math.max(20, Math.min(w, h) * 0.04) * (1 + u * 0.15);
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * (7 + u * 4));
    halo.addColorStop(0, mixRgba(D.halo, L.halo, u));
    halo.addColorStop(0.35, mixRgba(D.halo, L.halo, u, 0.25));
    halo.addColorStop(1, mixRgba(D.halo, L.halo, u, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    const disc = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    disc.addColorStop(0, mixHex(D.disc[0], L.disc[0], u));
    disc.addColorStop(1, mixHex(D.disc[1], L.disc[1], u));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, 6.283);
    ctx.fill();

    // Clouds drift by day
    if (u > 0.01) {
      clouds.forEach(c => {
        const cx = ((c.x + t * c.sp) % (w + 300)) - 150 + par.x * 10;
        drawCloud(cx, c.y + par.y * 5, c.s, 0.85 * u);
      });
    }

    // Horizon glow
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.78, 10, w * 0.5, h * 0.78, w * 0.7);
    glow.addColorStop(0, mixRgba(D.glow, L.glow, u));
    glow.addColorStop(1, mixRgba(D.glow, L.glow, u, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Birds glide across by day
    if (u > 0.01) {
      ctx.strokeStyle = `rgba(60, 64, 90, ${(0.55 * u).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      birds.forEach(b => {
        const bx = ((b.x + t * b.sp) % (w + 100)) - 50;
        const by = b.y + Math.sin(t * 0.6 + b.ph) * 10;
        const flap = Math.sin(t * 6 + b.ph) * 4 * b.s;
        ctx.beginPath();
        ctx.moveTo(bx - 8 * b.s, by - flap);
        ctx.quadraticCurveTo(bx - 3 * b.s, by - 3 * b.s, bx, by);
        ctx.quadraticCurveTo(bx + 3 * b.s, by - 3 * b.s, bx + 8 * b.s, by - flap);
        ctx.stroke();
      });
    }

    drawMountains(u, par.x * 3);

    // Hills, far to near, with gentle parallax
    const layers = [
      { base: h * 0.7, amp: h * 0.035, freq: 1.3, seed: 1.2, depth: 6 },
      { base: h * 0.78, amp: h * 0.04, freq: 0.9, seed: 3.4, depth: 14 },
      { base: h * 0.88, amp: h * 0.03, freq: 1.6, seed: 5.1, depth: 26 }
    ];
    layers.forEach((Ly, i) => {
      const color = mixHex(D.hills[i], L.hills[i], u);
      const off = par.x * Ly.depth;
      const base = Ly.base + par.y * Ly.depth * 0.3;
      hill(base, Ly.amp, Ly.freq, Ly.seed, off);
      ctx.fillStyle = color;
      ctx.fill();

      if (i === 1) {
        // A little cottage on the middle hill
        const cx = w * 0.24;
        const cy = hillY(cx, base, Ly.amp, Ly.freq, Ly.seed, off);
        const s = sc;
        cottage = { x: cx, y: cy + 4, s };
        chimney = { x: cx + 12 * s, y: cy + 4 - 50.5 * s };
        ground = x => hillY(x, base, Ly.amp, Ly.freq, Ly.seed, off);
        drawPond(ground, s, u, n);
        drawCottage(cx, cy + 4, s, u, n);
        drawSmoke(n);

        // A few pines on the same ridge, swaying in the breeze
        [0.38, 0.41, 0.62, 0.66, 0.69].forEach((tu, k) => {
          const tx = w * tu;
          const ty = hillY(tx, base, Ly.amp, Ly.freq, Ly.seed, off);
          const th = (30 + (k % 3) * 10) * s;
          pines[k] = { x: tx, y: ty + 2, th };
          drawPine(tx, ty + 2, th, windAt(tx) + rustle[k] * Math.sin(t * 15 + k), u, k + 1);
        });

        drawHen(ground, u);
        drawPeacock(ground, s, u);
      }
      if (i === 2) drawMeadow(x => hillY(x, base, Ly.amp, Ly.freq, Ly.seed, off), color, u, () => hill(base, Ly.amp, Ly.freq, Ly.seed, off));
    });

    // Fireflies by night
    if (n > 0.01) {
      for (const f of flies) {
        const a = Math.max(0, Math.sin(t * f.sp * 1.4 + f.ph)) * n;
        if (a < 0.02) continue;
        const fx = f.x + Math.sin(t * 0.3 * f.sp + f.ph) * 30 + par.x * 30;
        const fy = f.y + Math.cos(t * 0.25 * f.sp + f.ph * 2) * 18;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, f.r * 7);
        g.addColorStop(0, `rgba(255, 226, 140, ${(0.85 * a).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255, 226, 140, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(fx, fy, f.r * 7, 0, 6.283);
        ctx.fill();
      }
    }

    // Fade the bottom edge into the page colour
    const fade = ctx.createLinearGradient(0, h * 0.86, 0, h);
    const page = mixHex(D.page, L.page, u);
    fade.addColorStop(0, page.replace('rgb', 'rgba').replace(')', ', 0)'));
    fade.addColorStop(1, page);
    ctx.fillStyle = fade;
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
  };

  layout();
  pea.x = w * rnd(0.12, 0.88);
  if (reduceMotion) pea.raise = 1;
  window.addEventListener('resize', () => { layout(); pea.x = Math.max(w * 0.03, Math.min(w * 0.97, pea.x)); });
  window.addEventListener('pointermove', (e) => {
    par.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    par.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Tap the hill: the peacock dances (or stirs in his sleep), the peahen starts,
  // a pine rustles, the cottage lamp switches on or off
  const hitTest = (x, y) => {
    if (!ground) return null;
    if (Math.hypot(x - pea.x, y - (ground(pea.x) - pea.alt - 14 * sc)) < 24 * sc) return 'peacock';
    if (hen.on && Math.hypot(x - hen.x, y - (ground(hen.x) - hen.alt - 11 * sc)) < 16 * sc) return 'hen';
    // (the path is tested in device pixels, so scale the point to match)
    const dpr = canvas.width / w;
    if (pond && ctx.isPointInPath(pond.shape, x * dpr, y * dpr)) return 'pond';
    if (cottage && x > cottage.x - 33 * cottage.s && x < cottage.x + 30 * cottage.s && y > cottage.y - 52 * cottage.s && y < cottage.y + 4 * cottage.s) return 'cottage';
    const k = pines.findIndex(p => Math.abs(x - p.x) < p.th * 0.48 && y < p.y + 2 && y > p.y - p.th);
    return k >= 0 ? k : null;
  };
  const heroPoint = (e) => {
    const r = hero.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  hero.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const hit = hitTest(...heroPoint(e));
    if (hit === null) return;
    if (hit === 'peacock') {
      if (pea.mode === 'roost') { pea.rouse = 2.5; heroEvent('rustle'); }
      else if (pea.mode !== 'fly' && !isNight()) { startDance(); heroEvent('peacock'); }
    } else if (hit === 'hen') {
      hen.hop = 1;
      heroEvent('cluck');
    } else if (hit === 'pond') {
      const [x, y] = heroPoint(e);
      rings.push({ u: (x - pond.x) / pond.rx, v: (y - pond.y) / pond.ry, age: 0, life: 2.6 });
      heroEvent('plop');
    } else if (hit === 'cottage') {
      lamp.override = !lampOn();
      if (reduceMotion) lamp.k = lamp.override ? 1 : 0;
      heroEvent('lamp');
    } else {
      rustle[hit] = 1.6;
      if (pea.mode === 'roost' && pea.roost === hit) pea.rouse = 2.5;
      heroEvent('rustle');
    }
    if (reduceMotion) draw();
  });
  hero.addEventListener('pointermove', (e) => {
    const over = !e.target.closest('a, button') && hitTest(...heroPoint(e)) !== null;
    hero.style.cursor = over ? 'pointer' : '';
  });

  // Hero text drifts up and fades as you scroll into the worlds
  const onScroll = () => {
    const k = Math.min(1, window.scrollY / (h * 0.7));
    content.style.opacity = String(1 - k);
    content.style.transform = `translateY(${-k * 60}px)`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  if (reduceMotion) {
    draw();
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      day = Theme.current === 'light' ? 1 : 0;
      lamp.override = null;
      lamp.k = isNight() ? 1 : 0;
      draw();
    });
    return;
  }
  let heroVisible = true;
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero);
  let lastTheme = Theme.current;
  startLoop((dt) => {
    const target = Theme.current === 'light' ? 1 : 0;
    day += (target - day) * Math.min(1, dt * 2.2);
    if (Theme.current !== lastTheme) {
      // A new day or night: the lamp goes back to looking after itself,
      // and the first shooting star of the night comes soon
      lastTheme = Theme.current;
      lamp.override = null;
      meteorWait = Math.min(meteorWait, rnd(4, 9));
    }
    lamp.k += ((lampOn() ? 1 : 0) - lamp.k) * Math.min(1, dt * 6);
    if (!heroVisible) return;
    t += dt;
    par.x += (par.tx - par.x) * Math.min(1, dt * 2);
    par.y += (par.ty - par.y) * Math.min(1, dt * 2);
    stepWind(dt);
    stepPeacock(dt);
    stepHen(dt);
    stepSmoke(dt);
    stepPond(dt);
    stepMeteors(dt, 1 - day);
    draw();
  });
}

// ==========================================
// HERO BUTTERFLY
// ==========================================

const BUTTERFLY_PALETTES = {
  dark: { inner: '#d6f1ff', mid: '#5ea9ff', edge: '#2b2f86', rim: '#14123a', glow: 'rgba(130, 190, 255, 0.55)' },
  light: { inner: '#ffd88a', mid: '#f39a2c', edge: '#c0501a', rim: '#2b1a14', glow: 'rgba(255, 170, 70, 0)' }
};

/**
 * A butterfly that wanders between the letters of the wordmark, settling on
 * top of one for a while before flitting off to another. Letters are
 * measured from the real text (no extra markup), so it lands on the ink
 * itself: the bar of the T, the dot of the i. Comes close and it takes off.
 */
function startButterfly() {
  const canvas = document.getElementById('hero-butterfly');
  const hero = document.querySelector('.hero');
  const content = document.querySelector('.hero-content');
  const word = document.querySelector('.wordmark');
  const text = word && [...word.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
  if (!canvas || !text) return;
  const ctx = canvas.getContext('2d');
  const measure = document.createElement('canvas').getContext('2d');
  const range = document.createRange();
  const rand = (a, b) => a + Math.random() * (b - a);
  let w = 0, h = 0, letters = [], size = 30;
  let day = Theme.current === 'light' ? 1 : 0;
  const pointer = { x: -1e4, y: -1e4 };

  // Each letter's ink, relative to where the browser puts its glyph box
  const layout = () => {
    ({ width: w, height: h } = fitCanvas(canvas, ctx, hero.clientWidth, hero.clientHeight));
    const cs = getComputedStyle(word);
    const fs = parseFloat(cs.fontSize);
    measure.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    const ascent = measure.measureText('Hg').fontBoundingBoxAscent ?? fs * 0.8;
    letters = [];
    for (let i = 0; i < text.data.length; i++) {
      const ch = text.data[i];
      if (!ch.trim()) continue;
      const m = measure.measureText(ch);
      letters.push({ i, drop: ascent - m.actualBoundingBoxAscent, mid: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 });
    }
    size = Math.max(16, fs * 0.21);
  };

  // Top of a letter's ink, in hero coordinates (follows the scroll drift)
  const spot = (L) => {
    range.setStart(text, L.i);
    range.setEnd(text, L.i + 1);
    const r = range.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    return { x: r.left - hr.left + L.mid, y: r.top - hr.top + L.drop };
  };
  const where = (target) => (target.letter ? spot(target.letter) : target);

  const b = { drift: 0, blown: false, x: 0, y: 0, angle: 0.5, flap: 0, rest: 0, perch: null, target: null, path: null, t: 0, dur: 1, tilt: 0, open: 1 };

  const flyTo = (target) => {
    const end = where(target);
    const dx = end.x - b.x, dist = Math.hypot(dx, end.y - b.y);
    const top = Math.min(b.y, end.y) - (30 + Math.random() * 70 + dist * 0.22);
    b.path = {
      x0: b.x, y0: b.y,
      x1: b.x + dx * 0.25 + rand(-70, 70), y1: top,
      x2: b.x + dx * 0.75 + rand(-70, 70), y2: top + rand(0, 50)
    };
    b.perch = null;
    b.target = target;
    b.t = 0;
    b.dur = 1.1 + dist / 200;
  };

  // Usually another letter; now and then a little wander out into the sky first
  const next = () => {
    if (b.target && b.target.letter && Math.random() < 0.22) {
      flyTo({ x: rand(w * 0.12, w * 0.88), y: rand(h * 0.06, h * 0.3) });
      return;
    }
    const others = letters.filter(L => L !== b.perch);
    flyTo({ letter: others[Math.floor(Math.random() * others.length)] });
  };

  const land = (letter) => {
    b.perch = letter;
    b.rest = rand(2.5, 6.5);
    b.tilt = rand(-0.28, 0.28);
  };

  const drawWing = (pal, s, fore) => {
    ctx.beginPath();
    if (fore) {
      ctx.moveTo(0.04 * s, -0.1 * s);
      ctx.bezierCurveTo(0.25 * s, -0.55 * s, 0.6 * s, -0.86 * s, 0.98 * s, -0.8 * s);
      ctx.bezierCurveTo(1.08 * s, -0.55 * s, 0.95 * s, -0.25 * s, 0.78 * s, -0.08 * s);
      ctx.bezierCurveTo(0.55 * s, 0, 0.25 * s, 0.02 * s, 0.04 * s, 0.02 * s);
    } else {
      ctx.moveTo(0.04 * s, 0);
      ctx.bezierCurveTo(0.4 * s, -0.08 * s, 0.82 * s, 0, 0.84 * s, 0.3 * s);
      ctx.bezierCurveTo(0.86 * s, 0.58 * s, 0.5 * s, 0.78 * s, 0.25 * s, 0.62 * s);
      ctx.bezierCurveTo(0.1 * s, 0.5 * s, 0.04 * s, 0.3 * s, 0.04 * s, 0.12 * s);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0.05 * s, 0, 0, 0.05 * s, 0, 1.05 * s);
    g.addColorStop(0, pal.inner);
    g.addColorStop(0.45, pal.mid);
    g.addColorStop(1, pal.edge);
    ctx.fillStyle = g;
    ctx.fill();
    // A dark border band just inside the edge
    ctx.save();
    ctx.clip();
    ctx.shadowBlur = 0;
    ctx.lineWidth = s * 0.13;
    ctx.strokeStyle = pal.rim;
    ctx.stroke();
    ctx.restore();
  };

  const drawButterfly = (alpha) => {
    const s = size, pal = {};
    for (const k of ['inner', 'mid', 'edge', 'rim']) pal[k] = mixHex(BUTTERFLY_PALETTES.dark[k], BUTTERFLY_PALETTES.light[k], day);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x, b.y - s * 0.6);
    ctx.rotate(b.angle);

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side * (0.1 + 0.9 * b.open), 1);
      if (day < 0.5) {
        ctx.shadowColor = BUTTERFLY_PALETTES.dark.glow;
        ctx.shadowBlur = s * 0.6 * (1 - day * 2);
      }
      drawWing(pal, s, false);
      drawWing(pal, s, true);
      ctx.shadowBlur = 0;
      // Fine veins, and pale spots along the wing tip
      ctx.strokeStyle = 'rgba(20, 15, 40, 0.18)';
      ctx.lineWidth = Math.max(0.6, s * 0.018);
      ctx.beginPath();
      for (const [x, y] of [[0.95, -0.72], [0.92, -0.42], [0.72, -0.12], [0.78, 0.3], [0.5, 0.58]]) {
        ctx.moveTo(0.06 * s, 0);
        ctx.quadraticCurveTo(x * s * 0.5, y * s * 0.4, x * s * 0.9, y * s * 0.9);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (const [x, y, r] of [[0.96, -0.74, 0.03], [1.0, -0.6, 0.026], [0.98, -0.45, 0.024], [0.84, -0.8, 0.026], [0.8, 0.36, 0.026], [0.72, 0.56, 0.026], [0.5, 0.66, 0.024]]) {
        ctx.beginPath();
        ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Body, head and antennae
    ctx.fillStyle = '#231a2c';
    ctx.beginPath();
    ctx.ellipse(0, 0.06 * s, 0.05 * s, 0.36 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -0.32 * s, 0.07 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#231a2c';
    ctx.lineWidth = Math.max(0.8, s * 0.025);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 0.02 * s, -0.37 * s);
      ctx.quadraticCurveTo(side * 0.06 * s, -0.6 * s, side * 0.2 * s, -0.7 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(side * 0.2 * s, -0.7 * s, 0.03 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const render = () => {
    ctx.clearRect(0, 0, w, h);
    const alpha = parseFloat(content.style.opacity || '1');
    if (alpha > 0.01) drawButterfly(alpha);
  };

  const step = (dt) => {
    if (b.perch) {
      ({ x: b.x, y: b.y } = spot(b.perch));
      b.rest -= dt;
      // Wings fold and open slowly while it rests
      b.flap += dt * 1.6;
      b.open = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(b.flap));
      b.angle += (b.tilt - b.angle) * Math.min(1, dt * 4);
      const near = Math.hypot(pointer.x - b.x, pointer.y - b.y) < size * 1.6;
      // A strong gust holds its wings open, and sometimes lifts it off
      const g = HeroEvents.gustAt ? HeroEvents.gustAt(b.x) : 0;
      if (g > 0.3) b.open = Math.max(b.open, 0.75 + 0.25 * Math.sin(performance.now() / 33));
      if (g > 0.6 && !b.blown) {
        b.blown = true;
        if (Math.random() < 0.5) { next(); return; }
      }
      if (g < 0.1) b.blown = false;
      if (b.rest <= 0 || near) next();
      return;
    }
    b.t = Math.min(1, b.t + dt / b.dur);
    const e = 0.5 - 0.5 * Math.cos(Math.PI * b.t);
    const u = 1 - e, end = where(b.target), p = b.path;
    // Gusts push it off course; it fights back to land where it meant to
    b.drift += (HeroEvents.gustAt ? HeroEvents.gustAt(b.x) : 0) * size * 2.2 * dt;
    b.drift *= Math.exp(-dt * 0.8);
    const x = u * u * u * p.x0 + 3 * u * u * e * p.x1 + 3 * u * e * e * p.x2 + e * e * e * end.x + b.drift * (1 - e * e);
    let y = u * u * u * p.y0 + 3 * u * u * e * p.y1 + 3 * u * e * e * p.y2 + e * e * e * end.y;
    // A little lift with every wingbeat, settling out as it lands
    b.flap += dt * Math.PI * 2 * 7;
    y -= Math.sin(b.flap) * size * 0.12 * Math.sin(Math.PI * b.t);
    b.open = 0.5 + 0.5 * Math.cos(b.flap);
    // Head roughly into the flight, turning upright to land
    const vx = x - b.x, vy = y - b.y;
    const heading = Math.atan2(vx, -vy);
    const want = b.t > 0.85 ? b.tilt : Math.max(-1.2, Math.min(1.2, heading));
    let d = want - b.angle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    b.angle += d * Math.min(1, dt * 5);
    b.x = x;
    b.y = y;
    if (b.t >= 1) {
      b.drift = 0;
      if (b.target.letter) land(b.target.letter);
      else next();
    }
  };

  window.addEventListener('pointermove', (e) => {
    const hr = hero.getBoundingClientRect();
    pointer.x = e.clientX - hr.left;
    pointer.y = e.clientY - hr.top;
  });

  const begin = () => {
    layout();
    window.addEventListener('resize', layout);
    if (!letters.length) return;
    if (reduceMotion) {
      // Still: one butterfly resting, wings open
      land(letters[Math.floor(Math.random() * letters.length)]);
      const still = () => { day = Theme.current === 'light' ? 1 : 0; ({ x: b.x, y: b.y } = spot(b.perch)); b.angle = b.tilt; render(); };
      still();
      window.addEventListener('resize', still);
      window.addEventListener('scroll', still, { passive: true });
      document.getElementById('theme-toggle')?.addEventListener('click', still);
      return;
    }
    // Drift in from one side once the title has risen into place
    const left = Math.random() < 0.5;
    b.x = left ? -size * 2 : w + size * 2;
    b.y = h * rand(0.15, 0.35);
    b.angle = left ? 1 : -1;
    let wait = 1.6, heroVisible = true;
    new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero);
    startLoop((dt) => {
      day += ((Theme.current === 'light' ? 1 : 0) - day) * Math.min(1, dt * 2.2);
      if (!heroVisible) return;
      if (wait > 0) {
        wait -= dt;
        if (wait <= 0) next();
        return;
      }
      step(dt);
      render();
    });
  };
  // Measure with the real font, not a fallback
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(begin);
}

// ==========================================
// PREVIEWS
// ==========================================

/** Miniature reef using the aquarium's own fish, plants and bubbles. */
function aquariumPreview(canvas) {
  const ctx = canvas.getContext('2d');
  const k = 0.72; // world-to-window scale
  let w, h, W, H, bounds, fishes = [], plants = [], bubbles = [], jellies = [], turtle = null, school = null, time = 0;

  const layout = () => {
    ({ width: w, height: h } = fitCanvas(canvas, ctx));
    W = w / k; H = h / k;
    bounds = { left: 10, right: W - 10, top: 30, bottom: H - 50 };
    fishes = [
      new Fish('clownfish', W * 0.25, H * 0.45, bounds),
      new Fish('clownfish', W * 0.3, H * 0.52, bounds),
      new Fish('bluetang', W * 0.6, H * 0.35, bounds),
      new Fish('yellowtang', W * 0.45, H * 0.6, bounds),
      new Fish('angelfish', W * 0.75, H * 0.4, bounds),
      new Fish('clownfish', W * 0.35, H * 0.48, bounds),
      new Fish('bluetang', W * 0.55, H * 0.42, bounds)
    ];
    jellies = [new Jellyfish(W * 0.14, H * 0.3, bounds)];
    turtle = new SeaTurtle(W * 0.6, H * 0.2, bounds);
    school = new NeonSchool(10, bounds);
    plants = [0.05, 0.16, 0.3, 0.5, 0.64, 0.8, 0.94].map((u, i) =>
      new Plant(W * u, H - 30, 80 + (i % 3) * 35, 7, i % 3 === 1 ? 'coral' : 'green'));
  };

  const frame = (pointer) => {
    time++;
    if (time % 14 === 0) bubbles.push(new Bubble(W * 0.82 + (Math.random() - 0.5) * 10, H - 40, 2 + Math.random() * 4, 1 + Math.random()));
    bubbles = bubbles.filter(b => b.update(20, time));
    fishes.forEach(f => f.update([], time, () => {}));
    jellies.forEach(j => j.update(time));
    turtle.update(time);
    school.update(time);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#38bdf8');
    g.addColorStop(0.45, '#0284c7');
    g.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const bx = (w / 4) * (i + 0.5) + Math.sin(time * 0.01 + i) * 20;
      const beam = ctx.createLinearGradient(bx, 0, bx + 40, h);
      beam.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
      beam.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(bx - 18, 0);
      ctx.lineTo(bx + 18, 0);
      ctx.lineTo(bx + 70, h);
      ctx.lineTo(bx + 20, h);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.scale(k, k);
    const sand = ctx.createLinearGradient(0, H - 50, 0, H);
    sand.addColorStop(0, '#e9c46a');
    sand.addColorStop(1, '#b07d4a');
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 34);
    ctx.bezierCurveTo(W * 0.3, H - 50, W * 0.6, H - 22, W, H - 40);
    ctx.lineTo(W, H);
    ctx.fill();
    ctx.fillStyle = '#7f8c8d';
    [[0.2, 20, 12], [0.24, 13, 9], [0.72, 26, 14]].forEach(([u, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(W * u, H - 26, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    plants.forEach(p => p.draw(ctx, time, false));
    turtle.draw(ctx, false);
    school.draw(ctx, false);
    jellies.forEach(j => j.draw(ctx, false));
    fishes.forEach(f => f.draw(ctx, false));
    bubbles.forEach(b => b.draw(ctx, false));
    ctx.restore();
  };

  return { layout, frame };
}

/** The real Ragdoll, sitting in a corner of its room, watching your cursor. */
function catPreview(canvas) {
  const ctx = canvas.getContext('2d');
  const room = new Room();
  const cat = new Cat();
  let w, h, dpr, s, floorY, t = 0, nextGlance = 1, glance = null, theme = 'afternoon';
  const hour = new Date().getHours();
  theme = hour >= 5 && hour < 11 ? 'morning' : hour < 17 && hour >= 11 ? 'afternoon' : hour >= 17 && hour < 20 ? 'evening' : 'night';

  const layout = () => {
    ({ width: w, height: h, dpr } = fitCanvas(canvas, ctx));
    s = Math.max(0.45, Math.min(1.2, h / 330));
    floorY = h - 26 * s;
    // Lay the room out as if the card were a wider window onto it
    room.layout(w, h, floorY, s * 0.8);
    // Hand-composed for the small card: window behind the cat, bed to the right
    room.win = { x: w * 0.3, y: h * 0.1, w: w * 0.36, h: h * 0.4 };
    room.painting = { x: w * 0.76, y: h * 0.14, w: w * 0.13, h: w * 0.095 };
    room.plant.x = w * 0.09;
    room.lamp.x = w * 1.02;
    room.bed.x = w * 0.84;
    room.rug.x = w * 0.45;
    room.rug.rx = w * 0.42;
    cat.s = s;
    cat.floorY = floorY;
    cat.x = w * 0.46;
  };

  const frame = (pointer, dt) => {
    t += dt;
    if (pointer) {
      cat.lookTarget = pointer;
    } else {
      nextGlance -= dt;
      if (nextGlance <= 0) {
        nextGlance = 2 + Math.random() * 3;
        glance = [null, null, { x: w * 0.1, y: h * 0.2 }, { x: w * 0.9, y: floorY }][Math.floor(Math.random() * 4)];
        if (Math.random() < 0.3) cat.slowBlink();
      }
      cat.lookTarget = glance;
    }
    cat.update(dt);
    ctx.clearRect(0, 0, w, h);
    room.drawBack(ctx, theme, t);
    cat.draw(ctx, dpr);
    room.drawFront(ctx);
    room.drawLighting(ctx, theme, t);
  };

  return { layout, frame };
}

/** The real rainy window; moving the pointer over it wipes the fog. */
function rainPreview(canvas) {
  const world = new RainWorld(canvas, { preview: true });
  world.setMood(new Date().getHours() >= 7 && new Date().getHours() < 17 ? 'dusk' : 'night');
  let last = null;

  const layout = () => {
    const { width, height, dpr } = fitCanvas(canvas, world.ctx);
    world.resize(width, height, dpr);
  };

  const frame = (pointer, dt) => {
    if (pointer) {
      if (last) world.wipe(last.x, last.y, pointer.x, pointer.y, 22);
      last = { ...pointer };
    } else {
      last = null;
    }
    world.update(dt);
    world.draw();
  };

  return { layout, frame };
}

/** The real garden; seed is topped up so there are always visitors. Fast moves startle them. */
function feederPreview(canvas) {
  const garden = new FeederWorld(canvas, { preview: true });
  let last = null, topUp = 0;

  const layout = () => {
    const { width, height, dpr } = fitCanvas(canvas, garden.ctx);
    garden.resize(width, height, dpr);
    garden.scatter(width * 0.3, garden.groundY - 30, 24);
  };

  const frame = (pointer, dt) => {
    if (pointer && last) {
      const v = Math.hypot(pointer.x - last.x, pointer.y - last.y) / Math.max(dt, 0.008);
      if (v > 1600) garden.startle(pointer.x, pointer.y, 110, 0.7);
    }
    last = pointer ? { ...pointer } : null;
    topUp -= dt;
    if (topUp <= 0) {
      topUp = 6;
      if (garden.seeds.length < 12) garden.scatter(garden.w * (0.15 + Math.random() * 0.35), garden.groundY - 30, 18);
      if (garden.feederSeed < 0.3) garden.refill();
    }
    garden.update(dt);
    garden.draw();
  };

  return { layout, frame };
}

/** The real meadow at dusk; resting the pointer on it draws the fireflies in. */
function meadowPreview(canvas) {
  const meadow = new MeadowWorld(canvas, { preview: true });
  meadow.setMood('dusk');
  let still = 0, last = null;

  const layout = () => {
    const { width, height, dpr } = fitCanvas(canvas, meadow.ctx);
    meadow.resize(width, height, dpr);
  };

  const frame = (pointer, dt) => {
    if (pointer) {
      const moved = last ? Math.hypot(pointer.x - last.x, pointer.y - last.y) : 99;
      still = moved < 3 ? Math.min(1, still + dt * 0.8) : Math.max(0.3, still - dt);
      meadow.setAttractor(pointer.x, pointer.y, still);
    } else {
      still = 0;
      meadow.setAttractor(0, 0, 0);
    }
    last = pointer ? { ...pointer } : null;
    meadow.update(dt);
    meadow.draw();
  };

  return { layout, frame };
}

/** The real train window; it just keeps rolling. */
function trainPreview(canvas) {
  const train = new TrainWorld(canvas, { preview: true });
  train.reflection = true;

  const layout = () => {
    const { width, height, dpr } = fitCanvas(canvas, train.ctx);
    train.resize(width, height, dpr);
  };

  const frame = (pointer, dt) => {
    train.update(dt);
    train.draw();
  };

  return { layout, frame };
}

/** The real greenhouse potting bench; moving the pointer over a plant gently waters it and sways the leaves. */
function greenhousePreview(canvas) {
  // Shows your own greenhouse (read-only); hover the can over a pot to pour
  const gh = new GreenhouseWorld(canvas, { preview: true });

  const layout = () => {
    const { width, height, dpr } = fitCanvas(canvas, gh.ctx);
    gh.resize(width, height, dpr);
  };

  const frame = (pointer, dt) => {
    if (pointer) {
      gh.setPointer(pointer.x, pointer.y, true);
      gh.setPouring(!!gh.plantBelow(pointer.x, pointer.y));
    } else {
      gh.setPointer(-999, -999, false);
      gh.setPouring(false);
    }
    gh.update(dt);
    gh.draw();
  };

  return { layout, frame };
}

/** The real desk; hovering lifts whatever object is under the pointer. */
function deskPreview(canvas) {
  const desk = new DeskWorld(canvas, { preview: true });

  const layout = () => {
    const { width, height, dpr } = fitCanvas(canvas, desk.ctx);
    desk.resize(width, height, dpr);
  };

  const frame = (pointer, dt) => {
    desk.setHover(pointer ? desk.itemAt(pointer.x, pointer.y) : null);
    desk.update(dt);
    desk.draw();
  };

  return { layout, frame };
}

/** The real snow globe; moving the pointer over it sloshes the water. */
function snowglobePreview(canvas) {
  const globe = new SnowGlobeWorld(canvas, { preview: true });

  const layout = () => {
    const { width, height, dpr } = fitCanvas(canvas, globe.ctx);
    globe.resize(width, height, dpr);
  };

  const frame = (pointer, dt) => {
    globe.stir(pointer ? pointer.x : null, pointer ? pointer.y : null);
    globe.update(dt);
    globe.draw();
  };

  return { layout, frame };
}

/** The real beach; moving the pointer over the sand draws a light trail. */
function shorelinePreview(canvas) {
  const beach = new ShorelineWorld(canvas, { preview: true });

  const layout = () => {
    const { width, height, dpr } = fitCanvas(canvas, beach.ctx);
    beach.resize(width, height, dpr);
  };

  const frame = (pointer, dt) => {
    beach.trace(pointer ? pointer.x : null, pointer ? pointer.y : null);
    beach.update(dt);
    beach.draw();
  };

  return { layout, frame };
}

const PREVIEWS = {
  aquarium: aquariumPreview,
  cat: catPreview,
  rain: rainPreview,
  feeder: feederPreview,
  meadow: meadowPreview,
  train: trainPreview,
  greenhouse: greenhousePreview,
  desk: deskPreview,
  snowglobe: snowglobePreview,
  shoreline: shorelinePreview
};

// ==========================================
// WORLD SECTIONS
// ==========================================
/**
 * The shelf under the hero: one small window per world. Each shows a still
 * snapshot; on hover (with a mouse) the real preview starts up over it.
 */
function buildShelf() {
  const list = document.getElementById('shelf-list');
  if (!list) return;
  if (!list.children.length) list.innerHTML = TINY_WORLDS.map(twShelfItem).join('');

  const live = [];
  const canHover = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  list.querySelectorAll('.shelf-item').forEach((item) => {
    const img = item.querySelector('img');
    // Retry a failed snapshot once; if it still fails, the accent gradient shows instead
    img?.addEventListener('error', () => {
      if (img.dataset.retried) { img.remove(); return; }
      img.dataset.retried = '1';
      setTimeout(() => { img.src = `${img.src.split('?')[0]}?retry=1`; }, 800);
    });
    if (!canHover || reduceMotion) return;
    const world = TINY_WORLDS.find(w => w.slug === item.dataset.slug);
    const make = world && PREVIEWS[world.preview];
    if (!make) return;
    const entry = { canvas: item.querySelector('canvas'), preview: null, active: false };
    item.addEventListener('pointerenter', () => {
      try {
        if (!entry.preview) {
          entry.preview = make(entry.canvas);
          entry.preview.layout();
          live.push(entry);
        }
        entry.active = true;
        item.classList.add('live');
      } catch (e) {
        console.warn(`Shelf preview for "${world.slug}" unavailable:`, e);
      }
    });
    item.addEventListener('pointerleave', () => {
      entry.active = false;
      item.classList.remove('live');
    });
  });

  window.addEventListener('resize', () => live.forEach(en => { try { en.preview.layout(); } catch (_) {} }));
  startLoop((dt) => live.forEach(en => {
    if (!en.active) return;
    try { en.preview.frame(null, dt); } catch (_) { en.active = false; }
  }));
}

function buildWorlds() {
  const list = document.getElementById('world-list');
  const previews = [];
  // The build writes these sections into the page; build them here only if it didn't
  if (!list.children.length) list.innerHTML = TINY_WORLDS.map(twWorldSection).join('');

  list.querySelectorAll('.world').forEach((el) => {
    const world = TINY_WORLDS.find(w => w.slug === el.dataset.slug);
    if (!world) return;

    const win = el.querySelector('.world-window');
    const canvas = el.querySelector('canvas');
    const entry = { canvas, pointer: null, visible: false, preview: null };

    // Gentle 3D tilt and a sheen that follows the pointer
    win.addEventListener('pointermove', (e) => {
      const r = win.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      if (!reduceMotion) {
        win.style.setProperty('--ry', `${(u - 0.5) * 7}deg`);
        win.style.setProperty('--rx', `${(0.5 - v) * 6}deg`);
      }
      win.style.setProperty('--mx', `${u * 100}%`);
      win.style.setProperty('--my', `${v * 100}%`);
      entry.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    win.addEventListener('pointerleave', () => {
      win.style.setProperty('--rx', '0deg');
      win.style.setProperty('--ry', '0deg');
      entry.pointer = null;
    });

    const make = PREVIEWS[world.preview];
    if (make) {
      // One broken world must never blank the whole page
      try {
        entry.preview = make(canvas);
        entry.name = world.slug;
        previews.push(entry);
      } catch (e) {
        console.warn(`Preview for "${world.slug}" unavailable:`, e);
      }
    }
  });
  return previews;
}

function runPreviews(previews) {
  // Run a preview step; if it throws, retire that preview and keep the rest alive
  const safely = (p, fn) => {
    if (p.broken) return;
    try { fn(); } catch (e) { p.broken = true; console.warn(`Preview for "${p.name}" stopped:`, e); }
  };
  const layoutAll = () => previews.forEach(p => safely(p, () => p.preview.layout()));
  layoutAll();
  window.addEventListener('resize', layoutAll);

  const io = new IntersectionObserver(entries => entries.forEach(en => {
    const p = previews.find(x => x.canvas === en.target);
    if (p) p.visible = en.isIntersecting;
  }), { rootMargin: '120px' });
  previews.forEach(p => io.observe(p.canvas));

  // Always paint one frame so a window is never empty
  previews.forEach(p => safely(p, () => p.preview.frame(null, 0.016)));
  if (reduceMotion) return;
  startLoop((dt) => {
    previews.forEach(p => { if (p.visible) safely(p, () => p.preview.frame(p.pointer, dt)); });
  });
}

function setupReveal() {
  const items = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.classList.add('visible');
      io.unobserve(en.target);
    }
  }), { threshold: 0.18 });
  items.forEach(el => io.observe(el));
}

window.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  setupHomeSound();
  buildShelf();
  startHero();
  startButterfly();
  runPreviews(buildWorlds());
  setupReveal();
});
