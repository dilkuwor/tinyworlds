/**
 * cat.js - Procedural Ragdoll cat: poses, animation and rendering
 *
 * The cat is drawn in side view from a handful of soft shapes (haunch, chest,
 * neck, head, legs, plume tail). Every pose is a flat set of numbers, and the
 * live pose eases toward the target pose each frame, which gives the heavy,
 * floppy motion of a Ragdoll. The silhouette is painted on an offscreen
 * canvas so the seal-point colouring, bicolor blaze and shading can be laid
 * over it with `source-atop` and stay inside the fur outline.
 *
 * Local units: 1 unit = 1px at scale 1, facing right, floor at y = 0, up is -y.
 */

const CAT_POSES = {
  sit: {
    hipX: -30, hipY: -44, hipRx: 46, hipRy: 44,
    chestX: 8, chestY: -92, chestRx: 34, chestRy: 46,
    shX: 8, shY: 18, elbow: 4,
    headX: 20, headY: -150, headRot: 0,
    fpNX: 26, fpNY: 0, fpFX: 12, fpFY: 0,
    bkX: -40, bkY: -14, hock: -4,
    bpNX: 12, bpNY: 0, bpFX: 0, bpFY: 0,
    tailA: 2.3, tailCurl: -2.7, tailFront: 1,
    earsBack: 0, eyeOpen: 1, mouthOpen: 0, haunch: 1
  },
  stand: {
    hipX: -58, hipY: -76, hipRx: 42, hipRy: 38,
    chestX: 44, chestY: -80, chestRx: 40, chestRy: 38,
    shX: 6, shY: 14, elbow: 8,
    headX: 94, headY: -124, headRot: 0,
    fpNX: 52, fpNY: 0, fpFX: 38, fpFY: 0,
    bkX: -52, bkY: -52, hock: -16,
    bpNX: -54, bpNY: 0, bpFX: -68, bpFY: 0,
    tailA: 3.95, tailCurl: 0.9, tailFront: 0,
    earsBack: 0, eyeOpen: 1, mouthOpen: 0, haunch: 0
  },
  crouch: {
    hipX: -56, hipY: -42, hipRx: 42, hipRy: 34,
    chestX: 40, chestY: -36, chestRx: 40, chestRy: 32,
    shX: 8, shY: 10, elbow: 14,
    headX: 92, headY: -60, headRot: 0.05,
    fpNX: 70, fpNY: 0, fpFX: 58, fpFY: 0,
    bkX: -50, bkY: -20, hock: -6,
    bpNX: -30, bpNY: 0, bpFX: -42, bpFY: 0,
    tailA: 3.2, tailCurl: 0.3, tailFront: 0,
    earsBack: 0.35, eyeOpen: 1, mouthOpen: 0, haunch: 0.6
  },
  pounce: {
    hipX: -64, hipY: -74, hipRx: 44, hipRy: 32,
    chestX: 54, chestY: -86, chestRx: 42, chestRy: 32,
    shX: 14, shY: 4, elbow: -4,
    headX: 106, headY: -118, headRot: -0.12,
    fpNX: 136, fpNY: -96, fpFX: 124, fpFY: -84,
    bkX: -80, bkY: -66, hock: 0,
    bpNX: -132, bpNY: -44, bpFX: -122, bpFY: -34,
    tailA: 3.3, tailCurl: 0.3, tailFront: 0,
    earsBack: 0.4, eyeOpen: 1, mouthOpen: 0, haunch: 0
  },
  sleep: {
    hipX: -26, hipY: -32, hipRx: 58, hipRy: 32,
    chestX: 28, chestY: -32, chestRx: 46, chestRy: 30,
    shX: 20, shY: 8, elbow: 0,
    headX: 66, headY: -38, headRot: 0.55,
    fpNX: 86, fpNY: -4, fpFX: 76, fpFY: -4,
    bkX: -10, bkY: -12, hock: 0,
    bpNX: 30, bpNY: -2, bpFX: 20, bpFY: -2,
    tailA: 1.9, tailCurl: -2.9, tailFront: 1,
    earsBack: 0.15, eyeOpen: 0, mouthOpen: 0, haunch: 0.5
  },
  groom: {
    hipX: -30, hipY: -44, hipRx: 46, hipRy: 44,
    chestX: 8, chestY: -92, chestRx: 34, chestRy: 46,
    shX: 8, shY: 18, elbow: -12,
    headX: 24, headY: -142, headRot: 0.4,
    fpNX: 36, fpNY: -116, fpFX: 12, fpFY: 0,
    bkX: -40, bkY: -14, hock: -4,
    bpNX: 12, bpNY: 0, bpFX: 0, bpFY: 0,
    tailA: 2.3, tailCurl: -2.7, tailFront: 1,
    earsBack: 0, eyeOpen: 0.25, mouthOpen: 0, haunch: 1
  },
  bat: {
    hipX: -30, hipY: -46, hipRx: 46, hipRy: 42,
    chestX: 12, chestY: -88, chestRx: 35, chestRy: 44,
    shX: 10, shY: 16, elbow: -6,
    headX: 30, headY: -142, headRot: 0.22,
    fpNX: 84, fpNY: -22, fpFX: 14, fpFY: 0,
    bkX: -40, bkY: -14, hock: -4,
    bpNX: 12, bpNY: 0, bpFX: 0, bpFY: 0,
    tailA: 2.6, tailCurl: -1.6, tailFront: 0,
    earsBack: 0.2, eyeOpen: 1, mouthOpen: 0, haunch: 1
  },
  eat: {
    hipX: -56, hipY: -74, hipRx: 42, hipRy: 38,
    chestX: 44, chestY: -66, chestRx: 40, chestRy: 36,
    shX: 8, shY: 10, elbow: 10,
    headX: 100, headY: -46, headRot: 0.45,
    fpNX: 60, fpNY: 0, fpFX: 46, fpFY: 0,
    bkX: -52, bkY: -52, hock: -16,
    bpNX: -54, bpNY: 0, bpFX: -68, bpFY: 0,
    tailA: 3.7, tailCurl: 1.0, tailFront: 0,
    earsBack: 0, eyeOpen: 0.55, mouthOpen: 0, haunch: 0
  },
  stretch: {
    hipX: -56, hipY: -80, hipRx: 42, hipRy: 36,
    chestX: 40, chestY: -42, chestRx: 40, chestRy: 30,
    shX: 16, shY: 6, elbow: 0,
    headX: 98, headY: -62, headRot: -0.25,
    fpNX: 112, fpNY: 0, fpFX: 100, fpFY: 0,
    bkX: -52, bkY: -52, hock: -10,
    bpNX: -56, bpNY: 0, bpFX: -70, bpFY: 0,
    tailA: 4.3, tailCurl: 0.6, tailFront: 0,
    earsBack: 0.3, eyeOpen: 0.15, mouthOpen: 0.8, haunch: 0
  }
};

