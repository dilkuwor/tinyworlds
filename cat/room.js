/**
 * room.js - The cozy room the Ragdoll lives in
 * Wall, window with a sky that follows the lighting, curtains, a little
 * painting, wooden floor, rug, houseplant, floor lamp and a round cat bed.
 * Lighting is applied as a multiply tint over the whole scene, then light
 * sources (window beam, lamp, moon, dust motes) are added on top.
 */

const ROOM_THEMES = {
  morning: {
    label: 'Morning', icon: '🌅',
    wall: ['#f4e8da', '#ead8c4'], floor: ['#c9a07a', '#a57a55'],
    sky: ['#bfe1ff', '#ffe7cc'], curtain: '#a9bea6',
    tint: 'rgba(255, 238, 220, 1)', beam: 'rgba(255, 232, 190, A)', beamStrength: 0.55,
    lamp: false, dust: true
  },
  afternoon: {
    label: 'Afternoon', icon: '☀️',
    wall: ['#f6eee2', '#ecdfcd'], floor: ['#cfa57d', '#aa7f59'],
    sky: ['#79c1ff', '#d3ecff'], curtain: '#a9bea6',
    tint: null, beam: 'rgba(255, 249, 232, A)', beamStrength: 0.6,
    lamp: false, dust: true
  },
  evening: {
    label: 'Evening', icon: '🌇',
    wall: ['#f1d8be', '#e3c19f'], floor: ['#c3916a', '#94673f'],
    sky: ['#7b62b8', '#ff9c6e', '#ffd28a'], curtain: '#b6a58f',
    tint: 'rgba(255, 214, 178, 1)', beam: 'rgba(255, 176, 108, A)', beamStrength: 0.75,
    lamp: true, lampStrength: 0.35, dust: true
  },
  night: {
    label: 'Night', icon: '🌙',
    wall: ['#e9e3dc', '#ddd3c8'], floor: ['#b99a80', '#8e6f57'],
    sky: ['#0a1430', '#1d2c58'], curtain: '#9aa8a0',
    tint: 'rgba(82, 96, 150, 1)', beam: 'rgba(170, 190, 255, A)', beamStrength: 0.18,
    lamp: true, lampStrength: 0.9, dust: false
  }
};

class Room {
  constructor() {
    this.w = 0; this.h = 0; this.s = 1;
    this.floorY = 0;
    this.motes = Array.from({ length: 34 }, () => ({
      u: Math.random(), v: Math.random(), r: 0.6 + Math.random() * 1.6, ph: Math.random() * 10, sp: 0.2 + Math.random() * 0.5
    }));
    this.stars = Array.from({ length: 26 }, () => ({ u: Math.random(), v: Math.random() * 0.8, tw: Math.random() * 10 }));
    this.clouds = Array.from({ length: 3 }, (_, i) => ({ u: i / 3 + Math.random() * 0.2, v: 0.15 + Math.random() * 0.35, sz: 0.6 + Math.random() * 0.6 }));
  }

  layout(w, h, floorY, s) {
    Object.assign(this, { w, h, floorY, s });
    this.horizonY = floorY - 66 * s;
    const ww = Math.max(150, Math.min(w * 0.22, 360));
    const top = Math.max(60, h * 0.1);
    const wh = Math.max(120, Math.min((this.horizonY - top) * 0.62, 330));
    this.win = { x: w * 0.34 - ww / 2, y: top, w: ww, h: wh };
    this.painting = { x: w * 0.6, y: top + wh * 0.12, w: Math.max(80, Math.min(w * 0.1, 150)), h: Math.max(60, Math.min(w * 0.075, 110)) };
    this.plant = { x: Math.max(70 * s, w * 0.08), y: this.horizonY + 26 * s };
    this.lamp = { x: Math.min(w - 60 * s, w * 0.93), y: this.horizonY + 20 * s, top: Math.max(top + 30, this.horizonY - 330 * s) };
    this.bed = { x: Math.min(w * 0.78, w - 200 * s), y: floorY, rx: 120 * s, ry: 30 * s };
    this.rug = { x: w * 0.47, y: floorY + 8 * s, rx: Math.min(w * 0.34, 520 * s), ry: 26 * s };
  }

