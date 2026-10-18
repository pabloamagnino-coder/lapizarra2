import type { Color, Creature } from '../engine/types';

/**
 * All sound is synthesized with Web Audio — no audio files to license or load.
 * The context is created lazily on the first user gesture (browser autoplay rules).
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: { stop: () => void } | null = null;
  muted = false;
  ambientOn = true;

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      if (this.ambientOn) this.startAmbient();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }

  private get ready() {
    return this.ctx && this.master && !this.muted ? { ctx: this.ctx, out: this.master } : null;
  }

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; vol?: number; slide?: number; delay?: number; attack?: number } = {},
  ) {
    const r = this.ready;
    if (!r) return;
    const t0 = r.ctx.currentTime + (opts.delay ?? 0);
    const osc = r.ctx.createOscillator();
    const g = r.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t0 + dur);
    const vol = opts.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(r.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, opts: { freq?: number; q?: number; vol?: number; delay?: number } = {}) {
    const r = this.ready;
    if (!r) return;
    const t0 = r.ctx.currentTime + (opts.delay ?? 0);
    const len = Math.ceil(r.ctx.sampleRate * dur);
    const buf = r.ctx.createBuffer(1, len, r.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = r.ctx.createBufferSource();
    src.buffer = buf;
    const f = r.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = opts.freq ?? 1800;
    f.Q.value = opts.q ?? 1.2;
    const g = r.ctx.createGain();
    g.gain.value = opts.vol ?? 0.5;
    src.connect(f).connect(g).connect(r.out);
    src.start(t0);
  }

  /** Wooden token clack; pitch varies by color. */
  place(color: Color) {
    const base: Record<Color, number> = {
      blue: 520, yellow: 600, green: 440, brown: 360, gray: 300, red: 480,
    };
    this.noise(0.08, { freq: 2200, q: 2, vol: 0.6 });
    this.tone(base[color], 0.12, { type: 'triangle', vol: 0.18, slide: 0.7 });
    if (color === 'blue') this.tone(900, 0.25, { vol: 0.05, slide: 1.8, delay: 0.03 });
  }

  pickup() {
    this.noise(0.12, { freq: 3000, q: 0.8, vol: 0.25 });
    [660, 880].forEach((f, i) => this.tone(f, 0.14, { type: 'triangle', vol: 0.1, delay: i * 0.05 }));
  }

  hover() {
    this.tone(1200, 0.04, { vol: 0.03 });
  }

  card() {
    this.noise(0.18, { freq: 5000, q: 0.5, vol: 0.2 });
    this.tone(740, 0.2, { type: 'sine', vol: 0.08, slide: 1.3 });
  }

  error() {
    this.tone(180, 0.18, { type: 'square', vol: 0.06, slide: 0.8 });
  }

  turn() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.35, { vol: 0.08, delay: i * 0.08 }));
  }

  /** Little call when an animal arrives, plus a sparkle arpeggio. */
  animal(kind: Creature) {
    switch (kind) {
      case 'bird':
        for (let i = 0; i < 4; i++) this.tone(2200 + Math.random() * 800, 0.08, { vol: 0.08, slide: 1.4, delay: i * 0.09 });
        break;
      case 'frog':
        this.tone(140, 0.15, { type: 'square', vol: 0.08, slide: 1.6 });
        this.tone(150, 0.15, { type: 'square', vol: 0.08, slide: 1.6, delay: 0.2 });
        break;
      case 'insect':
        this.tone(220, 0.6, { type: 'sawtooth', vol: 0.03, slide: 1.1 });
        break;
      case 'fish':
        this.noise(0.4, { freq: 900, q: 0.7, vol: 0.4 });
        this.tone(400, 0.2, { vol: 0.08, slide: 2 });
        break;
      case 'turtle':
        this.tone(200, 0.3, { type: 'triangle', vol: 0.1, slide: 0.9 });
        break;
      default:
        this.tone(330, 0.25, { type: 'triangle', vol: 0.12, slide: 1.3 });
        this.tone(250, 0.3, { type: 'triangle', vol: 0.1, slide: 0.8, delay: 0.18 });
    }
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.4, { vol: 0.06, delay: 0.25 + i * 0.07 }));
  }

  complete() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, { vol: 0.08, delay: i * 0.09, type: 'triangle' }));
  }

  victory() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, 0.45, { vol: 0.1, delay: i * 0.13, type: 'triangle' }));
  }

  setAmbient(on: boolean) {
    this.ambientOn = on;
    if (on) this.startAmbient();
    else {
      this.ambient?.stop();
      this.ambient = null;
    }
  }

  /** Soft wind bed + occasional birds. */
  private startAmbient() {
    if (!this.ctx || !this.master || this.ambient) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    lfo.start();
    const birds = window.setInterval(() => {
      if (Math.random() < 0.35) {
        const base = 2500 + Math.random() * 1500;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.tone(base, 0.07, { vol: 0.015, slide: 1.3, delay: i * 0.1 });
      }
    }, 3000);
    this.ambient = {
      stop: () => {
        src.stop();
        lfo.stop();
        window.clearInterval(birds);
      },
    };
  }
}
