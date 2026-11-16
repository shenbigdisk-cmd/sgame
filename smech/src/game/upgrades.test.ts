import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVOLUTIONS, UPGRADES, defaultStats, rollOffer } from './upgrades';
import type { WeaponId } from './types';

const ALL: WeaponId[] = [
  'autocannon', 'cannon', 'scatter', 'coil', 'flame', 'cryo', 'cryoball',
  'jump', 'mines', 'smoke', 'missiles', 'turret', 'mortar', 'overdrive', 'rail', 'nova',
];

describe('player stats', () => {
  it('starts neutral', () => {
    const s = defaultStats();
    expect(s.maxHpMul).toBe(1);
    expect(s.reloadMul).toBe(1);
    expect(s.critChance).toBe(0);
    expect(s.armor).toBe(0);
    expect(s.overdriveStacks).toBe(0);
  });
});

describe('upgrade catalogue', () => {
  it('has unique ids', () => {
    const ids = UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every evolution after the weapon it evolves', () => {
    for (const evo of EVOLUTIONS) {
      expect(evo.evolution).toBe(true);
      expect(evo.evolves).toBeTruthy();
      expect(evo.id).toBe(`evo_${evo.evolves}`);
    }
  });

  it('only evolves weapons that exist', () => {
    for (const evo of EVOLUTIONS) {
      expect(ALL).toContain(evo.evolves!);
    }
  });

  it('gives every scavenged module weapon an evolution', () => {
    // The engine gates behaviour on evolved('mortar' | 'nova' | 'overdrive' | 'cryo');
    // a missing evolution would leave those branches permanently unreachable.
    const evoIds = new Set(EVOLUTIONS.map((e) => e.id));
    for (const moduleWeapon of ['mortar', 'nova', 'overdrive', 'cryo'] as WeaponId[]) {
      expect(evoIds.has(`evo_${moduleWeapon}`)).toBe(true);
    }
  });

  it('backs every evolution hook the engine uses', () => {
    // Guards against the engine calling evolved(x) for an evolution that does
    // not exist, which silently disables the whole branch.
    const source = readFileSync(resolve(process.cwd(), 'src/game/engine.ts'), 'utf8');
    const hooked = [...source.matchAll(/evolved\('([a-z]+)'\)/g)].map((m) => m[1]);
    expect(hooked.length).toBeGreaterThan(0);
    const evoIds = new Set(EVOLUTIONS.map((e) => e.id));
    for (const weapon of hooked) {
      expect(evoIds.has(`evo_${weapon}`)).toBe(true);
    }
  });
});

describe('rollOffer', () => {
  it('offers up to three choices ordered by rarity', () => {
    const offer = rollOffer(new Map(), new Set(ALL));
    expect(offer.length).toBeGreaterThan(0);
    expect(offer.length).toBeLessThanOrEqual(3);
    const rank = { common: 0, rare: 1, epic: 2 };
    const ranks = offer.map((u) => rank[u.rarity]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('never repeats the same upgrade inside one offer', () => {
    for (let i = 0; i < 50; i++) {
      const offer = rollOffer(new Map(), new Set(ALL));
      expect(new Set(offer.map((u) => u.id)).size).toBe(offer.length);
    }
  });

  it('respects the maximum number of stacks', () => {
    const taken = new Map([['regen', 3]]);
    for (let i = 0; i < 40; i++) {
      const offer = rollOffer(taken, new Set(ALL));
      expect(offer.some((u) => u.id === 'regen')).toBe(false);
    }
  });

  it('only offers evolutions for weapons the player owns', () => {
    const owned = new Set<WeaponId>(['cannon']);
    for (let i = 0; i < 60; i++) {
      const offer = rollOffer(new Map(), owned);
      for (const upgrade of offer) {
        if (upgrade.evolution) expect(owned.has(upgrade.evolves!)).toBe(true);
      }
    }
  });

  it('gates weapon-specific upgrades on the matching weapon', () => {
    const owned = new Set<WeaponId>(['cannon']);
    for (let i = 0; i < 80; i++) {
      const offer = rollOffer(new Map(), owned);
      for (const upgrade of offer) {
        if (upgrade.id === 'belt') expect(owned.has('autocannon')).toBe(true);
        if (upgrade.id === 'mortar_shells' || upgrade.id === 'mortar_cd') expect(owned.has('mortar')).toBe(true);
        if (upgrade.id === 'nova_radius') expect(owned.has('nova')).toBe(true);
        if (upgrade.id === 'overdrive_up') expect(owned.has('overdrive')).toBe(true);
        if (upgrade.id === 'cryo_lance') expect(owned.has('cryo')).toBe(true);
      }
    }
  });

  it('still produces choices for a chassis with nothing extra', () => {
    const offer = rollOffer(new Map(), new Set<WeaponId>(['autocannon', 'cannon', 'missiles', 'turret']));
    expect(offer.length).toBeGreaterThan(0);
  });

  it('only offers module evolutions once the module is mounted', () => {
    const moduleEvos = ['evo_mortar', 'evo_nova', 'evo_overdrive', 'evo_cryo'];
    const withoutModules = new Set<WeaponId>(['autocannon', 'cannon', 'missiles', 'turret']);
    for (let i = 0; i < 80; i++) {
      const offer = rollOffer(new Map(), withoutModules);
      for (const upgrade of offer) {
        if (moduleEvos.includes(upgrade.id)) expect(upgrade.id).toBe('never');
      }
    }
    const withMortar = new Set<WeaponId>(['autocannon', 'cannon', 'missiles', 'turret', 'mortar']);
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const offer = rollOffer(new Map(), withMortar);
      if (offer.some((u) => u.id === 'evo_mortar')) seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
});
