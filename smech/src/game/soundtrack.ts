/**
 * Dynamic Procedural Soundtrack Engine using Tone.js
 *
 * Provides responsive, multi-layered cyber-industrial and darksynth music
 * that adapts smoothly to gameplay state: Hangar, Sector Patrol, Full Combat, and Boss Climax.
 */

import * as Tone from 'tone';

export type MusicMood = 'hangar' | 'patrol' | 'combat' | 'boss' | 'victory';

export class SoundtrackDirector {
  private started = false;
  private currentMood: MusicMood = 'hangar';
  private intensity = 0; // 0..1
  private volume = 0.6;
  private muted = false;

  // Audio nodes & synths
  private outputGain: Tone.Gain | null = null;
  private drumGain: Tone.Gain | null = null;
  private bassGain: Tone.Gain | null = null;
  private leadGain: Tone.Gain | null = null;
  private padGain: Tone.Gain | null = null;

  // Synths
  private kick: Tone.MembraneSynth | null = null;
  private snare: Tone.NoiseSynth | null = null;
  private hat: Tone.MetalSynth | null = null;
  private bass: Tone.MonoSynth | null = null;
  private lead: Tone.FMSynth | null = null;
  private pad: Tone.PolySynth | null = null;

  // Sequences
  private kickSeq: Tone.Sequence | null = null;
  private snareSeq: Tone.Sequence | null = null;
  private hatSeq: Tone.Sequence | null = null;
  private bassSeq: Tone.Sequence | null = null;
  private leadSeq: Tone.Sequence | null = null;
  private padLoop: Tone.Loop | null = null;

  constructor() {
    // Lazy init on first user gesture
  }

