/**
 * scene.js - Ragdoll Cat scene: behaviour, input and rendering loop
 *
 * The cat's brain is a small state machine. "Locked" states (pounce, bat,
 * eat, groom, yawn, wake, annoyed) play out before the cat decides again;
 * otherwise it re-evaluates every frame, in priority order:
 * petting → treats → laser → yarn → prey-like cursor → nap → idle life.
 */

const rand = (a, b) => a + Math.random() * (b - a);
const easeInOut = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clampN(u, 0, 1));

class CatScene {
  constructor() {
    this.world = document.getElementById('world');
    this.canvas = document.getElementById('cat-canvas');
    this.room = new Room();
    this.cat = new Cat();
    this.treats = [];
    this.yarn = null;
    this.fx = [];
    this.toy = 'none';
    this.theme = this.themeForHour(new Date().getHours());

    this.pointer = { x: -999, y: -999, inside: false, lastMove: -99, lastT: 0, speed: 0, erratic: 0, dirX: 0, dirY: 0, scrub: 0 };
    this.time = 0;
    this.lastInteraction = 0;
    this.happiness = 70;
    this.treatsEaten = 0;

    this.state = 'sit';
    this.stateT = 0;
    this.goal = null;
    this.cooldown = 0;
    this.petCooldown = 0;
    this.petT = 0;
    this.lastOverCat = -99;
    this.lastPlay = -99;
    this.preyUntil = -99;
    this.behindT = 0;
    this.glance = null;
    this.nextGlance = 2;
    this.nextIdleAct = rand(8, 14);
    this.fxTimer = 0;
    this.statsTimer = 0;
    this.wakeRequested = false;

    this.stage = createStage(this.canvas, (stage) => { this.stage = stage; this.layout(); });
    this.ctx = this.stage.ctx;
    this.cat.x = this.stage.width * 0.46;
    this.layout();

    this.bindInput();
    this.bindUI();
    this.setTheme(this.theme);
    this.updateStats();
    startLoop((dt) => this.frame(dt));
  }

  themeForHour(h) {
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  layout() {
    const { width: w, height: h } = this.stage;
    const s = clampN(Math.min(h / 690, w / 640), 0.55, 1.5);
    this.s = s;
    this.floorY = h - Math.max(110, h * 0.19);
    this.room.layout(w, h, this.floorY, s);
    this.cat.s = s;
    this.cat.floorY = this.floorY;
    this.minX = 120 * s;
    this.maxX = w - 120 * s;
    this.cat.x = clampN(this.cat.x, this.minX, this.maxX);
    this.treats.forEach(t => { t.s = s; t.landed = false; });
    if (this.yarn) { this.yarn.s = s; this.yarn.r = 20 * s; }
  }

  // ==========================================
  // INPUT
  // ==========================================
  bindInput() {
    const p = this.pointer;
    window.addEventListener('pointermove', (e) => {
      if (Shell.isUIEvent(e)) { p.inside = false; return; }
      const now = performance.now() / 1000;
      const dt = Math.max(0.008, now - p.lastT);
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (p.inside && p.lastT) {
        const v = Math.hypot(dx, dy) / dt;
        p.speed = p.speed * 0.75 + Math.min(v, 6000) * 0.25;
        const len = Math.hypot(dx, dy);
        if (len > 2) {
          const nx = dx / len, ny = dy / len;
          const turn = 1 - (nx * p.dirX + ny * p.dirY); // 0 straight … 2 reversal
          p.erratic = p.erratic * 0.85 + turn * 0.15;
          p.dirX = nx; p.dirY = ny;
        }
      }
      p.x = e.clientX; p.y = e.clientY;
      p.lastT = now;
      p.inside = true;
      p.lastMove = this.time;
      this.interact();
    });
    document.addEventListener('pointerleave', () => { p.inside = false; });
    window.addEventListener('blur', () => { p.inside = false; });

    this.world.addEventListener('pointerdown', (e) => {
      if (Shell.isUIEvent(e)) return;
      p.x = e.clientX; p.y = e.clientY; p.inside = true; p.lastMove = this.time;
      this.interact();
      this.handleClick(e.clientX, e.clientY);
    });

    window.addEventListener('keydown', (e) => {
      if (Shell.isModifiedKey(e)) return;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') {
        e.preventDefault();
        this.dropTreat();
      } else if (k === 'y') {
        this.setToy(this.toy === 'yarn' ? 'none' : 'yarn');
      } else if (k === 'l') {
        this.setToy(this.toy === 'laser' ? 'none' : 'laser');
      } else if (k === 'd') {
        this.cycleTheme();
      } else if (k === 'm') {
        this.toggleSound();
      } else {
        return;
      }
      this.interact();
    });
  }

