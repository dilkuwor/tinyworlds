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
    this.lastTick = performance.now();
    this.timer = setInterval(() => this.tick(), 120);
  }

  /** Called a few times a second: drift the wind and decide what rings. */
  tick() {
    const now = performance.now();
    const dt = Math.min(0.5, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (!this.audible) return;

    // The wind wanders between calm and a gentle gust
    this.gust += (Math.random() - 0.5) * dt * 0.6 + (0.35 - this.gust) * dt * 0.08;
    this.gust = Math.max(0.05, Math.min(1, this.gust));
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
  let w = 0, h = 0, stars = [], flies = [], clouds = [], birds = [], t = 0;
  let day = Theme.current === 'light' ? 1 : 0; // 0 night … 1 day, eased
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  const D = HERO_PALETTES.dark, L = HERO_PALETTES.light;

  const layout = () => {
    ({ width: w, height: h } = fitCanvas(canvas, ctx, hero.clientWidth, hero.clientHeight));
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
        // A tiny cottage with a warm window on the middle hill
        const cx = w * 0.24;
        const cy = hillY(cx, base, Ly.amp, Ly.freq, Ly.seed, off);
        const s = Math.max(0.7, Math.min(1.4, w / 1200));
        ctx.save();
        ctx.translate(cx, cy + 4);
        ctx.scale(s, s);
        ctx.fillStyle = mixHex('#1d1946', '#f4ece0', u);
        ctx.fillRect(-18, -22, 36, 24);
        ctx.fillStyle = mixHex('#1d1946', '#c4704f', u);
        ctx.beginPath();
        ctx.moveTo(-23, -21);
        ctx.lineTo(0, -40);
        ctx.lineTo(23, -21);
        ctx.fill();
        ctx.fillRect(8, -40, 6, 12);
        const flicker = 0.85 + Math.sin(t * 3.1) * 0.05 + Math.sin(t * 7.3) * 0.04;
        if (n > 0.01) {
          const win = ctx.createRadialGradient(-6, -12, 1, -6, -12, 34);
          win.addColorStop(0, `rgba(255, 200, 120, ${(0.45 * flicker * n).toFixed(3)})`);
          win.addColorStop(1, 'rgba(255, 200, 120, 0)');
          ctx.fillStyle = win;
          ctx.fillRect(-40, -46, 80, 70);
        }
        ctx.fillStyle = mixHex('#ffd696', '#7aa6c9', u);
        ctx.fillRect(-10, -16, 8, 7);
        ctx.fillStyle = mixHex('#1d1946', '#8a5a3c', u);
        ctx.fillRect(4, -12, 7, 14);
        ctx.restore();

        // A few trees on the same ridge
        const treeColor = mixHex('#1d1946', '#5f8f62', u);
        [0.38, 0.41, 0.62, 0.66, 0.69].forEach((tu, k) => {
          const tx = w * tu;
          const ty = hillY(tx, base, Ly.amp, Ly.freq, Ly.seed, off);
          const th = (26 + (k % 3) * 9) * s;
          ctx.fillStyle = treeColor;
          ctx.beginPath();
          ctx.moveTo(tx - th * 0.32, ty + 2);
          ctx.lineTo(tx, ty - th);
          ctx.lineTo(tx + th * 0.32, ty + 2);
          ctx.fill();
        });
      }
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
  window.addEventListener('resize', layout);
  window.addEventListener('pointermove', (e) => {
    par.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    par.ty = (e.clientY / window.innerHeight - 0.5) * 2;
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
      draw();
    });
    return;
  }
  let heroVisible = true;
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero);
  startLoop((dt) => {
    const target = Theme.current === 'light' ? 1 : 0;
    day += (target - day) * Math.min(1, dt * 2.2);
    if (!heroVisible) return;
    t += dt;
    par.x += (par.tx - par.x) * Math.min(1, dt * 2);
    par.y += (par.ty - par.y) * Math.min(1, dt * 2);
    draw();
  });
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

const PREVIEWS = {
  aquarium: aquariumPreview,
  cat: catPreview,
  rain: rainPreview,
  feeder: feederPreview,
  meadow: meadowPreview,
  train: trainPreview,
  greenhouse: greenhousePreview,
  desk: deskPreview,
  snowglobe: snowglobePreview
};

// ==========================================
// WORLD SECTIONS
// ==========================================
/** A compact row of pills under the hero: one tap straight into any world. */
function buildWorldNav() {
  const nav = document.getElementById('world-nav');
  if (!nav) return;
  TINY_WORLDS.forEach((world) => {
    const a = document.createElement('a');
    a.className = 'world-pill';
    a.href = `/${world.slug}/`;
    a.style.setProperty('--accent', world.accent);
    a.innerHTML = `<span class="pill-icon" aria-hidden="true">${world.icon}</span><span class="pill-label">${world.title}</span>`;
    nav.appendChild(a);
  });
}

function buildWorlds() {
  const list = document.getElementById('world-list');
  const previews = [];

  TINY_WORLDS.forEach((world, i) => {
    const el = document.createElement('article');
    el.className = 'world reveal';
    el.style.setProperty('--accent', world.accent);
    const href = `/${world.slug}/`;
    el.innerHTML = `
      <div class="world-window-wrap">
        <a class="world-window" href="${href}" aria-label="Open ${world.title}">
          <canvas aria-hidden="true"></canvas>
        </a>
      </div>
      <div class="world-copy">
        <span class="world-index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="world-name">${world.title}</h3>
        <p class="world-lede">${world.lede}</p>
        <ul class="world-chips">${world.actions.map(a => `<li>${a}</li>`).join('')}</ul>
        <a class="world-cta" href="${href}">${world.cta} <span class="arrow" aria-hidden="true">→</span></a>
      </div>`;
    list.appendChild(el);

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
  buildWorldNav();
  startHero();
  runPreviews(buildWorlds());
  setupReveal();
});
