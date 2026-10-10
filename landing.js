/**
 * landing.js - Tiny Worlds homepage
 * A living night landscape in the hero, one section per world with a live
 * preview that reuses the world's real creatures, a gentle 3D tilt on the
 * preview windows, and reveal-on-scroll.
 */

const reduceMotion = prefersReducedMotion();

// ==========================================
// HERO: NIGHT LANDSCAPE
// ==========================================
function startHero() {
  const canvas = document.getElementById('hero-sky');
  const hero = document.querySelector('.hero');
  const content = document.querySelector('.hero-content');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, stars = [], flies = [], t = 0;
  const par = { x: 0, y: 0, tx: 0, ty: 0 };

  const layout = () => {
    ({ width: w, height: h, dpr } = fitCanvas(canvas, ctx, hero.clientWidth, hero.clientHeight));
    const count = Math.round(Math.min(260, (w * h) / 5200));
    stars = Array.from({ length: count }, () => {
      const v = Math.pow(Math.random(), 1.6); // denser near the top
      return { x: Math.random() * w, y: v * h * 0.72, r: Math.random() < 0.08 ? 1.6 : 0.5 + Math.random() * 0.9, tw: Math.random() * 10, sp: 0.6 + Math.random() * 1.8 };
    });
    flies = Array.from({ length: Math.round(Math.min(34, w / 40)) }, () => ({
      x: Math.random() * w, y: h * (0.62 + Math.random() * 0.36), ph: Math.random() * 10, sp: 0.3 + Math.random() * 0.6, r: 1 + Math.random() * 1.6
    }));
  };

  // Rolling hill silhouette: a sum of slow sines
  const hill = (base, amp, freq, seed, offset) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 10; x += 8) {
      const u = (x + offset) / w;
      const y = base + Math.sin(u * freq * 6.283 + seed) * amp + Math.sin(u * freq * 2.7 * 6.283 + seed * 2) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
  };
  const hillY = (x, base, amp, freq, seed, offset) => {
    const u = (x + offset) / w;
    return base + Math.sin(u * freq * 6.283 + seed) * amp + Math.sin(u * freq * 2.7 * 6.283 + seed * 2) * amp * 0.35;
  };

  const draw = () => {
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#070823');
    sky.addColorStop(0.45, '#17154a');
    sky.addColorStop(0.72, '#3a2b66');
    sky.addColorStop(0.86, '#7a4a72');
    sky.addColorStop(1, '#0b0a24');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (const st of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.sp + st.tw));
      ctx.fillStyle = `rgba(255, 248, 235, ${(a * (1 - st.y / (h * 0.8))).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(st.x + par.x * 4, st.y + par.y * 3, st.r, 0, 6.283);
      ctx.fill();
    }

    // Moon with a soft halo
    const portrait = h > w;
    const mx = w * (portrait ? 0.8 : 0.78) + par.x * 8, my = h * (portrait ? 0.1 : 0.2) + par.y * 6, mr = Math.max(20, Math.min(w, h) * 0.04);
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 7);
    halo.addColorStop(0, 'rgba(255, 236, 205, 0.32)');
    halo.addColorStop(0.35, 'rgba(255, 220, 190, 0.08)');
    halo.addColorStop(1, 'rgba(255, 220, 190, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    const disc = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    disc.addColorStop(0, '#fffaf0');
    disc.addColorStop(1, '#f1dcc0');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, 6.283);
    ctx.fill();

    // Horizon glow
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.78, 10, w * 0.5, h * 0.78, w * 0.7);
    glow.addColorStop(0, 'rgba(243, 160, 140, 0.22)');
    glow.addColorStop(1, 'rgba(243, 160, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Hills, far to near, with gentle parallax
    const layers = [
      { base: h * 0.7, amp: h * 0.035, freq: 1.3, seed: 1.2, color: '#2c2459', depth: 6 },
      { base: h * 0.78, amp: h * 0.04, freq: 0.9, seed: 3.4, color: '#1d1946', depth: 14 },
      { base: h * 0.88, amp: h * 0.03, freq: 1.6, seed: 5.1, color: '#0b0a24', depth: 26 }
    ];
    layers.forEach((L, i) => {
      const off = par.x * L.depth;
      hill(L.base + par.y * L.depth * 0.3, L.amp, L.freq, L.seed, off);
      ctx.fillStyle = L.color;
      ctx.fill();

      if (i === 1) {
        // A tiny cottage with a warm window on the middle hill
        const cx = w * 0.24;
        const cy = hillY(cx, L.base + par.y * L.depth * 0.3, L.amp, L.freq, L.seed, off);
        const s = Math.max(0.7, Math.min(1.4, w / 1200));
        ctx.save();
        ctx.translate(cx, cy + 4);
        ctx.scale(s, s);
        ctx.fillStyle = L.color;
        ctx.fillRect(-18, -22, 36, 24);
        ctx.beginPath();
        ctx.moveTo(-23, -21);
        ctx.lineTo(0, -40);
        ctx.lineTo(23, -21);
        ctx.fill();
        ctx.fillRect(8, -40, 6, 12);
        const flicker = 0.85 + Math.sin(t * 3.1) * 0.05 + Math.sin(t * 7.3) * 0.04;
        const win = ctx.createRadialGradient(-6, -12, 1, -6, -12, 34);
        win.addColorStop(0, `rgba(255, 200, 120, ${0.45 * flicker})`);
        win.addColorStop(1, 'rgba(255, 200, 120, 0)');
        ctx.fillStyle = win;
        ctx.fillRect(-40, -46, 80, 70);
        ctx.fillStyle = `rgba(255, 214, 150, ${flicker})`;
        ctx.fillRect(-10, -16, 8, 7);
        ctx.restore();

        // A few trees on the same ridge
        [0.38, 0.41, 0.62, 0.66, 0.69].forEach((u, k) => {
          const tx = w * u;
          const ty = hillY(tx, L.base + par.y * L.depth * 0.3, L.amp, L.freq, L.seed, off);
          const th = (26 + (k % 3) * 9) * s;
          ctx.fillStyle = L.color;
          ctx.beginPath();
          ctx.moveTo(tx - th * 0.32, ty + 2);
          ctx.lineTo(tx, ty - th);
          ctx.lineTo(tx + th * 0.32, ty + 2);
          ctx.fill();
        });
      }
    });

    // Fireflies drifting over the near hills
    for (const f of flies) {
      const a = Math.max(0, Math.sin(t * f.sp * 1.4 + f.ph));
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
  };

  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('pointermove', (e) => {
    par.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    par.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Hero text drifts up and fades as you scroll into the worlds
  const onScroll = () => {
    const u = Math.min(1, window.scrollY / (h * 0.7));
    content.style.opacity = String(1 - u);
    content.style.transform = `translateY(${-u * 60}px)`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  if (reduceMotion) { draw(); return; }
  let heroVisible = true;
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero);
  startLoop((dt) => {
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

const PREVIEWS = { aquarium: aquariumPreview, cat: catPreview };

// ==========================================
// WORLD SECTIONS
// ==========================================
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
      entry.preview = make(canvas);
      previews.push(entry);
    }
  });
  return previews;
}

function runPreviews(previews) {
  const layoutAll = () => previews.forEach(p => p.preview.layout());
  layoutAll();
  window.addEventListener('resize', layoutAll);

  const io = new IntersectionObserver(entries => entries.forEach(en => {
    const p = previews.find(x => x.canvas === en.target);
    if (p) p.visible = en.isIntersecting;
  }), { rootMargin: '120px' });
  previews.forEach(p => io.observe(p.canvas));

  // Always paint one frame so a window is never empty
  previews.forEach(p => p.preview.frame(null, 0.016));
  if (reduceMotion) return;
  startLoop((dt) => {
    previews.forEach(p => { if (p.visible) p.preview.frame(p.pointer, dt); });
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
  startHero();
  runPreviews(buildWorlds());
  setupReveal();
});
