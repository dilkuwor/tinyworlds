/**
 * desk.js - The Desk
 *
 * A cozy desk at night that ties the collection together. Each object on it
 * is a small doorway into another world:
 *   the rainy window → Rain on the Glass     the fish tank → Aquarium
 *   the jar of fireflies → Night Meadow      the sleeping cat → Ragdoll Cat
 *   the carved bird → The Feeder             the train ticket → Night Train
 *   the basil pot → The Greenhouse (it droops when your greenhouse is thirsty)
 *
 * Objects lift when you hover them and wobble when you brush past. The desk
 * lamp switches on and off; in the dark the window, tank and jar light the room.
 *
 * Reuses the real Fish (aquarium/entities.js) and Cat (cat/cat.js).
 */

const DK_TAU = Math.PI * 2;
const dkClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dkRand = (a, b) => a + Math.random() * (b - a);

const DESK_ITEMS = [
  { id: 'window', slug: 'rain', label: 'Rain on the Glass', icon: '🌧️' },
  { id: 'tank', slug: 'aquarium', label: 'Aquarium', icon: '🐠' },
  { id: 'jar', slug: 'meadow', label: 'Night Meadow', icon: '✨' },
  { id: 'bird', slug: 'feeder', label: 'The Feeder', icon: '🐦' },
  { id: 'cat', slug: 'cat', label: 'Ragdoll Cat', icon: '🐈' },
  { id: 'plant', slug: 'greenhouse', label: 'The Greenhouse', icon: '🪴' },
  { id: 'ticket', slug: 'train', label: 'Night Train', icon: '🚆' }
];

class DeskWorld {
  constructor(canvas, { preview = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = preview;
    this.t = 0;
    this.frame = 0;
    this.lampOn = true;
    this.lampLevel = 1;
    this.hovered = null;
    this.items = DESK_ITEMS.map(d => ({ ...d, lift: 0, wob: 0, wobVel: 0 }));
    this.raindrops = [];
    this.bubbles = [];
    this.greenhouseThirst = this.readGreenhouse();
    this.cat = typeof Cat === 'function' ? new Cat() : null;
    if (this.cat) {
      this.cat.setPose('sleep', 50);
      this.cat.pose = { ...CAT_POSES.sleep };
      this.cat.tailMood = 'sleep';
    }
    this.fish = [];
  }

  /** How thirsty your greenhouse is right now (0 fine … 1 parched), from its saved state. */
  readGreenhouse() {
    try {
      const data = JSON.parse(localStorage.getItem('tinyworlds.greenhouse.v2') || 'null');
      if (!data || !data.plants) return 0;
      const hours = (Date.now() - (data.saved || Date.now())) / 36e5;
      const waters = data.plants.map(p => Math.max(0, p.water - hours / 28));
      const thirsty = waters.filter(w => w < 0.3).length;
      return thirsty / waters.length;
    } catch (_) {
      return 0;
    }
  }

  // ---------- Layout ----------
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    const portrait = h > w;
    const S = this.S = dkClamp(Math.min(w / 980, h / 620), 0.45, 1.5) * (this.preview ? 1.15 : 1);
    this.deskTop = h * (portrait ? 0.56 : 0.6);
    const D = this.deskTop;
    this.win = { x: w * (portrait ? 0.08 : 0.07), y: h * 0.08, w: w * (portrait ? 0.56 : 0.34), h: Math.max(80, D - h * 0.08 - 34 * S) };
    this.lamp = { x: w * 0.88, base: D + 34 * S, headX: w * 0.76, headY: D - 190 * S };
    const at = (id) => this.items.find(i => i.id === id);
    const place = (id, x, y, hw, hh) => Object.assign(at(id), { x, y, hw, hh });
    place('window', this.win.x + this.win.w / 2, this.win.y + this.win.h, this.win.w / 2, this.win.h);
    place('tank', w * 0.17, D + 78 * S, 92 * S, 112 * S);
    place('jar', w * 0.36, D + 44 * S, 30 * S, 82 * S);
    place('bird', w * 0.46, D + 30 * S, 30 * S, 48 * S);
    place('cat', w * 0.55, D + 108 * S, 74 * S, 70 * S);
    place('plant', w * 0.7, D + 50 * S, 40 * S, 100 * S);
    place('ticket', w * 0.66, D + 128 * S, 60 * S, 24 * S);

    // City through the window
    this.city = [];
    let x = this.win.x;
    while (x < this.win.x + this.win.w) {
      const bw = dkRand(16, 40) * S, bh = dkRand(0.15, 0.55) * this.win.h;
      const lights = [];
      for (let yy = 6 * S; yy < bh - 4 * S; yy += 8 * S) for (let xx = 3 * S; xx < bw - 3 * S; xx += 6 * S) if (Math.random() < 0.3) lights.push([xx, yy]);
      this.city.push({ x, w: bw, h: bh, lights });
      x += bw + dkRand(0, 6) * S;
    }

    // Fish in the tank (local units: 400 wide)
    const tank = at('tank');
    this.tankK = (tank.hw * 2 - 16 * S) / 400;
    const innerH = (tank.hh - 30 * S) / this.tankK;
    const bounds = { left: 10, right: 390, top: 30, bottom: innerH - 40 };
    if (typeof Fish === 'function') {
      this.fish = [new Fish('clownfish', 120, innerH * 0.45, bounds), new Fish('bluetang', 260, innerH * 0.35, bounds), new Fish('yellowtang', 200, innerH * 0.6, bounds)];
    }
    this.flies = Array.from({ length: 9 }, () => ({ u: Math.random(), v: Math.random(), vx: dkRand(-0.2, 0.2), vy: dkRand(-0.2, 0.2), off: dkRand(-0.04, 0.04) }));

    if (this.cat) {
      const c = at('cat');
      this.cat.s = 0.42 * S;
      this.cat.x = c.x;
      this.cat.floorY = c.y - 14 * S;
    }
  }

