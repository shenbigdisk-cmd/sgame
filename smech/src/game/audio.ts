import type { VehicleType } from './types';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rr = (a: number, b: number) => a + Math.random() * (b - a);

interface NoiseOpts {
  dur: number;
  type: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  gain: number;
  delay?: number;
  attack?: number;
}

interface ToneOpts {
  type: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  gain: number;
  delay?: number;
  attack?: number;
}

interface EngineProfile {
  base: number;
  cutoff: number;
  rumble: number;
  turbine: boolean;
}

const PROFILES: Record<VehicleType, EngineProfile> = {
  warden: { base: 64, cutoff: 420, rumble: 7, turbine: true },
  pyre: { base: 46, cutoff: 300, rumble: 4.6, turbine: true },
  glacier: { base: 88, cutoff: 540, rumble: 8.5, turbine: true },
};

interface EngineNodes {
  oscs: OscillatorNode[];
  filter: BiquadFilterNode;
  gain: GainNode;
  lfo: OscillatorNode;
  servo: { osc: OscillatorNode; gain: GainNode } | null;
  clatter: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null;
  type: VehicleType;
}

interface MusicState {
  timer: number;
  step: number;
  next: number;
  intensity: number;
  target: number;
  droneGain: GainNode;
  droneFilter: BiquadFilterNode;
  oscs: OscillatorNode[];
  lfo: OscillatorNode;
  bass: BiquadFilterNode;
}

// A-minor pentatonic-ish bass pattern (Hz), two bars
const BASS_PATTERN = [55, 0, 0, 55, 0, 0, 65.41, 0, 55, 0, 0, 82.41, 0, 73.42, 0, 65.41];

/**
 * Fully procedural audio: weapons, explosions, engines, ambience and an adaptive score are
 * synthesised with the Web Audio API. Sounds are positional (stereo pan, distance muffling and
 * speed-of-sound delay) and share a procedurally generated reverb.
 */
export class AudioManager {
  ctx: AudioContext;
  private master: GainNode;
  private sfx: GainNode;
  private musicGain: GainNode;
  private reverbIn: GainNode;
  private noise: AudioBuffer;
  private engine: EngineNodes | null = null;
  private ambience: { out: GainNode; sources: AudioScheduledSourceNode[] } | null = null;
  private ambienceTimer = 0;
  private wading: { gain: GainNode; src: AudioBufferSourceNode } | null = null;
  private music: MusicState | null = null;
  private musicOn = true;
  private musicVolume = 0.6;
  private lastMg = 0;
  private mgCount = 0;

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.75;
    this.master.connect(comp);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.17;
    this.musicGain.connect(this.master);