  bindUI() {
    document.getElementById('btn-treat')?.addEventListener('click', () => { this.interact(); this.dropTreat(); });
    document.getElementById('btn-theme')?.addEventListener('click', () => this.cycleTheme());
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
    document.querySelectorAll('#toy-dropdown .dropdown-item').forEach(item =>
      item.addEventListener('click', (e) => { this.interact(); this.setToy(e.currentTarget.dataset.toy); }));
  }

  interact() {
    this.lastInteraction = this.time;
  }

  handleClick(x, y) {
    const cat = this.cat;
    if (this.toy === 'yarn') {
      if (this.yarn && this.yarn.hit(x, y)) {
        const dx = this.yarn.x - x;
        this.yarn.push(Math.sign(dx || 1) * rand(380, 620) * this.s, -rand(250, 420) * this.s, this.time);
      } else {
        if (!this.yarn) this.yarn = new Yarn(x, y, this.s);
        this.yarn.x = x;
        this.yarn.y = Math.min(y, this.floorY - this.yarn.r);
        this.yarn.push(rand(-250, 250) * this.s, -rand(0, 200) * this.s, this.time);
      }
      this.requestWake(x, y, 420);
      return;
    }
    if (this.toy === 'laser') {
      this.requestWake(x, y, 300);
      return;
    }
    if (cat.hitTest(x, y)) {
      if (this.state === 'sleep') {
        this.wakeRequested = true;
      } else {
        // A gentle boop
        cat.twitchEar();
        cat.slowBlink();
        this.happiness = Math.min(100, this.happiness + 3);
        this.spawnFx('heart', cat.headWorld());
        this.sound('mew');
      }
      return;
    }
    this.dropTreat(x, y);
  }

  requestWake(x, y, radius) {
    if (this.state !== 'sleep') return;
    const head = this.cat.headWorld();
    if (Math.hypot(head.x - x, head.y - y) < radius * this.s) this.wakeRequested = true;
  }

  dropTreat(x, y) {
    const w = this.stage.width;
    if (x === undefined) {
      x = rand(w * 0.15, w * 0.85);
      y = this.stage.height * 0.3;
    }
    x = clampN(x, 30, w - 30);
    y = Math.min(y, this.floorY - 10 * this.s);
    if (this.treats.length >= 6) this.treats.shift();
    this.treats.push(new Treat(x, y, this.s));
    if (this.state === 'sleep') this.wakeRequested = true;
    this.updateStats();
  }

  setToy(toy) {
    this.toy = toy;
    if (toy === 'yarn' && !this.yarn) {
      const x = clampN(this.cat.x + this.cat.dir * 260 * this.s, 80, this.stage.width - 80);
      this.yarn = new Yarn(x, this.floorY - 160 * this.s, this.s);
      this.yarn.lastTouched = this.time;
      if (this.state === 'sleep') this.wakeRequested = true;
    }
    if (toy !== 'yarn') this.yarn = null;
    this.world.classList.toggle('laser-mode', toy === 'laser');
    const labels = { none: ['🖐️', 'Hand'], yarn: ['🧶', 'Yarn'], laser: ['🔴', 'Laser'] };
    const [icon, label] = labels[toy];
    document.getElementById('toy-icon').textContent = icon;
    document.getElementById('toy-label').textContent = label;
    document.querySelectorAll('#toy-dropdown .dropdown-item').forEach(el =>
      el.classList.toggle('selected', el.dataset.toy === toy));
  }

