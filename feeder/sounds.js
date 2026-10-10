/**
 * sounds.js - Garden soundscape on the shared AudioEngine
 * A soft breeze, faint distant birds, and a call for each species:
 * sparrow chirps, goldfinch twitter, chickadee "fee-bee", cardinal
 * "cheer-cheer", blue jay "jay!", robin warble, plus wing flutters.
 */
class FeederSound extends AudioEngine {
  setupAmbient() {
    const breeze = this.loopNoise();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = this.ctx.createGain();
    g.gain.value = 0.035;
    breeze.connect(lp);
    lp.connect(g);
    g.connect(this.master);
  }

  whistle(freq, to, dur, gain = 0.05, delay = 0, type = 'sine') {
    this.tone({ type, freq, glide: [[to, dur * 0.9]], dur, gain, attack: 0.01, delay });
  }

  song(species, distant = false) {
    const g = distant ? 0.012 : 0.045;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (species) {
      case 'sparrow': {
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.whistle(r(3300, 3900), r(4200, 4700), 0.07, g, i * 0.13);
        break;
      }
      case 'goldfinch': {
        for (let i = 0; i < 7; i++) this.whistle(r(3000, 4800), r(3200, 5200), 0.05, g * 0.8, i * 0.07);
        break;
      }
      case 'chickadee': {
        this.whistle(4100, 4000, 0.32, g);
        this.whistle(3500, 3450, 0.36, g, 0.38);
        break;
      }
      case 'cardinal': {
        for (let i = 0; i < 3; i++) this.whistle(4400, 2300, 0.26, g, i * 0.32);
        break;
      }
      case 'bluejay': {
        this.tone({ type: 'sawtooth', freq: 900, glide: [[700, 0.22]], dur: 0.24, gain: g * 0.8, filter: { type: 'bandpass', freq: 2200, q: 2 } });
        this.noise({ dur: 0.18, gain: g * 0.4, type: 'bandpass', freq: 2600, q: 3 });
        break;
      }
      case 'robin': {
        for (let i = 0; i < 6; i++) {
          const f = r(2400, 4600);
          this.whistle(f, f * r(0.85, 1.2), r(0.08, 0.16), g * 0.8, i * 0.15);
        }
        break;
      }
    }
  }

  /** Distant birds now and then, so the garden never feels empty. */
  ambientChirp() {
    const pool = ['sparrow', 'goldfinch', 'chickadee', 'robin'];
    this.song(pool[Math.floor(Math.random() * pool.length)], true);
  }

  flutter(count = 1) {
    const n = Math.min(10, 5 + count * 2);
    for (let i = 0; i < n; i++) {
      this.noise({ dur: 0.04, gain: 0.05, type: 'bandpass', freq: 700 + Math.random() * 500, q: 0.8, delay: i * 0.035 });
    }
  }

  scatter() {
    for (let i = 0; i < 8; i++) {
      this.noise({ dur: 0.03, gain: 0.035, type: 'highpass', freq: 3000, delay: i * 0.025 + Math.random() * 0.02 });
    }
  }

  pour() {
    this.noise({ dur: 0.9, gain: 0.04, type: 'bandpass', freq: 2600, q: 0.7, attack: 0.1 });
  }
}

window.soundManager = new FeederSound();
