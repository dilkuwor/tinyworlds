/**
 * sounds.js - The Shoreline on the shared AudioEngine
 * A low surf that never stops, the rush of each wave up the sand and the
 * fizz as it slides back, gulls, a click of shells, and the sand under your finger.
 */
class ShoreSound extends AudioEngine {
  setupAmbient() {
    const c = this.ctx;
    const chain = (type, freq, q, gain) => {
      const src = this.loopNoise();
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = gain;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      return { f, g };
    };
    this.surf = chain('lowpass', 380, 0.7, 0.05);
    this.rush = chain('bandpass', 900, 0.5, 0);
    this.fizz = chain('highpass', 3200, 0.7, 0);
  }

  /** Follow the water: swash rushing up, backwash fizzing down (both 0 … 1). */
  water(swash, back) {
    if (!this.rush) return;
    const t = this.ctx.currentTime;
    this.rush.g.gain.setTargetAtTime(0.012 + swash * 0.09, t, 0.25);
    this.rush.f.frequency.setTargetAtTime(700 + swash * 600, t, 0.3);
    this.fizz.g.gain.setTargetAtTime(back * 0.025, t, 0.3);
  }

  gull() {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const f = 1250 + Math.random() * 250;
      this.tone({ type: 'sawtooth', freq: f, glide: [[f * 0.7, 0.3]], dur: 0.34, gain: 0.012, attack: 0.03, delay: i * 0.42, filter: { type: 'lowpass', freq: 2200, q: 2 } });
    }
  }

  clink() {
    this.tone({ freq: 1900, dur: 0.12, gain: 0.03, attack: 0.002 });
    this.tone({ freq: 2850, dur: 0.08, gain: 0.015, attack: 0.002, delay: 0.05 });
  }

  splash() {
    this.noise({ dur: 0.25, gain: 0.04, type: 'bandpass', freq: 1400, q: 0.8, attack: 0.01 });
  }

  scratch(speed = 0.5) {
    this.noise({ dur: 0.08, gain: 0.008 + speed * 0.012, type: 'bandpass', freq: 3500, q: 1.2, attack: 0.01 });
  }
}

window.soundManager = new ShoreSound();