    // procedural reverb impulse: decaying stereo noise with a few early reflections
    const len = Math.floor(ctx.sampleRate * 2.4);
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      for (const tap of [0.021, 0.037, 0.059, 0.083]) data[Math.floor(tap * ctx.sampleRate + ch * 40)] += 0.5 * (ch ? -1 : 1);
    }
    const conv = ctx.createConvolver();
    conv.buffer = impulse;
    this.reverbIn = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverbIn.connect(conv);
    conv.connect(wet);
    wet.connect(this.master);

    const n = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  // ---------------------------------------------------------------------------
  // Core helpers
  // ---------------------------------------------------------------------------
  resume() {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number) {
    this.master.gain.value = clamp(v, 0, 1);
  }

  /** Music level, independent of the master volume. */
  setMusicVolume(v: number) {
    this.musicVolume = clamp(v, 0, 1);
    this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.17 * this.musicVolume : 0, this.ctx.currentTime, 0.25);
  }

  isMusicOn() {
    return this.musicOn;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.17 * this.musicVolume : 0, this.ctx.currentTime, 0.25);
    return this.musicOn;
  }

  /** gain -> [lowpass] -> [pan] -> sfx (+ reverb send) */
  private route(pan = 0, wet = 0.2, cutoff = 20000, gain = 1): GainNode {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = gain;
    let node: AudioNode = g;
    if (cutoff < 19000) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = Math.max(400, cutoff);
      node.connect(f);
      node = f;
    }
    if (Math.abs(pan) > 0.02 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      node.connect(p);
      node = p;
    }
    node.connect(this.sfx);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      node.connect(s);
      s.connect(this.reverbIn);
    }
    return g;
  }

  private spatial(dist: number) {
    return {
      g: Math.pow(clamp(1 - dist / 340, 0, 1), 1.35),
      cutoff: 17000 - clamp(dist / 300, 0, 1) * 15800,
      delay: clamp(dist / 343, 0, 0.9),
    };
  }

  private noiseAt(dest: AudioNode, t0: number, o: NoiseOpts) {
    const ctx = this.ctx;
    const t = t0 + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = o.type;
    filt.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) filt.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 20), t + o.dur);
    filt.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(filt).connect(g).connect(dest);
    src.start(t, Math.random() * 1.2);
    src.stop(t + o.dur + 0.05);
  }

  private toneAt(dest: AudioNode, t0: number, o: ToneOpts) {
    const ctx = this.ctx;
    const t = t0 + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 10), t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  private N(dest: AudioNode, o: NoiseOpts) {
    this.noiseAt(dest, this.ctx.currentTime, o);
  }
  private T(dest: AudioNode, o: ToneOpts) {
    this.toneAt(dest, this.ctx.currentTime, o);
  }

  // ---------------------------------------------------------------------------
  // Player weapons
  // ---------------------------------------------------------------------------
  playCannon() {
    const d = this.route(0, 0.5);
    this.N(d, { dur: 0.06, type: 'highpass', f0: 1800, gain: 0.55 });
    this.N(d, { dur: 0.6, type: 'lowpass', f0: 1600, f1: 70, gain: 0.95 });
    this.T(d, { type: 'sine', f0: 130, f1: 26, dur: 0.55, gain: 0.95 });
    this.T(d, { type: 'triangle', f0: 70, f1: 20, dur: 0.85, gain: 0.5, delay: 0.02 });
    this.N(d, { dur: 1.6, type: 'lowpass', f0: 260, f1: 40, gain: 0.32, attack: 0.08, delay: 0.04 });
    // breech clack
    this.T(d, { type: 'square', f0: 520, f1: 180, dur: 0.05, gain: 0.07, delay: 0.17 });
    this.N(d, { dur: 0.04, type: 'bandpass', f0: 2300, q: 2, gain: 0.12, delay: 0.18 });
  }

  playRail() {
    const d = this.route(0, 0.55);
    this.T(d, { type: 'sawtooth', f0: 260, f1: 2600, dur: 0.26, gain: 0.12, attack: 0.15 });
    this.N(d, { dur: 0.14, type: 'highpass', f0: 3200, gain: 0.8, delay: 0.26 });
    this.T(d, { type: 'sine', f0: 100, f1: 20, dur: 0.6, gain: 0.95, delay: 0.26 });
    this.T(d, { type: 'triangle', f0: 4600, f1: 900, dur: 0.55, gain: 0.1, delay: 0.26 });
    this.N(d, { dur: 1.1, type: 'lowpass', f0: 500, f1: 50, gain: 0.3, delay: 0.3 });
  }

  playMG() {
    const now = this.ctx.currentTime;
    if (now - this.lastMg < 0.03) return;
    this.lastMg = now;
    this.mgCount++;
    const d = this.route(0, 0.12);
    const f = rr(1400, 1800);
    this.N(d, { dur: 0.06, type: 'bandpass', f0: f, f1: 420, q: 0.7, gain: 0.26 });
    this.T(d, { type: 'square', f0: rr(220, 280), f1: 60, dur: 0.045, gain: 0.1 });
    if (this.mgCount % 5 === 0) this.T(d, { type: 'sine', f0: rr(3300, 4200), dur: 0.07, gain: 0.035, delay: rr(0.1, 0.18) });
  }

  playMissile() {
    const d = this.route(0, 0.3);
    this.N(d, { dur: 0.7, type: 'bandpass', f0: 420, f1: 2600, q: 1.1, gain: 0.34, attack: 0.03 });
    this.T(d, { type: 'sawtooth', f0: 170, f1: 640, dur: 0.4, gain: 0.07 });
    this.T(d, { type: 'sine', f0: 90, f1: 40, dur: 0.25, gain: 0.5 });
  }

  playEmp() {
    const d = this.route(0, 0.55);
    this.N(d, { dur: 0.85, type: 'bandpass', f0: 3200, f1: 180, q: 1.6, gain: 0.38 });
    this.T(d, { type: 'sawtooth', f0: 1800, f1: 55, dur: 0.75, gain: 0.12 });
    this.T(d, { type: 'sine', f0: 60, f1: 30, dur: 0.7, gain: 0.55 });
    for (let i = 0; i < 9; i++) this.N(d, { dur: 0.03, type: 'highpass', f0: rr(3500, 6000), gain: 0.16, delay: 0.05 + i * 0.07 });
  }

  playArc() {
    const d = this.route(0, 0.3);
    for (let i = 0; i < 7; i++) this.N(d, { dur: 0.03, type: 'highpass', f0: rr(3000, 6500), gain: 0.18, delay: i * 0.035 });
    this.T(d, { type: 'square', f0: 1200, f1: 300, dur: 0.18, gain: 0.05 });
  }

  playShieldUp() {
    const d = this.route(0, 0.4);
    this.T(d, { type: 'sine', f0: 220, f1: 880, dur: 0.5, gain: 0.18, attack: 0.05 });
    this.T(d, { type: 'triangle', f0: 440, f1: 1320, dur: 0.45, gain: 0.08, delay: 0.08 });
  }

  playShieldDown() {
    const d = this.route(0, 0.45);
    this.T(d, { type: 'sine', f0: 900, f1: 130, dur: 0.6, gain: 0.18 });
    this.N(d, { dur: 0.35, type: 'highpass', f0: 2500, gain: 0.14 });
    this.T(d, { type: 'square', f0: 140, f1: 55, dur: 0.4, gain: 0.08, delay: 0.1 });
  }

  playShieldHit() {
    const d = this.route(0, 0.3);
    this.T(d, { type: 'sine', f0: rr(1100, 1400), f1: 650, dur: 0.12, gain: 0.14 });
    this.N(d, { dur: 0.08, type: 'bandpass', f0: 3000, q: 2, gain: 0.1 });
  }

  playStrikeCall() {
    const d = this.route(0, 0.2);
    this.N(d, { dur: 0.28, type: 'bandpass', f0: 1800, q: 5, gain: 0.1 });
    [880, 880, 1320].forEach((f, i) => this.T(d, { type: 'square', f0: f, dur: 0.08, gain: 0.06, delay: 0.1 + i * 0.12 }));
  }

  playIncoming() {
    const d = this.route(0, 0.35);
    this.T(d, { type: 'sine', f0: 2400, f1: 450, dur: 1.4, gain: 0.12, attack: 0.1 });
    this.N(d, { dur: 1.3, type: 'bandpass', f0: 1800, f1: 400, q: 3, gain: 0.05, attack: 0.2 });
  }

  playCrit() {
    const d = this.route(0, 0.3);
    this.T(d, { type: 'triangle', f0: 1800, f1: 2600, dur: 0.1, gain: 0.14 });
    this.T(d, { type: 'sine', f0: 3200, dur: 0.18, gain: 0.05, delay: 0.04 });
  }

  // ---------------------------------------------------------------------------
  // Enemy & world sounds (positional)
  // ---------------------------------------------------------------------------
  playFlame() {
    const now = this.ctx.currentTime;
    if (now - this.lastMg < 0.05) return;
    this.lastMg = now;
    const d = this.route(0, 0.15);
    this.N(d, { dur: 0.16, type: 'lowpass', f0: 900, f1: 200, gain: 0.4, attack: 0.02 });
    this.N(d, { dur: 0.1, type: 'bandpass', f0: 2400, q: 0.8, gain: 0.1 });
  }

  playCryo() {
    const now = this.ctx.currentTime;
    if (now - this.lastMg < 0.05) return;
    this.lastMg = now;
    const d = this.route(0, 0.2);
    this.T(d, { type: 'sine', f0: 2400, f1: 3600, dur: 0.14, gain: 0.08 });
    this.N(d, { dur: 0.12, type: 'highpass', f0: 5000, gain: 0.08 });
    this.T(d, { type: 'triangle', f0: 880, f1: 1320, dur: 0.1, gain: 0.05 });
  }

  playJump() {
    const d = this.route(0, 0.4);
    this.N(d, { dur: 0.55, type: 'bandpass', f0: 320, f1: 2100, q: 0.9, gain: 0.42, attack: 0.03 });
    this.T(d, { type: 'sawtooth', f0: 90, f1: 280, dur: 0.45, gain: 0.12, attack: 0.02 });
    this.T(d, { type: 'sine', f0: 60, f1: 30, dur: 0.4, gain: 0.5 });
  }

  playMine() {
    const d = this.route(0, 0.15);
    this.T(d, { type: 'square', f0: 640, f1: 420, dur: 0.05, gain: 0.12 });
    this.T(d, { type: 'sine', f0: 880, dur: 0.08, gain: 0.08, delay: 0.09 });
    this.N(d, { dur: 0.08, type: 'bandpass', f0: 1800, q: 2, gain: 0.12, delay: 0.02 });
  }

  playSmoke() {
    const d = this.route(0, 0.3);
    this.N(d, { dur: 0.9, type: 'highpass', f0: 1400, f1: 3200, gain: 0.36, attack: 0.04 });
    this.N(d, { dur: 2.2, type: 'bandpass', f0: 700, q: 0.5, gain: 0.16, attack: 0.2 });
    this.T(d, { type: 'sine', f0: 180, f1: 90, dur: 0.18, gain: 0.24 });
  }

  playTurretDeploy() {
    const d = this.route(0, 0.35);
    this.T(d, { type: 'square', f0: 220, f1: 90, dur: 0.12, gain: 0.16 });
    this.N(d, { dur: 0.12, type: 'lowpass', f0: 800, gain: 0.3 });
    this.T(d, { type: 'sine', f0: 660, dur: 0.15, gain: 0.1, delay: 0.14 });
    this.T(d, { type: 'sine', f0: 990, dur: 0.2, gain: 0.1, delay: 0.24 });
  }

  playTurretShot(dist: number, pan = 0) {
    const s = this.spatial(dist);
    if (s.g < 0.02) return;
    const d = this.route(pan, 0.15, s.cutoff, s.g);
    this.noiseAt(d, this.ctx.currentTime + s.delay, { dur: 0.07, type: 'bandpass', f0: 1500, f1: 500, q: 0.8, gain: 0.3 });
  }

  playOverdrive() {
    const d = this.route(0, 0.5);
    this.T(d, { type: 'sawtooth', f0: 120, f1: 900, dur: 0.7, gain: 0.14, attack: 0.1 });
    this.T(d, { type: 'sine', f0: 60, f1: 30, dur: 0.8, gain: 0.7 });
    this.N(d, { dur: 0.6, type: 'lowpass', f0: 1200, f1: 100, gain: 0.4, delay: 0.1 });
    [440, 660, 880].forEach((f, i) => this.T(d, { type: 'triangle', f0: f, dur: 0.25, gain: 0.08, delay: 0.5 + i * 0.09 }));
  }

  playNova() {
    const d = this.route(0, 0.55);
    this.N(d, { dur: 0.5, type: 'highpass', f0: 2800, f1: 6000, gain: 0.3 });
    this.T(d, { type: 'sine', f0: 1800, f1: 300, dur: 0.7, gain: 0.16 });
    this.T(d, { type: 'triangle', f0: 2400, f1: 4800, dur: 0.4, gain: 0.07, delay: 0.05 });
    for (let i = 0; i < 6; i++) this.N(d, { dur: 0.04, type: 'highpass', f0: rr(4000, 7000), gain: 0.12, delay: 0.08 + i * 0.05 });
  }

  playMortar() {
    const d = this.route(0, 0.4);
    this.T(d, { type: 'sine', f0: 140, f1: 45, dur: 0.4, gain: 0.7 });
    this.N(d, { dur: 0.35, type: 'lowpass', f0: 900, f1: 120, gain: 0.5 });
  }

  playCheer() {
    const d = this.route(0, 0.6, 3000);
    // crowd roar: swelling band noise
    this.N(d, { dur: 2.6, type: 'bandpass', f0: 900, q: 0.5, gain: 0.5, attack: 0.35 });
    this.N(d, { dur: 2.2, type: 'bandpass', f0: 2200, q: 0.7, gain: 0.2, attack: 0.4, delay: 0.1 });
    // arena horns
    for (const [f, g] of [[98, 0.12], [98.5, 0.1], [147, 0.09], [196, 0.07]] as [number, number][]) {
      this.T(d, { type: 'sawtooth', f0: f, dur: 1.6, gain: g, attack: 0.3, delay: 0.15 });
    }
    [660, 880, 1100].forEach((f, i) => this.T(d, { type: 'triangle', f0: f, dur: 0.3, gain: 0.06, delay: 1.4 + i * 0.12 }));
  }

  playEnemyShot(kind: 'tank' | 'mech' | 'heavy' | 'sniper', dist: number, pan = 0) {
    const s = this.spatial(dist);
    if (s.g < 0.02) return;
    const d = this.route(pan, 0.2 + dist / 700, s.cutoff, s.g);
    const t = this.ctx.currentTime + s.delay;
    if (kind === 'sniper') {
      this.noiseAt(d, t, { dur: 0.3, type: 'highpass', f0: 1200, f1: 300, gain: 0.5 });
      this.toneAt(d, t, { type: 'sawtooth', f0: 1600, f1: 200, dur: 0.3, gain: 0.2 });
      this.noiseAt(d, t, { dur: 0.9, type: 'lowpass', f0: 400, f1: 60, gain: 0.25, delay: 0.05 });
    } else if (kind === 'tank') {
      this.noiseAt(d, t, { dur: 0.5, type: 'lowpass', f0: 700, f1: 60, gain: 0.65 });
      this.noiseAt(d, t, { dur: 0.05, type: 'highpass', f0: 2000, gain: 0.25 });
      this.toneAt(d, t, { type: 'sine', f0: 95, f1: 28, dur: 0.45, gain: 0.55 });
    } else if (kind === 'mech') {
      this.noiseAt(d, t, { dur: 0.06, type: 'bandpass', f0: rr(1000, 1400), f1: 400, q: 0.8, gain: 0.24 });
      this.toneAt(d, t, { type: 'square', f0: 200, f1: 70, dur: 0.04, gain: 0.05 });
    } else {
      this.noiseAt(d, t, { dur: 0.8, type: 'bandpass', f0: 380, f1: 2400, q: 0.9, gain: 0.5, attack: 0.05 });
      this.toneAt(d, t, { type: 'sawtooth', f0: 200, f1: 90, dur: 0.55, gain: 0.12 });
      this.toneAt(d, t, { type: 'sine', f0: 80, f1: 35, dur: 0.4, gain: 0.45 });
    }
  }

  playExplosion(dist: number, big = false, pan = 0) {
    const s = this.spatial(dist);
    const gain = s.g * (big ? 1.2 : 1);
    if (gain < 0.015) return;
    const d = this.route(pan, big ? 0.6 : 0.42, s.cutoff, gain);
    const t = this.ctx.currentTime + s.delay;
    this.noiseAt(d, t, { dur: 0.14, type: 'highpass', f0: 1200, f1: 300, gain: 0.7 });
    this.noiseAt(d, t, { dur: big ? 1.9 : 1.15, type: 'lowpass', f0: 1500, f1: 50, gain: 0.95, attack: 0.01 });
    this.toneAt(d, t, { type: 'sine', f0: 80, f1: 20, dur: big ? 1.3 : 0.75, gain: 0.9 });
    const ticks = big ? 11 : 6;
    for (let i = 0; i < ticks; i++) {
      this.noiseAt(d, t, { dur: 0.05, type: 'bandpass', f0: rr(800, 3500), q: 1.2, gain: rr(0.06, 0.16), delay: 0.14 + Math.random() * (big ? 1.2 : 0.7) });
    }
    if (big) {
      this.toneAt(d, t, { type: 'sine', f0: 60, f1: 22, dur: 1.0, gain: 0.6, delay: 0.18 });
      this.noiseAt(d, t, { dur: 2.2, type: 'lowpass', f0: 300, f1: 40, gain: 0.35, attack: 0.15, delay: 0.1 });
    }
  }

  playWhiz(pan = 0) {
    const d = this.route(pan, 0.12);
    this.N(d, { dur: 0.22, type: 'bandpass', f0: 3600, f1: 1300, q: 3, gain: 0.2 });
    this.T(d, { type: 'sine', f0: 2600, f1: 900, dur: 0.18, gain: 0.04 });
  }

  playDropLand(dist: number, pan = 0) {
    const s = this.spatial(dist);
    if (s.g < 0.02) return;
    const d = this.route(pan, 0.4, s.cutoff, s.g);
    const t = this.ctx.currentTime + s.delay;
    this.toneAt(d, t, { type: 'sine', f0: 90, f1: 28, dur: 0.45, gain: 0.85 });
    this.noiseAt(d, t, { dur: 0.55, type: 'lowpass', f0: 700, f1: 80, gain: 0.55 });
    this.toneAt(d, t, { type: 'triangle', f0: 520, f1: 470, dur: 0.5, gain: 0.1, delay: 0.05 });
    this.noiseAt(d, t, { dur: 0.7, type: 'highpass', f0: 4200, gain: 0.07, delay: 0.1 });
  }

  playBeacon(pan = 0) {
    const d = this.route(pan, 0.55);
    this.T(d, { type: 'sine', f0: 1180, dur: 0.55, gain: 0.07, attack: 0.01 });
    this.T(d, { type: 'sine', f0: 1770, dur: 0.4, gain: 0.025, attack: 0.01, delay: 0.02 });
  }

  playExpand() {
    const d = this.route(0, 0.55, 2400);
    this.T(d, { type: 'sawtooth', f0: 170, f1: 430, dur: 1.5, gain: 0.11, attack: 0.3 });
    this.T(d, { type: 'sawtooth', f0: 172, f1: 436, dur: 1.5, gain: 0.08, attack: 0.3 });
    this.T(d, { type: 'sine', f0: 55, f1: 30, dur: 2, gain: 0.85 });
    this.N(d, { dur: 1.7, type: 'bandpass', f0: 200, f1: 3200, q: 1, gain: 0.22, attack: 0.4 });
    [660, 990, 1320].forEach((f, i) => this.T(d, { type: 'sine', f0: f, dur: 0.9, gain: 0.05, delay: 1.1 + i * 0.12 }));
  }

  // ---------------------------------------------------------------------------
  // Feedback / UI
  // ---------------------------------------------------------------------------
  playHitEnemy() {
    const d = this.route(0, 0.15);
    this.T(d, { type: 'triangle', f0: rr(1200, 1800), f1: 500, dur: 0.08, gain: 0.17 });
    this.N(d, { dur: 0.05, type: 'highpass', f0: 3000, gain: 0.12 });
    this.T(d, { type: 'sine', f0: 160, f1: 80, dur: 0.07, gain: 0.12 });
  }

  playPlayerHit() {
    const d = this.route(0, 0.3);
    this.N(d, { dur: 0.4, type: 'lowpass', f0: 500, f1: 70, gain: 0.85 });
    this.T(d, { type: 'sine', f0: 150, f1: 40, dur: 0.35, gain: 0.65 });
    this.T(d, { type: 'square', f0: 880, dur: 0.06, gain: 0.05, delay: 0.1 });
    this.T(d, { type: 'sine', f0: 2400, dur: 0.6, gain: 0.018, delay: 0.05 });
  }

  playPickup() {
    const d = this.route(0, 0.35);
    this.T(d, { type: 'sine', f0: 660, dur: 0.12, gain: 0.2 });
    this.T(d, { type: 'sine', f0: 990, dur: 0.18, gain: 0.2, delay: 0.1 });
    this.T(d, { type: 'sine', f0: 1320, dur: 0.24, gain: 0.15, delay: 0.2 });
    this.T(d, { type: 'sine', f0: 1980, dur: 0.3, gain: 0.06, delay: 0.26 });
  }

  playWave() {
    const d = this.route(0, 0.4, 2400);
    // brass-like horn: detuned saws through a lowpass
    for (const [f, g] of [[110, 0.1], [110.6, 0.08], [165, 0.07], [220, 0.05]] as [number, number][]) {
      this.T(d, { type: 'sawtooth', f0: f, f1: f * 1.02, dur: 1.2, gain: g, attack: 0.18 });
    }
    [523, 659, 784].forEach((f, i) => this.T(d, { type: 'square', f0: f, dur: 0.14, gain: 0.07, delay: 1.0 + i * 0.14 }));
  }

  playWaveClear() {
    const d = this.route(0, 0.4);
    [392, 523, 659, 784, 1046].forEach((f, i) => this.T(d, { type: 'triangle', f0: f, dur: 0.3, gain: 0.14, delay: i * 0.13 }));
  }

  playReady() {
    const d = this.route(0, 0.1);
    this.T(d, { type: 'sine', f0: 1500, dur: 0.04, gain: 0.08 });
    this.T(d, { type: 'sine', f0: 1100, dur: 0.05, gain: 0.08, delay: 0.05 });
  }

  playUpgrade() {
    const d = this.route(0, 0.45);
    [523, 784, 1046, 1568].forEach((f, i) => this.T(d, { type: 'triangle', f0: f, dur: 0.26, gain: 0.14, delay: i * 0.08 }));
    this.T(d, { type: 'sine', f0: 3136, dur: 0.6, gain: 0.04, delay: 0.3 });
  }

  playUiHover() {
    const d = this.route(0, 0.05);
    this.T(d, { type: 'sine', f0: 1800, dur: 0.035, gain: 0.03 });
  }

  playKillStreak(level: number) {
    const d = this.route(0, 0.25);
    const n = Math.min(level, 5);
    for (let i = 0; i < n; i++) this.T(d, { type: 'triangle', f0: 440 * Math.pow(1.26, i), dur: 0.08, gain: 0.08, delay: i * 0.055 });
  }

  playLockWarning() {
    const d = this.route(0, 0.05);
    this.T(d, { type: 'square', f0: 1400, dur: 0.06, gain: 0.06 });
  }

  playAlarm() {
    const d = this.route(0, 0.1);
    this.T(d, { type: 'sawtooth', f0: 520, f1: 380, dur: 0.3, gain: 0.07 });
    this.T(d, { type: 'sawtooth', f0: 520, f1: 380, dur: 0.3, gain: 0.07, delay: 0.38 });
  }

  /** `weight` scales the footfall: ~0.7 for light mechs up to 1.6 for heavies. */
  playFootstep(weight = 1) {
    const d = this.route(0, 0.18);
    const w = clamp(weight, 0.5, 2);
    this.T(d, { type: 'sine', f0: 72 / w, f1: 28, dur: 0.14 * w, gain: 0.5 * Math.min(1.2, w) });
    this.N(d, { dur: 0.16, type: 'lowpass', f0: 320 / Math.sqrt(w), f1: 55, gain: 0.45 });
    this.T(d, { type: 'square', f0: rr(280, 360), f1: 200, dur: 0.035, gain: 0.04, delay: 0.02 });
    this.N(d, { dur: 0.14, type: 'highpass', f0: 4500, gain: 0.03, delay: 0.05 });
  }

  // ---------------------------------------------------------------------------
  // Engines
  // ---------------------------------------------------------------------------
  startEngine(type: VehicleType) {
    this.stopEngine();
    const ctx = this.ctx;
    const p = PROFILES[type];
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = p.cutoff;
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const mk = (wave: OscillatorType, freq: number, level: number) => {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(filter);
      osc.start();
      return osc;
    };
    const oscs = [mk('sawtooth', p.base, 0.5), mk('square', p.base * 1.012, 0.3), mk('sine', p.base * 0.5, 0.75)];
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = p.rumble;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    filter.connect(gain).connect(this.sfx);
    gain.gain.setTargetAtTime(0.07, ctx.currentTime, 0.5);

    let servo: EngineNodes['servo'] = null;
    let clatter: EngineNodes['clatter'] = null;
    if (p.turbine) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 240;
      const sg = ctx.createGain();
      sg.gain.value = 0;
      osc.connect(sg).connect(this.sfx);
      osc.start();
      servo = { osc, gain: sg };
    } else {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const cf = ctx.createBiquadFilter();
      cf.type = 'bandpass';
      cf.frequency.value = 650;
      cf.Q.value = 0.9;
      const cg = ctx.createGain();
      cg.gain.value = 0;
      src.connect(cf).connect(cg).connect(this.sfx);
      src.start();
      clatter = { src, filter: cf, gain: cg };
    }
    this.engine = { oscs: [...oscs], filter, gain, lfo, servo, clatter, type };
    this.engine.oscs.push(lfo);
  }

  setEngine(speedFactor: number, throttle: boolean) {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    const f = clamp(speedFactor, 0, 1);
    const boost = throttle ? 0.12 : 0;
    const p = PROFILES[e.type];
    e.oscs[0].frequency.setTargetAtTime(p.base * (1 + f * 1.25), t, 0.15);
    e.oscs[1].frequency.setTargetAtTime(p.base * 1.012 * (1 + f * 1.25), t, 0.15);
    e.oscs[2].frequency.setTargetAtTime(p.base * 0.5 * (1 + f * 1.25), t, 0.15);
    e.filter.frequency.setTargetAtTime(p.cutoff * (1 + (f + boost) * 2.2), t, 0.15);
    e.gain.gain.setTargetAtTime(0.06 + 0.1 * (f + boost), t, 0.15);
    e.lfo.frequency.setTargetAtTime(p.rumble * (1 + f * 1.5), t, 0.2);
    if (e.servo) {
      e.servo.osc.frequency.setTargetAtTime(200 + 360 * f, t, 0.12);
      e.servo.gain.gain.setTargetAtTime(0.004 + f * 0.022, t, 0.15);
    }
    if (e.clatter) {
      e.clatter.filter.frequency.setTargetAtTime(500 + f * 900, t, 0.15);
      e.clatter.gain.gain.setTargetAtTime(f * 0.08, t, 0.15);
    }
  }

  stopEngine() {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    e.gain.gain.setTargetAtTime(0, t, 0.2);
    e.servo?.gain.gain.setTargetAtTime(0, t, 0.2);
    e.clatter?.gain.gain.setTargetAtTime(0, t, 0.2);
    const stopAt = t + 1;
    for (const o of e.oscs) {
      try {
        o.stop(stopAt);
      } catch {
        /* already stopped */
      }
    }
    try {
      e.servo?.osc.stop(stopAt);
      e.clatter?.src.stop(stopAt);
    } catch {
      /* ignore */
    }
    this.engine = null;
  }

  // ---------------------------------------------------------------------------
  // Ambience (wind bed, distant rumbles, night insects) and wading
  // ---------------------------------------------------------------------------
  startAmbience(kind: 'wind' | 'night' | 'storm') {
    this.stopAmbience();
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.sfx);
    out.gain.setTargetAtTime(1, t, 2);
    const sources: AudioScheduledSourceNode[] = [];
    const level = kind === 'storm' ? 0.16 : 0.055;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = kind === 'storm' ? 520 : 380;
    bp.Q.value = 0.7;
    const wind = ctx.createGain();
    wind.gain.value = level;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 260;
    lfo.connect(lfoG).connect(bp.frequency);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.21;
    const lfo2G = ctx.createGain();
    lfo2G.gain.value = level * 0.55;
    lfo2.connect(lfo2G).connect(wind.gain);
    src.connect(bp).connect(wind).connect(out);
    src.start();
    lfo.start();
    lfo2.start();
    sources.push(src, lfo, lfo2);

    const src2 = ctx.createBufferSource();
    src2.buffer = this.noise;
    src2.loop = true;
    const whistle = ctx.createBiquadFilter();
    whistle.type = 'bandpass';
    whistle.frequency.value = 1700;
    whistle.Q.value = 9;
    const wg = ctx.createGain();
    wg.gain.value = kind === 'storm' ? 0.03 : 0.01;
    src2.connect(whistle).connect(wg).connect(out);
    src2.start(0, 0.7);
    sources.push(src2);

    if (kind === 'night') {
      const cr = ctx.createOscillator();
      cr.type = 'sine';
      cr.frequency.value = 4300;
      const cg = ctx.createGain();
      cg.gain.value = 0.0015;
      const cl = ctx.createOscillator();
      cl.type = 'square';
      cl.frequency.value = 8.5;
      const cd = ctx.createGain();
      cd.gain.value = 0.0035;
      cl.connect(cd).connect(cg.gain);
      cr.connect(cg).connect(out);
      cr.start();
      cl.start();
      sources.push(cr, cl);
    }
    this.ambience = { out, sources };
    const schedule = () => {
      this.ambienceTimer = window.setTimeout(() => {
        this.distantBoom();
        schedule();
      }, rr(7000, 16000));
    };
    schedule();
  }

  private distantBoom() {
    if (this.ctx.state !== 'running') return;
    const d = this.route(rr(-0.85, 0.85), 0.85, 700, 0.5);
    this.N(d, { dur: 2.8, type: 'lowpass', f0: 170, f1: 40, gain: 0.35, attack: 0.15 });
    this.T(d, { type: 'sine', f0: 55, f1: 28, dur: 2, gain: 0.3 });
  }

  stopAmbience() {
    window.clearTimeout(this.ambienceTimer);
    const a = this.ambience;
    if (!a) return;
    a.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    for (const s of a.sources) {
      try {
        s.stop(this.ctx.currentTime + 1.5);
      } catch {
        /* ignore */
      }
    }
    this.ambience = null;
  }

  setWading(on: boolean) {
    const ctx = this.ctx;
    if (!this.wading) {
      if (!on) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(bp).connect(gain).connect(this.sfx);
      src.start();
      this.wading = { gain, src };
    }
    this.wading.gain.gain.setTargetAtTime(on ? 0.055 : 0, ctx.currentTime, 0.15);
  }

  // ---------------------------------------------------------------------------
  // Adaptive score
  // ---------------------------------------------------------------------------
  startMusic() {
    if (this.music) return;
    const ctx = this.ctx;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260;
    droneFilter.Q.value = 1;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneFilter.connect(droneGain).connect(this.musicGain);
    const oscs: OscillatorNode[] = [];
    for (const [type, f] of [['sawtooth', 55], ['sawtooth', 55.3], ['sawtooth', 82.41], ['triangle', 110]] as [OscillatorType, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = type === 'triangle' ? 0.2 : 0.28;
      o.connect(g).connect(droneFilter);
      o.start();
      oscs.push(o);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lg = ctx.createGain();
    lg.gain.value = 140;
    lfo.connect(lg).connect(droneFilter.frequency);
    lfo.start();
    const bass = ctx.createBiquadFilter();
    bass.type = 'lowpass';
    bass.frequency.value = 650;
    bass.connect(this.musicGain);
    droneGain.gain.setTargetAtTime(0.5, ctx.currentTime, 3);
    this.music = {
      timer: window.setInterval(() => this.musicTick(), 90),
      step: 0,
      next: 0,
      intensity: 0.1,
      target: 0.1,
      droneGain,
      droneFilter,
      oscs,
      lfo,
      bass,
    };
  }

  setMusicIntensity(v: number) {
    if (this.music) this.music.target = clamp(v, 0, 1);
  }

  private musicTick() {
    const m = this.music;
    const ctx = this.ctx;
    if (!m || ctx.state !== 'running') return;
    m.intensity += (m.target - m.intensity) * 0.1;
    const i = m.intensity;
    m.droneFilter.frequency.setTargetAtTime(220 + 900 * i, ctx.currentTime, 0.6);
    m.droneGain.gain.setTargetAtTime(0.35 + 0.45 * i, ctx.currentTime, 0.8);
    const bpm = 84 + 46 * i;
    const stepDur = 60 / bpm / 4;
    if (m.next < ctx.currentTime - 0.1) m.next = ctx.currentTime + 0.05;
    while (m.next < ctx.currentTime + 0.35) {
      this.musicStep(m, m.step, m.next, stepDur, i);
      m.step = (m.step + 1) % 32;
      m.next += stepDur;
    }
  }

  private musicStep(m: MusicState, step: number, t: number, dur: number, i: number) {
    const s = step % 16;
    const f = BASS_PATTERN[s] * (step >= 16 ? 0.891 : 1);
    if (f > 0 && i > 0.12) this.toneAt(m.bass, t, { type: 'sawtooth', f0: f, dur: dur * 1.8, gain: 0.1 + i * 0.1, attack: 0.01 });
    if (i > 0.4 && s % 4 === 0) this.toneAt(this.musicGain, t, { type: 'sine', f0: 150, f1: 40, dur: 0.18, gain: 0.25 + 0.2 * i });
    if (i > 0.6 && (s === 4 || s === 12)) {
      this.noiseAt(this.musicGain, t, { dur: 0.13, type: 'bandpass', f0: 1800, q: 0.8, gain: 0.13 });
      this.toneAt(this.musicGain, t, { type: 'triangle', f0: 190, f1: 120, dur: 0.08, gain: 0.1 });
    }
    if (i > 0.5 && s % 2 === 0) this.noiseAt(this.musicGain, t, { dur: 0.035, type: 'highpass', f0: 7000, gain: 0.04 + 0.04 * i });
    if (i > 0.82 && s % 2 === 1) this.noiseAt(this.musicGain, t, { dur: 0.03, type: 'highpass', f0: 7500, gain: 0.03 });
    if (i > 0.7 && step === 0) this.toneAt(this.musicGain, t, { type: 'sawtooth', f0: 220, f1: 440, dur: 1.2, gain: 0.035, attack: 0.5 });
  }

  stopMusic() {
    const m = this.music;
    if (!m) return;
    window.clearInterval(m.timer);
    m.droneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    for (const o of [...m.oscs, m.lfo]) {
      try {
        o.stop(this.ctx.currentTime + 2);
      } catch {
        /* ignore */
      }
    }
    this.music = null;
  }

  dispose() {
    this.stopEngine();
    this.stopAmbience();
    this.stopMusic();
    this.setWading(false);
    void this.ctx.close().catch(() => undefined);
  }
}
