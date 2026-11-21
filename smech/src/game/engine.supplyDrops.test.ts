import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Game } from './engine';

interface DropHarness {
  alive: boolean;
  dropTimer: number;
  dropTimerTotal: number;
  stats: { dropRate: number };
  drops: object[];
  spawnDrop: ReturnType<typeof vi.fn>;
  updateDrops(dt: number): void;
}

function fieldDrop() {
  return {
    falling: false,
    kind: 'repair',
    credits: 0,
    pos: new THREE.Vector3(200, 0, 0),
    life: 30,
    ping: 5,
    ring: { rotation: { z: 0 }, material: { opacity: 0 } },
    group: new THREE.Group(),
  };
}

function harness(dropTimer: number, drops: object[] = []) {
  const spawnDrop = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), {
    alive: true,
    dropTimer,
    dropTimerTotal: 60,
    stats: { dropRate: 0 },
    drops,
    pos: new THREE.Vector3(),
    cfg: { radius: 2 },
    time: 0,
    audio: { playBeacon: vi.fn() },
    spawnDrop,
  }) as DropHarness;
  return { game, spawnDrop };
}

describe('sky supply cadence', () => {
  it('delivers only a repair kit after the longer interval', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { game, spawnDrop } = harness(0.5);
    game.updateDrops(1);

    expect(spawnDrop).toHaveBeenCalledOnce();
    expect(spawnDrop).toHaveBeenCalledWith(undefined, undefined, 'repair');
    expect(game.dropTimerTotal).toBe(87.5);
    vi.restoreAllMocks();
  });

  it('waits for the current field crate to be collected or expire before another airdrop', () => {
    const { game, spawnDrop } = harness(0.5, [fieldDrop()]);
    game.updateDrops(1);

    expect(spawnDrop).not.toHaveBeenCalled();
    expect(game.dropTimer).toBeLessThan(0);
  });
});
