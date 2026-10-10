/**
 * sounds.js - Night train soundscape on the shared AudioEngine
 * A low rumble and wind that follow the speed, the clack of wheels over
 * rail joints, the horn, and the whoosh of tunnels and passing trains.
 */
class TrainSound extends AudioEngine {
  setupAmbient() {
    const src = this.loopNoise();
    const low = this.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 140;
    this.rumble = this.ctx.createGain();
    this.rumble.gain.value = 0.12;
    src.connect(low);
    low.connect(this.rumble);
    this.rumble.connect(this.master);

    const air = this.loopNoise();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 900;
    hp.Q.value = 0.5;
    this.wind = this.ctx.createGain();
    this.wind.gain.value = 0.02;
    air.connect(hp);
    hp.connect(this.wind);
    this.wind.connect(this.master);
  }

  /** 0 … 1 speed and how enclosed we are (tunnels are louder). */
  setMotion(speed, tunnel) {
    if (!this.rumble) return;
    const now = this.ctx.currentTime;
    this.rumble.gain.setTargetAtTime(0.08 + speed * 0.1 + tunnel * 0.12, now, 0.4);
    this.wind.gain.setTargetAtTime(0.008 + speed * 0.03 + tunnel * 0.02, now, 0.4);
  }

  /** Two wheel sets over one rail joint: "ta-tak". */
  clack(speed = 0.5) {
    const gap = 0.16 - speed * 0.08;
    for (const d of [0, gap]) {
      this.noise({ dur: 0.06, gain: 0.07, type: 'lowpass', freq: 900, delay: d });
      this.tone({ type: 'sine', freq: 70, glide: [[45, 0.07]], dur: 0.08, gain: 0.08, delay: d });
    }
  }

  horn() {
    const f = [311, 392];
    f.forEach((fr, i) => this.tone({ type: 'sawtooth', freq: fr, dur: 1.5, gain: 0.03, attack: 0.08, delay: i * 0.01, filter: { type: 'lowpass', freq: 1200 } }));
  }

  whoosh(long = false) {
    this.noise({ dur: long ? 1.6 : 1.1, gain: 0.12, type: 'bandpass', freq: 600, q: 0.6, attack: long ? 0.3 : 0.15 });
  }

  chime() {
    this.tone({ type: 'sine', freq: 784, dur: 0.9, gain: 0.025, attack: 0.01 });
    this.tone({ type: 'sine', freq: 622, dur: 1.1, gain: 0.025, attack: 0.01, delay: 0.35 });
  }
}

window.soundManager = new TrainSound();
