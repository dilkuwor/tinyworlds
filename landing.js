/**
 * landing.js - Tiny Worlds landing page
 * Ambient light-mote background, scene cards built from TINY_WORLDS, live
 * miniature previews that reuse each world's real creatures, and arrow-key
 * navigation between cards.
 */

const reduceMotion = prefersReducedMotion();

// ==========================================
// AMBIENT BACKGROUND
// ==========================================
function startBackground() {
  const canvas = document.getElementById('bg');
  const stage = createStage(canvas);
  const motes = Array.from({ length: 60 }, () => ({
    x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2.2,
    vx: (Math.random() - 0.5) * 0.004, vy: -0.003 - Math.random() * 0.006,
    ph: Math.random() * 10, hue: Math.random() < 0.7 ? '190, 225, 255' : '255, 214, 170'
  }));

  const draw = (t) => {
    const { ctx, width: w, height: h } = stage;
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.8 + m.ph));
      const px = m.x * w, py = m.y * h;
      const g = ctx.createRadialGradient(px, py, 0, px, py, m.r * 6);
      g.addColorStop(0, `rgba(${m.hue}, ${a.toFixed(3)})`);
      g.addColorStop(1, `rgba(${m.hue}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, m.r * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (reduceMotion) { draw(0); return; }
  startLoop((dt, t) => {
    for (const m of motes) {
      m.x += m.vx * dt + Math.sin(t * 0.3 + m.ph) * 0.0002;
      m.y += m.vy * dt;
      if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
      if (m.x < -0.05) m.x = 1.05;
      if (m.x > 1.05) m.x = -0.05;
    }
    draw(t);
  });
}

// ==========================================
// PREVIEWS
// ==========================================

/** Miniature reef using the aquarium's own fish, plants and bubbles. */
function aquariumPreview(canvas) {
  const ctx = canvas.getContext('2d');
  const k = 0.62; // world-to-card scale
  let w, h, W, H, bounds, fishes = [], plants = [], bubbles = [], time = 0;

  const layout = () => {
    ({ width: w, height: h } = fitCanvas(canvas, ctx));
    W = w / k; H = h / k;
    bounds = { left: 10, right: W - 10, top: 30, bottom: H - 50 };
    fishes = [
      new Fish('clownfish', W * 0.25, H * 0.45, bounds),
      new Fish('clownfish', W * 0.3, H * 0.52, bounds),
      new Fish('bluetang', W * 0.6, H * 0.35, bounds),
      new Fish('yellowtang', W * 0.45, H * 0.6, bounds),
      new Fish('angelfish', W * 0.75, H * 0.4, bounds)
    ];
    plants = [0.08, 0.22, 0.5, 0.78, 0.92].map((u, i) =>
      new Plant(W * u, H - 30, 90 + (i % 3) * 30, 7, i % 2 ? 'coral' : 'green'));
  };

  const frame = (pointer) => {
    time++;
    if (time % 14 === 0) bubbles.push(new Bubble(W * 0.82 + (Math.random() - 0.5) * 10, H - 40, 2 + Math.random() * 4, 1 + Math.random()));
    bubbles = bubbles.filter(b => b.update(20, time));
    fishes.forEach(f => f.update([], time, () => {}));

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
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 34);
    ctx.bezierCurveTo(W * 0.3, H - 50, W * 0.6, H - 22, W, H - 40);
    ctx.lineTo(W, H);
    ctx.fill();
    plants.forEach(p => p.draw(ctx, time, false));
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
    s = Math.max(0.45, Math.min(0.75, h / 300));
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
// CARDS
// ==========================================
function buildCards() {
  const grid = document.getElementById('worlds');
  const previews = [];

  TINY_WORLDS.forEach((world, i) => {
    const card = document.createElement('a');
    card.className = 'world-card';
    card.href = `/${world.slug}/`;
    card.style.setProperty('--accent', world.accent);
    card.style.setProperty('--delay', `${i * 90}ms`);
    card.innerHTML = `
      <div class="world-preview"><canvas aria-hidden="true"></canvas></div>
      <div class="world-info">
        <div class="world-title"><span class="world-icon">${world.icon}</span>${world.title}</div>
        <p class="world-desc">${world.description}</p>
        <span class="world-enter">Enter <span aria-hidden="true">→</span></span>
      </div>`;
    grid.appendChild(card);

    const make = PREVIEWS[world.preview];
    if (make) {
      const canvas = card.querySelector('canvas');
      const preview = make(canvas);
      const entry = { card, canvas, preview, pointer: null, visible: true };
      card.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        entry.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      });
      card.addEventListener('pointerleave', () => { entry.pointer = null; });
      previews.push(entry);
    }
  });

  // A quiet placeholder so the grid feels intentional, not unfinished
  const soon = document.createElement('div');
  soon.className = 'world-card world-soon';
  soon.innerHTML = `
    <div class="soon-inner">
      <div class="soon-icon">🌱</div>
      <div class="world-title">More worlds growing</div>
      <p class="world-desc">New tiny worlds will appear here over time.</p>
    </div>`;
  grid.appendChild(soon);

  return previews;
}

function runPreviews(previews) {
  const layoutAll = () => previews.forEach(p => p.preview.layout());
  layoutAll();
  window.addEventListener('resize', layoutAll);

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      const p = previews.find(x => x.canvas === en.target);
      if (p) p.visible = en.isIntersecting;
    }));
    previews.forEach(p => io.observe(p.canvas));
  }

  if (reduceMotion) {
    previews.forEach(p => p.preview.frame(null, 0.016));
    return;
  }
  startLoop((dt) => {
    previews.forEach(p => { if (p.visible) p.preview.frame(p.pointer, dt); });
  });
}

// ==========================================
// KEYBOARD NAVIGATION
// ==========================================
function setupKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const cards = [...document.querySelectorAll('a.world-card')];
    if (!cards.length) return;
    const i = cards.indexOf(document.activeElement);
    const cols = Math.max(1, Math.round(document.getElementById('worlds').clientWidth / cards[0].offsetWidth));
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    const next = i < 0 ? 0 : Math.max(0, Math.min(cards.length - 1, i + step));
    cards[next].focus();
    e.preventDefault();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  startBackground();
  runPreviews(buildCards());
  setupKeyboard();
});
