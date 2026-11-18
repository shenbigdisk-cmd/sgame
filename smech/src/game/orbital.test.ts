import { describe, expect, it } from 'vitest';
import { ORBITAL, orbitalDamage, orbitalOffset, orbitalRadius } from './orbital';

describe('Skyfall orbital barrage', () => {
  it('marks a large footprint, widening consistently with upgrades', () => {
    expect(orbitalRadius(0, false)).toBe(24);
    expect(orbitalRadius(2, false)).toBeCloseTo(28.8);
    expect(orbitalRadius(0, true)).toBe(30);
    expect(orbitalRadius(2, true)).toBeCloseTo(36);
    expect(orbitalRadius(100, false)).toBeCloseTo(28.8);
  });

  it('places one central bolt and six evenly distributed follow-ups within the marker', () => {
    const offsets = Array.from({ length: ORBITAL.bolts }, (_, i) => orbitalOffset(i, ORBITAL.radius));
    expect(offsets[0]).toEqual({ x: 0, z: 0 });
    for (const point of offsets.slice(1)) {
      expect(Math.hypot(point.x, point.z)).toBeCloseTo(ORBITAL.radius * 0.6);
    }
    expect(offsets.slice(1).reduce((sum, p) => sum + p.x, 0)).toBeCloseTo(0);
    expect(offsets.slice(1).reduce((sum, p) => sum + p.z, 0)).toBeCloseTo(0);
    expect(ORBITAL.warning).toBeGreaterThan(0);
    expect(ORBITAL.interval).toBeGreaterThan(0);
  });

  it('deals damage across the whole central footprint but not beyond it', () => {
    const base = ORBITAL.coreDamage;
    expect(orbitalDamage(0, ORBITAL.radius, base)).toBe(base);
    expect(orbitalDamage(-2, ORBITAL.radius, base)).toBe(base);
    expect(orbitalDamage(ORBITAL.radius / 2, ORBITAL.radius, base)).toBeCloseTo(base * 0.75);
    expect(orbitalDamage(ORBITAL.radius - 0.01, ORBITAL.radius, base)).toBeGreaterThan(base * 0.5);
    expect(orbitalDamage(ORBITAL.radius, ORBITAL.radius, base)).toBe(0);
    expect(orbitalDamage(ORBITAL.radius + 1, ORBITAL.radius, base)).toBe(0);
  });
});
