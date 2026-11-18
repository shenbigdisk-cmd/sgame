import { expect, it } from 'vitest';
import { cacheValue, crossesVeil, SALVAGE, veilStats } from './fieldRules';
import { WEAPON_INFO } from './vehicles';

const cloud = { pos: { x: 0, y: 0, z: 0 }, radius: 10, life: 4 };
const at = (x: number, y = 3) => ({ x, y, z: 0 });
it('finds the cloud between frames even if neither endpoint is inside', () => {
  expect(crossesVeil(at(-20), at(20), cloud)).toBe(true);
  expect(crossesVeil(at(0), at(0), cloud)).toBe(true);
});
it('does not absorb shots above or beyond the cloud, or after expiry', () => {
  expect(crossesVeil(at(-20, 9), at(20, 9), cloud)).toBe(false);
  expect(crossesVeil(at(12), at(20), cloud)).toBe(false);
  expect(crossesVeil(at(0), at(1), { ...cloud, life: 0 })).toBe(false);
});
it('awards whole credits throughout the advertised range', () => {
  const values = Array.from({ length: 1001 }, (_, i) => cacheValue(i / 1000));
  expect(Math.min(...values)).toBe(SALVAGE.min);
  expect(Math.max(...values)).toBe(SALVAGE.max);
  expect(new Set(values).size).toBe(SALVAGE.max - SALVAGE.min + 1);
});

it('never grants continuous smoke, even with both belt upgrades and the evolution', () => {
  for (const belt of [0, 1, 2])
    for (const evolved of [true, false]) {
      const { life, cooldown } = veilStats(belt, evolved, WEAPON_INFO.smoke.cooldown);
      expect(cooldown - life).toBeGreaterThan(1.5);
    }
});
