import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Game } from './engine';
import { activeStatuses, type BuffTimers } from './status';
import { defaultStats, type PlayerStats } from './upgrades';

const timers = (): BuffTimers => ({ aegis: 0, overcharge: 0, rapid: 0, haste: 0, overdrive: 0, smoke: 0 });

describe('active status timers', () => {
  it('shows all simultaneous effects and uses the real upgraded overdrive duration', () => {
    const statuses = activeStatuses({ aegis: 5.8, overcharge: 20, rapid: 12, haste: 7, overdrive: 15, smoke: 3 }, 16, { life: 5.5, maxLife: 9 });
    expect(statuses.map((status) => status.id)).toEqual(['veiled', 'aegis', 'overcharge', 'rapid', 'haste', 'overdrive', 'smoke']);
    expect(statuses.find((status) => status.id === 'overdrive')).toMatchObject({ time: 15, max: 16 });
    expect(statuses[0]).toMatchObject({ time: 5.5, max: 9 });
    expect(statuses.find((status) => status.id === 'smoke')).toMatchObject({ time: 3, max: 4.5 });
  });

  it('keeps the duration of the current overdrive activation if another rank is installed mid-buff', () => {
    type Harness = {
      stats: PlayerStats;
      buffT: BuffTimers;
      overdriveDuration: number;
      fireOverdrive: () => void;
    };
    const game = Object.assign(Object.create(Game.prototype) as Harness, {
      stats: defaultStats(), buffT: timers(), overdriveDuration: 8,
      taken: new Map(), pos: new THREE.Vector3(), enemies: [], shake: 0,
      fire: { emit: () => undefined }, explosion: () => undefined,
      audio: { playOverdrive: () => undefined }, makeNoise: () => undefined, addFeed: () => undefined,
    });
    game.stats.overdriveStacks = 2;
    game.fireOverdrive();
    expect(game.buffT.overdrive).toBe(16);
    game.stats.overdriveStacks = 3;
    expect(activeStatuses(game.buffT, game.overdriveDuration).find((status) => status.id === 'overdrive')?.max).toBe(16);
    game.fireOverdrive();
    expect(game.buffT.overdrive).toBe(20);
    expect(game.overdriveDuration).toBe(20);
  });

  it('distinguishes a lingering sprint from actual concealment and removes expired effects', () => {
    const sprint = { ...timers(), smoke: 2 };
    expect(activeStatuses(sprint, 8).map((status) => status.id)).toEqual(['smoke']);
    expect(activeStatuses(timers(), 8, { life: 2, maxLife: 6 }).map((status) => status.id)).toEqual(['veiled']);
    expect(activeStatuses(timers(), 8, { life: 0, maxLife: 6 })).toEqual([]);
    expect(activeStatuses(sprint, 8, { life: 2, maxLife: 6 }, false)).toEqual([]);
  });
});

describe('smoke coverage in the simulation', () => {
  type Cloud = { pos: THREE.Vector3; radius: number; life: number; maxLife: number };
  type SmokeHarness = {
    alive: boolean;
    pos: THREE.Vector3;
    smokeClouds: Cloud[];
    concealmentCloud: () => Cloud | undefined;
    isConcealed: () => boolean;
  };
  const makeGame = (): SmokeHarness => Object.assign(Object.create(Game.prototype) as SmokeHarness, {
    alive: true,
    pos: new THREE.Vector3(0, 0, 0),
    smokeClouds: [],
  });

  it('requires the pilot to be inside a live cloud and updates immediately on exit', () => {
    const game = makeGame();
    const cloud = { pos: new THREE.Vector3(), radius: 10, life: 4, maxLife: 6 };
    game.smokeClouds = [cloud];
    expect(game.isConcealed()).toBe(true);
    expect(game.concealmentCloud()).toBe(cloud);
    game.pos.x = 11;
    expect(game.isConcealed()).toBe(false);
    expect(game.concealmentCloud()).toBeUndefined();
    game.pos.x = 0;
    cloud.life = 0;
    expect(game.isConcealed()).toBe(false);
    cloud.life = 4;
    game.alive = false;
    expect(game.isConcealed()).toBe(false);
  });

  it('uses the longest remaining covering cloud, not a distant or expired cloud', () => {
    const game = makeGame();
    const short = { pos: new THREE.Vector3(), radius: 10, life: 2, maxLife: 6 };
    const long = { pos: new THREE.Vector3(1, 0, 0), radius: 10, life: 5, maxLife: 9 };
    game.smokeClouds = [short, { ...long, pos: new THREE.Vector3(100, 0, 0), life: 8 }, long];
    expect(game.concealmentCloud()).toBe(long);
    expect(activeStatuses(timers(), 8, game.concealmentCloud())[0]).toMatchObject({ id: 'veiled', time: 5, max: 9 });
  });
});