  cycleTheme() {
    const order = ['morning', 'afternoon', 'evening', 'night'];
    this.setTheme(order[(order.indexOf(this.theme) + 1) % order.length]);
  }

  setTheme(theme) {
    this.theme = theme;
    const T = ROOM_THEMES[theme];
    document.getElementById('theme-icon').textContent = T.icon;
    document.getElementById('theme-btn-label').textContent = T.label;
  }

  toggleSound() {
    const muted = window.soundManager.toggleMute();
    document.getElementById('sound-icon').textContent = muted ? '🔇' : '🔊';
    document.getElementById('sound-label').textContent = muted ? 'Off' : 'On';
  }

  sound(name) {
    const sm = window.soundManager;
    if (sm && sm[name]) sm[name]();
  }

  spawnFx(kind, at) {
    this.fx.push(new FloatFx(kind, at.x + rand(-10, 10) * this.s, at.y - 30 * this.s, this.s));
  }

  // ==========================================
  // BRAIN
  // ==========================================
  setState(name) {
    this.state = name;
    this.stateT = 0;
  }

  walkTo(x, { run = false, onArrive = null, purpose = 'wander' } = {}) {
    this.goal = { x: clampN(x, this.minX, this.maxX), run, onArrive, purpose };
    if (this.state !== 'walk') this.setState('walk');
  }

  stopWalking() {
    this.goal = null;
  }

  sit() {
    this.stopWalking();
    this.setState('sit');
    this.cat.setPose('sit', 5);
  }

