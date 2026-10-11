/**
 * sounds.js - The Snow Globe on the shared AudioEngine
 * A quiet room with a fire somewhere, the music box, water swishing when
 * you shake the globe, a tink on the glass, and the ratchet of the key.
 */
class SnowGlobeSound extends AudioEngine {
  setupAmbient() {
    const room = this.loopNoise();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.012;
    room.connect(lp);
    lp.connect(g);
    g.connect(this.master);
  }

  /** One music-box note: a pure comb tone with a short bright edge. */
  note(midi, bass, speed = 1) {
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const soft = 0.6 + 0.4 * speed;
    if (midi) {
      const f = hz(midi);
      this.tone({ freq: f, dur: 2.2, gain: 0.05 * soft, attack: 0.002 });
      this.tone({ freq: f * 2, dur: 0.8, gain: 0.012 * soft, attack: 0.002 });
      this.tone({ freq: f * 3.98, dur: 0.25, gain: 0.006 * soft, attack: 0.001 });
    }
    if (bass) this.tone({ freq: hz(bass), dur: 1.8, gain: 0.03 * soft, attack: 0.003 });
  }

  swish(s = 0.5) {
    this.noise({ dur: 0.35 + s * 0.3, gain: 0.02 + 0.04 * s, type: 'bandpass', freq: 450 + s * 450, q: 0.7, attack: 0.08 });
  }

  tink() {
    this.tone({ freq: 2600, dur: 0.5, gain: 0.03, attack: 0.001 });
    this.tone({ freq: 3900, dur: 0.25, gain: 0.014, attack: 0.001 });
  }

  ratchet() {
    for (let i = 0; i < 4; i++) this.noise({ dur: 0.02, gain: 0.05, type: 'bandpass', freq: 3000, q: 2, delay: i * 0.06 });
  }

  click() {
    this.noise({ dur: 0.04, gain: 0.06, type: 'bandpass', freq: 2200, q: 1.5 });
  }

  crackle() {
    this.noise({ dur: 0.03, gain: 0.012, type: 'highpass', freq: 1500 });
  }
}

window.soundManager = new SnowGlobeSound();