  // ---------- Behind the cat ----------
  drawBack(ctx, theme, t) {
    const T = ROOM_THEMES[theme];
    this.drawWall(ctx, T);
    this.drawWindow(ctx, T, t);
    this.drawPainting(ctx);
    this.drawFloor(ctx, T);
    this.drawRug(ctx);
    this.drawPlant(ctx, t);
    this.drawLampBody(ctx, T);
    this.drawBedBack(ctx);
  }

  drawWall(ctx, T) {
    const { w, horizonY: hy, s } = this;
    const g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, T.wall[0]);
    g.addColorStop(1, T.wall[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hy);

    // Faint wallpaper stripes
    ctx.fillStyle = 'rgba(120, 90, 60, 0.035)';
    for (let x = 0; x < w; x += 34) ctx.fillRect(x, 0, 12, hy);

    // Baseboard
    ctx.fillStyle = '#f8f3ec';
    ctx.fillRect(0, hy - 16 * s, w, 16 * s);
    ctx.fillStyle = 'rgba(90, 64, 44, 0.18)';
    ctx.fillRect(0, hy - 16 * s, w, 1.5);
    ctx.fillRect(0, hy - 1, w, 2);
  }

  drawWindow(ctx, T, t) {
    const { x, y, w, h } = this.win;
    const f = 10;

    // Sky
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    T.sky.forEach((c, i) => sky.addColorStop(i / (T.sky.length - 1), c));
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);