  think(dt) {
    const c = this.cat, p = this.pointer, E = c.extra;
    this.stateT += dt;
    this.cooldown -= dt;
    this.petCooldown -= dt;

    // Expression extras relax back to neutral unless a state holds them
    E.headRot = approach(E.headRot, 0, 4, dt);
    E.eyeOpen = approach(E.eyeOpen, 1, 3, dt);
    E.mouthOpen = approach(E.mouthOpen, 0, 6, dt);
    E.pawLift = approach(E.pawLift, 0, 8, dt);
    E.wiggle = approach(E.wiggle, 0, 6, dt);
    E.earsBack = approach(E.earsBack, 0, 3, dt);
    c.chew = approach(c.chew, 0, 10, dt);

    const pointerFresh = p.inside && this.time - p.lastMove < 0.3;
    const overCat = p.inside && !!c.hitTest(p.x, p.y);
    if (overCat) this.lastOverCat = this.time;
    const slowStroke = this.toy !== 'laser' && pointerFresh && overCat && p.speed < 1500 * this.s;
    if (overCat && pointerFresh && p.speed > 2600 * this.s) p.scrub += dt; else p.scrub = Math.max(0, p.scrub - dt * 0.5);

    let purr = 0;
    let tailMood = this.happiness > 72 ? 'happy' : 'calm';
    let dilate = this.theme === 'night' ? 0.7 : 0.35;

    // ---------- Locked states ----------
    switch (this.state) {
      case 'pounce': this.updatePounce(dt); c.tailMood = 'hunt'; c.dilate = approach(c.dilate, 0.95, 6, dt); return;
      case 'bat': this.updateBat(dt); c.tailMood = 'alert'; return;
      case 'eat': this.updateEat(dt); c.tailMood = 'happy'; return;
      case 'wake': this.updateWake(dt); c.tailMood = 'calm'; return;
      case 'annoyed': this.updateAnnoyed(dt); c.tailMood = 'lash'; return;
      case 'yawn': this.updateYawn(dt); return;
      case 'groom':
        if (!slowStroke && this.updateGroom(dt)) return;
        break;
      case 'sleep': {
        c.tailMood = 'sleep';
        c.lookTarget = null;
        if (this.wakeRequested) {
          this.wakeRequested = false;
          this.setState('wake');
          return;
        }
        if (slowStroke) {
          // Petting a sleeping Ragdoll: it purrs and melts, but stays asleep
          purr = 0.6;
          this.happiness = Math.min(100, this.happiness + 2 * dt);
          this.fxTimer -= dt;
          if (this.fxTimer <= 0) { this.fxTimer = 1.4; this.spawnFx('heart', c.headWorld()); }
        }
        this.fxTimer -= dt;
        if (this.fxTimer <= 0) { this.fxTimer = 1.8; this.spawnFx('z', c.headWorld()); }
        if (Math.random() < dt * 0.15) {
          if (Math.random() < 0.5) c.twitchEar(); else E.pawLift = 8;
        }
        this.setPurr(purr);
        return;
      }
    }

    // ---------- Free states: decide what matters most right now ----------
    this.wakeRequested = false;

    // 1. Petting
    if ((this.state === 'pet' || slowStroke) && this.petCooldown <= 0 && this.time - this.lastOverCat < 0.7) {
      if (this.state !== 'pet') {
        this.stopWalking();
        this.setState('pet');
        this.petT = 0;
        c.setPose('sit', 4);
      }
      this.petT += slowStroke ? dt : 0;
      const side = p.x > c.x ? 1 : -1;
      E.headRot = approach(E.headRot, 0.2 * side * c.dir, 3, dt);
      E.eyeOpen = approach(E.eyeOpen, 0.12, 3, dt);
      c.lookTarget = { x: p.x, y: p.y };
      this.happiness = Math.min(100, this.happiness + 5 * dt);
      this.fxTimer -= dt;
      if (this.fxTimer <= 0) { this.fxTimer = 0.9; this.spawnFx('heart', c.headWorld()); }
      if (p.scrub > 0.35 || this.petT > 22) {
        this.setState('annoyed');
        this.setPurr(0);
        return;
      }
      c.tailMood = 'happy';
      c.dilate = approach(c.dilate, 0.3, 3, dt);
      this.setPurr(1);
      return;
    }
    if (this.state === 'pet') this.sit();

    // 2. Treats
    const treat = this.nearestTreat();
    if (treat) {
      c.lookTarget = { x: treat.x, y: treat.y };
      if (treat.landed) {
        this.goEat(treat);
      } else if (this.state === 'sit') {
        c.dilate = approach(c.dilate, 0.8, 4, dt);
      }
      if (this.state === 'walk') c.setPose('stand', 7);
      this.setPurr(0);
      return;
    }

    // 3. Laser dot
    if (this.toy === 'laser' && p.inside && this.time - p.lastMove < 8) {
      this.chase({ x: p.x, y: p.y }, 'laser', dt);
      this.setPurr(0);
      return;
    }

    // 4. Yarn
    const y = this.yarn;
    if (y && (y.moving || this.time - y.lastTouched < 9)) {
      this.chase({ x: y.x, y: y.y }, 'yarn', dt);
      this.setPurr(0);
      return;
    }

    // 5. A cursor darting around like prey
    if (this.toy === 'none' && pointerFresh && !overCat && p.speed > 1700 * this.s && p.erratic > 0.45 && p.y > this.room.horizonY - 80 * this.s) {
      this.preyUntil = this.time + 2.2;
    }
    if (this.time < this.preyUntil && p.inside) {
      this.chase({ x: p.x, y: p.y }, 'prey', dt);
      this.setPurr(0);
      return;
    }
    if (this.state === 'crouch') this.sit();

    // 6. Nap when left alone
    const sleepAfter = this.theme === 'night' ? 22 : 45;
    if (this.time - this.lastInteraction > sleepAfter && this.state !== 'walk') {
      this.goSleep();
      return;
    }
    if (this.goal && this.goal.purpose === 'sleep' && this.time - this.lastInteraction < 1) this.sit();

    // 7. Idle life: watch the pointer, glance around, groom, wander
    this.idle(dt, dilate, tailMood);
    this.setPurr(0);
  }

