/**
 * toys.js - Treats, the yarn ball, the laser dot and floating effects
 */

class Treat {
  constructor(x, y, s) {
    this.x = x;
    this.y = y;
    this.s = s;
    this.vy = 0;
    this.rot = (Math.random() - 0.5) * 0.6;
    this.landed = false;
    this.claimed = false;
  }

  update(dt, floorY) {
    if (this.landed) return;
    this.vy += 1900 * this.s * dt;
    this.y += this.vy * dt;
    const rest = floorY - 4 * this.s;
    if (this.y >= rest) {
      this.y = rest;
      if (this.vy > 260 * this.s) {
        this.vy *= -0.3;
        if (window.soundManager) window.soundManager.playTreatLand();
      } else {
        this.vy = 0;
        this.landed = true;
      }
    }
  }

  draw(ctx) {
    const s = this.s;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.scale(s, s);
    // Little fish-shaped biscuit
    ctx.fillStyle = '#b8743c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.moveTo(-7, 0);
    ctx.lineTo(-14, -5);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 220, 170, 0.5)';
    ctx.beginPath();
    ctx.ellipse(1, -2, 5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3418';
    ctx.beginPath();
    ctx.arc(5, -1, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Yarn {
  constructor(x, y, s) {
    this.s = s;
    this.r = 20 * s;
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 300 * s;
    this.vy = 0;
    this.rot = 0;
    this.trail = [];
    this.trailTimer = 0;
    this.lastTouched = 0;
    this.color = ['#e07a8a', '#7fb0d8', '#e8b04f'][Math.floor(Math.random() * 3)];
  }

  get moving() {
    return Math.abs(this.vx) > 12 * this.s || Math.abs(this.vy) > 30 * this.s;
  }

  hit(px, py) {
    return Math.hypot(px - this.x, py - this.y) < this.r * 2.2;
  }

  push(vx, vy, now) {
    this.vx = vx;
    this.vy = vy;
    this.lastTouched = now;
  }

  update(dt, floorY, w) {
    const s = this.s;
    this.vy += 2000 * s * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const rest = floorY - this.r + 4 * s;
    if (this.y > rest) {
      this.y = rest;
      if (this.vy > 120 * s) {
        if (this.vy > 380 * s && window.soundManager) window.soundManager.playYarnBounce();
        this.vy *= -0.42;
      } else {
        this.vy = 0;
      }
      this.vx *= Math.exp(-1.5 * dt); // rolling friction
    }
    if (this.x < this.r) { this.x = this.r; this.vx = Math.abs(this.vx) * 0.6; }
    if (this.x > w - this.r) { this.x = w - this.r; this.vx = -Math.abs(this.vx) * 0.6; }
    this.rot += (this.vx * dt) / this.r;

    // Loose strand: remember where the ball has rolled
    this.trailTimer += dt;
    if (this.trailTimer > 0.04) {
      this.trailTimer = 0;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 22) this.trail.shift();
    }
  }

  draw(ctx, floorY) {
    const { x, y, r, s } = this;
    // Strand trailing on the floor
    if (this.trail.length > 2) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      const pts = this.trail.slice(-14).map((p, i, arr) => ({
        x: p.x, y: Math.min(floorY - 1.5 * s, p.y + r) + Math.sin(i * 1.3) * 1.5 * s
      }));
      ctx.moveTo(x, Math.min(floorY - 2 * s, y + r * 0.7));
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(x, y);
    // Contact shadow
    ctx.fillStyle = 'rgba(40, 25, 15, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, floorY - y - 1, r * 0.9, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(this.rot);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    g.addColorStop(0.3, this.color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = g;
    ctx.fill();

    // Wound strands
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.lineWidth = 1.2 * s;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.05, r * (0.25 + i * 0.12), i * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }
}

/** Floating hearts and Zzz's. */
class FloatFx {
  constructor(kind, x, y, s) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.s = s;
    this.vx = (Math.random() - 0.5) * 16 * s;
    this.vy = -(26 + Math.random() * 14) * s;
    this.life = 0;
    this.max = kind === 'z' ? 2.8 : 1.8;
    this.size = kind === 'z' ? 12 + Math.random() * 6 : 8 + Math.random() * 4;
  }

  update(dt) {
    this.life += dt;
    this.x += this.vx * dt + Math.sin(this.life * 3) * 0.3;
    this.y += this.vy * dt;
    return this.life < this.max;
  }

  draw(ctx) {
    const u = this.life / this.max;
    const a = Math.sin(Math.PI * Math.min(1, u * 1.1)) * 0.9;
    const sz = this.size * this.s * (0.7 + u * 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.x, this.y);
    if (this.kind === 'z') {
      ctx.fillStyle = '#eef2ff';
      ctx.font = `600 ${sz.toFixed(1)}px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('z', 0, 0);
    } else {
      ctx.fillStyle = '#ff7a9c';
      ctx.beginPath();
      ctx.moveTo(0, sz * 0.35);
      ctx.bezierCurveTo(-sz, -sz * 0.3, -sz * 0.45, -sz, 0, -sz * 0.45);
      ctx.bezierCurveTo(sz * 0.45, -sz, sz, -sz * 0.3, 0, sz * 0.35);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawLaserDot(ctx, x, y, t, strong) {
  const pulse = 1 + Math.sin(t * 18) * 0.12;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 22 * pulse);
  glow.addColorStop(0, `rgba(255, 40, 40, ${strong ? 0.6 : 0.4})`);
  glow.addColorStop(1, 'rgba(255, 40, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff2b2b';
  ctx.beginPath();
  ctx.arc(x, y, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 230, 230, 0.9)';
  ctx.beginPath();
  ctx.arc(x - 0.8, y - 0.8, 1.3, 0, Math.PI * 2);
  ctx.fill();
}
