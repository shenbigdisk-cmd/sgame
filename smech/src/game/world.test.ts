import { describe, expect, it } from 'vitest';
import {
  MAX_ZONE,
  START_RADIUS,
  WORLD_RADIUS,
  districtAt,
  generateLayout,
  heightAt,
  inWater,
  randomSeedCode,
  seedFromString,
  stageSeedCode,
  zoneRadius,
} from './world';

describe('sector seeds', () => {
  it('produces codes in the documented shape', () => {
    for (let i = 0; i < 25; i++) {
      expect(randomSeedCode()).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
    }
  });

  it('hashes the same code to the same value', () => {
    expect(seedFromString('ABC-123')).toBe(seedFromString('ABC-123'));
    expect(seedFromString('ABC-123')).not.toBe(seedFromString('ABC-124'));
  });

  it('derives a stable, distinct sector code for every cleared stage', () => {
    const codes = Array.from({ length: 6 }, (_, stage) => stageSeedCode('ABC-123', stage));
    expect(codes.every((code) => /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
    expect(stageSeedCode('ABC-123', 2)).toBe(codes[2]);
    expect(stageSeedCode('ABC-124', 2)).not.toBe(codes[2]);
  });
});

describe('procedural layout', () => {
  it('is deterministic for a given seed', () => {
    const a = generateLayout('IRON-9');
    const b = generateLayout('IRON-9');
    expect(a.theme.name).toBe(b.theme.name);
    expect(a.districts.map((d) => `${d.type}:${d.name}:${d.x.toFixed(3)}:${d.z.toFixed(3)}`)).toEqual(
      b.districts.map((d) => `${d.type}:${d.name}:${d.x.toFixed(3)}:${d.z.toFixed(3)}`),
    );
    expect(a.roads.length).toBe(b.roads.length);
  });

  it('builds different worlds for different seeds', () => {
    const a = generateLayout('IRON-9');
    const b = generateLayout('RUST-4');
    const fingerprint = (l: typeof a) => `${l.theme.name}|${l.districts.length}|${l.districts.map((d) => d.name).join(',')}`;
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it('always produces a named theme, districts and roads', () => {
    const layout = generateLayout('HANG-01');
    expect(layout.theme.name.length).toBeGreaterThan(0);
    expect(layout.districts.length).toBeGreaterThan(0);
    expect(layout.roads.length).toBeGreaterThan(0);
  });

  it('reports a district for any position', () => {
    generateLayout('HANG-01');
    expect(districtAt(0, 0)).toBe('CENTRAL PLAZA');
    expect(districtAt(4000, -4000)).toBeTruthy();
  });
});

describe('golden layout', () => {
  it('rebuilds the exact same arena for a known seed', () => {
    const layout = generateLayout('IRON-9');
    expect(layout.theme.name).toBe('HIGH NOON');
    expect(layout.districts.map((d) => `${d.type}:${d.name}`)).toEqual([
      'highlands:RAZORBACK RIDGE',
      'industrial:REFINERY ROW',
      'city:HARBOR HEIGHTS',
      'marsh:MIRROR LAKES',
      'ruins:OLD TOWN',
      'ruins:THE WRECKAGE',
      'industrial:SCRAPWORKS',
      'mesas:RED MESAS',
      'crater:THE PIT',
      'city:CENTRAL BLOCKS',
      'marsh:SALT MARSH',
      'highlands:IRON HILLS',
      'crater:SCORCH CRATER',
      'mesas:THE SPIRES',
    ]);
    expect(layout.roads).toHaveLength(14);
  });

  it('rebuilds the exact same terrain', () => {
    generateLayout('IRON-9');
    let sum = 0;
    for (let i = 0; i < 500; i++) {
      sum += heightAt((i * 37) % 600 - 300, (i * 91) % 600 - 300);
    }
    expect(Math.round(sum * 1000) / 1000).toBe(1214.593);
  });
});

describe('terrain', () => {
  it('returns finite heights everywhere', () => {
    generateLayout('TERR-1');
    for (const [x, z] of [[0, 0], [50, -80], [-200, 130], [400, 400]]) {
      expect(Number.isFinite(heightAt(x, z))).toBe(true);
    }
  });

  it('flags water as a boolean', () => {
    generateLayout('TERR-1');
    expect(typeof inWater(0, 0)).toBe('boolean');
  });
});

describe('perimeter', () => {
  it('grows with every zone and stops at the world radius', () => {
    expect(zoneRadius(0)).toBe(START_RADIUS);
    expect(zoneRadius(1)).toBeGreaterThan(zoneRadius(0));
    expect(zoneRadius(MAX_ZONE)).toBeGreaterThan(zoneRadius(MAX_ZONE - 1));
    for (const zone of [0, 1, 2, 3, 99]) {
      expect(zoneRadius(zone)).toBeLessThanOrEqual(WORLD_RADIUS - 28);
    }
  });
});
