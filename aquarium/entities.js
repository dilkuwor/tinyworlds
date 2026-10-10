/**
 * entities.js - Visual Entities for Aquarium Simulation
 * Procedural rendering and physics for Fish, Jellyfish, Sea Turtle, Crab, Flora, Bubbles, and Food.
 */

// Utility helpers
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// ==========================================
// 1. BUBBLES
// ==========================================
class Bubble {
  constructor(x, y, radius = 3 + Math.random() * 6, vy = 1 + Math.random() * 2) {
    this.x = x;
    this.y = y;
    this.initialX = x;
    this.r = radius;
    this.vy = vy;
    this.wobbleFreq = 0.05 + Math.random() * 0.08;
    this.wobbleAmp = 2 + Math.random() * 4;
    this.phase = Math.random() * Math.PI * 2;
    this.popped = false;
    this.popProgress = 0;
  }

  update(waterLine, time) {
    if (this.popped) {
      this.popProgress += 0.15;
      return this.popProgress < 1;
    }

    this.y -= this.vy;
    this.x = this.initialX + Math.sin(time * this.wobbleFreq + this.phase) * this.wobbleAmp;

    if (this.y <= waterLine + this.r) {
      this.popped = true;
      if (Math.random() < 0.25 && window.soundManager) {
        window.soundManager.playBubble(1.2);
      }
    }
    return true;
  }

  draw(ctx, isNight) {
    ctx.save();
    if (this.popped) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * (1 + this.popProgress * 1.5), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(180, 235, 255, ${Math.max(0, 1 - this.popProgress)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      
      const grad = ctx.createRadialGradient(
        this.x - this.r * 0.35, this.y - this.r * 0.35, this.r * 0.1,
        this.x, this.y, this.r
      );
      
      if (isNight) {
        grad.addColorStop(0, 'rgba(150, 240, 255, 0.8)');
        grad.addColorStop(0.7, 'rgba(40, 160, 220, 0.3)');
        grad.addColorStop(1, 'rgba(0, 180, 255, 0.6)');
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        grad.addColorStop(0.65, 'rgba(200, 245, 255, 0.25)');
        grad.addColorStop(1, 'rgba(140, 220, 255, 0.6)');
      }

      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = isNight ? 'rgba(100, 220, 255, 0.6)' : 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Glint highlight
      ctx.beginPath();
      ctx.arc(this.x - this.r * 0.35, this.y - this.r * 0.35, this.r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
    }
    ctx.restore();
  }
}

// ==========================================
// 2. FISH FOOD
// ==========================================
class Food {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 3 + Math.random() * 2.5;
    this.vy = 0.7 + Math.random() * 0.6;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.color = ['#ff8438', '#ffb703', '#d90429', '#e07a5f', '#80b918'][Math.floor(Math.random() * 5)];
    this.eaten = false;
    this.age = 0;
  }

  update(seabedY) {
    this.age++;
    if (this.eaten) return false;

    if (this.y < seabedY - this.r) {
      this.y += this.vy;
      this.x += this.vx + Math.sin(this.age * 0.08 + this.wobblePhase) * 0.3;
    } else {
      // Settles gently on the bottom sand
      this.y = seabedY - this.r;
    }

    // Food dissolves after 40 seconds if untouched
    return this.age < 2400;
  }

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 4;
    ctx.fill();

    // Flake texture spec
    ctx.beginPath();
    ctx.arc(this.x - 1, this.y - 1, this.r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
    ctx.restore();
  }
}

// ==========================================
// 3. FLORA & SEAWEED (PLANTS)
// ==========================================
class Plant {
  constructor(x, baseY, height = 180 + Math.random() * 120, segments = 8, colorType = 'green') {
    this.x = x;
    this.baseY = baseY;
    this.height = height;
    this.segments = segments;
    this.segmentLen = height / segments;
    this.colorType = colorType; // 'green', 'coral', 'anemone'
    this.phase = Math.random() * Math.PI * 2;
    this.swaySpeed = 0.015 + Math.random() * 0.015;
    this.maxSway = 14 + Math.random() * 16;
  }

