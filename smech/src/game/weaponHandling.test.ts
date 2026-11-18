import { describe, expect, it } from 'vitest';
import { EMP, effectiveStability, projectileSpread } from './weaponHandling';

describe('weapon stabilization', () => {
  it('only reduces the extra spread from moving, not the stationary grouping', () => {
    const stationary = projectileSpread(0.009, 0, 20, 0.3, 0);
    expect(stationary).toBeCloseTo(0.009);
    expect(projectileSpread(0.009, 0, 20, 0.8, 0.3)).toBe(stationary);
    const moving = projectileSpread(0.009, 20, 20, 0.3, 0);
    const stabilised = projectileSpread(0.009, 20, 20, 0.3, 0.22);
    expect(moving).toBeGreaterThan(stationary);
    expect(stabilised).toBeLessThan(moving);
    expect(stabilised).toBeGreaterThan(stationary);
    expect(projectileSpread(0.009, -20, 20, 0.3, 0)).toBeCloseTo(moving);
  });

  it('caps combined stabilization at 95% and handles a speed boost safely', () => {
    expect(effectiveStability(0.8, 0.3)).toBe(0.95);
    expect(projectileSpread(0.009, 40, 20, 0.8, 0.3)).toBeCloseTo(0.009 + 0.032 * 0.05);
    expect(effectiveStability(0, 0)).toBe(0);
  });
});

describe('EMP balance', () => {
  it('makes bosses and chained targets less affected and prevents permanent lock', () => {
    expect(EMP.bossStun).toBeLessThan(EMP.stun);
    expect(EMP.chainStun).toBeLessThan(EMP.stun);
    expect(EMP.resistance).toBeGreaterThan(EMP.stun);
  });
});
