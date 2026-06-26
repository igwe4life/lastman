import type { GameBus, SfxName } from '../gameplay/events';

/**
 * All sound is synthesized with the Web Audio API — no binary audio assets are
 * required for the POC. This covers ambient wind, intermittent birds, a soft
 * orchestral pad, footsteps and interaction SFX. To use real audio later, load
 * buffers (e.g. from public/assets/audio) and play them through `master`
 * instead of the oscillator graphs here; the bus contract stays the same.
 *
 * Must be started from a user gesture (browser autoplay policy) — Game starts
 * it on the "Begin Journey" click.
 */
export class AudioManager {
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicGain?: GainNode;
  private windGain?: GainNode;
  private started = false;
  private birdTimer = 0;

  constructor(private bus: GameBus) {
    bus.on('sfx', (name) => this.playSfx(name));
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    this.startWind();
    this.startMusic();
  }

  resume(): void {
    this.ctx?.resume();
  }

  setMasterVolume(v: number): void {
    if (this.master) this.master.gain.value = v;
  }

  // --- Ambient wind: filtered looping noise ---------------------------------
  private startWind(): void {
    if (!this.ctx || !this.master) return;
    const noise = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.6;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.08;

    // Slow LFO on the filter to make the wind gust.
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    noise.connect(filter).connect(this.windGain).connect(this.master);
    noise.start();
  }

  // --- Soft orchestral pad: stacked detuned oscillators ---------------------
  private startMusic(): void {
    if (!this.ctx || !this.master) return;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
    // Gentle fade-in.
    this.musicGain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 6);

    // A warm major chord (C major add9) with slow detune shimmer.
    const freqs = [130.81, 196.0, 261.63, 329.63, 392.0];
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      const g = this.ctx!.createGain();
      g.gain.value = 0.18 / freqs.length;

      // Slow tremolo so the pad breathes.
      const lfo = this.ctx!.createOscillator();
      const lfoGain = this.ctx!.createGain();
      lfo.frequency.value = 0.07 + i * 0.013;
      lfoGain.gain.value = g.gain.value * 0.6;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();

      osc.connect(g).connect(this.musicGain!);
      osc.start();
    });
  }

  /** Called each frame to schedule occasional birdsong. */
  update(dt: number): void {
    if (!this.ctx) return;
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 2 + Math.random() * 5;
      this.chirp();
    }
  }

  private chirp(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const base = 1800 + Math.random() * 1200;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 1.4, t + 0.08);
    osc.frequency.linearRampToValueAtTime(base * 0.9, t + 0.16);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.04, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // --- One-shot SFX ---------------------------------------------------------
  private playSfx(name: SfxName): void {
    if (!this.ctx || !this.master) return;
    switch (name) {
      case 'collect':
        this.blip(880, 0.08, 'sine', 0.12, 1.5);
        break;
      case 'buy':
        // Two-tone coin/cash-register chime.
        this.blip(1180, 0.07, 'square', 0.06, 1.0);
        window.setTimeout(() => this.blip(1560, 0.12, 'square', 0.06, 1.0), 70);
        break;
      case 'give':
        this.arpeggio([659, 880, 1046], 0.08);
        break;
      case 'pray':
        // Soft warm swell.
        this.blip(392, 0.6, 'sine', 0.08, 1.5);
        window.setTimeout(() => this.blip(587, 0.7, 'sine', 0.06, 1.2), 120);
        break;
      case 'event':
        // Rising sweep into a soft boom.
        this.sweep(180, 900, 1.4, 0.09);
        this.thud(0.12);
        break;
      case 'levelup':
        this.arpeggio([523, 659, 784, 1046, 1318], 0.1);
        break;
      case 'chime':
        this.blip(1320, 0.4, 'sine', 0.1, 2);
        break;
      case 'success':
        this.arpeggio([523, 659, 784, 1046], 0.1);
        break;
      case 'denied':
        this.blip(160, 0.18, 'square', 0.08, 0.6);
        break;
      case 'interact':
        this.blip(440, 0.1, 'triangle', 0.1, 1.2);
        break;
      case 'jump':
        this.blip(330, 0.12, 'triangle', 0.07, 2.2);
        break;
      case 'footstep':
        this.thud(0.05);
        break;
      case 'footstep-run':
        this.thud(0.08);
        break;
    }
  }

  private sweep(from: number, to: number, dur: number, vol: number): void {
    const t = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.25);
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number, pitchMul = 1): void {
    const t = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * pitchMul, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private arpeggio(freqs: number[], step: number): void {
    freqs.forEach((f, i) => {
      window.setTimeout(() => this.blip(f, 0.18, 'sine', 0.12), i * step * 1000);
    });
  }

  private thud(vol: number): void {
    const t = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.14);
  }
}