  draw(ctx, time, isNight) {
    ctx.save();
    const segs = [];
    let curX = this.x;
    let curY = this.baseY;
    segs.push({ x: curX, y: curY });

    for (let i = 1; i <= this.segments; i++) {
      const swayOffset = Math.sin(time * this.swaySpeed + i * 0.35 + this.phase) * (this.maxSway * (i / this.segments));
      curX = this.x + swayOffset;
      curY = this.baseY - i * this.segmentLen;
      segs.push({ x: curX, y: curY });
    }

    if (this.colorType === 'coral') {
      // Fan coral style
      ctx.strokeStyle = isNight ? '#9d4edd' : '#e76f51';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(segs[0].x, segs[0].y);
      for (let i = 1; i < segs.length; i++) {
        const xc = (segs[i - 1].x + segs[i].x) / 2;
        const yc = (segs[i - 1].y + segs[i].y) / 2;
        ctx.quadraticCurveTo(segs[i - 1].x, segs[i - 1].y, xc, yc);
      }
      ctx.stroke();

      // Branching coral twigs
      for (let i = 2; i < segs.length; i += 2) {
        ctx.beginPath();
        const side = i % 4 === 0 ? 1 : -1;
        ctx.moveTo(segs[i].x, segs[i].y);
        ctx.quadraticCurveTo(segs[i].x + 20 * side, segs[i].y - 10, segs[i].x + 35 * side, segs[i].y - 20);
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
    } else {
      // Lush ribbon kelp / seaweed with leaves
      const grad = ctx.createLinearGradient(this.x, this.baseY, this.x, this.baseY - this.height);
      if (isNight) {
        grad.addColorStop(0, '#0f4c3a');
        grad.addColorStop(0.5, '#137547');
        grad.addColorStop(1, '#25a244');
      } else {
        grad.addColorStop(0, '#19532d');
        grad.addColorStop(0.5, '#2d7f36');
        grad.addColorStop(1, '#5db347');
      }

      ctx.strokeStyle = grad;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(segs[0].x, segs[0].y);
      for (let i = 1; i < segs.length - 1; i++) {
        const xc = (segs[i].x + segs[i + 1].x) / 2;
        const yc = (segs[i].y + segs[i + 1].y) / 2;
        ctx.quadraticCurveTo(segs[i].x, segs[i].y, xc, yc);
      }
      ctx.quadraticCurveTo(
        segs[segs.length - 1].x, segs[segs.length - 1].y,
        segs[segs.length - 1].x, segs[segs.length - 1].y
      );
      ctx.stroke();

      // Fronds / leaves along stem
      for (let i = 2; i < segs.length; i += 2) {
        const leafSide = i % 4 === 0 ? 1 : -1;
        const lx = segs[i].x;
        const ly = segs[i].y;
        const leafLen = 22 + (i / this.segments) * 8;
        const tipX = lx + leafSide * leafLen;
        const tipY = ly - 10 + Math.sin(time * this.swaySpeed + i) * 5;

        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.quadraticCurveTo(lx + leafSide * (leafLen * 0.6), ly - 15, tipX, tipY);
        ctx.quadraticCurveTo(lx + leafSide * (leafLen * 0.4), ly + 5, lx, ly);
        ctx.fillStyle = isNight ? 'rgba(37, 162, 68, 0.7)' : 'rgba(93, 179, 71, 0.85)';
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

// ==========================================
// 4. FISH (SPECIES-SPECIFIC PROCEDURAL DRAWING)
// ==========================================
class Fish {
  constructor(species, x, y, bounds) {
    this.species = species; // 'clownfish', 'bluetang', 'angelfish', 'yellowtang'
    this.x = x;
    this.y = y;
    this.bounds = bounds;

    // Movement params
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 1;
    this.targetX = x + (Math.random() - 0.5) * 400;
    this.targetY = y + (Math.random() - 0.5) * 200;
    this.heading = this.vx >= 0 ? 0 : Math.PI;
    this.angle = 0;

    // Species configurations
    const configs = {
      clownfish: {
        size: 34,
        maxSpeed: 2.2,
        tailSpeed: 0.18,
        colors: { body: '#ff6b1a', stripes: '#ffffff', outline: '#1a1a1a', fin: '#ff8838' },
        name: 'Clownfish'
      },
      bluetang: {
        size: 40,
        maxSpeed: 2.5,
        tailSpeed: 0.16,
        colors: { body: '#1f65d6', pattern: '#0f172a', tail: '#ffdd00', belly: '#2575fc' },
        name: 'Blue Tang'
      },
      angelfish: {
        size: 46,
        maxSpeed: 1.8,
        tailSpeed: 0.12,
        colors: { body: '#e0e6ed', stripes: '#1e293b', accent: '#ffb703', fin: 'rgba(255,255,255,0.7)' },
        name: 'Angelfish'
      },
      yellowtang: {
        size: 36,
        maxSpeed: 2.3,
        tailSpeed: 0.17,
        colors: { body: '#ffd000', fin: '#ffe047', accent: '#ffffff' },
        name: 'Yellow Tang'
      }
    };

    this.cfg = configs[species] || configs.clownfish;
    this.size = this.cfg.size * (0.85 + Math.random() * 0.3);
    this.maxSpeed = this.cfg.maxSpeed * (0.9 + Math.random() * 0.2);
    
    // Internal state
    this.tailPhase = Math.random() * Math.PI * 2;
    this.hungerTimer = Math.random() * 200;
    this.isHungry = false;
    this.state = 'wander'; // 'wander', 'seeking_food', 'startled'
    this.startleTimer = 0;
    this.mouthBubbleTimer = Math.random() * 500;
  }

  update(foods, time, spawnBubbleCallback) {
    this.hungerTimer++;
    this.mouthBubbleTimer++;

    // Spontaneous bubble from mouth
    if (this.mouthBubbleTimer > 600 && Math.random() < 0.008) {
      this.mouthBubbleTimer = 0;
      if (spawnBubbleCallback) {
        const mouthX = this.x + Math.cos(this.heading) * (this.size * 0.8);
        const mouthY = this.y + Math.sin(this.heading) * (this.size * 0.8);
        spawnBubbleCallback(mouthX, mouthY, 2.5 + Math.random() * 2);
      }
    }

    if (this.hungerTimer > 300) this.isHungry = true;

    // Handle states
    if (this.startleTimer > 0) {
      this.startleTimer--;
      if (this.startleTimer <= 0) this.state = 'wander';
    } else if (this.isHungry && foods.length > 0) {
      // Seek nearest food
      let nearestFood = null;
      let minDist = 350;
      for (const food of foods) {
        if (!food.eaten) {
          const d = dist(this.x, this.y, food.x, food.y);
          if (d < minDist) {
            minDist = d;
            nearestFood = food;
          }
        }
      }

      if (nearestFood) {
        this.state = 'seeking_food';
        this.targetX = nearestFood.x;
        this.targetY = nearestFood.y;

        // Eat food if close enough
        if (minDist < this.size * 0.6) {
          nearestFood.eaten = true;
          this.isHungry = false;
          this.hungerTimer = 0;
          this.state = 'wander';
          if (window.soundManager) window.soundManager.playFeed();
          if (spawnBubbleCallback) {
            spawnBubbleCallback(this.x, this.y - 10, 3);
          }
        }
      } else {
        this.state = 'wander';
      }
    } else {
      this.state = 'wander';
    }

    // Wander behavior: pick new target when close or randomly
    if (this.state === 'wander') {
      if (dist(this.x, this.y, this.targetX, this.targetY) < 60 || Math.random() < 0.015) {
        this.targetX = this.bounds.left + Math.random() * (this.bounds.right - this.bounds.left);
        this.targetY = this.bounds.top + 40 + Math.random() * (this.bounds.bottom - this.bounds.top - 100);
      }
    }

    // Steering calculation
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distanceToTarget = Math.hypot(dx, dy);

    let desiredVx = (dx / (distanceToTarget || 1)) * this.maxSpeed;
    let desiredVy = (dy / (distanceToTarget || 1)) * (this.maxSpeed * 0.7);

    if (this.state === 'startled') {
      desiredVx *= 2.0;
      desiredVy *= 1.6;
    }

    // Smooth velocity steering
    const steerStrength = this.state === 'startled' ? 0.12 : 0.04;
    this.vx = lerp(this.vx, desiredVx, steerStrength);
    this.vy = lerp(this.vy, desiredVy, steerStrength);

    // Bound repulsive forces
    const margin = 80;
    if (this.x < this.bounds.left + margin) this.vx += 0.2;
    if (this.x > this.bounds.right - margin) this.vx -= 0.2;
    if (this.y < this.bounds.top + 60) this.vy += 0.2;
    if (this.y > this.bounds.bottom - margin) this.vy -= 0.2;

    this.x += this.vx;
    this.y += this.vy;

    // Heading and orientation
    const currentSpeed = Math.hypot(this.vx, this.vy);
    const targetHeading = Math.atan2(this.vy, this.vx);

    // Direction facing
    this.isFacingRight = this.vx >= 0;

    // Angle tilt based on vertical movement
    this.angle = lerp(this.angle, Math.sin(targetHeading) * 0.25, 0.1);

    // Tail oscillation speed increases with swimming speed
    const tailSpeedFactor = (currentSpeed / this.maxSpeed) * 1.5 + 0.5;
    this.tailPhase += this.cfg.tailSpeed * tailSpeedFactor;
  }

  startle(sourceX, sourceY) {
    const angleAway = Math.atan2(this.y - sourceY, this.x - sourceX);
    this.vx = Math.cos(angleAway) * (this.maxSpeed * 2.2);
    this.vy = Math.sin(angleAway) * (this.maxSpeed * 1.8);
    this.targetX = this.x + this.vx * 30;
    this.targetY = this.y + this.vy * 30;
    this.state = 'startled';
    this.startleTimer = 45;
  }

  draw(ctx, isNight) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (!this.isFacingRight) {
      ctx.scale(-1, 1);
    }

    const tailWag = Math.sin(this.tailPhase);
    const s = this.size;

    switch (this.species) {
      case 'clownfish':
        this.drawClownfish(ctx, s, tailWag, isNight);
        break;
      case 'bluetang':
        this.drawBlueTang(ctx, s, tailWag, isNight);
        break;
      case 'angelfish':
        this.drawAngelfish(ctx, s, tailWag, isNight);
        break;
      case 'yellowtang':
        this.drawYellowTang(ctx, s, tailWag, isNight);
        break;
      default:
        this.drawClownfish(ctx, s, tailWag, isNight);
    }

    ctx.restore();
  }

  drawClownfish(ctx, s, tailWag, isNight) {
    const halfH = s * 0.38;

    // 1. Tail fin
    ctx.save();
    ctx.translate(-s * 0.45, 0);
    ctx.rotate(tailWag * 0.25);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.3, -s * 0.4, -s * 0.22);
    ctx.quadraticCurveTo(-s * 0.32, 0, -s * 0.4, s * 0.22);
    ctx.quadraticCurveTo(-s * 0.3, s * 0.3, 0, 0);
    ctx.fillStyle = this.cfg.colors.fin;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#111';
    ctx.stroke();

    // White rim on caudal fin
    ctx.beginPath();
    ctx.arc(-s * 0.35, 0, s * 0.15, -Math.PI / 2, Math.PI / 2, true);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // 2. Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -halfH * 0.7);
    ctx.quadraticCurveTo(0, -halfH * 1.5, s * 0.2, -halfH * 0.5);
    ctx.quadraticCurveTo(0, -halfH * 0.8, -s * 0.2, -halfH * 0.7);
    ctx.fillStyle = this.cfg.colors.fin;
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 3. Ventral / Anal fin
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, halfH * 0.6);
    ctx.quadraticCurveTo(0, halfH * 1.4, s * 0.15, halfH * 0.4);
    ctx.quadraticCurveTo(0, halfH * 0.7, -s * 0.15, halfH * 0.6);
    ctx.fillStyle = this.cfg.colors.fin;
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4. Main Body
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, 0);
    ctx.bezierCurveTo(-s * 0.25, -halfH * 1.2, s * 0.25, -halfH * 1.1, s * 0.5, 0);
    ctx.bezierCurveTo(s * 0.25, halfH * 1.1, -s * 0.25, halfH * 1.2, -s * 0.45, 0);
    ctx.fillStyle = this.cfg.colors.body;
    ctx.fill();

    // 5. White Vertical Stripes with Black Borders
    const drawStripe = (centerX, width, topH, botH) => {
      ctx.beginPath();
      ctx.moveTo(centerX - width * 0.5, -topH);
      ctx.quadraticCurveTo(centerX + 3, 0, centerX - width * 0.5, botH);
      ctx.lineTo(centerX + width * 0.5, botH);
      ctx.quadraticCurveTo(centerX + width * 0.5 + 3, 0, centerX + width * 0.5, -topH);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#111';
      ctx.stroke();
    };

    drawStripe(s * 0.18, s * 0.12, halfH * 0.85, halfH * 0.85); // Head stripe
    drawStripe(-s * 0.05, s * 0.14, halfH * 1.05, halfH * 1.05); // Mid stripe
    drawStripe(-s * 0.35, s * 0.09, halfH * 0.65, halfH * 0.65); // Tail stripe

    // 6. Eye & Pupil
    const eyeX = s * 0.32;
    const eyeY = -halfH * 0.22;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, s * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9900';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + 1, eyeY, s * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + 1.8, eyeY - 1, s * 0.02, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // 7. Pectoral Fin (waving)
    ctx.save();
    ctx.translate(s * 0.05, halfH * 0.2);
    ctx.rotate(tailWag * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.14, s * 0.08, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 140, 50, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  drawBlueTang(ctx, s, tailWag, isNight) {
    const halfH = s * 0.42;

    // Tail fin (distinct yellow triangle wedge)
    ctx.save();
    ctx.translate(-s * 0.42, 0);
    ctx.rotate(tailWag * 0.28);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.35, -s * 0.28);
    ctx.quadraticCurveTo(-s * 0.28, 0, -s * 0.35, s * 0.28);
    ctx.closePath();
    ctx.fillStyle = '#ffd000';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // Body
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, 0);
    ctx.bezierCurveTo(-s * 0.25, -halfH * 1.15, s * 0.2, -halfH * 1.1, s * 0.48, -halfH * 0.1);
    ctx.bezierCurveTo(s * 0.3, halfH * 1.1, -s * 0.25, halfH * 1.15, -s * 0.42, 0);
    ctx.fillStyle = isNight ? '#164db0' : '#1f65d6';
    ctx.fill();

    // Black iconic palette pattern on flank
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -halfH * 0.7);
    ctx.bezierCurveTo(-s * 0.2, -halfH * 0.9, -s * 0.38, -halfH * 0.4, -s * 0.4, 0);
    ctx.bezierCurveTo(-s * 0.38, halfH * 0.4, -s * 0.2, halfH * 0.75, 0, halfH * 0.5);
    ctx.bezierCurveTo(s * 0.15, halfH * 0.3, s * 0.1, 0, -s * 0.1, 0);
    ctx.bezierCurveTo(-s * 0.2, 0, -s * 0.2, -halfH * 0.4, s * 0.1, -halfH * 0.7);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Dorsal & Ventral edges
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eye
    const eyeX = s * 0.32;
    const eyeY = -halfH * 0.22;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, s * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + 1, eyeY, s * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + 1.8, eyeY - 1, s * 0.018, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Yellow Pectoral fin
    ctx.save();
    ctx.translate(s * 0.05, halfH * 0.15);
    ctx.rotate(tailWag * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.14, s * 0.08, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd000';
    ctx.fill();
    ctx.restore();
  }

  drawAngelfish(ctx, s, tailWag, isNight) {
    const halfH = s * 0.65;

    // Tail fin
    ctx.save();
    ctx.translate(-s * 0.38, 0);
    ctx.rotate(tailWag * 0.22);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.28, -s * 0.25);
    ctx.lineTo(-s * 0.22, 0);
    ctx.lineTo(-s * 0.28, s * 0.25);
    ctx.closePath();
    ctx.fillStyle = 'rgba(230, 240, 255, 0.85)';
    ctx.fill();
    ctx.restore();

    // High Arched Dorsal Fin (Graceful needle shape)
    ctx.beginPath();
    ctx.moveTo(0, -halfH * 0.4);
    ctx.quadraticCurveTo(-s * 0.1, -halfH * 1.5, -s * 0.4, -halfH * 1.8);
    ctx.quadraticCurveTo(-s * 0.18, -halfH * 0.9, -s * 0.25, -halfH * 0.2);
    ctx.fillStyle = isNight ? 'rgba(255, 200, 50, 0.8)' : '#ffe169';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Long Pelvic Fin Filaments
    ctx.beginPath();
    ctx.moveTo(s * 0.05, halfH * 0.4);
    ctx.quadraticCurveTo(0, halfH * 1.4, -s * 0.15, halfH * 2.0);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Diamond Body
    ctx.beginPath();
    ctx.moveTo(s * 0.4, 0);
    ctx.lineTo(0, -halfH * 0.6);
    ctx.lineTo(-s * 0.38, 0);
    ctx.lineTo(0, halfH * 0.6);
    ctx.closePath();

    const bodyGrad = ctx.createLinearGradient(-s * 0.3, 0, s * 0.4, 0);
    bodyGrad.addColorStop(0, '#cbd5e1');
    bodyGrad.addColorStop(0.5, '#f8fafc');
    bodyGrad.addColorStop(1, '#fde047');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Vertical black stripes
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -halfH * 0.4);
    ctx.lineTo(s * 0.15, halfH * 0.4);
    ctx.moveTo(-s * 0.05, -halfH * 0.55);
    ctx.lineTo(-s * 0.05, halfH * 0.55);
    ctx.moveTo(-s * 0.22, -halfH * 0.3);
    ctx.lineTo(-s * 0.22, halfH * 0.3);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Eye
    const eyeX = s * 0.24;
    const eyeY = -halfH * 0.15;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, s * 0.065, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + 0.8, eyeY, s * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
  }

