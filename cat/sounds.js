/**
 * sounds.js - Cat soundscape on the shared AudioEngine
 * Soft room tone, a breathing purr, mews and trills, pounce thumps,
 * yarn taps and treat crunches. All synthesised.
 */
class CatSound extends AudioEngine {
  setupAmbient() {
    // Quiet room tone: lowpassed noise
    const room = this.loopNoise();
    const roomFilter = this.ctx.createBiquadFilter();
    roomFilter.type = 'lowpass';
    roomFilter.frequency.value = 280;
    const roomGain = this.ctx.createGain();
    roomGain.gain.value = 0.03;
    room.connect(roomFilter);
    roomFilter.connect(roomGain);
    roomGain.connect(this.master);

    // Purr: a low buzzy rumble that swells with each breath
    const rumble = this.ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.value = 26;
    const body = this.ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = 52;
    const purrFilter = this.ctx.createBiquadFilter();
    purrFilter.type = 'lowpass';
    purrFilter.frequency.value = 190;
    const breath = this.ctx.createGain();
    breath.gain.value = 0.55;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.55;
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 0.45;
    lfo.connect(lfoDepth);
    lfoDepth.connect(breath.gain);

    this.purrLevel = this.ctx.createGain();
    this.purrLevel.gain.value = 0;
    rumble.connect(purrFilter);
    body.connect(purrFilter);
    purrFilter.connect(breath);
    breath.connect(this.purrLevel);
    this.purrLevel.connect(this.master);
    rumble.start();
    body.start();
    lfo.start();
  }

  /** 0 … 1 purr intensity (smoothly ramped). */
  setPurr(level) {
    if (!this.purrLevel) return;
    this.purrLevel.gain.setTargetAtTime(level * 0.22, this.ctx.currentTime, 0.4);
  }

  mew() {
    const voice = { type: 'bandpass', freq: 950, q: 1.4 };
    this.tone({ type: 'sawtooth', freq: 520, glide: [[760, 0.14], [560, 0.42]], dur: 0.46, gain: 0.05, attack: 0.04, filter: voice });
  }

  trill() {
    const voice = { type: 'bandpass', freq: 800, q: 1.2 };
    this.tone({ type: 'triangle', freq: 360, glide: [[540, 0.12], [500, 0.24]], dur: 0.26, gain: 0.08, attack: 0.02, filter: voice });
    this.tone({ type: 'triangle', freq: 500, glide: [[610, 0.1]], dur: 0.16, gain: 0.05, attack: 0.02, delay: 0.2, filter: voice });
  }

  yawn() {
    this.tone({ type: 'sine', freq: 520, glide: [[300, 0.85]], dur: 0.95, gain: 0.03, attack: 0.15, filter: { type: 'lowpass', freq: 1200 } });
    this.noise({ dur: 0.9, gain: 0.015, type: 'bandpass', freq: 900, q: 0.6, attack: 0.2 });
  }

  thump() {
    this.noise({ dur: 0.2, gain: 0.25, type: 'lowpass', freq: 170 });
  }

  tap() {
    this.noise({ dur: 0.05, gain: 0.07, type: 'bandpass', freq: 1300, q: 0.8 });
    this.tone({ type: 'triangle', freq: 240, glide: [[160, 0.06]], dur: 0.07, gain: 0.05 });
  }

  crunch() {
    [0, 0.14, 0.29, 0.5].forEach(d =>
      this.noise({ dur: 0.05, gain: 0.09, type: 'bandpass', freq: 2400 + Math.random() * 800, q: 0.9, delay: d }));
  }

  playTreatLand() {
    this.tone({ type: 'triangle', freq: 1700, glide: [[1200, 0.03]], dur: 0.04, gain: 0.025 });
  }

  playYarnBounce() {
    this.noise({ dur: 0.08, gain: 0.05, type: 'lowpass', freq: 400 });
  }
}

window.soundManager = new CatSound();
