/**
 * sounds.js - Aquarium soundscape on the shared AudioEngine
 * Gentle underwater hum, bubble pops, feeding plops and startle swooshes.
 */
class AquariumSound extends AudioEngine {
  setupAmbient() {
    // Gentle underwater hum: low sine + triangle through a lowpass filter
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 55;    // Low A
    osc2.type = 'triangle';
    osc2.frequency.value = 65.4;  // C
    filter.type = 'lowpass';
    filter.frequency.value = 140;
    gain.gain.value = 0.05;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc1.start();
    osc2.start();
  }

  playBubble(pitchMultiplier = 1) {
    const f = (400 + Math.random() * 300) * pitchMultiplier;
    this.tone({ freq: f, glide: [[f * 1.8, 0.08]], dur: 0.09, gain: 0.08 });
  }

  playFeed() {
    this.tone({ freq: 650, glide: [[1100, 0.06], [450, 0.14]], dur: 0.15, gain: 0.09 });
  }

  playStartle() {
    this.tone({ type: 'triangle', freq: 220, glide: [[110, 0.2]], dur: 0.22, gain: 0.12 });
  }
}

window.soundManager = new AquariumSound();