  drawYellowTang(ctx, s, tailWag, isNight) {
    const halfH = s * 0.45;

    // Tail fin
    ctx.save();
    ctx.translate(-s * 0.4, 0);
    ctx.rotate(tailWag * 0.28);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.25, -s * 0.25, -s * 0.32, -s * 0.2);
    ctx.quadraticCurveTo(-s * 0.25, 0, -s * 0.32, s * 0.2);
    ctx.quadraticCurveTo(-s * 0.25, s * 0.25, 0, 0);
    ctx.fillStyle = '#ffe047';
    ctx.fill();
    ctx.restore();

    // Oval body
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, 0);
    ctx.bezierCurveTo(-s * 0.2, -halfH * 1.25, s * 0.2, -halfH * 1.25, s * 0.42, 0);
    ctx.bezierCurveTo(s * 0.2, halfH * 1.25, -s * 0.2, halfH * 1.25, -s * 0.4, 0);
    ctx.fillStyle = isNight ? '#eab308' : '#ffd000';
    ctx.fill();

    // White scalpel spine near tail
    ctx.beginPath();
    ctx.ellipse(-s * 0.28, 0, s * 0.06, s * 0.02, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Dorsal & Ventral subtle fin ridge
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Eye
    const eyeX = s * 0.28;
    const eyeY = -halfH * 0.18;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, s * 0.065, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + 0.8, eyeY, s * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    // Pectoral fin
    ctx.save();
    ctx.translate(s * 0.04, halfH * 0.1);
    ctx.rotate(tailWag * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.12, s * 0.07, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 235, 100, 0.85)';
    ctx.fill();
    ctx.restore();
  }
}

