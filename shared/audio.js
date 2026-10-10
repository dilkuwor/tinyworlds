/**
 * audio.js - Shared procedural Web Audio engine for Tiny Worlds
 * Zero audio files: every sound is synthesised. Scenes extend AudioEngine,
 * build their ambience in setupAmbient() and use tone()/noise() for effects.
 * Everything routes through one master gain, so muting is a single ramp.
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.isMuted = true;
    this.isInitialized = false;
    this._noiseBuffer = null;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.isInitialized = true;
      this.setupAmbient();
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  /** Override in a scene to build looping ambience connected to this.master. */
  setupAmbient() {}

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.init();
    this.resume();
    this.isMuted = !this.isMuted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime, 0.25);
    }
    return this.isMuted;
  }

  /** True when effects should be played. */
  get audible() {
    return !this.isMuted && !!this.ctx;
  }

  get noiseBuffer() {
    if (!this._noiseBuffer && this.ctx) {
      const len = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBuffer = buffer;
    }
    return this._noiseBuffer;
  }

  /**
   * One-shot oscillator note with an optional pitch glide.
   * glide: array of [frequency, secondsFromStart] points after the start frequency.
   */
  tone({ type = 'sine', freq = 440, glide = [], dur = 0.15, gain = 0.08, attack = 0.005, delay = 0, filter = null } = {}) {
    if (!this.audible) return;
    try {
      this.resume();
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      glide.forEach(([f, at]) => osc.frequency.exponentialRampToValueAtTime(Math.max(1, f), t0 + at));

      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      let node = osc;
      if (filter) {
        const f = this.ctx.createBiquadFilter();
        f.type = filter.type || 'lowpass';
        f.frequency.value = filter.freq || 1000;
        f.Q.value = filter.q || 1;
        node.connect(f);
        node = f;
      }
      node.connect(amp);
      amp.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  /** One-shot filtered noise burst (thumps, taps, crunches, breaths). */
  noise({ dur = 0.1, gain = 0.08, type = 'lowpass', freq = 800, q = 1, attack = 0.004, delay = 0 } = {}) {
    if (!this.audible) return;
    try {
      this.resume();
      const t0 = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(amp);
      amp.connect(this.master);
      src.start(t0, Math.random() * 1.5);
      src.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  /** Looping noise source (for ambience), returned unconnected-to-output for further routing. */
  loopNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.start();
    return src;
  }
}

window.AudioEngine = AudioEngine;