    if (T === ROOM_THEMES.evening) {
      const sun = ctx.createRadialGradient(x + w * 0.7, y + h * 0.82, 4, x + w * 0.7, y + h * 0.82, w * 0.45);
      sun.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
      sun.addColorStop(0.2, 'rgba(255, 200, 120, 0.5)');
      sun.addColorStop(1, 'rgba(255, 160, 100, 0)');
      ctx.fillStyle = sun;
      ctx.fillRect(x, y, w, h);
    }
    if (T.dust) {
      // Drifting clouds
      ctx.fillStyle = T === ROOM_THEMES.evening ? 'rgba(255, 210, 190, 0.55)' : 'rgba(255, 255, 255, 0.85)';
      this.clouds.forEach(c => {
        const cx = x + (((c.u + t * 0.006) % 1.4) - 0.2) * w;
        const cy = y + c.v * h;
        const r = 16 * c.sz;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx + r * 1.1, cy - r * 0.4, r * 1.25, 0, Math.PI * 2);
        ctx.arc(cx + r * 2.3, cy, r * 0.95, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // Distant rooftops / tree line
    ctx.fillStyle = T === ROOM_THEMES.night ? 'rgba(10, 16, 34, 0.9)' : 'rgba(110, 140, 120, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let i = 0; i <= 12; i++) {
      const px = x + (i / 12) * w;
      ctx.lineTo(px, y + h * (0.84 - 0.06 * Math.abs(Math.sin(i * 1.7))));
    }
    ctx.lineTo(x + w, y + h);
    ctx.fill();
    ctx.restore();

    // Frame and mullions
    ctx.strokeStyle = '#fbf8f3';
    ctx.lineWidth = f;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = f * 0.6;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.moveTo(x, y + h * 0.48);
    ctx.lineTo(x + w, y + h * 0.48);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90, 64, 44, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - f / 2, y - f / 2, w + f, h + f);

    // Sill
    ctx.fillStyle = '#fbf8f3';
    ctx.fillRect(x - 18, y + h + f / 2, w + 36, 9);
    ctx.fillStyle = 'rgba(90, 64, 44, 0.16)';
    ctx.fillRect(x - 18, y + h + f / 2 + 9, w + 36, 3);

    // Curtains
    const sway = Math.sin(t * 0.6) * 3;
    const drawCurtain = (cx, side) => {
      const cw = w * 0.28;
      const top = y - 26;
      const bottom = y + h + 46;
      ctx.fillStyle = T.curtain;
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx + side * cw, top);
      ctx.quadraticCurveTo(cx + side * cw * 0.55 + sway, (top + bottom) / 2, cx + side * cw * 0.75 + sway * 1.5, bottom);
      for (let i = 0; i <= 4; i++) {
        const px = cx + side * cw * 0.75 + sway * 1.5 - side * (i / 4) * cw * 0.95;
        ctx.lineTo(px, bottom + (i % 2 ? 6 : 0));
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.07)';
      ctx.lineWidth = 2;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + side * cw * k * 0.22, top + 4);
        ctx.quadraticCurveTo(cx + side * cw * k * 0.16 + sway, (top + bottom) / 2, cx + side * cw * k * 0.2 + sway, bottom);
        ctx.stroke();
      }
    };
    drawCurtain(x - f - 4, -1);
    drawCurtain(x + w + f + 4, 1);
    ctx.fillStyle = '#8b6b4f';
    ctx.fillRect(x - w * 0.38, y - 30, w * 1.76, 5);
  }

  drawPainting(ctx) {
    const { x, y, w, h } = this.painting;
    ctx.fillStyle = '#9b7653';
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#9fd4e6');
    g.addColorStop(0.62, '#3e8fb3');
    g.addColorStop(0.63, '#e8cf9e');
    g.addColorStop(1, '#d9b57c');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // A tiny orange fish, a nod to the aquarium
    ctx.fillStyle = '#ff8a3d';
    const fx = x + w * 0.42, fy = y + h * 0.38, fs = w * 0.08;
    ctx.beginPath();
    ctx.ellipse(fx, fy, fs, fs * 0.6, 0, 0, Math.PI * 2);
    ctx.moveTo(fx - fs * 0.8, fy);
    ctx.lineTo(fx - fs * 1.6, fy - fs * 0.6);
    ctx.lineTo(fx - fs * 1.6, fy + fs * 0.6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.strokeRect(x, y, w, h);
  }

  drawFloor(ctx, T) {
    const { w, h, horizonY: hy, s } = this;
    const g = ctx.createLinearGradient(0, hy, 0, h);
    g.addColorStop(0, T.floor[0]);
    g.addColorStop(1, T.floor[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, w, h - hy);

    // Planks: rows get taller toward the viewer
    ctx.strokeStyle = 'rgba(70, 45, 25, 0.14)';
    ctx.lineWidth = 1;
    let y = hy, gap = 9 * s, row = 0;
    while (y < h) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      const len = 220 + gap * 6;
      for (let x = (row % 2) * len * 0.5; x < w; x += len) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + gap);
        ctx.stroke();
      }
      y += gap;
      gap *= 1.28;
      row++;
    }
    // Soft shadow where the floor meets the wall
    const sh = ctx.createLinearGradient(0, hy, 0, hy + 24 * s);
    sh.addColorStop(0, 'rgba(60, 40, 25, 0.22)');
    sh.addColorStop(1, 'rgba(60, 40, 25, 0)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, hy, w, 24 * s);
  }

  drawRug(ctx) {
    const { x, y, rx, ry } = this.rug;
    const rings = ['#b8705e', '#e9cfa6', '#86a39b', '#e9cfa6', '#c98a6d'];
    rings.forEach((c, i) => {
      const k = 1 - i * 0.16;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    // Fringe
    ctx.strokeStyle = 'rgba(240, 225, 200, 0.85)';
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      for (let k = -4; k <= 4; k++) {
        const py = y + k * ry * 0.18;
        const px = x + side * rx * Math.sqrt(Math.max(0, 1 - (k * 0.18) ** 2));
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + side * 9 * this.s, py + 1);
        ctx.stroke();
      }
    }
  }

  drawPlant(ctx, t) {
    const { x, y } = this.plant;
    const s = this.s;
    // Leaves
    const leaves = [
      [-1.9, 120, 0.9], [-1.55, 150, 1], [-1.25, 135, 0.95], [-2.2, 100, 0.85],
      [-0.95, 110, 0.85], [-1.7, 170, 1.05], [-1.4, 95, 0.8]
    ];
    leaves.forEach(([a, len, k], i) => {
      const sway = Math.sin(t * 0.7 + i) * 0.03;
      const ang = a + sway;
      const L = len * s;
      const bx = x, by = y - 58 * s;
      const tx = bx + Math.cos(ang) * L, ty = by + Math.sin(ang) * L;
      ctx.strokeStyle = '#4f7a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(ang) * L * 0.5, by + Math.sin(ang) * L * 0.6, tx, ty);
      ctx.stroke();
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = i % 2 ? '#6f9e5f' : '#5d8c50';
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * s * k, 34 * s * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -30 * s * k);
      ctx.lineTo(0, 30 * s * k);
      ctx.stroke();
      ctx.restore();
    });
    // Pot
    ctx.fillStyle = '#c4714e';
    ctx.beginPath();
    ctx.moveTo(x - 40 * s, y - 70 * s);
    ctx.lineTo(x + 40 * s, y - 70 * s);
    ctx.lineTo(x + 30 * s, y);
    ctx.lineTo(x - 30 * s, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b0623f';
    ctx.fillRect(x - 44 * s, y - 78 * s, 88 * s, 14 * s);
    ctx.fillStyle = 'rgba(40, 25, 15, 0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 38 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLampBody(ctx, T) {
    const { x, y, top } = this.lamp;
    const s = this.s;
    ctx.fillStyle = 'rgba(40, 25, 15, 0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 34 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d3a37';
    ctx.beginPath();
    ctx.ellipse(x, y - 4 * s, 30 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3d3a37';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * s);
    ctx.lineTo(x, top + 40 * s);
    ctx.stroke();
    // Shade
    ctx.fillStyle = T.lamp ? '#f8e6c6' : '#efe3cf';
    ctx.beginPath();
    ctx.moveTo(x - 30 * s, top);
    ctx.lineTo(x + 30 * s, top);
    ctx.lineTo(x + 52 * s, top + 62 * s);
    ctx.lineTo(x - 52 * s, top + 62 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 64, 44, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawBedBack(ctx) {
    const { x, y, rx, ry } = this.bed;
    const s = this.s;
    // Rim side (in shadow) and rim top
    ctx.fillStyle = '#b98f80';
    ctx.beginPath();
    ctx.ellipse(x, y - 8 * s, rx, ry * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    const top = ctx.createLinearGradient(0, y - 60 * s, 0, y);
    top.addColorStop(0, '#ead0c2');
    top.addColorStop(1, '#d4ad9c');
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.ellipse(x, y - 24 * s, rx, ry * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cushion in the hollow
    const cg = ctx.createRadialGradient(x, y - 30 * s, 6, x, y - 26 * s, rx * 0.8);
    cg.addColorStop(0, '#fbf6f0');
    cg.addColorStop(1, '#e2d5c8');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(x, y - 26 * s, rx * 0.74, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 80, 60, 0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y - 30 * s, rx * 0.74, ry * 0.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // ---------- In front of the cat ----------
  drawFront(ctx) {
    const { x, y, rx, ry } = this.bed;
    const s = this.s;
    // Front of the rim, drawn over the cat so it sinks into the bed
    const g = ctx.createLinearGradient(0, y - 30 * s, 0, y + 26 * s);
    g.addColorStop(0, '#e6c9ba');
    g.addColorStop(0.45, '#d2aa98');
    g.addColorStop(1, '#ad8373');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y - 8 * s, rx, ry * 1.1, 0, 0, Math.PI);
    ctx.lineTo(x - rx, y - 24 * s);
    ctx.ellipse(x, y - 26 * s, rx * 0.74, ry * 0.7, 0, Math.PI, 0, true);
    ctx.lineTo(x + rx, y - 24 * s);
    ctx.closePath();
    ctx.fill();
    // Soft highlight along the rim
    ctx.strokeStyle = 'rgba(255, 245, 235, 0.55)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.ellipse(x, y - 24 * s, rx * 0.9, ry * 0.98, 0, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
  }

  // ---------- Lighting ----------
  drawLighting(ctx, theme, t) {
    const T = ROOM_THEMES[theme];
    const { w, h, s } = this;

    if (T.tint) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = T.tint;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Window light falling across the room and onto the floor
    const { x, y, w: ww, h: wh } = this.win;
    const shift = (this.floorY - (y + wh)) * 0.55;
    const beam = ctx.createLinearGradient(x, y + wh, x + shift, this.floorY + 30 * s);
    beam.addColorStop(0, T.beam.replace('A', (0.32 * T.beamStrength).toFixed(3)));
    beam.addColorStop(1, T.beam.replace('A', '0'));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x, y + wh * 0.2);
    ctx.lineTo(x + ww, y + wh * 0.2);
    ctx.lineTo(x + ww + shift * 1.25, this.floorY + 40 * s);
    ctx.lineTo(x + shift * 0.9, this.floorY + 40 * s);
    ctx.closePath();
    ctx.fill();

    const pool = ctx.createRadialGradient(x + ww / 2 + shift, this.floorY + 10 * s, 10, x + ww / 2 + shift, this.floorY + 10 * s, ww * 0.9);
    pool.addColorStop(0, T.beam.replace('A', (0.35 * T.beamStrength).toFixed(3)));
    pool.addColorStop(1, T.beam.replace('A', '0'));
    ctx.fillStyle = pool;
    ctx.fillRect(0, this.horizonY, w, h - this.horizonY);

    if (T.dust) {
      this.motes.forEach(m => {
        const v = (m.v + t * 0.01 * m.sp) % 1;
        const px = x + m.u * ww + v * shift + Math.sin(t * 0.5 + m.ph) * 10;
        const py = y + wh * 0.25 + v * (this.floorY - y - wh * 0.25);
        const a = 0.5 * Math.sin(v * Math.PI) * T.beamStrength;
        ctx.fillStyle = `rgba(255, 245, 225, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, m.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (theme === 'night') {
      // Moon and stars stay luminous through the tint
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, ww, wh);
      ctx.clip();
      this.stars.forEach(st => {
        const a = 0.45 + 0.45 * Math.sin(t * 1.3 + st.tw);
        ctx.fillStyle = `rgba(230, 236, 255, ${a.toFixed(3)})`;
        ctx.fillRect(x + st.u * ww, y + st.v * wh * 0.75, 1.6, 1.6);
      });
      const mx = x + ww * 0.72, my = y + wh * 0.26;
      const glow = ctx.createRadialGradient(mx, my, 2, mx, my, ww * 0.35);
      glow.addColorStop(0, 'rgba(230, 236, 255, 0.55)');
      glow.addColorStop(1, 'rgba(230, 236, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, ww, wh);
      ctx.fillStyle = '#f4f1e4';
      ctx.beginPath();
      ctx.arc(mx, my, ww * 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (T.lamp) {
      const { x: lx, top } = this.lamp;
      const k = T.lampStrength;
      const glow = ctx.createRadialGradient(lx, top + 70 * s, 10, lx, top + 140 * s, 520 * s);
      glow.addColorStop(0, `rgba(255, 196, 120, ${(0.55 * k).toFixed(3)})`);
      glow.addColorStop(0.4, `rgba(255, 170, 90, ${(0.2 * k).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(255, 150, 70, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = `rgba(255, 226, 170, ${(0.85 * k).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(lx - 30 * s, top);
      ctx.lineTo(lx + 30 * s, top);
      ctx.lineTo(lx + 52 * s, top + 62 * s);
      ctx.lineTo(lx - 52 * s, top + 62 * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Gentle vignette
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, theme === 'night' ? 'rgba(5, 8, 20, 0.45)' : 'rgba(60, 40, 20, 0.18)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}

window.Room = Room;
window.ROOM_THEMES = ROOM_THEMES;