// ==========================================
// 5. JELLYFISH (PULSING & TENTACLE PHYSICS)
// ==========================================
class Jellyfish {
  constructor(x, y, bounds) {
    this.x = x;
    this.y = y;
    this.bounds = bounds;
    this.radius = 26 + Math.random() * 14;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.vy = -0.4;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.tentaclesCount = 7;
    this.tentacles = [];

    // Initialize tentacle joint points for organic trailing physics
    for (let i = 0; i < this.tentaclesCount; i++) {
      const joints = [];
      const len = 12;
      for (let j = 0; j < len; j++) {
        joints.push({ x: this.x, y: this.y + j * 6 });
      }
      this.tentacles.push(joints);
    }
  }

  update(time) {
    this.pulsePhase += 0.045;
    const pulseFactor = Math.sin(this.pulsePhase);

    // Propel upward during bell contraction, drift down during expansion
    if (pulseFactor > 0.4) {
      this.vy = -1.1 * pulseFactor;
    } else {
      this.vy = 0.35;
    }

    this.y += this.vy;
    this.x += this.vx + Math.sin(time * 0.02) * 0.4;

    // Bound wrap / bounce
    if (this.y < this.bounds.top + 70) {
      this.vy = 0.5;
    }
    if (this.y > this.bounds.bottom - 120) {
      this.vy = -1.0;
    }
    if (this.x < this.bounds.left + 50) this.vx = 0.3;
    if (this.x > this.bounds.right - 50) this.vx = -0.3;

    // Update tentacle joints
    const contraction = Math.max(0.7, 1 - Math.max(0, pulseFactor) * 0.3);
    const spacing = (this.radius * 1.6 * contraction) / (this.tentaclesCount - 1);
    const startX = this.x - (this.radius * 0.8 * contraction);

    for (let i = 0; i < this.tentaclesCount; i++) {
      const joints = this.tentacles[i];
      const rootX = startX + i * spacing;
      const rootY = this.y + this.radius * 0.2;

      joints[0].x = rootX;
      joints[0].y = rootY;

      for (let j = 1; j < joints.length; j++) {
        const prev = joints[j - 1];
        const cur = joints[j];

        // Lag and sine wave oscillation
        const targetX = prev.x + Math.sin(time * 0.05 + i + j * 0.4) * 2;
        const targetY = prev.y + 6;

        cur.x = lerp(cur.x, targetX, 0.25);
        cur.y = lerp(cur.y, targetY, 0.3);
      }
    }
  }