// Ragdoll seal-point bicolor palette
const CAT_COLORS = {
  cream: '#f1e6d6',
  white: '#fcf9f4',
  fawn: 'rgba(186, 156, 124, 0.55)',
  seal: '#4d382d',
  sealDeep: '#3a2a22',
  sealSoft: 'rgba(83, 60, 47, 0.95)',
  innerEar: '#e7b8ad',
  nose: '#b97f77',
  mouth: '#5a3d33',
  irisLight: '#a8dcff',
  iris: '#4a8ad6',
  irisDark: '#23508f',
  pupil: '#0d1420',
  lid: '#3f2d24'
};

const TAU = Math.PI * 2;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Closed fluffy ellipse path: radius dips into soft points like tufts of fur. */
function fluffPath(ctx, cx, cy, rx, ry, rot = 0, tufts = 14, amp = 0.07, seed = 0) {
  const steps = tufts * 8;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU;
    const wave = 0.5 + 0.5 * Math.sin(a * tufts + seed);
    const bump = 1 + amp * wave * wave;
    const px = Math.cos(a) * rx * bump;
    const py = Math.sin(a) * ry * bump;
    const x = cx + px * Math.cos(rot) - py * Math.sin(rot);
    const y = cy + px * Math.sin(rot) + py * Math.cos(rot);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function fillFluff(ctx, cx, cy, rx, ry, rot, tufts, amp, seed) {
  ctx.beginPath();
  fluffPath(ctx, cx, cy, rx, ry, rot, tufts, amp, seed);
  ctx.fill();
}

class Cat {
  constructor() {
    this.x = 0;
    this.floorY = 0;
    this.s = 1;
    this.dir = 1;          // facing: 1 right, -1 left
    this.flip = 1;         // animated horizontal scale while turning
    this.yOff = 0;         // vertical offset (jumps, sitting in bed)

    this.poseName = 'sit';
    this.pose = { ...CAT_POSES.sit };
    this.blendRate = 5;

    this.t = Math.random() * 100;
    this.phase = 0;        // walk cycle
    this.walkAmt = 0;      // 0 still … 1 walking
    this.runAmt = 0;
    this.speed = 0;        // signed px/s set by the scene

    // Expression & secondary motion
    this.blinkT = 0;
    this.nextBlink = 2 + Math.random() * 3;
    this.slowBlinkT = 0;
    this.earTwitch = [0, 0];
    this.look = { x: 0, y: 0 };      // pupil offset (-1…1)
    this.lookTarget = null;           // world point or null (looks at viewer)
    this.turn = 0.3;                  // 0 faces viewer … 0.5 faces travel direction
    this.headLook = 0;                // extra head rotation from looking
    this.tailMood = 'calm';           // calm | alert | hunt | lash | sleep
    this.tailSway = 0.12;
    this.tailSpeed = 1.2;
    this.dilate = 0.35;
    this.extra = { headRot: 0, headX: 0, headY: 0, eyeOpen: 1, mouthOpen: 0, pawLift: 0, wiggle: 0, earsBack: 0 };
    this.chew = 0;
    this.purring = false;

    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    this.offTail = document.createElement('canvas');
    this.offTailCtx = this.offTail.getContext('2d');
    this.frame = this.pose;
  }

  setPose(name, rate = 5) {
    if (!CAT_POSES[name]) return;
    this.poseName = name;
    this.blendRate = rate;
  }

  /** Request a slow "I trust you" blink. */
  slowBlink() {
    if (this.slowBlinkT <= 0) this.slowBlinkT = 1.8;
  }

  twitchEar(i = Math.random() < 0.5 ? 0 : 1) {
    this.earTwitch[i] = 1;
  }

  // ---------- Geometry helpers ----------
  toLocal(px, py) {
    const f = this.flip >= 0 ? 1 : -1;
    return { x: (px - this.x) * f / this.s, y: (py - (this.floorY + this.yOff)) / this.s };
  }

  toWorld(lx, ly) {
    const f = this.flip >= 0 ? 1 : -1;
    return { x: this.x + lx * this.s * f, y: this.floorY + this.yOff + ly * this.s };
  }

  headWorld() {
    const F = this.frame;
    return this.toWorld(F.headX, F.headY);
  }

  /** Front paw tip in world space (used for batting the yarn). */
  pawWorld() {
    const F = this.frame;
    return this.toWorld(F.fpNX, F.fpNY);
  }

  /** 'head' | 'body' | null for a world point. */
  hitTest(px, py) {
    const F = this.frame;
    const p = this.toLocal(px, py);
    const inEllipse = (cx, cy, rx, ry) => ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 <= 1;
    if (inEllipse(F.headX, F.headY, 44, 40)) return 'head';
    if (inEllipse(F.chestX, F.chestY, F.chestRx + 14, F.chestRy + 14)) return 'body';
    if (inEllipse(F.hipX, F.hipY, F.hipRx + 14, F.hipRy + 14)) return 'body';
    if (inEllipse((F.hipX + F.chestX) / 2, (F.hipY + F.chestY) / 2, Math.abs(F.chestX - F.hipX) / 2 + 20, 40)) return 'body';
    return null;
  }

  // ---------- Animation ----------
  update(dt) {
    this.t += dt;
    const target = CAT_POSES[this.poseName];
    for (const k in target) this.pose[k] = approach(this.pose[k], target[k], this.blendRate, dt);

    // Turning: squash through zero for a soft turn-around
    this.flip = approach(this.flip, this.dir, 9, dt);
    if (Math.abs(this.flip) < 0.04) this.flip = 0.04 * this.dir;

    // Walk cycle driven by actual travel speed
    const moving = Math.abs(this.speed) > 4 * this.s;
    this.walkAmt = approach(this.walkAmt, moving ? 1 : 0, 8, dt);
    const running = Math.abs(this.speed) > 190 * this.s;
    this.runAmt = approach(this.runAmt, running ? 1 : 0, 6, dt);
    const cycleLen = (running ? 120 : 62) * this.s;
    this.phase += (Math.abs(this.speed) * dt / cycleLen) * TAU;

    // Blinks
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0.17;
      this.nextBlink = 2.2 + Math.random() * 4.5;
    }
    this.blinkT = Math.max(0, this.blinkT - dt);
    this.slowBlinkT = Math.max(0, this.slowBlinkT - dt);
    this.earTwitch = this.earTwitch.map(v => Math.max(0, v - dt * 3.2));
    if (Math.random() < dt * 0.08) this.twitchEar();

    // Tail temperament
    const moods = {
      calm: [0.12, 1.1], alert: [0.18, 2.2], hunt: [0.1, 7], lash: [0.55, 6.5], sleep: [0.03, 0.6], happy: [0.2, 1.6]
    };
    const [sway, speed] = moods[this.tailMood] || moods.calm;
    this.tailSway = approach(this.tailSway, sway, 3, dt);
    this.tailSpeed = approach(this.tailSpeed, speed, 3, dt);

    this.updateLook(dt);
    this.frame = this.computeFrame();
  }

  updateLook(dt) {
    let lx = 0, ly = 0, turn = 0.12, headLook = 0;
    if (this.lookTarget) {
      const p = this.toLocal(this.lookTarget.x, this.lookTarget.y);
      const dx = p.x - this.pose.headX;
      const dy = p.y - this.pose.headY;
      const d = Math.hypot(dx, dy) || 1;
      lx = clampN(dx / Math.max(d, 140), -1, 1);
      ly = clampN(dy / Math.max(d, 140), -1, 1);
      if (dx > 0) {
        turn = clampN(0.12 + dx / 900, 0.12, 0.5);
        headLook = clampN(Math.atan2(dy, dx) * 0.45, -0.38, 0.38);
      } else {
        headLook = clampN(dy / 500, -0.2, 0.2);
      }
    }
    this.look.x = approach(this.look.x, lx, 7, dt);
    this.look.y = approach(this.look.y, ly, 7, dt);
    this.turn = approach(this.turn, turn, 2.5, dt);
    this.headLook = approach(this.headLook, headLook, 3, dt);
  }

  /** Live pose + walk cycle + breathing + expression extras. */
  computeFrame() {
    const F = { ...this.pose };
    const E = this.extra;
    const asleep = this.poseName === 'sleep';

    // Breathing
    const breath = Math.sin(this.t * TAU / (asleep ? 4.4 : 3.2)) * (asleep ? 0.035 : 0.012);
    F.chestRy *= 1 + breath;
    F.hipRy *= 1 + breath * 0.6;
    F.chestY -= breath * 10;
    F.headY -= breath * 8;

    // Walk / run cycle on the paws and a gentle body bob
    if (this.walkAmt > 0.01) {
      const w = this.walkAmt;
      const stride = (16 + this.runAmt * 14) * w;
      const lift = (9 + this.runAmt * 8) * w;
      const ph = this.phase;
      const step = (o) => [Math.sin(ph + o) * stride, -Math.max(0, Math.cos(ph + o)) * lift];
      const [a1, b1] = step(0), [a2, b2] = step(Math.PI);
      F.fpNX += a1; F.fpNY += b1;
      F.fpFX += a2; F.fpFY += b2;
      F.bpNX += a2; F.bpNY += b2;
      F.bpFX += a1; F.bpFY += b1;
      const bob = Math.sin(ph * 2) * 2.2 * w;
      F.hipY += bob; F.chestY += bob * 0.8; F.headY += bob * 0.6;
      F.chestX += this.runAmt * 6 * Math.sin(ph); F.hipX -= this.runAmt * 6 * Math.sin(ph);
      F.headY -= this.runAmt * 6;
    }

    // Hunting butt wiggle
    if (E.wiggle > 0.01) {
      const wig = Math.sin(this.t * 22) * 5 * E.wiggle;
      F.hipX += wig; F.hipY -= Math.abs(wig) * 0.6;
    }

    // Paw lift (grooming licks, batting)
    F.fpNY -= E.pawLift;

    F.headRot += this.headLook + E.headRot;
    F.headX += E.headX;
    F.headY += E.headY;
    F.mouthOpen = clampN(F.mouthOpen + E.mouthOpen + this.chew, 0, 1);
    F.earsBack = clampN(F.earsBack + E.earsBack, 0, 1);

    // Eyes: pose openness × expression × blinks
    let eye = F.eyeOpen * E.eyeOpen;
    if (this.blinkT > 0) eye *= 1 - Math.sin((this.blinkT / 0.17) * Math.PI);
    if (this.slowBlinkT > 0) eye *= 1 - 0.85 * Math.sin((this.slowBlinkT / 1.8) * Math.PI);
    F.eye = clampN(eye, 0, 1);
    return F;
  }

  // ---------- Drawing ----------
  tailPoints(F) {
    const N = 13;
    const len = 128;
    const pts = [];
    let x = F.hipX - F.hipRx * 0.82;
    let y = F.hipY - F.hipRy * 0.2;
    pts.push({ x, y, r: 13 });
    for (let i = 1; i <= N; i++) {
      const u = i / N;
      const sway = this.tailSway * Math.sin(this.t * this.tailSpeed - i * 0.42) * u * 1.6;
      const a = F.tailA + F.tailCurl * u + sway;
      x += Math.cos(a) * (len / N);
      y += Math.sin(a) * (len / N);
      const r = u < 0.78 ? 14 + Math.sin(u * Math.PI) * 3.5 : 15.5 - (u - 0.78) * 30;
      if (y > -r * 0.85) y = -r * 0.85; // rest on the floor, never through it
      pts.push({ x, y, r });
    }
    return pts;
  }

  earShape(ctx, F, side) {
    // side: -1 back ear, +1 front ear (in head-local coords)
    const fx = this.turn * 8;
    const twitch = this.earTwitch[side < 0 ? 0 : 1];
    const baseX = fx + side * 19 - this.turn * 6;
    const baseY = -18;
    const tilt = side * (0.32 + F.earsBack * 0.55) + twitch * side * 0.35 * Math.sin(this.t * 30);
    const h = 27 - F.earsBack * 7;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(-13, 6);
    ctx.quadraticCurveTo(-8, -h * 0.6, -1, -h);
    ctx.quadraticCurveTo(8, -h * 0.55, 13, 6);
    ctx.closePath();
    ctx.restore();
  }

  innerEarShape(ctx, F, side) {
    const fx = this.turn * 8;
    const twitch = this.earTwitch[side < 0 ? 0 : 1];
    const baseX = fx + side * 19 - this.turn * 6;
    const tilt = side * (0.32 + F.earsBack * 0.55) + twitch * side * 0.35 * Math.sin(this.t * 30);
    const h = 27 - F.earsBack * 7;
    ctx.save();
    ctx.translate(baseX, -18);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(-7, 2);
    ctx.quadraticCurveTo(-4, -h * 0.5, 0, -h * 0.72);
    ctx.quadraticCurveTo(4, -h * 0.45, 7, 2);
    ctx.closePath();
    ctx.restore();
  }

  legPath(ctx, x1, y1, x2, y2, bend) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const d = Math.hypot(dx, dy) || 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx + (-dy / d) * bend, my + (dx / d) * bend, x2, y2);
  }

  /** Leg strokes + paws. near: true for the leg closest to the viewer. */
  drawLegs(ctx, F, which, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    const shX = F.chestX + F.shX, shY = F.chestY + F.shY;
    const legs = [];
    if (which === 'far') {
      legs.push([F.bkX - 10, F.bkY, F.bpFX, F.bpFY, F.hock, 17]);
      legs.push([shX - 10, shY, F.fpFX, F.fpFY, F.elbow, 17]);
    } else {
      legs.push([F.bkX, F.bkY, F.bpNX, F.bpNY, F.hock, 19]);
      legs.push([shX, shY, F.fpNX, F.fpNY, F.elbow, 19]);
    }
    for (const [x1, y1, x2, y2, bend, w] of legs) {
      ctx.lineWidth = w;
      this.legPath(ctx, x1, y1, x2, y2 - 5, bend);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x2 + 3, y2 - 6, 12.5, 7.5, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawTail(ctx, pts) {
    pts.forEach((p, i) => fillFluff(ctx, p.x, p.y, p.r * 1.15, p.r, 0, 7, 0.22, i * 1.7));
  }

  /** Torso silhouette: haunch, belly bridge, chest, neck, ruff. */
  drawTorso(ctx, F) {
    fillFluff(ctx, F.hipX, F.hipY, F.hipRx, F.hipRy, 0, 16, 0.06, 0.3);

    // Bridge between haunch and chest with a soft, low belly
    ctx.beginPath();
    ctx.moveTo(F.hipX, F.hipY - F.hipRy * 0.92);
    ctx.quadraticCurveTo((F.hipX + F.chestX) / 2, Math.min(F.hipY - F.hipRy, F.chestY - F.chestRy) + 6,
      F.chestX, F.chestY - F.chestRy * 0.92);
    ctx.lineTo(F.chestX, F.chestY + F.chestRy * 0.9);
    ctx.quadraticCurveTo((F.hipX + F.chestX) / 2, Math.max(F.hipY + F.hipRy, F.chestY + F.chestRy) + 6,
      F.hipX, F.hipY + F.hipRy * 0.9);
    ctx.closePath();
    ctx.fill();

    fillFluff(ctx, F.chestX, F.chestY, F.chestRx, F.chestRy, 0, 16, 0.07, 1.1);

    // Sitting haunch: rounded thigh resting on the floor
    if (F.haunch > 0.05) {
      fillFluff(ctx, F.hipX + 12, F.hipY + F.hipRy * 0.35, F.hipRx * 0.78 * F.haunch + 8, F.hipRy * 0.55, -0.15, 12, 0.07, 2.2);
    }

    // Neck and mane
    const nx = F.chestX + (F.headX - F.chestX) * 0.55;
    const ny = F.chestY + (F.headY - F.chestY) * 0.55;
    fillFluff(ctx, nx, ny, 28, 30, 0, 12, 0.1, 0.7);
    fillFluff(ctx, nx + 8, ny + 14, 26, 32, 0.2, 14, 0.14, 1.9);
  }

  drawHeadShape(ctx, F) {
    ctx.save();
    ctx.translate(F.headX, F.headY);
    ctx.rotate(F.headRot);
    this.earShape(ctx, F, -1); ctx.fill();
    this.earShape(ctx, F, 1); ctx.fill();
    fillFluff(ctx, 0, -4, 35, 30, 0, 14, 0.06, 0.4);
    fillFluff(ctx, this.turn * 5, 9, 41, 23, 0, 12, 0.13, 1.3); // fluffy jowls
    ctx.restore();
  }

  /** Prepare an offscreen layer: clear it and set the cat-local transform. */
  beginLayer(canvas, ctx, dpr, ox, oy) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(this.flip * this.s * dpr, 0, 0, this.s * dpr, ox * dpr, oy * dpr);
    return ctx;
  }

  /** Plume tail on its own layer: cream silhouette, seal-point gradient over it. */
  paintTail(F, tail, dpr, ox, oy) {
    const c = this.beginLayer(this.offTail, this.offTailCtx, dpr, ox, oy);
    c.fillStyle = CAT_COLORS.cream;
    this.drawTail(c, tail);
    c.globalCompositeOperation = 'source-atop';
    const a = tail[0], z = tail[tail.length - 1];
    const tg = c.createLinearGradient(a.x, a.y, z.x, z.y);
    tg.addColorStop(0, '#9b7f68');
    tg.addColorStop(0.3, CAT_COLORS.seal);
    tg.addColorStop(1, CAT_COLORS.sealDeep);
    c.fillStyle = tg;
    c.fillRect(-300, -300, 600, 320);
    c.globalCompositeOperation = 'source-over';
  }

  /** Body and head on the main offscreen layer: silhouette, then colouring. */
  paintBody(F, dpr, ox, oy) {
    const c = this.beginLayer(this.off, this.offCtx, dpr, ox, oy);

    // ---- Silhouette with base colours ----
    this.drawLegs(c, F, 'far', '#dccdbb');
    c.fillStyle = CAT_COLORS.cream;
    this.drawTorso(c, F);
    this.drawLegs(c, F, 'near', CAT_COLORS.white);
    c.fillStyle = CAT_COLORS.cream;
    this.drawHeadShape(c, F);

    // ---- Colouring, clipped to the silhouette ----
    c.globalCompositeOperation = 'source-atop';

    // Soft top-to-belly gradient: warm cream back, white underside
    const grad = c.createLinearGradient(0, -190, 0, 0);
    grad.addColorStop(0, 'rgba(214, 192, 165, 0.75)');
    grad.addColorStop(0.55, 'rgba(240, 230, 216, 0.35)');
    grad.addColorStop(1, 'rgba(255, 253, 249, 0.6)');
    c.fillStyle = grad;
    c.fillRect(-260, -260, 520, 280);

    // Fawn saddle along the back
    const backY = Math.min(F.hipY - F.hipRy, F.chestY - F.chestRy);
    const sad = c.createRadialGradient(F.hipX + 20, backY + 8, 4, F.hipX + 20, backY + 8, 95);
    sad.addColorStop(0, CAT_COLORS.fawn);
    sad.addColorStop(1, 'rgba(186, 156, 124, 0)');
    c.fillStyle = sad;
    c.fillRect(-260, -260, 520, 280);

    // White bib and mitts (bicolor)
    c.fillStyle = 'rgba(253, 250, 245, 0.92)';
    const nx = F.chestX + (F.headX - F.chestX) * 0.55;
    const ny = F.chestY + (F.headY - F.chestY) * 0.55;
    fillFluff(c, nx + 10, ny + 22, 22, 34, 0.15, 14, 0.16, 2.4);
    this.drawLegs(c, F, 'near', CAT_COLORS.white);
    c.lineWidth = 1.2;
    c.strokeStyle = 'rgba(160, 135, 115, 0.4)';
    const shX = F.chestX + F.shX, shY = F.chestY + F.shY;
    this.legPath(c, shX - 9, shY + 6, F.fpNX - 9, F.fpNY - 6, F.elbow);
    c.stroke();

    // Contact shadow where fur meets the floor
    const ao = c.createLinearGradient(0, -16, 0, 0);
    ao.addColorStop(0, 'rgba(110, 86, 68, 0)');
    ao.addColorStop(1, 'rgba(110, 86, 68, 0.3)');
    c.fillStyle = ao;
    c.fillRect(-260, -16, 520, 18);

    // ---- Head colouring: dark mask, ears, white blaze ----
    c.save();
    c.translate(F.headX, F.headY);
    c.rotate(F.headRot);
    const fx = this.turn * 8;
    c.fillStyle = CAT_COLORS.seal;
    this.earShape(c, F, -1); c.fill();
    this.earShape(c, F, 1); c.fill();
    const mask = c.createRadialGradient(fx, -6, 4, fx, -4, 44);
    mask.addColorStop(0, CAT_COLORS.sealSoft);
    mask.addColorStop(0.55, 'rgba(92, 68, 54, 0.85)');
    mask.addColorStop(1, 'rgba(120, 92, 72, 0)');
    c.fillStyle = mask;
    c.fillRect(-60, -60, 120, 100);

    // Inverted-V blaze down the muzzle
    const blaze = c.createLinearGradient(0, -16, 0, 8);
    blaze.addColorStop(0, 'rgba(252, 249, 244, 0)');
    blaze.addColorStop(0.45, 'rgba(252, 249, 244, 0.85)');
    blaze.addColorStop(1, CAT_COLORS.white);
    c.fillStyle = blaze;
    c.beginPath();
    c.moveTo(fx, -16);
    c.quadraticCurveTo(fx - 4, 4, fx - 30, 22);
    c.quadraticCurveTo(fx - 26, 44, fx, 46);
    c.quadraticCurveTo(fx + 26, 44, fx + 30, 22);
    c.quadraticCurveTo(fx + 4, 4, fx, -16);
    c.closePath();
    c.fill();
    c.restore();

    c.globalCompositeOperation = 'source-over';
  }

  /** Eyes, nose, mouth, whiskers and inner ears, drawn crisp on the main canvas. */
  drawFace(ctx, F) {
    ctx.save();
    ctx.translate(F.headX, F.headY);
    ctx.rotate(F.headRot);
    const fx = this.turn * 8;

    // Inner ears
    ctx.fillStyle = CAT_COLORS.innerEar;
    ctx.globalAlpha = 0.8;
    this.innerEarShape(ctx, F, -1); ctx.fill();
    this.innerEarShape(ctx, F, 1); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255, 252, 246, 0.75)';
    ctx.lineWidth = 0.9;
    for (const side of [-1, 1]) {
      const bx = fx + side * 19 - this.turn * 6;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(bx + side * (k * 2 - 2), -16);
        ctx.quadraticCurveTo(bx + side * (k * 3), -26, bx + side * (k * 4 + 3), -31 + k * 2);
        ctx.stroke();
      }
    }

    // Eyes
    for (const side of [-1, 1]) {
      const far = side === 1 ? this.turn : -this.turn;
      const ex = fx + side * 13.5 - this.turn * 3;
      const ey = -3;
      const sxScale = 1 - Math.max(0, far) * 0.4;
      this.drawEye(ctx, ex, ey, sxScale, F.eye, side);
    }

    // Nose
    const nx = fx + this.turn * 2;
    ctx.fillStyle = CAT_COLORS.nose;
    ctx.beginPath();
    ctx.moveTo(nx - 4.5, 8);
    ctx.quadraticCurveTo(nx, 6.5, nx + 4.5, 8);
    ctx.quadraticCurveTo(nx + 1, 12.5, nx, 13);
    ctx.quadraticCurveTo(nx - 1, 12.5, nx - 4.5, 8);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = CAT_COLORS.mouth;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    if (F.mouthOpen > 0.05) {
      const mo = F.mouthOpen;
      ctx.fillStyle = '#4a2a28';
      ctx.beginPath();
      ctx.ellipse(nx, 17 + mo * 4, 5 + mo * 3, 2 + mo * 7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e59a9a';
      ctx.beginPath();
      ctx.ellipse(nx, 19 + mo * 7, 3.5 + mo * 2, 1.5 + mo * 3, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(nx, 13);
      ctx.lineTo(nx, 15.5);
      ctx.quadraticCurveTo(nx - 3, 19, nx - 6.5, 16.5);
      ctx.moveTo(nx, 15.5);
      ctx.quadraticCurveTo(nx + 3, 19, nx + 6.5, 16.5);
      ctx.stroke();
    }

    // Whiskers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 0.8;
    const twitch = Math.sin(this.t * 1.7) * 0.04 + (F.mouthOpen * 0.1);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const a = (k - 1) * 0.16 + twitch;
        const ox = nx + side * 8, oy = 13 + k * 2;
        const len = 36 - Math.abs(k - 1) * 4;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(ox + side * len * 0.55, oy + (k - 1) * 3 + side * a * 10,
          ox + side * len * Math.cos(a), oy + len * Math.sin(a) * side + (k - 1) * 4 + 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawEye(ctx, ex, ey, sx, open, side) {
    const rx = 8.6, ry = 7.6;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(sx, 1);
    ctx.rotate(side * -0.12);

    if (open < 0.14) {
      // Closed: a soft content curve
      ctx.strokeStyle = CAT_COLORS.lid;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-rx, 0);
      ctx.quadraticCurveTo(0, 4.5, rx, 0);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const lidTop = -ry + (1 - open) * ry * 1.8;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(-rx - 1, lidTop, rx * 2 + 2, ry * 2 + 2);
    ctx.clip();

    const iris = ctx.createRadialGradient(-1.5, -2, 1, 0, 0, rx);
    iris.addColorStop(0, CAT_COLORS.irisLight);
    iris.addColorStop(0.55, CAT_COLORS.iris);
    iris.addColorStop(1, CAT_COLORS.irisDark);
    ctx.fillStyle = iris;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    const px = this.look.x * 2.8, py = this.look.y * 2.2;
    ctx.fillStyle = CAT_COLORS.pupil;
    ctx.beginPath();
    ctx.ellipse(px, py, 1.6 + this.dilate * 4.6, 6.6, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(px - 2.6, py - 3, 1.9, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(px + 2.2, py + 2.4, 0.9, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Lid edge and outline
    ctx.strokeStyle = CAT_COLORS.lid;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.stroke();
    if (open < 0.98) {
      const half = Math.sqrt(Math.max(0, 1 - (lidTop / ry) ** 2)) * rx;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-half, lidTop);
      ctx.lineTo(half, lidTop);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Draw at the current position. ctx is a CSS-pixel context; dpr is the device ratio. */
  draw(ctx, dpr = 1, shadowAlpha = 0.22) {
    const F = this.frame;
    const s = this.s;
    const W = 500 * s, H = 340 * s;
    const ox = W / 2, oy = H - 40 * s;
    const pw = Math.ceil(W * dpr), ph = Math.ceil(H * dpr);
    for (const cv of [this.off, this.offTail]) {
      if (cv.width !== pw || cv.height !== ph) {
        cv.width = pw;
        cv.height = ph;
      }
    }

    // Floor shadow (shrinks while airborne)
    const lift = clampN(-this.yOff / (120 * s), 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(40, 28, 20, ${shadowAlpha * (1 - lift * 0.6)})`;
    ctx.beginPath();
    const cx = this.x + ((F.hipX + F.chestX) / 2) * s * (this.flip >= 0 ? 1 : -1);
    ctx.ellipse(cx, this.floorY + 2 * s, (Math.abs(F.chestX - F.hipX) / 2 + 70) * s * (1 - lift * 0.3), 10 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    const tail = this.tailPoints(F);
    this.paintTail(F, tail, dpr, ox, oy);
    this.paintBody(F, dpr, ox, oy);
    const dx = this.x - ox, dy = this.floorY + this.yOff - oy;
    if (F.tailFront > 0.5) {
      ctx.drawImage(this.off, dx, dy, W, H);
      ctx.drawImage(this.offTail, dx, dy, W, H);
    } else {
      ctx.drawImage(this.offTail, dx, dy, W, H);
      ctx.drawImage(this.off, dx, dy, W, H);
    }

    ctx.save();
    ctx.translate(this.x, this.floorY + this.yOff);
    ctx.scale(this.flip * s, s);
    this.drawFace(ctx, F);
    ctx.restore();
  }
}

window.Cat = Cat;
window.CAT_POSES = CAT_POSES;
