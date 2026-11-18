import { describe, expect, it } from 'vitest';
import { conditionFor } from './sectorRules';
import { impactMultiplier } from './threats';
import { rnd, seedRng } from './rng';

describe('sector briefing', () => {
  it('predicts a stable condition without disturbing arena generation', () => {
    seedRng(12);
    const expected = rnd();
    seedRng(12);
    expect(conditionFor('IRON-9')).toEqual(conditionFor('IRON-9'));
    expect(rnd()).toBe(expected);
  });
  it('offers each of the three conditions across sectors', () => {
    expect(new Set(Array.from({ length: 100 }, (_, i) => conditionFor(`TEST-${i}`).name)).size).toBe(3);
  });
});

describe('bastion plating', () => {
  it('rewards changing ammunition', () => {
    expect(impactMultiplier('bastion', 'bullet')).toBe(0.5);
    expect(impactMultiplier('bastion', 'rocket')).toBe(1.5);
    expect(impactMultiplier('bastion', 'shell')).toBe(1.5);
  });
  it('leaves unarmored targets unaffected', () => {
    expect(impactMultiplier('mender', 'bullet')).toBe(1);
    expect(impactMultiplier('mech', 'shell')).toBe(1);
  });
});