  // ---------- Interaction ----------
  itemAt(x, y) {
    // Front objects win over the window behind them
    const order = ['ticket', 'cat', 'tank', 'plant', 'bird', 'jar', 'window'];
    for (const id of order) {
      const it = this.items.find(i => i.id === id);
      if (x > it.x - it.hw && x < it.x + it.hw && y > it.y - it.hh && y < it.y + 8 * this.S) return it;
    }
    return null;
  }

  hitLamp(x, y) {
    const L = this.lamp, S = this.S;
    return Math.hypot(x - L.headX, y - L.headY) < 50 * S || (Math.abs(x - L.x) < 40 * S && y > this.deskTop && y < L.base + 10 * S);
  }

  setHover(item) {
    if (item !== this.hovered && item) this.onHoverChange?.(item);
    this.hovered = item;
  }

  nudge(x, y, dx) {
    const it = this.itemAt(x, y);
    if (it && Math.abs(dx) > 3) it.wobVel += dkClamp(dx * 0.02, -0.6, 0.6);
    if (it && it.id === 'tank') this.fish.forEach(f => Math.random() < 0.5 && f.startle && f.startle(200, 150));
    return it;
  }

  toggleLamp() {
    this.lampOn = !this.lampOn;
    return this.lampOn;
  }

  // ---------- Simulation ----------
  update(dt) {
    this.t += dt;
    this.frame++;
    const S = this.S;
    this.lampLevel += ((this.lampOn ? 1 : 0) - this.lampLevel) * Math.min(1, dt * 6);
    for (const it of this.items) {
      it.lift += ((it === this.hovered ? 1 : 0) - it.lift) * Math.min(1, dt * 8);
      const f = -it.wob * 60 - it.wobVel * 6;
      it.wobVel += f * dt;
      it.wob += it.wobVel * dt;
    }
    // Rain on the window
    const W = this.win;
    if (this.raindrops.length < (this.preview ? 30 : 60) && Math.random() < dt * 30) {
      this.raindrops.push({ x: W.x + Math.random() * W.w, y: W.y + Math.random() * W.h * 0.7, r: dkRand(1, 3) * S, v: 0, stick: dkRand(0.5, 3) });
    }
    for (const d of this.raindrops) {
      d.stick -= dt;
      if (d.stick < 0) { d.v = Math.min(80 * S, d.v + 160 * S * dt); if (Math.random() < dt * 1.2) { d.stick = dkRand(0.2, 1.2); d.v = 0; } }
      d.y += d.v * dt;
    }
    this.raindrops = this.raindrops.filter(d => d.y < W.y + W.h - 4);
    // Fish and bubbles
    this.fish.forEach(f => f.update([], this.frame, () => {}));
    const tank = this.items.find(i => i.id === 'tank');
    if (Math.random() < dt * 3) this.bubbles.push({ x: tank.x + tank.hw * 0.55 + dkRand(-4, 4) * S, y: tank.y - 22 * S, r: dkRand(1, 2.4) * S });
    this.bubbles.forEach(b => { b.y -= 26 * S * dt; b.x += Math.sin(this.t * 4 + b.r) * 0.2; });
    this.bubbles = this.bubbles.filter(b => b.y > tank.y - tank.hh + 30 * S);
    // Fireflies in the jar
    for (const f of this.flies) {
      f.u += f.vx * dt; f.v += f.vy * dt;
      if (f.u < 0.1 || f.u > 0.9) f.vx *= -1;
      if (f.v < 0.15 || f.v > 0.9) f.vy *= -1;
      f.vx += dkRand(-0.3, 0.3) * dt; f.vy += dkRand(-0.3, 0.3) * dt;
      f.vx = dkClamp(f.vx, -0.25, 0.25); f.vy = dkClamp(f.vy, -0.25, 0.25);
    }
    if (this.cat) {
      this.cat.lookTarget = null;
      this.cat.update(dt);
    }
    if (Math.floor(this.t) % 30 === 0 && this.frame % 60 === 0) this.greenhouseThirst = this.readGreenhouse();
  }

