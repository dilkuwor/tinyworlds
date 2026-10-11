/**
 * sounds.js - The Desk on the shared AudioEngine
 * Rain against the window, a quiet clock, the lamp switch, a purr when you
 * hover the cat, a bubble from the tank, and a soft chime as you step inside.
 */
class DeskSound extends AudioEngine {
  setupAmbient() {
    const rain = this.loopNoise();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = 0.035;
    rain.connect(lp);
    lp.connect(g);
    g.connect(this.master);

    // Purr, faded in only while the cat is under the pointer
    const rumble = this.ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.value = 26;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 180;
    this.purrGain = this.ctx.createGain();
    this.purrGain.gain.value = 0;
    rumble.connect(f);
    f.connect(this.purrGain);
    this.purrGain.connect(this.master);
    rumble.start();
  }

  tick(tock = false) {
    this.tone({ type: 'triangle', freq: tock ? 1500 : 1800, dur: 0.03, gain: 0.012 });
  }

  click() {
    this.noise({ dur: 0.04, gain: 0.08, type: 'bandpass', freq: 2500, q: 1.5 });
    this.tone({ type: 'square', freq: 180, glide: [[90, 0.03]], dur: 0.04, gain: 0.02 });
  }

  purr(on) {
    if (!this.purrGain) return;
    this.purrGain.gain.setTargetAtTime(on ? 0.12 : 0, this.ctx.currentTime, 0.3);
  }

  bubble() {
    const f = 500 + Math.random() * 300;
    this.tone({ freq: f, glide: [[f * 1.8, 0.08]], dur: 0.09, gain: 0.05 });
  }

  chime() {
    this.tone({ type: 'sine', freq: 660, dur: 1.2, gain: 0.04 });
    this.tone({ type: 'sine', freq: 990, dur: 1.0, gain: 0.025, delay: 0.1 });
  }

  wobble() {
    this.tone({ type: 'triangle', freq: 320, glide: [[260, 0.1]], dur: 0.12, gain: 0.025 });
  }
}

window.soundManager = new DeskSound();