  private initSynths() {
    if (this.outputGain) return;

    try {
      this.outputGain = new Tone.Gain(this.muted ? 0 : this.volume * 0.45).toDestination();

      this.drumGain = new Tone.Gain(0.7).connect(this.outputGain);
      this.bassGain = new Tone.Gain(0.8).connect(this.outputGain);
      this.leadGain = new Tone.Gain(0.5).connect(this.outputGain);
      this.padGain = new Tone.Gain(0.6).connect(this.outputGain);

      // Industrial kick
      this.kick = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 },
      }).connect(this.drumGain);

      // Snappy metallic snare
      this.snare = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.001, decay: 0.22, sustain: 0 },
      }).connect(this.drumGain);

      // Hi-hat
      this.hat = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.08, release: 0.05 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).connect(this.drumGain);
      this.hat.volume.value = -12;

      // Heavy industrial FM bass
      this.bass = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { Q: 3, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.3 },
        filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.3, baseFrequency: 60, octaves: 3 },
      }).connect(this.bassGain);

      // Aggressive cyber lead
      this.lead = new Tone.FMSynth({
        harmonicity: 2,
        modulationIndex: 4,
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.4 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
      }).connect(this.leadGain);
      this.lead.volume.value = -8;

      // Atmospheric darksynth pad
      this.pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 1.2, decay: 1.5, sustain: 0.6, release: 2.0 },
      }).connect(this.padGain);
      this.pad.volume.value = -10;

      this.initPatterns();
    } catch {
      // In non-audio/headless environments, fail gracefully
    }
  }

  private initPatterns() {
    if (!this.kick || !this.snare || !this.hat || !this.bass || !this.lead || !this.pad) return;

    // 16-step kick sequence
    this.kickSeq = new Tone.Sequence(
      (time, note) => {
        if (note && this.kick) this.kick.triggerAttackRelease(note, '8n', time);
      },
      ['C1', null, null, null, 'C1', null, null, null, 'C1', null, null, null, 'C1', null, null, null],
      '16n',
    );

    // Snare on 5 and 13 (beats 2 and 4)
    this.snareSeq = new Tone.Sequence(
      (time, note) => {
        if (note && this.snare) this.snare.triggerAttackRelease('16n', time);
      },
      [null, null, null, null, 'hit', null, null, null, null, null, null, null, 'hit', null, null, null],
      '16n',
    );

    // 16th note metallic hats
    this.hatSeq = new Tone.Sequence(
      (time, note) => {
        if (note && this.hat) this.hat.triggerAttackRelease('32n', time);
      },
      ['x', null, 'x', null, 'x', null, 'x', 'x', 'x', null, 'x', null, 'x', null, 'x', 'x'],
      '16n',
    );

    // Driving rolling darksynth bassline in D-minor
    const bassNotes = [
      'D1', 'D1', 'D2', 'D1',
      'F1', 'D1', 'A1', 'D1',
      'D1', 'D1', 'C2', 'D1',
      'G1', 'D1', 'F1', 'E1',
    ];

    this.bassSeq = new Tone.Sequence(
      (time, note) => {
        if (note && this.bass) this.bass.triggerAttackRelease(note, '16n', time);
      },
      bassNotes,
      '16n',
    );

    // Lead melody for high combat / boss phases
    const leadNotes = [
      null, null, 'D4', null,
      'F4', null, 'E4', null,
      null, 'A4', null, 'G4',
      'F4', 'E4', 'D4', null,
    ];

    this.leadSeq = new Tone.Sequence(
      (time, note) => {
        if (note && this.lead && this.intensity > 0.4) {
          this.lead.triggerAttackRelease(note, '8n', time);
        }
      },
      leadNotes,
      '16n',
    );

    // Evolving ambient chords
    const padChords = [
      ['D3', 'F3', 'A3', 'C4'],
      ['Bb2', 'D3', 'F3', 'A3'],
      ['G2', 'Bb2', 'D3', 'F3'],
      ['A2', 'C#3', 'E3', 'G3'],
    ];
    let chordIdx = 0;

    this.padLoop = new Tone.Loop((time) => {
      if (this.pad) {
        const chord = padChords[chordIdx % padChords.length];
        this.pad.triggerAttackRelease(chord, '2m', time);
        chordIdx++;
      }
    }, '2m');
  }

  async start(): Promise<void> {
    if (this.started) return;
    try {
      await Tone.start();
      this.initSynths();
      Tone.getTransport().bpm.value = 126;

      this.kickSeq?.start(0);
      this.snareSeq?.start(0);
      this.hatSeq?.start(0);
      this.bassSeq?.start(0);
      this.leadSeq?.start(0);
      this.padLoop?.start(0);

      Tone.getTransport().start();
      this.started = true;
      this.applyMood(this.currentMood);
    } catch {
      // Audio permission or mock environment
    }
  }

  stop(): void {
    if (!this.started) return;
    try {
      Tone.getTransport().stop();
      this.started = false;
    } catch {
      // ignore
    }
  }

  setMood(mood: MusicMood): void {
    if (this.currentMood === mood) return;
    this.currentMood = mood;
    if (this.started) {
      this.applyMood(mood);
    }
  }

  setIntensity(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    if (Math.abs(clamped - this.intensity) < 0.2) return;
    this.intensity = clamped;
    if (!this.started || !this.outputGain) return;

    try {
      const now = Tone.now();
      if (this.currentMood === 'combat' || this.currentMood === 'boss') {
        const drumVol = 0.5 + this.intensity * 0.4;
        const leadVol = this.intensity > 0.4 ? (this.intensity - 0.4) * 1.4 : 0;
        this.drumGain?.gain.cancelScheduledValues(now);
        this.leadGain?.gain.cancelScheduledValues(now);
        this.drumGain?.gain.rampTo(drumVol, 0.3);
        this.leadGain?.gain.rampTo(leadVol, 0.3);
      }
    } catch {
      // ignore
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.outputGain && !this.muted) {
      this.outputGain.gain.rampTo(this.volume * 0.45, 0.1);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.outputGain) {
      this.outputGain.gain.rampTo(muted ? 0 : this.volume * 0.45, 0.1);
    }
  }

  private applyMood(mood: MusicMood): void {
    if (!this.outputGain) return;

    try {
      const now = Tone.now();
      this.drumGain?.gain.cancelScheduledValues(now);
      this.leadGain?.gain.cancelScheduledValues(now);
      this.bassGain?.gain.cancelScheduledValues(now);
      this.padGain?.gain.cancelScheduledValues(now);

      switch (mood) {
        case 'hangar':
          Tone.getTransport().bpm.value = 96;
          this.drumGain?.gain.rampTo(0, 0.4);
          this.leadGain?.gain.rampTo(0, 0.4);
          this.bassGain?.gain.rampTo(0.2, 0.5);
          this.padGain?.gain.rampTo(0.7, 0.5);
          break;

        case 'patrol':
          Tone.getTransport().bpm.value = 118;
          this.drumGain?.gain.rampTo(0.3, 0.4);
          this.leadGain?.gain.rampTo(0, 0.4);
          this.bassGain?.gain.rampTo(0.5, 0.4);
          this.padGain?.gain.rampTo(0.4, 0.5);
          break;

        case 'combat':
          Tone.getTransport().bpm.value = 130;
          this.drumGain?.gain.rampTo(0.8, 0.3);
          this.bassGain?.gain.rampTo(0.8, 0.3);
          this.padGain?.gain.rampTo(0.25, 0.4);
          this.leadGain?.gain.rampTo(0.4, 0.4);
          break;

        case 'boss':
          Tone.getTransport().bpm.value = 140;
          this.drumGain?.gain.rampTo(1.0, 0.2);
          this.bassGain?.gain.rampTo(0.9, 0.2);
          this.leadGain?.gain.rampTo(0.8, 0.2);
          this.padGain?.gain.rampTo(0.2, 0.3);
          break;

        case 'victory':
          Tone.getTransport().bpm.value = 100;
          this.drumGain?.gain.rampTo(0, 0.3);
          this.leadGain?.gain.rampTo(0.3, 0.3);
          this.bassGain?.gain.rampTo(0.3, 0.3);
          this.padGain?.gain.rampTo(0.8, 0.4);
          break;
      }
    } catch {
      // ignore
    }
  }

  dispose(): void {
    this.stop();
    try {
      this.kick?.dispose();
      this.snare?.dispose();
      this.hat?.dispose();
      this.bass?.dispose();
      this.lead?.dispose();
      this.pad?.dispose();
      this.kickSeq?.dispose();
      this.snareSeq?.dispose();
      this.hatSeq?.dispose();
      this.bassSeq?.dispose();
      this.leadSeq?.dispose();
      this.padLoop?.dispose();
      this.outputGain?.dispose();
    } catch {
      // ignore
    }
  }
}