  // ---------- Drawing ----------
  drawRoom(c) {
    const { w, h, S } = this, D = this.deskTop;
    const wall = c.createLinearGradient(0, 0, 0, D);
    wall.addColorStop(0, '#2b2433');
    wall.addColorStop(1, '#3b2f37');
    c.fillStyle = wall;
    c.fillRect(0, 0, w, D);
    c.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let x = 0; x < w; x += 28 * S) c.fillRect(x, 0, 10 * S, D);
    // A little framed picture and a shelf with books
    const px = w * 0.52, py = h * 0.12;
    c.fillStyle = '#5b4535';
    c.fillRect(px - 4 * S, py - 4 * S, 98 * S, 72 * S);
    const g = c.createLinearGradient(0, py, 0, py + 64 * S);
    g.addColorStop(0, '#34405e');
    g.addColorStop(0.6, '#d48a6a');
    g.addColorStop(1, '#2a2f3d');
    c.fillStyle = g;
    c.fillRect(px, py, 90 * S, 64 * S);
    c.fillStyle = '#f2d9a8';
    c.beginPath();
    c.arc(px + 62 * S, py + 30 * S, 7 * S, 0, DK_TAU);
    c.fill();
    const sy = h * 0.34;
    c.fillStyle = '#4a3527';
    c.fillRect(w * 0.48, sy, 170 * S, 8 * S);
    const books = ['#7a4a4a', '#4a6a7a', '#c9a35a', '#5a7a4a', '#8a6a9a', '#3d4a6b'];
    let bx = w * 0.48 + 8 * S;
    books.forEach((col, i) => {
      const bh = (34 + (i * 7) % 16) * S, bw = (11 + (i * 5) % 6) * S;
      c.fillStyle = col;
      c.fillRect(bx, sy - bh, bw, bh);
      bx += bw + 2 * S;
    });
    // Desk
    const desk = c.createLinearGradient(0, D, 0, h);
    desk.addColorStop(0, '#6b4a33');
    desk.addColorStop(0.5, '#523826');
    desk.addColorStop(1, '#2e1f15');
    c.fillStyle = desk;
    c.fillRect(0, D, w, h - D);
    c.fillStyle = 'rgba(255, 220, 180, 0.12)';
    c.fillRect(0, D, w, 2 * S);
    c.strokeStyle = 'rgba(30, 18, 10, 0.25)';
    c.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = D + (h - D) * (i / 5) * (i / 5);
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
  }

  drawWindow(c, it) {
    const { S } = this, W = this.win;
    c.save();
    c.translate(0, -it.lift * 3 * S);
    const sky = c.createLinearGradient(0, W.y, 0, W.y + W.h);
    sky.addColorStop(0, '#0b1230');
    sky.addColorStop(1, '#25305a');
    c.fillStyle = sky;
    c.fillRect(W.x, W.y, W.w, W.h);
    for (const b of this.city) {
      const base = W.y + W.h;
      c.fillStyle = '#10142a';
      c.fillRect(b.x, base - b.h, Math.min(b.w, W.x + W.w - b.x), b.h);
      c.fillStyle = 'rgba(255, 210, 140, 0.8)';
      for (const [lx, ly] of b.lights) if (b.x + lx < W.x + W.w - 2) c.fillRect(b.x + lx, base - b.h + ly, 2 * S, 3 * S);
    }
    // Raindrops on the pane
    // Diagonal rain beyond the glass
    c.strokeStyle = 'rgba(170, 190, 230, 0.18)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 40; i++) {
      const rx = W.x + ((i * 97 + this.t * 260) % W.w), ry = W.y + ((i * 53 + this.t * 520) % W.h);
      c.moveTo(rx, ry);
      c.lineTo(rx - 4 * S, ry + 14 * S);
    }
    c.stroke();
    // Drops on the pane, with a wet trail behind the ones that slide
    for (const d of this.raindrops) {
      if (d.v > 0) {
        c.strokeStyle = 'rgba(190, 210, 245, 0.18)';
        c.lineWidth = d.r * 0.8;
        c.beginPath();
        c.moveTo(d.x, d.y - d.r);
        c.lineTo(d.x, d.y - d.r - 30 * S);
        c.stroke();
      }
      c.fillStyle = 'rgba(30, 40, 70, 0.55)';
      c.beginPath();
      c.ellipse(d.x, d.y, d.r, d.r * 1.25, 0, 0, DK_TAU);
      c.fill();
      c.strokeStyle = 'rgba(200, 220, 255, 0.5)';
      c.lineWidth = 0.8;
      c.stroke();
      c.fillStyle = 'rgba(255, 245, 225, 0.85)';
      c.beginPath();
      c.arc(d.x - d.r * 0.3, d.y - d.r * 0.4, d.r * 0.28, 0, DK_TAU);
      c.fill();
    }
    // Frame, cross bar and sill
    c.strokeStyle = '#5c4232';
    c.lineWidth = 10 * S;
    c.strokeRect(W.x, W.y, W.w, W.h);
    c.lineWidth = 6 * S;
    c.beginPath();
    c.moveTo(W.x + W.w / 2, W.y);
    c.lineTo(W.x + W.w / 2, W.y + W.h);
    c.moveTo(W.x, W.y + W.h * 0.45);
    c.lineTo(W.x + W.w, W.y + W.h * 0.45);
    c.stroke();
    c.fillStyle = '#6a4c3a';
    c.fillRect(W.x - 14 * S, W.y + W.h + 4 * S, W.w + 28 * S, 9 * S);
    c.restore();
  }

  /** Common transform for a desk object: lift on hover, wobble on nudge. */
  withItem(c, it, fn) {
    c.save();
    c.translate(it.x, it.y - it.lift * 8 * this.S);
    c.rotate(it.wob * 0.25);
    fn();
    c.restore();
  }

  shadow(c, hw, k = 1) {
    c.fillStyle = 'rgba(15, 8, 4, 0.35)';
    c.beginPath();
    c.ellipse(4 * this.S, 2 * this.S, hw * k, 7 * this.S, 0, 0, DK_TAU);
    c.fill();
  }

  drawTank(c, it) {
    const S = this.S, x0 = -it.hw, w = it.hw * 2, h = it.hh - 18 * S;
    this.withItem(c, it, () => {
      this.shadow(c, it.hw * 1.05);
      // Water and sand
      c.save();
      c.beginPath();
      c.rect(x0 + 6 * S, -h, w - 12 * S, h - 4 * S);
      c.clip();
      const water = c.createLinearGradient(0, -h, 0, 0);
      water.addColorStop(0, '#3fa6c9');
      water.addColorStop(1, '#0d4f6e');
      c.fillStyle = water;
      c.fillRect(x0, -h, w, h);
      c.fillStyle = '#d8b878';
      c.fillRect(x0, -18 * S, w, 18 * S);
      c.strokeStyle = '#3f8a4f';
      c.lineWidth = 3 * S;
      for (const u of [0.18, 0.3, 0.78]) {
        c.beginPath();
        c.moveTo(x0 + w * u, -12 * S);
        c.quadraticCurveTo(x0 + w * u + Math.sin(this.t + u * 9) * 6 * S, -h * 0.45, x0 + w * u + Math.sin(this.t * 1.3 + u) * 4 * S, -h * 0.62);
        c.stroke();
      }
      c.save();
      c.translate(x0 + 8 * S, -h + 10 * S);
      c.scale(this.tankK, this.tankK);
      this.fish.forEach(f => f.draw(c, false));
      c.restore();
      c.fillStyle = 'rgba(220, 245, 255, 0.6)';
      for (const b of this.bubbles) {
        c.beginPath();
        c.arc(b.x - it.x, b.y - it.y + it.lift * 8 * S, b.r, 0, DK_TAU);
        c.fill();
      }
      c.restore();
      // Glass, rim and stand
      c.strokeStyle = 'rgba(210, 235, 245, 0.55)';
      c.lineWidth = 2.5 * S;
      c.strokeRect(x0 + 6 * S, -h, w - 12 * S, h - 4 * S);
      c.fillStyle = 'rgba(255, 255, 255, 0.12)';
      c.fillRect(x0 + 12 * S, -h + 6 * S, 6 * S, h - 20 * S);
      c.fillStyle = '#2a2622';
      c.fillRect(x0, -h - 6 * S, w, 8 * S);
      c.fillRect(x0, -6 * S, w, 8 * S);
    });
  }

  drawJar(c, it) {
    const S = this.S, hw = it.hw, h = it.hh - 10 * S;
    const pulse = Math.pow(Math.max(0, Math.sin(this.t * 3.1)), 6);
    this.withItem(c, it, () => {
      this.shadow(c, hw);
      // Glow escaping the glass
      c.save();
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, -h * 0.5, 0, 0, -h * 0.5, hw * 4);
      g.addColorStop(0, `rgba(230, 255, 150, ${(0.12 + 0.25 * pulse) * (1.2 - this.lampLevel * 0.6)})`);
      g.addColorStop(1, 'rgba(230, 255, 150, 0)');
      c.fillStyle = g;
      c.fillRect(-hw * 4, -h * 0.5 - hw * 4, hw * 8, hw * 8);
      c.restore();
      c.fillStyle = 'rgba(200, 225, 220, 0.12)';
      c.beginPath();
      if (c.roundRect) c.roundRect(-hw, -h, hw * 2, h, 10 * S); else c.rect(-hw, -h, hw * 2, h);
      c.fill();
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const f of this.flies) {
        const b = Math.pow(Math.max(0, Math.sin(this.t * 3.1 + f.off * 30)), 6);
        const fx = -hw + f.u * hw * 2, fy = -h + f.v * h;
        const r = (3 + b * 6) * S;
        const fg = c.createRadialGradient(fx, fy, 0, fx, fy, r);
        fg.addColorStop(0, `rgba(240, 255, 170, ${0.25 + b * 0.75})`);
        fg.addColorStop(1, 'rgba(240, 255, 170, 0)');
        c.fillStyle = fg;
        c.fillRect(fx - r, fy - r, r * 2, r * 2);
      }
      c.restore();
      c.strokeStyle = 'rgba(220, 240, 235, 0.45)';
      c.lineWidth = 2 * S;
      c.beginPath();
      if (c.roundRect) c.roundRect(-hw, -h, hw * 2, h, 10 * S); else c.rect(-hw, -h, hw * 2, h);
      c.stroke();
      c.fillStyle = 'rgba(255, 255, 255, 0.18)';
      c.fillRect(-hw + 5 * S, -h + 10 * S, 4 * S, h - 24 * S);
      c.fillStyle = '#9a8a6a';
      c.fillRect(-hw - 3 * S, -h - 9 * S, hw * 2 + 6 * S, 10 * S);
    });
  }

  drawBird(c, it) {
    const S = this.S;
    this.withItem(c, it, () => {
      this.shadow(c, 20 * S);
      // Small block stand
      c.fillStyle = '#4a3121';
      c.fillRect(-16 * S, -8 * S, 32 * S, 8 * S);
      // Carved wooden sparrow, bobbing a little
      c.rotate(Math.sin(this.t * 1.4) * 0.03 + it.wob * 0.4);
      const wood = c.createLinearGradient(0, -40 * S, 0, -8 * S);
      wood.addColorStop(0, '#c99a62');
      wood.addColorStop(1, '#8a5f36');
      c.fillStyle = wood;
      c.beginPath();
      c.ellipse(0, -22 * S, 16 * S, 11 * S, -0.2, 0, DK_TAU);
      c.fill();
      c.beginPath();
      c.arc(13 * S, -34 * S, 8 * S, 0, DK_TAU);
      c.fill();
      c.beginPath();
      c.moveTo(-12 * S, -24 * S);
      c.lineTo(-30 * S, -16 * S);
      c.lineTo(-28 * S, -12 * S);
      c.closePath();
      c.fill();
      c.fillStyle = '#5a3a20';
      c.beginPath();
      c.moveTo(20 * S, -35 * S);
      c.lineTo(28 * S, -33 * S);
      c.lineTo(20 * S, -31 * S);
      c.fill();
      c.beginPath();
      c.arc(15 * S, -36 * S, 1.6 * S, 0, DK_TAU);
      c.fill();
      c.strokeStyle = 'rgba(80, 50, 25, 0.5)';
      c.lineWidth = 1.2 * S;
      c.beginPath();
      c.moveTo(-8 * S, -25 * S);
      c.quadraticCurveTo(0, -18 * S, 8 * S, -22 * S);
      c.stroke();
    });
  }

  drawCat(c, it) {
    const S = this.S;
    this.withItem(c, it, () => {
      this.shadow(c, it.hw * 0.95);
      // Velvet cushion
      const g = c.createRadialGradient(0, -16 * S, 4, 0, -12 * S, it.hw);
      g.addColorStop(0, '#9a5f72');
      g.addColorStop(1, '#5e3445');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, -10 * S, it.hw * 0.95, 18 * S, 0, 0, DK_TAU);
      c.fill();
    });
    if (this.cat) {
      this.cat.x = it.x - 6 * S;
      this.cat.floorY = it.y - 16 * S - it.lift * 8 * S;
      this.cat.draw(c, this.dpr, 0);
    }
  }

  drawPlant(c, it) {
    const S = this.S, droop = this.greenhouseThirst * 0.9;
    this.withItem(c, it, () => {
      this.shadow(c, 26 * S);
      // Leaves first, then the pot in front
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.32 + Math.sin(this.t * 0.8 + i) * 0.03;
        const len = (28 + (i % 3) * 10) * S;
        const ax = Math.cos(a) * len * 0.6, ay = -42 * S + Math.sin(a) * len * 0.6;
        c.strokeStyle = '#4f7d39';
        c.lineWidth = 2 * S;
        c.beginPath();
        c.moveTo(0, -42 * S);
        c.lineTo(ax, ay);
        c.stroke();
        c.save();
        c.translate(ax, ay);
        c.rotate(a + (i < 3 ? -1 : 1) * droop * 0.9);
        const lg = c.createLinearGradient(0, -6 * S, 0, 6 * S);
        lg.addColorStop(0, '#8fd06a');
        lg.addColorStop(1, '#3f8a35');
        c.fillStyle = lg;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(10 * S, -7 * S, 20 * S, 0);
        c.quadraticCurveTo(10 * S, 7 * S, 0, 0);
        c.fill();
        c.restore();
      }
      const pg = c.createLinearGradient(-26 * S, 0, 26 * S, 0);
      pg.addColorStop(0, '#9c4f30');
      pg.addColorStop(0.4, '#d27a50');
      pg.addColorStop(1, '#8a4429');
      c.fillStyle = pg;
      c.beginPath();
      c.moveTo(-26 * S, -44 * S);
      c.lineTo(26 * S, -44 * S);
      c.lineTo(19 * S, 0);
      c.lineTo(-19 * S, 0);
      c.closePath();
      c.fill();
      c.fillStyle = '#c56a43';
      c.fillRect(-28 * S, -48 * S, 56 * S, 8 * S);
    });
  }

  drawTicket(c, it) {
    const S = this.S;
    this.withItem(c, it, () => {
      c.rotate(-0.08);
      c.fillStyle = 'rgba(15, 8, 4, 0.3)';
      c.fillRect(-56 * S, -18 * S, 116 * S, 38 * S);
      c.fillStyle = '#efe2c4';
      c.fillRect(-60 * S, -22 * S, 116 * S, 38 * S);
      c.fillStyle = '#b5543f';
      c.fillRect(-60 * S, -22 * S, 116 * S, 9 * S);
      c.strokeStyle = 'rgba(90, 60, 40, 0.5)';
      c.setLineDash([3 * S, 3 * S]);
      c.beginPath();
      c.moveTo(24 * S, -12 * S);
      c.lineTo(24 * S, 16 * S);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#3a2a20';
      c.font = `700 ${Math.round(9 * S)}px ui-serif, Georgia, serif`;
      c.textBaseline = 'middle';
      c.fillText('NIGHT TRAIN', -54 * S, -1 * S);
      c.font = `${Math.round(7 * S)}px ui-sans-serif, system-ui, sans-serif`;
      c.fillText('ADMIT ONE · PLATFORM 2', -54 * S, 9 * S);
      c.fillText('NO 0821', 28 * S, 2 * S);
    });
  }

  drawLampAndMug(c) {
    const S = this.S, L = this.lamp, D = this.deskTop;
    // Notebook and pencil under the lamp
    c.save();
    c.translate(this.w * 0.83, D + 100 * S);
    c.rotate(0.06);
    c.fillStyle = 'rgba(15, 8, 4, 0.3)';
    c.fillRect(-56 * S, -30 * S, 116 * S, 64 * S);
    c.fillStyle = '#e9e1cf';
    c.fillRect(-60 * S, -34 * S, 116 * S, 64 * S);
    c.strokeStyle = 'rgba(120, 140, 170, 0.35)';
    c.lineWidth = 1;
    for (let y = -22; y < 26; y += 8) {
      c.beginPath();
      c.moveTo(-54 * S, y * S);
      c.lineTo(50 * S, y * S);
      c.stroke();
    }
    c.fillStyle = '#e8b04f';
    c.save();
    c.rotate(-0.5);
    c.fillRect(-10 * S, 20 * S, 70 * S, 5 * S);
    c.restore();
    c.restore();
    // Mug
    const mx = this.w * 0.93, my = D + 66 * S;
    c.fillStyle = 'rgba(15, 8, 4, 0.3)';
    c.beginPath();
    c.ellipse(mx + 4 * S, my + 2 * S, 22 * S, 6 * S, 0, 0, DK_TAU);
    c.fill();
    c.fillStyle = '#d9cfc0';
    c.fillRect(mx - 18 * S, my - 40 * S, 36 * S, 40 * S);
    c.strokeStyle = '#d9cfc0';
    c.lineWidth = 4 * S;
    c.beginPath();
    c.ellipse(mx + 20 * S, my - 20 * S, 8 * S, 10 * S, 0, -Math.PI / 2, Math.PI / 2);
    c.stroke();
    c.fillStyle = '#5a3420';
    c.beginPath();
    c.ellipse(mx, my - 40 * S, 17 * S, 3.5 * S, 0, 0, DK_TAU);
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    c.lineWidth = 2.5 * S;
    for (let i = 0; i < 2; i++) {
      c.beginPath();
      c.moveTo(mx + (i - 0.5) * 8 * S, my - 46 * S);
      for (let k = 1; k <= 5; k++) c.lineTo(mx + (i - 0.5) * 8 * S + Math.sin(this.t + k + i * 2) * 5 * S, my - 46 * S - k * 9 * S);
      c.stroke();
    }
    // Anglepoise lamp
    c.strokeStyle = '#2f2c2a';
    c.lineWidth = 6 * S;
    c.lineCap = 'round';
    const elbowX = L.x + 20 * S, elbowY = D - 110 * S;
    c.beginPath();
    c.moveTo(L.x, L.base - 6 * S);
    c.lineTo(elbowX, elbowY);
    c.lineTo(L.headX + 20 * S, L.headY - 10 * S);
    c.stroke();
    c.fillStyle = '#2f2c2a';
    c.beginPath();
    c.ellipse(L.x, L.base, 34 * S, 9 * S, 0, 0, DK_TAU);
    c.fill();
    c.save();
    c.translate(L.headX, L.headY);
    c.rotate(0.5);
    c.fillStyle = '#c65a3a';
    c.beginPath();
    c.moveTo(-14 * S, -20 * S);
    c.lineTo(14 * S, -20 * S);
    c.lineTo(34 * S, 16 * S);
    c.lineTo(-34 * S, 16 * S);
    c.closePath();
    c.fill();
    c.fillStyle = `rgba(255, 236, 190, ${0.2 + this.lampLevel * 0.8})`;
    c.beginPath();
    c.ellipse(0, 16 * S, 32 * S, 6 * S, 0, 0, DK_TAU);
    c.fill();
    c.restore();
  }

  drawLighting(c) {
    const { w, h, S } = this, L = this.lamp, lv = this.lampLevel;
    // Darkness when the lamp is off; warm pool of light when it is on
    c.fillStyle = `rgba(6, 6, 18, ${0.18 + (1 - lv) * 0.5})`;
    c.fillRect(0, 0, w, h);
    c.save();
    c.globalCompositeOperation = 'screen';
    if (lv > 0.01) {
      const px = L.headX - 40 * S, py = this.deskTop + 40 * S;
      const g = c.createRadialGradient(px, py, 10, px, py, Math.max(w, h) * 0.55);
      g.addColorStop(0, `rgba(255, 196, 120, ${0.45 * lv})`);
      g.addColorStop(0.45, `rgba(255, 170, 100, ${0.14 * lv})`);
      g.addColorStop(1, 'rgba(255, 160, 90, 0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
    // The window and the tank light the room a little, more so in the dark
    const W = this.win;
    const wg = c.createRadialGradient(W.x + W.w / 2, W.y + W.h / 2, 10, W.x + W.w / 2, W.y + W.h, W.w);
    wg.addColorStop(0, `rgba(120, 140, 220, ${0.08 + (1 - lv) * 0.08})`);
    wg.addColorStop(1, 'rgba(120, 140, 220, 0)');
    c.fillStyle = wg;
    c.fillRect(0, 0, w, h);
    const tank = this.items.find(i => i.id === 'tank');
    const tg = c.createRadialGradient(tank.x, tank.y - tank.hh / 2, 10, tank.x, tank.y - tank.hh / 2, tank.hw * 3);
    tg.addColorStop(0, `rgba(80, 200, 230, ${0.08 + (1 - lv) * 0.14})`);
    tg.addColorStop(1, 'rgba(80, 200, 230, 0)');
    c.fillStyle = tg;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  draw() {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    const byId = (id) => this.items.find(i => i.id === id);
    this.drawRoom(c);
    this.drawWindow(c, byId('window'));
    this.drawJar(c, byId('jar'));
    this.drawBird(c, byId('bird'));
    this.drawPlant(c, byId('plant'));
    this.drawTank(c, byId('tank'));
    this.drawLampAndMug(c);
    this.drawCat(c, byId('cat'));
    this.drawTicket(c, byId('ticket'));
    this.drawLighting(c);
    // The jar and tank glow through the darkness
    if (this.lampLevel < 0.99) {
      c.save();
      c.globalAlpha = 1 - this.lampLevel;
      c.globalCompositeOperation = 'lighter';
      this.drawJarGlowOnly(c, byId('jar'));
      c.restore();
    }
    // Hover ring under the object
    const it = this.hovered;
    if (it && it.lift > 0.05) {
      c.strokeStyle = `rgba(255, 230, 180, ${0.35 * it.lift})`;
      c.lineWidth = 2 * this.S;
      c.beginPath();
      c.ellipse(it.x, it.y + 2 * this.S, it.hw * 1.05, 10 * this.S, 0, 0, DK_TAU);
      c.stroke();
    }
  }

  drawJarGlowOnly(c, it) {
    const S = this.S, h = it.hh - 10 * S;
    for (const f of this.flies) {
      const b = Math.pow(Math.max(0, Math.sin(this.t * 3.1 + f.off * 30)), 6);
      const fx = it.x - it.hw + f.u * it.hw * 2, fy = it.y - h + f.v * h - it.lift * 8 * S;
      const r = (4 + b * 8) * S;
      const fg = c.createRadialGradient(fx, fy, 0, fx, fy, r);
      fg.addColorStop(0, `rgba(240, 255, 170, ${0.3 + b * 0.7})`);
      fg.addColorStop(1, 'rgba(240, 255, 170, 0)');
      c.fillStyle = fg;
      c.fillRect(fx - r, fy - r, r * 2, r * 2);
    }
  }
}

window.DeskWorld = DeskWorld;
window.DESK_ITEMS = DESK_ITEMS;
