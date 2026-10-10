/**
 * aquarium.js - Main Canvas Engine, Environment Renderer & Interactivity
 */

class Aquarium {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('world');

    // Display dimensions
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;
    this.waterLine = 40;
    this.seabedY = this.height - 70;

    // Time & lighting
    this.time = 0;
    this.theme = 'day'; // 'day', 'twilight', 'night', 'deep'
    this.aeratorMode = 'normal'; // 'normal', 'turbo', 'off'

    // Collections
    this.fishes = [];
    this.jellyfishes = [];
    this.turtle = null;
    this.crab = null;
    this.school = null;
    this.plants = [];
    this.bubbles = [];
    this.foods = [];
    this.particles = []; // Marine snow / plankton
    this.clickRipples = [];

    // Aerator emitter position (treasure chest at bottom right)
    this.aeratorX = Math.max(120, this.width * 0.82);

    this.init();
  }

  getBounds() {
    return {
      left: 10,
      right: this.width - 10,
      top: this.waterLine + 20,
      bottom: this.seabedY - 10
    };
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Generate marine snow particles
    for (let i = 0; i < 45; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: this.waterLine + Math.random() * (this.height - this.waterLine - 80),
        r: 1 + Math.random() * 1.8,
        vy: 0.15 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Populate flora / seaweed
    this.initFlora();

    // Populate marine life
    this.populateInitialLife();

    // Attach user input listeners
    this.setupEventListeners();

    // Start rendering loop
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    const size = fitCanvas(this.canvas, this.ctx, window.innerWidth, window.innerHeight);
    this.width = size.width;
    this.height = size.height;
    this.dpr = size.dpr;

    this.waterLine = Math.max(35, this.height * 0.05);
    this.seabedY = this.height - Math.max(60, this.height * 0.09);
    this.aeratorX = Math.max(100, this.width * 0.82);

    const bounds = this.getBounds();
    this.fishes.forEach(f => f.bounds = bounds);
    this.jellyfishes.forEach(j => j.bounds = bounds);
    if (this.turtle) this.turtle.bounds = bounds;
    if (this.crab) {
      this.crab.bounds = bounds;
      this.crab.seabedY = this.seabedY;
    }
    if (this.school) this.school.bounds = bounds;

    // Refresh plants for new width/height
    this.initFlora();
  }

  initFlora() {
    this.plants = [];
    const count = Math.max(8, Math.floor(this.width / 95));
    const step = this.width / (count + 1);

    for (let i = 0; i < count; i++) {
      const px = step * (i + 0.5) + (Math.random() - 0.5) * 35;
      const h = 140 + Math.random() * 150;
      const type = (i % 4 === 1) ? 'coral' : 'green';
      this.plants.push(new Plant(px, this.seabedY + 10, h, 8 + Math.floor(Math.random() * 4), type));
    }
  }

  populateInitialLife() {
    const b = this.getBounds();

    // Clownfish family
    this.fishes.push(new Fish('clownfish', this.width * 0.25, this.height * 0.45, b));
    this.fishes.push(new Fish('clownfish', this.width * 0.28, this.height * 0.52, b));
    this.fishes.push(new Fish('clownfish', this.width * 0.22, this.height * 0.48, b));

    // Blue Tangs
    this.fishes.push(new Fish('bluetang', this.width * 0.5, this.height * 0.35, b));
    this.fishes.push(new Fish('bluetang', this.width * 0.55, this.height * 0.4, b));

    // Angelfish
    this.fishes.push(new Fish('angelfish', this.width * 0.7, this.height * 0.3, b));
    this.fishes.push(new Fish('angelfish', this.width * 0.65, this.height * 0.25, b));

    // Yellow Tang
    this.fishes.push(new Fish('yellowtang', this.width * 0.38, this.height * 0.6, b));

    // Jellyfish
    this.jellyfishes.push(new Jellyfish(this.width * 0.15, this.height * 0.35, b));
    this.jellyfishes.push(new Jellyfish(this.width * 0.88, this.height * 0.4, b));

    // Sea Turtle
    this.turtle = new SeaTurtle(this.width * 0.05, this.height * 0.22, b);

    // Seabed Crab
    this.crab = new Crab(this.width * 0.45, this.seabedY, b);

    // Neon Tetra School
    this.school = new NeonSchool(14, b);

    this.updateStatsUI();
  }

  addFish(species) {
    const b = this.getBounds();
    const spawnX = Math.random() * (this.width - 200) + 100;
    const spawnY = this.waterLine + 80 + Math.random() * (this.seabedY - this.waterLine - 160);

    if (species === 'jellyfish') {
      this.jellyfishes.push(new Jellyfish(spawnX, spawnY, b));
    } else if (species === 'turtle') {
      if (!this.turtle) {
        this.turtle = new SeaTurtle(spawnX, spawnY, b);
      } else {
        // Toggle or restart turtle position
        this.turtle.x = -80;
        this.turtle.vx = Math.abs(this.turtle.vx);
        this.turtle.isFacingRight = true;
      }
    } else {
      this.fishes.push(new Fish(species, spawnX, spawnY, b));
    }
    this.updateStatsUI();
  }

  dropFood(x, y) {
    const clampedX = clamp(x, 20, this.width - 20);
    const clampedY = clamp(y, this.waterLine + 10, this.seabedY - 40);

    // Drop 3-4 delicate food flakes
    for (let i = 0; i < 3; i++) {
      const fx = clampedX + (Math.random() - 0.5) * 24;
      const fy = clampedY + (Math.random() - 0.5) * 16;
      this.foods.push(new Food(fx, fy));
    }

    if (window.soundManager) window.soundManager.playFeed();
    this.spawnClickRipple(x, y);
    this.updateStatsUI();
  }

  feedAll() {
    for (let i = 0; i < 7; i++) {
      const rx = 80 + Math.random() * (this.width - 160);
      const ry = this.waterLine + 20 + Math.random() * 40;
      this.dropFood(rx, ry);
    }
  }

  startleNearby(x, y) {
    const startleRadius = 160;
    let startledAny = false;

    this.fishes.forEach(fish => {
      if (dist(fish.x, fish.y, x, y) < startleRadius) {
        fish.startle(x, y);
        startledAny = true;
      }
    });

    if (startledAny && window.soundManager) {
      window.soundManager.playStartle();
    }
  }

  spawnClickRipple(x, y) {
    const rippleEl = document.createElement('div');
    rippleEl.className = 'click-ripple';
    rippleEl.style.left = `${x}px`;
    rippleEl.style.top = `${y}px`;
    this.container.appendChild(rippleEl);
    setTimeout(() => rippleEl.remove(), 800);
  }

  setupEventListeners() {
    let isMouseDown = false;

    // Click / touch to drop food & startle fish
    this.container.addEventListener('mousedown', (e) => {
      if (Shell.isUIEvent(e)) return;
      isMouseDown = true;
      this.dropFood(e.clientX, e.clientY);
      this.startleNearby(e.clientX, e.clientY);
    });

    this.container.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      if (Math.random() < 0.2) {
        this.dropFood(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => { isMouseDown = false; });

    // Touch support for mobile devices
    this.container.addEventListener('touchstart', (e) => {
      if (Shell.isUIEvent(e)) return;
      const touch = e.touches[0];
      this.dropFood(touch.clientX, touch.clientY);
      this.startleNearby(touch.clientX, touch.clientY);
    }, { passive: true });

    // Scene keyboard shortcuts (T, F, ?, Esc are handled by the shared shell)
    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.feedAll();
      } else if (e.key === 'd' || e.key === 'D') {
        this.cycleTheme();
      } else if (e.key === 'm' || e.key === 'M') {
        this.toggleSound();
      } else if (e.key === 'a' || e.key === 'A') {
        const types = ['clownfish', 'bluetang', 'angelfish', 'yellowtang', 'jellyfish'];
        this.addFish(types[Math.floor(Math.random() * types.length)]);
      } else if (e.key === 'c' || e.key === 'C') {
        this.foods = [];
        this.updateStatsUI();
      }
    });
  }

  cycleTheme() {
    const modes = ['day', 'twilight', 'night', 'deep'];
    const nextIdx = (modes.indexOf(this.theme) + 1) % modes.length;
    this.setTheme(modes[nextIdx]);
  }

  setTheme(theme) {
    this.theme = theme;
    const themeBtn = document.getElementById('theme-btn-label');
    if (themeBtn) {
      themeBtn.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    }
  }

  toggleSound() {
    if (!window.soundManager) return;
    const isMuted = window.soundManager.toggleMute();
    const soundIcon = document.getElementById('sound-icon');
    const soundLabel = document.getElementById('sound-label');
    if (soundIcon) soundIcon.textContent = isMuted ? '🔇' : '🔊';
    if (soundLabel) soundLabel.textContent = isMuted ? 'Off' : 'On';
  }

  toggleAerator() {
    const modes = ['normal', 'turbo', 'off'];
    const nextIdx = (modes.indexOf(this.aeratorMode) + 1) % modes.length;
    this.aeratorMode = modes[nextIdx];
    const aeratorLabel = document.getElementById('aerator-label');
    if (aeratorLabel) {
      aeratorLabel.textContent = this.aeratorMode.charAt(0).toUpperCase() + this.aeratorMode.slice(1);
    }
  }

  updateStatsUI() {
    const fishCountEl = document.getElementById('stat-fish-count');
    const foodCountEl = document.getElementById('stat-food-count');
    if (fishCountEl) {
      const total = this.fishes.length + this.jellyfishes.length + (this.turtle ? 1 : 0);
      fishCountEl.textContent = total;
    }
    if (foodCountEl) {
      foodCountEl.textContent = this.foods.length;
    }
  }

  // ==========================================
  // RENDERING & LOOP
  // ==========================================
  loop(timestamp) {
    this.time++;

    this.update();
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  update() {
    const bounds = this.getBounds();
    const isNight = this.theme === 'night' || this.theme === 'deep';

    // Aerator bubble generation
    if (this.aeratorMode !== 'off') {
      const bubbleInterval = this.aeratorMode === 'turbo' ? 3 : 8;
      if (this.time % bubbleInterval === 0) {
        const bx = this.aeratorX + (Math.random() - 0.5) * 18;
        const by = this.seabedY - 14;
        const size = (this.aeratorMode === 'turbo') ? 3 + Math.random() * 7 : 2.5 + Math.random() * 5;
        this.bubbles.push(new Bubble(bx, by, size, 1.2 + Math.random() * 2));
      }
    }

    // Update bubbles
    this.bubbles = this.bubbles.filter(b => b.update(this.waterLine, this.time));

    // Update food flakes
    this.foods = this.foods.filter(f => f.update(this.seabedY));
    if (this.time % 60 === 0) this.updateStatsUI();

    // Update marine snow particles
    for (const p of this.particles) {
      p.y += p.vy;
      p.x += Math.sin(this.time * 0.02 + p.phase) * 0.3;
      if (p.y > this.seabedY) {
        p.y = this.waterLine + 5;
        p.x = Math.random() * this.width;
      }
    }

    // Update fishes
    const spawnBubble = (x, y, r) => this.bubbles.push(new Bubble(x, y, r));
    this.fishes.forEach(f => f.update(this.foods, this.time, spawnBubble));

    // Update jellyfish
    this.jellyfishes.forEach(j => j.update(this.time));

    // Update sea turtle
    if (this.turtle) this.turtle.update(this.time);

    // Update crab
    if (this.crab) this.crab.update(this.seabedY);

    // Update neon shoal
    if (this.school) this.school.update(this.time);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const isNight = this.theme === 'night';
    const isDeep = this.theme === 'deep';
    const isTwilight = this.theme === 'twilight';

    ctx.clearRect(0, 0, w, h);

    // 1. Water Background Gradient
    this.drawWaterBackground(ctx, w, h);

    // 2. Caustics & Sunbeams (Day / Twilight)
    if (!isNight && !isDeep) {
      this.drawSunbeams(ctx, w, h);
    }

    // 3. Sandy Seabed & Ocean Floor Rocks
    this.drawSeabed(ctx, w, h);

    // 4. Sunken Aerator Treasure Chest
    this.drawAeratorChest(ctx);

    // 5. Flora / Seaweed / Corals
    this.plants.forEach(p => p.draw(ctx, this.time, isNight || isDeep));

    // 6. Food Flakes
    this.foods.forEach(f => f.draw(ctx));

    // 7. Crab on Seabed
    if (this.crab) this.crab.draw(ctx, isNight || isDeep);

    // 8. Fishes & Marine Life
    if (this.turtle) this.turtle.draw(ctx, isNight || isDeep);
    if (this.school) this.school.draw(ctx, isNight || isDeep);
    this.fishes.forEach(f => f.draw(ctx, isNight || isDeep));
    this.jellyfishes.forEach(j => j.draw(ctx, isNight || isDeep));

    // 9. Floating Marine Snow & Plankton
    this.drawParticles(ctx, isNight || isDeep);

    // 10. Bubbles
    this.bubbles.forEach(b => b.draw(ctx, isNight || isDeep));

    // 11. Water Surface Line & Refraction Shimmer
    this.drawWaterSurface(ctx, w);

    // 12. Tank Glass Frame Vignette
    this.drawTankGlassVignette(ctx, w, h);
  }

  drawWaterBackground(ctx, w, h) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);

    if (this.theme === 'day') {
      grad.addColorStop(0, '#38bdf8');   // Bright tropical cyan surface
      grad.addColorStop(0.35, '#0284c7'); // Turquoise mid-water
      grad.addColorStop(0.75, '#0369a1'); // Deep ocean blue
      grad.addColorStop(1, '#0c4a6e');    // Sandy floor depth
    } else if (this.theme === 'twilight') {
      grad.addColorStop(0, '#f472b6');    // Pinkish dusk sky reflection
      grad.addColorStop(0.3, '#818cf8');  // Violet water
      grad.addColorStop(0.7, '#3730a3');  // Deep indigo
      grad.addColorStop(1, '#1e1b4b');    // Dark depths
    } else if (this.theme === 'night') {
      grad.addColorStop(0, '#0f172a');    // Starry dark water
      grad.addColorStop(0.4, '#091c3e');  // Bioluminescent blue
      grad.addColorStop(0.8, '#04132c');  // Deep midnight
      grad.addColorStop(1, '#020617');    // Pitch black abyss
    } else { // 'deep'
      grad.addColorStop(0, '#0e2b3d');
      grad.addColorStop(0.5, '#061727');
      grad.addColorStop(1, '#010911');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  drawSunbeams(ctx, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const numBeams = 7;
    for (let i = 0; i < numBeams; i++) {
      const beamX = (w / numBeams) * (i + 0.5) + Math.sin(this.time * 0.015 + i) * 60;
      const beamW = 60 + Math.sin(this.time * 0.02 + i * 2) * 25;
      const angle = (Math.PI / 180) * (70 + (i - numBeams / 2) * 4 + Math.sin(this.time * 0.01 + i) * 3);

      const grad = ctx.createLinearGradient(beamX, this.waterLine, beamX + Math.cos(angle) * h, h * 0.85);
      const alpha = 0.08 + Math.sin(this.time * 0.025 + i * 1.5) * 0.04;

      if (this.theme === 'twilight') {
        grad.addColorStop(0, `rgba(255, 200, 160, ${alpha * 1.5})`);
        grad.addColorStop(1, 'rgba(255, 120, 180, 0)');
      } else {
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 1.8})`);
        grad.addColorStop(1, 'rgba(100, 220, 255, 0)');
      }

      ctx.beginPath();
      ctx.moveTo(beamX - beamW * 0.4, this.waterLine);
      ctx.lineTo(beamX + beamW * 0.4, this.waterLine);
      ctx.lineTo(beamX + beamW * 2.2 + 100, h * 0.85);
      ctx.lineTo(beamX - beamW * 1.8 - 50, h * 0.85);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }

  drawSeabed(ctx, w, h) {
    ctx.save();
    const isNight = this.theme === 'night' || this.theme === 'deep';

    // Sandy floor smooth dunes
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, this.seabedY);
    ctx.bezierCurveTo(
      w * 0.25, this.seabedY - 18,
      w * 0.6, this.seabedY + 12,
      w, this.seabedY - 8
    );
    ctx.lineTo(w, h);
    ctx.closePath();

    const sandGrad = ctx.createLinearGradient(0, this.seabedY - 20, 0, h);
    if (isNight) {
      sandGrad.addColorStop(0, '#1e293b');
      sandGrad.addColorStop(0.5, '#0f172a');
      sandGrad.addColorStop(1, '#020617');
    } else {
      sandGrad.addColorStop(0, '#e9c46a');
      sandGrad.addColorStop(0.4, '#d4a373');
      sandGrad.addColorStop(1, '#99582a');
    }
    ctx.fillStyle = sandGrad;
    ctx.fill();

    // Decorative seabed rocks
    const drawRock = (rx, ry, rw, rh) => {
      ctx.beginPath();
      ctx.ellipse(rx, ry, rw, rh, 0, 0, Math.PI * 2);
      ctx.fillStyle = isNight ? '#334155' : '#7f8c8d';
      ctx.fill();
      ctx.strokeStyle = isNight ? '#1e293b' : '#5d6d7e';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    drawRock(w * 0.12, this.seabedY + 16, 32, 18);
    drawRock(w * 0.16, this.seabedY + 22, 22, 14);
    drawRock(w * 0.52, this.seabedY + 28, 44, 22);
    drawRock(w * 0.84, this.seabedY + 18, 50, 24);

    // Sand grain texture dots
    ctx.fillStyle = isNight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)';
    for (let i = 0; i < 28; i++) {
      const gx = ((i * 73) % w);
      const gy = this.seabedY + 10 + ((i * 37) % (h - this.seabedY - 15));
      ctx.beginPath();
      ctx.arc(gx, gy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawAeratorChest(ctx) {
    ctx.save();
    const cx = this.aeratorX;
    const cy = this.seabedY - 6;

    // Small sunken treasure chest acting as aerator
    // Base
    ctx.fillStyle = '#6f4e37';
    ctx.strokeStyle = '#4a2810';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 16, cy - 14, 32, 16);
    ctx.strokeRect(cx - 16, cy - 14, 32, 16);

    // Lid partially open
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 14);
    ctx.lineTo(cx + 18, cy - 22);
    ctx.lineTo(cx + 18, cy - 17);
    ctx.lineTo(cx - 18, cy - 10);
    ctx.closePath();
    ctx.fillStyle = '#8b5a2b';
    ctx.fill();
    ctx.stroke();

    // Gold trim & lock
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(cx - 3, cy - 11, 6, 7);

    // Aerator glow ring
    ctx.beginPath();
    ctx.arc(cx, cy - 16, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 210, 255, 0.4)';
    ctx.fill();

    ctx.restore();
  }

  drawParticles(ctx, isNight) {
    ctx.save();
    ctx.fillStyle = isNight ? 'rgba(0, 255, 230, 0.45)' : 'rgba(255, 255, 255, 0.35)';
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawWaterSurface(ctx, w) {
    ctx.save();
    const wl = this.waterLine;

    // Undulating surface wave
    ctx.beginPath();
    ctx.moveTo(0, wl);
    for (let x = 0; x <= w; x += 30) {
      const y = wl + Math.sin(this.time * 0.04 + x * 0.015) * 3.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();

    ctx.fillStyle = (this.theme === 'night') ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.25)';
    ctx.fill();

    // Surface glow / crest highlight
    ctx.beginPath();
    ctx.moveTo(0, wl);
    for (let x = 0; x <= w; x += 30) {
      const y = wl + Math.sin(this.time * 0.04 + x * 0.015) * 3.5;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  drawTankGlassVignette(ctx, w, h) {
    ctx.save();
    // Inner shadow vignette for aquarium glass look
    const vignette = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.4,
      w / 2, h / 2, Math.max(w, h) * 0.75
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 5, 20, 0.45)');

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Subtle glass reflection streaks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(-100, h * 0.8);
    ctx.lineTo(w * 0.4, -50);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w * 0.2, h + 50);
    ctx.lineTo(w * 0.8, -50);
    ctx.stroke();

    ctx.restore();
  }
}

// Global bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const aquarium = new Aquarium('aquarium-canvas');
  window.aquarium = aquarium;

  // UI buttons
  const feedBtn = document.getElementById('btn-feed');
  if (feedBtn) feedBtn.addEventListener('click', () => aquarium.feedAll());

  Shell.init({ storageKey: 'tinyworlds.aquarium' });

  document.querySelectorAll('#add-dropdown .dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => aquarium.addFish(e.currentTarget.getAttribute('data-species')));
  });

  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) themeBtn.addEventListener('click', () => aquarium.cycleTheme());

  const soundBtn = document.getElementById('btn-sound');
  if (soundBtn) soundBtn.addEventListener('click', () => aquarium.toggleSound());

  const aeratorBtn = document.getElementById('btn-aerator');
  if (aeratorBtn) aeratorBtn.addEventListener('click', () => aquarium.toggleAerator());
});