  draw(ctx, isNight) {
    ctx.save();
    const pulse = Math.sin(this.pulsePhase);
    const contractionX = Math.max(0.75, 1 - Math.max(0, pulse) * 0.28);
    const elongationY = 1 + Math.max(0, pulse) * 0.22;
    const r = this.radius;

    // Glowing effect in night mode
    if (isNight) {
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 18;
    }

    // 1. Draw trailing tentacles
    for (let i = 0; i < this.tentacles.length; i++) {
      const joints = this.tentacles[i];
      ctx.beginPath();
      ctx.moveTo(joints[0].x, joints[0].y);
      for (let j = 1; j < joints.length; j++) {
        ctx.lineTo(joints[j].x, joints[j].y);
      }
      ctx.strokeStyle = isNight ? 'rgba(0, 242, 254, 0.6)' : 'rgba(255, 140, 210, 0.5)';
      ctx.lineWidth = i % 2 === 0 ? 1.5 : 1.0;
      ctx.stroke();
    }

    // 2. Translucent Bell Dome
    ctx.translate(this.x, this.y);
    ctx.scale(contractionX, elongationY);

    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r, -r * 1.35, r, -r * 1.35, r, 0);
    // Scalloped ruffled rim
    ctx.quadraticCurveTo(r * 0.6, r * 0.15, r * 0.3, 0);
    ctx.quadraticCurveTo(0, r * 0.2, -r * 0.3, 0);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.15, -r, 0);
    ctx.closePath();

    const bellGrad = ctx.createRadialGradient(0, -r * 0.4, r * 0.1, 0, -r * 0.2, r);
    if (isNight) {
      bellGrad.addColorStop(0, 'rgba(0, 255, 230, 0.85)');
      bellGrad.addColorStop(0.5, 'rgba(0, 180, 255, 0.55)');
      bellGrad.addColorStop(1, 'rgba(100, 50, 255, 0.25)');
    } else {
      bellGrad.addColorStop(0, 'rgba(255, 220, 240, 0.8)');
      bellGrad.addColorStop(0.6, 'rgba(255, 120, 190, 0.45)');
      bellGrad.addColorStop(1, 'rgba(180, 100, 255, 0.2)');
    }

    ctx.fillStyle = bellGrad;
    ctx.fill();
    ctx.strokeStyle = isNight ? 'rgba(150, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Inner glowing organ rings
    ctx.beginPath();
    ctx.arc(0, -r * 0.35, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = isNight ? 'rgba(0, 255, 200, 0.4)' : 'rgba(255, 180, 220, 0.35)';
    ctx.fill();

    ctx.restore();
  }
}

