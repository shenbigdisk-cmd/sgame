import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { EVOLUTIONS, UPGRADES, defaultStats, rollOffer, weaponUpgradeInfo } from './upgrades';
import type { WeaponId } from './types';

const ALL: WeaponId[] = [
  'autocannon', 'cannon', 'scatter', 'coil', 'flame', 'cryo', 'cryoball', 'emp',
  'cinder', 'orbital', 'mines', 'smoke', 'missiles', 'turret', 'mortar', 'overdrive', 'rail', 'nova',
];

describe('player stats', () => {
  it('starts neutral', () => {
    const s = defaultStats();
    expect(s.maxHpMul).toBe(1);
    expect(s.reloadMul).toBe(1);
    expect(s.critChance).toBe(0);
    expect(s.armor).toBe(0);
    expect(s.overdriveStacks).toBe(0);
    expect(s.lastStand).toBe(0);
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

  it('gives every Forge special an evolution', () => {
    // The engine gates behaviour on evolved('mortar' | 'nova' | 'overdrive' | 'cryo');
    // a missing evolution would leave those branches permanently unreachable.
    const evoIds = new Set(EVOLUTIONS.map((e) => e.id));
    for (const special of ['mortar', 'nova', 'overdrive', 'cryo', 'orbital'] as WeaponId[]) {
      expect(evoIds.has(`evo_${special}`)).toBe(true);
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

describe('weapon upgrade indicators', () => {
  it('counts each installed rank and evolution only on the weapon it affects', () => {
    const taken = new Map([['turret_up', 2], ['evo_turret', 1], ['armor', 3], ['missile_cd', 1]]);
    expect(weaponUpgradeInfo('turret', 'specialE', taken)).toEqual({
      count: 3,
      upgrades: [
        { name: 'SENTRY PROTOCOLS', rank: 2, evolution: false },
        { name: 'ARC SENTRY', rank: 1, evolution: true },
      ],
      evolved: true,
    });
    expect(weaponUpgradeInfo('missiles', 'specialQ', taken).count).toBe(1);
    expect(weaponUpgradeInfo('cannon', 'secondary', taken).count).toBe(0);
    expect(weaponUpgradeInfo(null, 'specialE', taken)).toEqual({ count: 0, upgrades: [], evolved: false });
  });

  it('marks each evolution only on its own weapon', () => {
    for (const evolution of EVOLUTIONS) {
      const taken = new Map([[evolution.id, 1]]);
      for (const weapon of ALL) {
        const result = weaponUpgradeInfo(weapon, 'specialE', taken);
        expect(result.count, `${evolution.id} on ${weapon}`).toBe(weapon === evolution.evolves ? 1 : 0);
        expect(result.evolved).toBe(weapon === evolution.evolves);
      }
    }
  });

  it('applies generic damage, reload, targeting and structure bonuses where the engine uses them', () => {
    const taken = new Map([['he', 2], ['autoloader', 1], ['targeting', 1], ['breacher', 1], ['coolant', 1]]);
    expect(weaponUpgradeInfo('cannon', 'secondary', taken).count).toBe(5);
    expect(weaponUpgradeInfo('autocannon', 'primary', taken).count).toBe(3);
    expect(weaponUpgradeInfo('missiles', 'specialQ', taken).count).toBe(4);
    expect(weaponUpgradeInfo('mortar', 'specialE', taken).count).toBe(4);
    expect(weaponUpgradeInfo('cinder', 'specialQ', taken).count).toBe(1);
    expect(weaponUpgradeInfo('turret', 'specialE', taken).count).toBe(0);
    expect(weaponUpgradeInfo('smoke', 'specialE', taken).count).toBe(0);
  });

  it('badges LAST CIRCUIT on every damage-dealing weapon, but not on smoke or unevolved nova', () => {
    const taken = new Map([['sig_laststand', 1]]);
    for (const weapon of ALL) {
      const info = weaponUpgradeInfo(weapon, 'specialE', taken);
      expect(info.count, weapon).toBe(weapon === 'smoke' || weapon === 'nova' ? 0 : 1);
    }
  });

  it('respects the cryo socket and only applies crit to an evolved damaging nova', () => {
    const taken = new Map([['coolant', 1], ['autoloader', 1], ['deepfreeze', 2], ['crit', 1]]);
    expect(weaponUpgradeInfo('cryo', 'secondary', taken).count).toBe(4);
    expect(weaponUpgradeInfo('cryo', 'specialQ', taken).count).toBe(4);
    expect(weaponUpgradeInfo('nova', 'specialE', taken).count).toBe(0);
    taken.set('evo_nova', 1);
    expect(weaponUpgradeInfo('nova', 'specialE', taken).count).toBe(2);
    expect(weaponUpgradeInfo('smoke', 'specialE', taken).count).toBe(0);
  });

  it('includes shared signature effects, while ignoring repairs and unknown perks', () => {
    const taken = new Map([['sig_cluster', 1], ['sig_haste', 1], ['sig_surge', 1], ['medkit', 4], ['unknown', 9]]);
    expect(weaponUpgradeInfo('scatter', 'primary', taken).count).toBe(2);
    expect(weaponUpgradeInfo('cinder', 'specialQ', taken).count).toBe(1);
    expect(weaponUpgradeInfo('mortar', 'specialQ', taken).count).toBe(2);
    expect(weaponUpgradeInfo('turret', 'specialE', taken).count).toBe(0);
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

  it('offers the orbital evolution and uplink only to a mech with Skyfall', () => {
    const owned = new Set<WeaponId>(['orbital']);
    const without = new Set<WeaponId>(['cinder']);
    const seen = new Set<string>();
    let seed = 12345;
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    });
    try {
      for (let i = 0; i < 1000; i++) {
        for (const upgrade of rollOffer(new Map(), owned)) seen.add(upgrade.id);
        for (const upgrade of rollOffer(new Map(), without)) {
          expect(['evo_orbital', 'orbital_uplink']).not.toContain(upgrade.id);
        }
      }
      expect(seen.has('evo_orbital')).toBe(true);
      expect(seen.has('orbital_uplink')).toBe(true);
    } finally {
      random.mockRestore();
    }
  });

  it('still produces choices for a chassis with nothing extra', () => {
    const offer = rollOffer(new Map(), new Set<WeaponId>(['autocannon', 'cannon', 'missiles', 'turret']));
    expect(offer.length).toBeGreaterThan(0);
  });

  it('only offers special evolutions once that special is mounted', () => {
    const specialEvos = ['evo_mortar', 'evo_nova', 'evo_overdrive', 'evo_cryo'];
    const withoutSpecials = new Set<WeaponId>(['autocannon', 'cannon', 'missiles', 'turret']);
    for (let i = 0; i < 80; i++) {
      const offer = rollOffer(new Map(), withoutSpecials);
      for (const upgrade of offer) {
        if (specialEvos.includes(upgrade.id)) expect(upgrade.id).toBe('never');
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
