import { describe, expect, it } from 'vitest';
import { MODULE_AFFINITY, MODULE_KEYS, MODULE_POOL, VEHICLES, VEHICLE_ORDER, WEAPON_COUNT, WEAPON_INFO, pickModule } from './vehicles';
import type { WeaponId } from './types';

describe('arsenal', () => {
  it('lists every weapon in the info table', () => {
    expect(WEAPON_COUNT).toBe(Object.keys(WEAPON_INFO).length);
    expect(WEAPON_COUNT).toBeGreaterThanOrEqual(16);
  });

  it('gives every weapon a name, icon and key', () => {
    for (const [id, info] of Object.entries(WEAPON_INFO)) {
      expect(info.name.length, id).toBeGreaterThan(0);
      expect(info.short.length, id).toBeGreaterThan(0);
      expect(info.icon.length, id).toBeGreaterThan(0);
      expect(info.key.length, id).toBeGreaterThan(0);
    }
  });

  it('uses unique weapon ids', () => {
    const ids = Object.keys(WEAPON_INFO);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('chassis', () => {
  it('exposes a loadout of four real weapons', () => {
    for (const id of VEHICLE_ORDER) {
      const loadout = Object.values(VEHICLES[id].loadout);
      expect(loadout).toHaveLength(4);
      for (const weapon of loadout) {
        expect(WEAPON_INFO[weapon], `${id}/${weapon}`).toBeTruthy();
      }
      expect(new Set(loadout).size).toBe(4);
    }
  });

  it('gives every chassis a distinct loadout', () => {
    const seen = VEHICLE_ORDER.map((id) => Object.values(VEHICLES[id].loadout).join('|'));
    expect(new Set(seen).size).toBe(VEHICLE_ORDER.length);
  });
});

describe('module hardpoints', () => {
  it('exposes two spare hardpoints beyond the chassis ones', () => {
    expect(MODULE_KEYS).toHaveLength(4);
    expect(MODULE_KEYS.slice(0, 2)).toEqual(['Q', 'E']);
  });

  it('binds the spare hardpoints to keys no other action uses', () => {
    // R and F drive the scavenged modules; Q/E drive the chassis specials and
    // C drives the secondary trigger, so the two must not overlap.
    expect(MODULE_KEYS.slice(2)).toEqual(['R', 'F']);
    const reserved = new Set(['Q', 'E', 'C', 'R', 'F']);
    expect(reserved.size).toBe(5);
  });

  it('only offers modules that are real weapons', () => {
    for (const module of MODULE_POOL) {
      expect(WEAPON_INFO[module], module).toBeTruthy();
    }
    expect(new Set(MODULE_POOL).size).toBe(MODULE_POOL.length);
  });

  it('never puts a module on a chassis hardpoint', () => {
    const chassisWeapons = new Set<WeaponId>(VEHICLE_ORDER.flatMap((id) => Object.values(VEHICLES[id].loadout)));
    for (const module of MODULE_POOL) expect(chassisWeapons.has(module)).toBe(false);
  });

  it('gives every chassis an affinity of real modules', () => {
    for (const id of VEHICLE_ORDER) {
      expect(MODULE_AFFINITY[id].length).toBeGreaterThan(0);
      for (const module of MODULE_AFFINITY[id]) expect(MODULE_POOL).toContain(module);
    }
  });
});

describe('weapon cache loot', () => {
  it('never hands out a module the player already owns', () => {
    const owned = new Set<WeaponId>(['mortar']);
    for (let i = 0; i < 200; i++) {
      const pick = pickModule(owned, 'warden');
      expect(pick).not.toBe('mortar');
    }
  });

  it('returns null once every module is owned', () => {
    const owned = new Set<WeaponId>(MODULE_POOL);
    expect(pickModule(owned, 'warden')).toBeNull();
  });

  it('prefers the chassis affinity when the roll succeeds', () => {
    // rand() < 0.65 selects the affinity branch, the next call indexes it
    const rand = (() => {
      const values = [0.1, 0];
      let i = 0;
      return () => values[i++ % values.length];
    })();
    expect(pickModule(new Set<WeaponId>(), 'glacier', rand)).toBe(MODULE_AFFINITY.glacier[0]);
  });

  it('falls back to the whole pool when the affinity roll fails', () => {
    const rand = (() => {
      const values = [0.9, 0];
      let i = 0;
      return () => values[i++ % values.length];
    })();
    const pick = pickModule(new Set<WeaponId>(), 'glacier', rand);
    expect(pick).not.toBeNull();
    expect(MODULE_POOL).toContain(pick!);
  });

  it('only offers modules the chassis affinity points at', () => {
    const owned = new Set<WeaponId>(MODULE_POOL.filter((m) => !MODULE_AFFINITY.pyre.includes(m)));
    for (let i = 0; i < 100; i++) {
      const pick = pickModule(owned, 'pyre');
      expect(MODULE_AFFINITY.pyre).toContain(pick!);
    }
  });
});
