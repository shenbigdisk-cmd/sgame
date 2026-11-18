import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from './audio';

class Param {
  value = 0;
  events: { value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.value = value; this.events.push({ value, time }); return this; }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ value, time }); return this; }
  exponentialRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ value, time }); return this; }
  setTargetAtTime(value: number, time: number, _constant: number) { this.value = value; this.events.push({ value, time }); return this; }
}
class Node {
  connections: object[] = [];
  connect<T extends object>(node: T): T { this.connections.push(node); return node; }
}
class Gain extends Node { gain = new Param(); }
class Filter extends Node { type = ''; frequency = new Param(); Q = new Param(); }
class Panner extends Node { pan = new Param(); }
class Source extends Node {
  buffer: unknown = null;
  loop = false;
  type = '';
  frequency = new Param();
  started?: number;
  stopped?: number;
  start(time = 0, _offset = 0) { this.started = time; }
  stop(time = 0) { this.stopped = time; }
}
class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new Node();
  sources: Source[] = [];
  filters: Filter[] = [];
  panners: Panner[] = [];
  createGain() { return new Gain(); }
  createDynamicsCompressor() {
    return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() });
  }
  createBuffer(channels: number, length: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (channel: number) => data[channel] };
  }
  createConvolver() { return Object.assign(new Node(), { buffer: null }); }
  createBiquadFilter() { const filter = new Filter(); this.filters.push(filter); return filter; }
  createStereoPanner() { const panner = new Panner(); this.panners.push(panner); return panner; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  createOscillator() { const source = new Source(); this.sources.push(source); return source; }
  close() { return Promise.resolve(); }
  resume() { return Promise.resolve(); }
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', FakeContext);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const audio = new AudioManager();
  return { audio, ctx: audio.ctx as unknown as FakeContext };
}

describe('procedural combat audio', () => {
  it('lets simultaneous primary and secondary weapons sound without sharing a throttle', () => {
    const { audio, ctx } = setup();
    audio.playMG('autocannon');
    const afterAuto = ctx.sources.length;
    expect(afterAuto).toBeGreaterThan(0); // first shot works even at audio time zero
    audio.playFlame();
    const afterFlame = ctx.sources.length;
    audio.playCryo();
    const afterCryo = ctx.sources.length;
    audio.playMG('coil');
    expect(afterFlame).toBeGreaterThan(afterAuto);
    expect(afterCryo).toBeGreaterThan(afterFlame);
    expect(ctx.sources.length).toBeGreaterThan(afterCryo);
    const beforeRepeats = ctx.sources.length;
    audio.playMG('autocannon');
    audio.playFlame();
    audio.playCryo();
    audio.playMG('coil');
    expect(ctx.sources.length).toBe(beforeRepeats);
    ctx.currentTime = 0.08;
    audio.playFlame();
    expect(ctx.sources.length).toBeGreaterThan(beforeRepeats);
  });

  it('synthesizes distinct ballistic, scatter and electromagnetic profiles and stops their sources', () => {
    const sample = (fire: (audio: AudioManager) => void) => {
      const { audio, ctx } = setup();
      fire(audio);
      expect(ctx.sources.every((source) => source.started !== undefined && source.stopped !== undefined && source.stopped > source.started)).toBe(true);
      return {
        tones: ctx.sources.filter((source) => source.frequency.events.length).map((source) => source.frequency.events[0].value),
        filters: ctx.filters.map((filter) => filter.frequency.events[0]?.value).filter((value) => value !== undefined),
      };
    };
    const cannon = sample((audio) => audio.playCannon());
    const scatter = sample((audio) => audio.playScatter());
    const autocannon = sample((audio) => audio.playMG('autocannon'));
    const coil = sample((audio) => audio.playMG('coil'));
    expect(cannon).not.toEqual(scatter);
    expect(autocannon).not.toEqual(coil);
    expect(coil.tones.some((frequency) => frequency > 1000)).toBe(true);
    expect(autocannon.tones.every((frequency) => frequency < 1000)).toBe(true);
  });

  it('coalesces dense impacts but preserves direction, distance, and large blasts', () => {
    const { audio, ctx } = setup();
    for (let i = 0; i < 100; i++) {
      audio.playExplosion(20, false, -0.7);
      audio.playHitEnemy();
      audio.playCrit();
    }
    const crowded = ctx.sources.length;
    expect(crowded).toBeLessThan(15);
    audio.playExplosion(20, true, -0.7);
    const big = ctx.sources.length;
    expect(big).toBeGreaterThan(crowded);
    audio.playExplosion(20, false, 0.7);
    const otherSide = ctx.sources.length;
    expect(otherSide).toBeGreaterThan(big);
    audio.playExplosion(180, false, -0.7);
    expect(ctx.sources.length).toBeGreaterThan(otherSide);
    expect(ctx.panners.map((panner) => panner.pan.value)).toContain(-0.7);
    expect(ctx.panners.map((panner) => panner.pan.value)).toContain(0.7);
    const farSources = ctx.sources.slice(otherSide);
    expect(farSources[0].started).toBeCloseTo(180 / 343);
    const beforeInaudible = ctx.sources.length;
    audio.playExplosion(400, false, 0);
    expect(ctx.sources.length).toBe(beforeInaudible);
    ctx.currentTime = 0.07;
    audio.playExplosion(20, false, -0.7);
    expect(ctx.sources.length).toBeGreaterThan(beforeInaudible);
  });

  it('spatializes evolved turret arcs and retains independent master and score volume', () => {
    const { audio, ctx } = setup();
    audio.playArc(100, 0.8);
    expect(ctx.panners.at(-1)?.pan.value).toBe(0.8);
    expect(ctx.sources[0].started).toBeCloseTo(100 / 343);
    const mixer = audio as unknown as { master: Gain; musicGain: Gain };
    audio.setVolume(0);
    expect(mixer.master.gain.value).toBe(0);
    audio.setMusicVolume(0.4);
    expect(mixer.musicGain.gain.value).toBeCloseTo(0.17 * 0.4);
    expect(mixer.master.gain.value).toBe(0);
    expect(audio.toggleMusic()).toBe(false);
    expect(mixer.musicGain.gain.value).toBe(0);
    audio.setVolume(2);
    expect(mixer.master.gain.value).toBe(1);
  });
});