// ==========================================
// 6. SEA TURTLE (MAJESTIC GLIDER)
// ==========================================
class SeaTurtle {
  constructor(x, y, bounds) {
    this.x = x;
    this.y = y;
    this.bounds = bounds;
    this.vx = 0.9;
    this.vy = 0.1;
    this.flipperPhase = 0;
    this.size = 52;
    this.isFacingRight = true;
  }

  update(time) {
    this.flipperPhase += 0.04;
    this.x += this.vx;
    this.y += Math.sin(time * 0.015) * 0.4;

    // Reverse direction at edges
    if (this.x > this.bounds.right + 100) {
      this.vx = -Math.abs(this.vx);
      this.isFacingRight = false;
      this.y = this.bounds.top + 80 + Math.random() * (this.bounds.bottom - this.bounds.top - 250);
    } else if (this.x < this.bounds.left - 100) {
      this.vx = Math.abs(this.vx);
      this.isFacingRight = true;
      this.y = this.bounds.top + 80 + Math.random() * (this.bounds.bottom - this.bounds.top - 250);
    }
  }

  draw(ctx, isNight) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (!this.isFacingRight) {
      ctx.scale(-1, 1);
    }

    const s = this.size;
    const flipperAngle = Math.sin(this.flipperPhase) * 0.45;

