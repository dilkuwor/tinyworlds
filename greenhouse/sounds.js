/**
 * sounds.js - Procedural audio engine for The Greenhouse
 * Synthesizes water sprays, droplets on glass and terracotta, leaf rustles,
 * brass roof vent hinge creaks, and subtle environmental ambience.
 */
class GreenhouseSound extends AudioEngine {
  constructor() {
    super();
    this.currentMood = 'midday';
    this.ventOpen = false;
  }

  setupAmbient() {
    const noise = this.loopNoise();

    // 1. Warm conservatory room tone (air circulation, greenhouse glass shelter)
    const airFilter = this.ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.value = 320;
    this.airGain = this.ctx.createGain();
    this.airGain.gain.value = 0.045;
    noise.connect(airFilter);
    airFilter.connect(this.airGain);
    this.airGain.connect(this.master);

    // 2. Breeze / draft layer (increases when roof vent is open)
    const breezeFilter = this.ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.value = 480;
    breezeFilter.Q.value = 1.8;
    this.breezeGain = this.ctx.createGain();
    this.breezeGain.gain.value = 0.015;
    noise.connect(breezeFilter);
    breezeFilter.connect(this.breezeGain);
    this.breezeGain.connect(this.master);

    // 3. Continuous watering stream node (created dynamically or modulated)
    const pourFilter = this.ctx.createBiquadFilter();
    pourFilter.type = 'bandpass';
    pourFilter.frequency.value = 1400;
    pourFilter.Q.value = 3.5;
    this.pourGain = this.ctx.createGain();
    this.pourGain.gain.value = 0;
    noise.connect(pourFilter);
    pourFilter.connect(this.pourGain);
    this.pourGain.connect(this.master);

    this.applyAtmosphere(this.currentMood, this.ventOpen);
  }

  applyAtmosphere(mood, ventOpen) {
    this.currentMood = mood;
    this.ventOpen = ventOpen;
    if (!this.ctx || !this.breezeGain) return;
    const now = this.ctx.currentTime;
    const breezeLevel = ventOpen ? 0.055 : 0.012;
    this.breezeGain.gain.setTargetAtTime(breezeLevel, now, 0.6);
  }

  /** Continuous watering stream level (0 to 1) */
  setWaterStream(level) {
    if (!this.audible || !this.pourGain) return;
    const now = this.ctx.currentTime;
    this.pourGain.gain.setTargetAtTime(Math.min(1, Math.max(0, level)) * 0.09, now, 0.08);
  }

  /** Single water droplet hitting leaf or soil */
  drip(size = 1) {
    if (!this.audible) return;
    const f0 = 1200 + Math.random() * 800 - size * 100;
    const f1 = f0 * (0.65 + Math.random() * 0.2);
    this.tone({
      type: 'sine',
      freq: f0,
      glide: [[f1, 0.06]],
      dur: 0.08,
      gain: 0.025 * size,
      attack: 0.002
    });
  }

  /** Fine aerosol mister spray */
  mist() {
    if (!this.audible) return;
    this.noise({
      dur: 0.24,
      gain: 0.06,
      type: 'bandpass',
      freq: 3200,
      q: 2.5,
      attack: 0.01
    });
  }

  /** Soft leaf brush / foliage rustle */
  leafRustle(intensity = 1) {
    if (!this.audible) return;
    const freq = 1800 + Math.random() * 600;
    this.noise({
      dur: 0.12 * intensity,
      gain: 0.035 * intensity,
      type: 'bandpass',
      freq,
      q: 1.2,
      attack: 0.01
    });
  }

  /** Resonant terracotta pot clink when touched or selected */
  potClink() {
    if (!this.audible) return;
    const baseFreq = 420 + Math.random() * 80;
    this.tone({
      type: 'triangle',
      freq: baseFreq,
      glide: [[baseFreq * 0.96, 0.08]],
      dur: 0.18,
      gain: 0.045,
      attack: 0.003
    });
    this.tone({
      type: 'sine',
      freq: baseFreq * 2.3,
      dur: 0.12,
      gain: 0.02,
      attack: 0.002
    });
  }

  /** Roof vent opening or closing: brass latch click & subtle iron creak */
  roofVent(open) {
    if (!this.audible) return;
    // Latch click
    this.tone({
      type: 'square',
      freq: open ? 1200 : 900,
      dur: 0.04,
      gain: 0.03,
      attack: 0.002
    });
    // Hinge creak
    const fStart = open ? 220 : 380;
    const fEnd = open ? 380 : 200;
    this.tone({
      type: 'sawtooth',
      freq: fStart,
      glide: [[fEnd, 0.25]],
      dur: 0.28,
      gain: 0.025,
      attack: 0.02
    });
  }

  /** Occasional birdsong outside the glass (morning/afternoon) */
  birdChirp() {
    if (!this.audible) return;
    const start = 2400 + Math.random() * 600;
    this.tone({
      type: 'sine',
      freq: start,
      glide: [[start + 600, 0.05], [start - 400, 0.12]],
      dur: 0.14,
      gain: 0.02,
      attack: 0.005
    });
  }
}

window.soundManager = new GreenhouseSound();