  setPurr(level) {
    if (window.soundManager) window.soundManager.setPurr(level);
  }

  nearestTreat() {
    let best = null, bd = Infinity;
    for (const t of this.treats) {
      const d = Math.abs(t.x - this.cat.x);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  idle(dt, dilate, tailMood) {
    const c = this.cat, p = this.pointer;
    c.tailMood = tailMood;
    c.dilate = approach(c.dilate, dilate, 2, dt);

    if (this.state === 'walk') {
      c.setPose('stand', 6);
    } else if (this.state !== 'sit') {
      this.sit();
    }

    // Where to look
    const watching = p.inside && this.time - p.lastMove < 3.5;
    if (watching) {
      c.lookTarget = { x: p.x, y: p.y };
    } else {
      this.nextGlance -= dt;
      if (this.nextGlance <= 0) {
        this.nextGlance = rand(2, 5);
        const r = this.room;
        const options = [null, null, { x: r.win.x + r.win.w / 2, y: r.win.y + r.win.h / 2 }, { x: r.plant.x, y: r.plant.y - 120 * this.s },
          { x: c.x + c.dir * 400 * this.s, y: this.floorY - 20 }];
        this.glance = options[Math.floor(Math.random() * options.length)];
      }
      c.lookTarget = this.glance;
    }

    if (this.state !== 'sit') return;

    // Turn around to face something behind for a while
    if (c.lookTarget) {
      const local = c.toLocal(c.lookTarget.x, c.lookTarget.y);
      this.behindT = local.x < -30 ? this.behindT + dt : 0;
      if (this.behindT > 1.1) { c.dir = -c.dir; this.behindT = 0; }
    }

    // Slow blink at a still, nearby pointer: cat for "I trust you"
    const head = c.headWorld();
    const still = this.time - p.lastMove;
    if (p.inside && still > 1.5 && still < 12 && Math.hypot(p.x - head.x, p.y - head.y) < 380 * this.s && Math.random() < dt * 0.18) {
      c.slowBlink();
    }

    this.nextIdleAct -= dt;
    if (this.nextIdleAct <= 0) {
      this.nextIdleAct = rand(10, 20);
      const roll = Math.random();
      if (roll < 0.4) {
        let tx;
        do { tx = rand(this.minX, this.maxX); } while (Math.abs(tx - this.room.bed.x) < 170 * this.s && Math.random() < 0.8);
        this.walkTo(tx);
      } else if (roll < 0.72) {
        this.setState('groom');
      } else if (roll < 0.88) {
        this.setState('yawn');
      } else {
        c.twitchEar();
      }
    }
  }

  goEat(treat) {
    const c = this.cat;
    let dir = Math.sign(treat.x - c.x) || c.dir;
    let standX = treat.x - dir * 100 * this.s;
    if (standX < this.minX || standX > this.maxX) {
      dir = -dir;
      standX = treat.x - dir * 100 * this.s;
    }
    if (Math.abs(standX - c.x) < 8 * this.s && this.state !== 'eat') {
      c.dir = Math.sign(treat.x - c.x) || c.dir;
      treat.claimed = true;
      this.eating = treat;
      this.stopWalking();
      this.setState('eat');
      c.setPose('eat', 6);
      this.sound('crunch');
    } else if (!this.goal || Math.abs(this.goal.x - standX) > 4) {
      this.walkTo(standX, { purpose: 'eat', run: Math.abs(standX - c.x) > 500 * this.s });
    }
  }

  goSleep() {
    const bedX = this.room.bed.x;
    if (Math.abs(this.cat.x - bedX) < 10 * this.s) {
      this.stopWalking();
      this.setState('sleep');
      this.cat.setPose('sleep', 2.2);
      this.cat.lookTarget = null;
      this.fxTimer = 2;
      return;
    }
    if (!this.goal || this.goal.purpose !== 'sleep') this.walkTo(bedX, { purpose: 'sleep' });
  }

  /** Stalk a target: approach, crouch and wiggle, then pounce (or bat it when close). */
  chase(target, kind, dt) {
    const c = this.cat, E = c.extra;
    c.lookTarget = target;
    c.dilate = approach(c.dilate, 0.9, 5, dt);
    c.tailMood = 'alert';
    const dx = target.x - c.x;
    const dir = Math.sign(dx) || c.dir;
    const dist = Math.abs(dx);
    const high = target.y < this.room.horizonY - 40 * this.s;

    if (this.cooldown > 0) {
      if (this.state !== 'sit') this.sit();
      return;
    }

    // Close enough to swat the yarn or the dot under its nose
    if (kind !== 'prey' && dist < 150 * this.s && dist > 30 * this.s && !high && target.y > this.floorY - 120 * this.s) {
      this.startBat(dir);
      return;
    }

    if (this.state === 'crouch') {
      E.wiggle = this.stateT > this.crouchFor * 0.45 ? 1 : 0;
      c.tailMood = 'hunt';
      if (dist > 520 * this.s || high || (dir !== c.dir && dist > 60 * this.s)) { this.sit(); return; }
      if (this.stateT >= this.crouchFor) this.startPounce(target.x);
      return;
    }

    if (high) {
      // Dot up on the wall: trot underneath and stare up at it
      if (dist > 90 * this.s) this.walkTo(target.x - dir * 40 * this.s, { run: dist > 400 * this.s, purpose: 'chase' });
      else if (this.state !== 'sit') this.sit();
      return;
    }

    if (dist > 300 * this.s) {
      this.walkTo(target.x - dir * 180 * this.s, { run: dist > 420 * this.s || kind === 'laser', purpose: 'chase' });
      return;
    }

    if (dist > 70 * this.s) {
      this.stopWalking();
      c.dir = dir;
      this.setState('crouch');
      this.crouchFor = kind === 'laser' ? rand(0.4, 0.9) : rand(0.7, 1.4);
      c.setPose('crouch', 6);
      return;
    }

    if (this.state !== 'sit') this.sit();
  }

  startPounce(tx) {
    const c = this.cat;
    this.setState('pounce');
    this.pounce = {
      x0: c.x,
      x1: clampN(tx - c.dir * 120 * this.s, this.minX, this.maxX),
      dur: 0.5 + Math.min(0.35, Math.abs(tx - c.x) / (1400 * this.s)),
      h: (38 + Math.min(52, Math.abs(tx - c.x) * 0.12 / this.s)) * this.s
    };
    c.setPose('pounce', 14);
  }

  updatePounce(dt) {
    const c = this.cat, P = this.pounce;
    const u = this.stateT / P.dur;
    c.x = P.x0 + (P.x1 - P.x0) * easeInOut(u);
    c.yOff = -Math.sin(Math.PI * clampN(u, 0, 1)) * P.h;
    c.speed = 0;
    if (u > 0.72) c.setPose('crouch', 12);
    if (u >= 1) {
      c.yOff = 0;
      this.sound('thump');
      this.lastPlay = this.time;
      this.happiness = Math.min(100, this.happiness + 2);
      const y = this.yarn;
      if (y) {
        const paw = c.pawWorld();
        if (Math.abs(y.x - paw.x) < 80 * this.s) this.whackYarn(c.dir);
      }
      this.cooldown = this.toy === 'laser' ? rand(0.5, 1.3) : rand(1.2, 2.4);
      this.setState('sit');
      c.setPose('sit', 4);
    }
  }

  startBat(dir) {
    this.stopWalking();
    this.cat.dir = dir;
    this.setState('bat');
    this.batHit = false;
    this.cat.setPose('bat', 13);
  }

  updateBat() {
    const c = this.cat;
    if (!this.batHit && this.stateT > 0.17) {
      this.batHit = true;
      const y = this.yarn;
      if (y) {
        const paw = c.pawWorld();
        if (Math.hypot(y.x - paw.x, y.y - paw.y) < 90 * this.s) this.whackYarn(c.dir);
      }
      this.lastPlay = this.time;
    }
    if (this.stateT > 0.5) {
      this.cooldown = rand(0.5, 1.1);
      this.sit();
    }
  }

  whackYarn(dir) {
    const y = this.yarn;
    y.push(dir * rand(380, 680) * this.s, -rand(220, 480) * this.s, this.time);
    this.sound('tap');
  }

  updateEat(dt) {
    const c = this.cat;
    c.chew = 0.28 * Math.max(0, Math.sin(this.stateT * 13));
    if (this.eating) c.lookTarget = { x: this.eating.x, y: this.eating.y };
    if (this.stateT > 1.9) {
      this.treats = this.treats.filter(t => t !== this.eating);
      this.eating = null;
      this.treatsEaten++;
      this.happiness = Math.min(100, this.happiness + 9);
      if (Math.random() < 0.6) this.sound('trill');
      this.updateStats();
      this.sit();
      if (!this.treats.length) this.setState('groom');
    }
  }

  /** Returns true while grooming should keep control. */
  updateGroom(dt) {
    const c = this.cat, E = c.extra;
    if (this.treats.length || (this.toy === 'laser' && this.time - this.pointer.lastMove < 0.5)) {
      this.sit();
      return false;
    }
    c.setPose('groom', 5);
    c.lookTarget = null;
    const lick = Math.sin(this.stateT * 7);
    E.pawLift = Math.max(0, lick) * 7;
    E.headRot = lick * 0.07;
    E.mouthOpen = lick > 0.3 ? 0.18 : 0;
    if (this.stateT > 3.4) {
      this.sit();
      return false;
    }
    return true;
  }

  updateYawn() {
    const c = this.cat, E = c.extra;
    if (this.stateT < 0.05) this.sound('yawn');
    const u = this.stateT / 1.7;
    E.mouthOpen = Math.sin(Math.PI * clampN(u, 0, 1)) * 0.95;
    E.eyeOpen = 1 - Math.sin(Math.PI * clampN(u, 0, 1)) * 0.75;
    E.earsBack = Math.sin(Math.PI * clampN(u, 0, 1)) * 0.3;
    E.headRot = -Math.sin(Math.PI * clampN(u, 0, 1)) * 0.15;
    if (u >= 1) this.sit();
  }

  updateWake() {
    const c = this.cat, E = c.extra, t = this.stateT;
    if (t < 0.9) {
      c.setPose('sit', 2.6);
      E.eyeOpen = t / 0.9 * 0.6;
    } else if (t < 1.9) {
      if (!this.yawned) { this.yawned = true; this.sound('yawn'); }
      const u = (t - 0.9) / 1.0;
      E.mouthOpen = Math.sin(Math.PI * u) * 0.95;
      E.eyeOpen = 0.3;
    } else if (t < 3.3) {
      c.setPose('stretch', 3.5);
    } else {
      this.yawned = false;
      this.sit();
      this.sound('trill');
      this.lastInteraction = this.time;
    }
  }

  updateAnnoyed() {
    const c = this.cat, E = c.extra;
    E.earsBack = 0.8;
    c.setPose('sit', 5);
    if (this.stateT > 1.1) {
      const away = this.pointer.x > c.x ? -1 : 1;
      let tx = c.x + away * 260 * this.s;
      if (tx < this.minX || tx > this.maxX) tx = c.x - away * 260 * this.s;
      this.petCooldown = 7;
      this.happiness = Math.max(0, this.happiness - 4);
      this.walkTo(tx, { purpose: 'away' });
    }
  }

  moveCat(dt) {
    const c = this.cat;
    if (this.state === 'pounce') return;

    if (this.goal && this.state === 'walk') {
      const dx = this.goal.x - c.x;
      if (Math.abs(dx) < 5 * this.s) {
        const g = this.goal;
        this.goal = null;
        c.speed *= 0.3;
        if (g.purpose === 'sleep') this.goSleep();
        else this.sit();
        if (g.onArrive) g.onArrive();
      } else {
        c.dir = Math.sign(dx);
        const top = (this.goal.run ? 300 : 105) * this.s;
        const target = Math.min(top, Math.abs(dx) * 3 + 25 * this.s) * c.dir;
        c.speed = approach(c.speed, target, 4, dt);
        c.setPose('stand', 7);
      }
    } else {
      c.speed = approach(c.speed, 0, 9, dt);
    }
    c.x = clampN(c.x + c.speed * dt, this.minX, this.maxX);

    // Settle into the bed cushion
    const inBed = Math.abs(c.x - this.room.bed.x) < 60 * this.s && ['sleep', 'wake', 'sit', 'pet', 'groom', 'yawn'].includes(this.state);
    c.yOff = approach(c.yOff, inBed ? -2 * this.s : 0, 6, dt);
  }

  // ==========================================
  // LOOP
  // ==========================================
  frame(dt) {
    this.time += dt;
    const p = this.pointer;
    if (this.time - p.lastMove > 0.1) p.speed *= Math.exp(-8 * dt);

    this.treats.forEach(t => t.update(dt, this.floorY));
    if (this.yarn) this.yarn.update(dt, this.floorY, this.stage.width);
    this.fx = this.fx.filter(f => f.update(dt));

    this.think(dt);
    this.moveCat(dt);
    this.cat.update(dt);

    this.happiness = Math.max(15, this.happiness - dt * 0.04);
    this.statsTimer -= dt;
    if (this.statsTimer <= 0) { this.statsTimer = 0.3; this.updateStats(); }

    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const { width: w, height: h, dpr } = this.stage;
    ctx.clearRect(0, 0, w, h);

    this.room.drawBack(ctx, this.theme, this.time);
    this.treats.forEach(t => t.draw(ctx));
    this.cat.draw(ctx, dpr);
    this.room.drawFront(ctx);
    if (this.yarn) this.yarn.draw(ctx, this.floorY);
    this.room.drawLighting(ctx, this.theme, this.time);

    this.fx.forEach(f => f.draw(ctx));
    const p = this.pointer;
    if (this.toy === 'laser' && p.inside) drawLaserDot(ctx, p.x, p.y, this.time, this.theme === 'night');
  }

  mood() {
    const st = this.state;
    if (st === 'sleep') return ['😴', 'Sleepy'];
    if (st === 'annoyed' || (this.goal && this.goal.purpose === 'away')) return ['😾', 'Grumpy'];
    if (st === 'pet') return ['😻', 'Loved'];
    if (st === 'eat') return ['😋', 'Munching'];
    if (['crouch', 'pounce', 'bat'].includes(st) || this.time - this.lastPlay < 4) return ['😸', 'Playful'];
    if (this.happiness > 65) return ['😌', 'Content'];
    if (this.happiness > 35) return ['🐱', 'Curious'];
    return ['😿', 'Lonely'];
  }

  updateStats() {
    const [icon, label] = this.mood();
    const moodIcon = document.getElementById('stat-mood-icon');
    if (!moodIcon) return;
    moodIcon.textContent = icon;
    document.getElementById('stat-mood').textContent = label;
    document.getElementById('stat-happy-bar').style.width = `${Math.round(this.happiness)}%`;
    document.getElementById('stat-happy').title = `Happiness ${Math.round(this.happiness)}%`;
    document.getElementById('stat-treats').textContent = this.treatsEaten;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  Shell.init({ storageKey: 'tinyworlds.cat' });
  window.catScene = new CatScene();
});
