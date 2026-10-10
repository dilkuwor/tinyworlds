/**
 * sounds.js - Night meadow soundscape on the shared AudioEngine
 * A soft breeze, several crickets chirping at their own pace, the odd frog,
 * a gentle chime when you call the fireflies, and a shimmer for shooting stars.
 */
class MeadowSound extends AudioEngine {
  setupAmbient() {
    const wind = this.loopNoise();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.035;
    wind.connect(lp);
    lp.connect(this.windGain);
    this.windGain.connect(this.master);

    // Slow gusts
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = this.ctx.createGain();
    depth.gain.value = 0.02;
    lfo.connect(depth);
    depth.connect(this.windGain.gain);
    lfo.start();
  }

  /** One cricket chirp: a few fast pulses of a high, pure tone. */
  cricket(pitch = 4500, gain = 0.018, pulses = 3) {
    for (let i = 0; i < pulses; i++) {
      this.tone({ type: 'sine', freq: pitch, dur: 0.028, gain, attack: 0.004, delay: i * 0.045 });
    }
  }

  frog() {
    const base = 110 + Math.random() * 60;
    for (let i = 0; i < 2; i++) {
      this.tone({ type: 'sawtooth', freq: base, glide: [[base * 1.4, 0.08]], dur: 0.12, gain: 0.04, delay: i * 0.16, filter: { type: 'bandpass', freq: 600, q: 2 } });
    }
  }

  chime() {
    this.tone({ type: 'sine', freq: 660, dur: 1.6, gain: 0.035, attack: 0.02 });
    this.tone({ type: 'sine', freq: 990, dur: 1.4, gain: 0.02, attack: 0.02, delay: 0.08 });
    this.tone({ type: 'sine', freq: 1320, dur: 1.1, gain: 0.012, attack: 0.02, delay: 0.16 });
  }

  shimmer() {
    this.tone({ type: 'sine', freq: 2400, glide: [[3600, 0.7]], dur: 0.8, gain: 0.012, attack: 0.1 });
  }
}

window.soundManager = new MeadowSound();