    // 1. Back flippers
    ctx.save();
    ctx.translate(-s * 0.5, s * 0.2);
    ctx.rotate(flipperAngle * 0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.2, s * 0.09, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fillStyle = '#2b704c';
    ctx.fill();
    ctx.restore();

    // 2. Far Front Flipper (drawn behind shell)
    ctx.save();
    ctx.translate(s * 0.25, -s * 0.25);
    ctx.rotate(-flipperAngle);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.25, s * 0.45, s * 0.13, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1e5235';
    ctx.fill();
    ctx.restore();

    // 3. Head & Neck
    ctx.beginPath();
    ctx.moveTo(s * 0.5, 0);
    ctx.quadraticCurveTo(s * 0.7, -s * 0.05, s * 0.85, 0);
    ctx.quadraticCurveTo(s * 0.7, s * 0.12, s * 0.5, s * 0.08);
    ctx.fillStyle = '#3a875c';
    ctx.fill();

    // Turtle Eye
    ctx.beginPath();
    ctx.arc(s * 0.76, -s * 0.02, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // 4. Carapace (Shell)
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.58, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = isNight ? '#20402b' : '#386641';
    ctx.fill();
    ctx.strokeStyle = '#1b3b24';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Scute pattern on shell
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.36, s * 0.25, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#6a994e';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-s * 0.36, 0); ctx.lineTo(-s * 0.58, 0);
    ctx.moveTo(s * 0.36, 0); ctx.lineTo(s * 0.58, 0);
    ctx.moveTo(0, -s * 0.25); ctx.lineTo(0, -s * 0.42);
    ctx.moveTo(0, s * 0.25); ctx.lineTo(0, s * 0.42);
    ctx.stroke();

    // 5. Near Front Flipper (drawn in front)
    ctx.save();
    ctx.translate(s * 0.25, s * 0.2);
    ctx.rotate(flipperAngle);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.25, s * 0.5, s * 0.15, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = '#3a875c';
    ctx.fill();
    ctx.strokeStyle = '#1e5235';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}

// ==========================================
// 7. CRAB (BOTTOM SEABED DWELLER)
// ==========================================
class Crab {
  constructor(x, seabedY, bounds) {
    this.x = x;
    this.seabedY = seabedY;
    this.bounds = bounds;
    this.vx = 0.6;
    this.size = 24;
    this.clawPhase = 0;
    this.walkPhase = 0;
  }

  update(seabedY) {
    this.seabedY = seabedY;
    this.x += this.vx;
    this.walkPhase += 0.1;
    this.clawPhase += 0.05;

    if (this.x > this.bounds.right - 100) {
      this.vx = -Math.abs(this.vx);
    } else if (this.x < this.bounds.left + 100) {
      this.vx = Math.abs(this.vx);
    }
  }

  draw(ctx, isNight) {
    ctx.save();
    const cy = this.seabedY - 12;
    ctx.translate(this.x, cy);

    // Walking legs
    for (let side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const legAngle = Math.sin(this.walkPhase + i) * 0.3;
        ctx.beginPath();
        ctx.moveTo(side * (this.size * 0.4), 2);
        ctx.lineTo(side * (this.size * 0.7 + i * 2), 6 + legAngle * 4);
        ctx.lineTo(side * (this.size * 0.9 + i * 3), 12);
        ctx.strokeStyle = isNight ? '#9e2a2b' : '#e63946';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    }

    // Oval Body Shell
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size * 0.6, this.size * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = isNight ? '#9e2a2b' : '#d90429';
    ctx.fill();
    ctx.strokeStyle = '#540b0e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eye stalks
    for (let side of [-1, 1]) {
      const ex = side * 5;
      ctx.beginPath();
      ctx.moveTo(ex, -this.size * 0.3);
      ctx.lineTo(ex, -this.size * 0.55);
      ctx.strokeStyle = '#d90429';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ex, -this.size * 0.6, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex, -this.size * 0.6, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
    }

    // Claws waving
    for (let side of [-1, 1]) {
      const clawWave = Math.sin(this.clawPhase + side) * 0.2;
      ctx.save();
      ctx.translate(side * (this.size * 0.6), -this.size * 0.2);
      ctx.rotate(clawWave + side * 0.3);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(side * 10, -8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#d90429';
      ctx.stroke();

      // Pincer
      ctx.beginPath();
      ctx.arc(side * 12, -10, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#e63946';
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

// ==========================================
// 8. NEON TETRA SCHOOL (FLOCKING SHOAL)
// ==========================================
class NeonSchool {
  constructor(count, bounds) {
    this.bounds = bounds;
    this.members = [];
    const centerX = bounds.left + Math.random() * (bounds.right - bounds.left);
    const centerY = bounds.top + 150 + Math.random() * 200;

    for (let i = 0; i < count; i++) {
      this.members.push({
        x: centerX + (Math.random() - 0.5) * 120,
        y: centerY + (Math.random() - 0.5) * 80,
        vx: 1.2 + (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        tailPhase: Math.random() * Math.PI * 2
      });
    }

    this.targetX = centerX;
    this.targetY = centerY;
  }

  update(time) {
    // School wander target
    if (Math.random() < 0.02) {
      this.targetX = this.bounds.left + 150 + Math.random() * (this.bounds.right - this.bounds.left - 300);
      this.targetY = this.bounds.top + 120 + Math.random() * (this.bounds.bottom - this.bounds.top - 240);
    }

    for (const m of this.members) {
      m.tailPhase += 0.25;

      // Attract towards school center target
      const dx = this.targetX - m.x;
      const dy = this.targetY - m.y;
      m.vx = lerp(m.vx, (dx / (Math.hypot(dx, dy) || 1)) * 2.2, 0.03);
      m.vy = lerp(m.vy, (dy / (Math.hypot(dx, dy) || 1)) * 1.5, 0.03);

      m.x += m.vx;
      m.y += m.vy;
    }
  }

  draw(ctx, isNight) {
    ctx.save();
    for (const m of this.members) {
      const angle = Math.atan2(m.vy, m.vx);
      const s = 14;

      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(angle);

      // Tail
      const tailWag = Math.sin(m.tailPhase) * 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, 0);
      ctx.lineTo(-s * 0.8, -3 + tailWag);
      ctx.lineTo(-s * 0.8, 3 + tailWag);
      ctx.closePath();
      ctx.fillStyle = '#ff3366';
      ctx.fill();

      // Slender Body
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.5, 3.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(230, 240, 255, 0.9)';
      ctx.fill();

      // Iridescent Neon Blue Stripe
      ctx.beginPath();
      ctx.moveTo(s * 0.4, -1);
      ctx.lineTo(-s * 0.3, -1);
      ctx.strokeStyle = isNight ? '#00f7ff' : '#00b4d8';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Red lower half
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, 1);
      ctx.lineTo(-s * 0.5, 1);
      ctx.strokeStyle = '#ef233c';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }
}
