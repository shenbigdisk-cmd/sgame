import { describe, expect, it } from 'vitest';
import { VEHICLES, VEHICLE_ORDER, WEAPON_COUNT, WEAPON_INFO } from './vehicles';

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

  it('gives every chassis a distinct baseline', () => {
    const seen = VEHICLE_ORDER.map((id) => `${VEHICLES[id].maxHp}/${VEHICLES[id].shield}/${VEHICLES[id].maxSpeed}`);
    expect(new Set(seen).size).toBe(VEHICLE_ORDER.length);
  });
});
