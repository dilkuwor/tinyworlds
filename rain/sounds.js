/**
 * sounds.js - Rain soundscape on the shared AudioEngine
 * A two-layer rain bed (soft hiss + low patter), drips on the sill,
 * rolling thunder, and the squeak of a finger on wet glass.
 */
class RainSound extends AudioEngine {
  setupAmbient() {
    const noise = this.loopNoise();

    // High, airy hiss of rain on glass
    const hiss = this.ctx.createBiquadFilter();
    hiss.type = 'highpass';
    hiss.frequency.value = 2400;
    this.hissGain = this.ctx.createGain();
    this.hissGain.gain.value = 0;

    // Low, soft patter of rain on the street
    const body = this.ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 650;
    this.bodyGain = this.ctx.createGain();
    this.bodyGain.gain.value = 0;

    noise.connect(hiss);
    hiss.connect(this.hissGain);
    this.hissGain.connect(this.master);
    noise.connect(body);
    body.connect(this.bodyGain);
    this.bodyGain.connect(this.master);

    // Finger squeak: band-limited noise whose level follows the wipe speed
    const squeakSrc = this.loopNoise();
    const squeak = this.ctx.createBiquadFilter();
    squeak.type = 'bandpass';
    squeak.frequency.value = 1700;
    squeak.Q.value = 6;
    this.squeakGain = this.ctx.createGain();
    this.squeakGain.gain.value = 0;
    squeakSrc.connect(squeak);
    squeak.connect(this.squeakGain);
    this.squeakGain.connect(this.master);

    this.setLevel(this.level || 'steady');
  }

  setLevel(level) {
    this.level = level;
    if (!this.ctx || !this.hissGain) return;
    const mix = { light: [0.025, 0.06], steady: [0.045, 0.11], heavy: [0.075, 0.19] }[level] || [0.045, 0.11];
    const now = this.ctx.currentTime;
    this.hissGain.gain.setTargetAtTime(mix[0], now, 0.8);
    this.bodyGain.gain.setTargetAtTime(mix[1], now, 0.8);
  }

  /** 0 … 1 wipe speed. */
  setWipe(v) {
    if (!this.squeakGain) return;
    this.squeakGain.gain.setTargetAtTime(Math.min(1, v) * 0.05, this.ctx.currentTime, 0.04);
  }

  drip(size = 1) {
    const f = 1500 + Math.random() * 900 - size * 60;
    this.tone({ type: 'sine', freq: f, glide: [[f * 0.55, 0.09]], dur: 0.1, gain: 0.025 + Math.min(0.03, size * 0.004) });
  }

  thunder(strength = 1) {
    const delay = 0.6 + Math.random() * 1.8;
    this.noise({ dur: 0.5, gain: 0.12 * strength, type: 'lowpass', freq: 400, delay, attack: 0.01 });
    this.noise({ dur: 3.2, gain: 0.22 * strength, type: 'lowpass', freq: 140, delay: delay + 0.1, attack: 0.25 });
    this.noise({ dur: 2.6, gain: 0.14 * strength, type: 'lowpass', freq: 90, delay: delay + 0.9, attack: 0.4 });
  }
}

window.soundManager = new RainSound();
