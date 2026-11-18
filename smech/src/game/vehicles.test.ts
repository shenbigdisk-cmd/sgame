import { describe, expect, it } from 'vitest';
import { VEHICLES, VEHICLE_ORDER, WEAPON_COUNT, WEAPON_INFO, socketForWeapon } from './vehicles';

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
        expect(weapon).toBeTruthy();
        expect(WEAPON_INFO[weapon!], `${id}/${weapon}`).toBeTruthy();
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

  it('balances the factory reactor against its sustained draw', () => {
    for (const id of VEHICLE_ORDER) {
      const v = VEHICLES[id];
      expect(v.powerOutput, id).toBeGreaterThanOrEqual(v.powerDraw);
      for (const [socket, cost] of Object.entries(v.powerCost)) {
        expect(cost, `${id}/${socket}`).toBeGreaterThan(0);
      }
    }
  });

  it('defines a complete, separated weapon profile for every chassis', () => {
    for (const id of VEHICLE_ORDER) {
      const v = VEHICLES[id];
      for (const field of [
        'cannonDamage', 'cannonReload', 'shellSpeed', 'splash',
        'mgDamage', 'mgInterval', 'mgHeatPerShot',
        'scatterDamage', 'scatterReload', 'scatterSpeed', 'scatterSplash',
        'flameDamage', 'cryoDamage', 'beamInterval',
        'cryoGrenadeDamage', 'cryoGrenadeReload',
      ] as const) {
        expect(v[field], `${id}/${field}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('power sockets', () => {
  it('maps a weapon to the socket that fires it', () => {
    const loadout = VEHICLES.warden.loadout;
    expect(socketForWeapon('autocannon', loadout)).toBe('primary');
    expect(socketForWeapon('cannon', loadout)).toBe('secondary');
    expect(socketForWeapon('missiles', loadout)).toBe('specialQ');
    expect(socketForWeapon('turret', loadout)).toBe('specialE');
    expect(socketForWeapon('scatter', loadout)).toBeNull();
  });
});

describe('shorter additional weapon cooldowns', () => {
  it('reduces every existing special’s base recharge without changing primary or secondary timing', () => {
    const previous = { cinder: 10, mines: 9, smoke: 14, missiles: 8, turret: 22, mortar: 20, overdrive: 22, rail: 8, nova: 15 } as const;
    for (const [id, cooldown] of Object.entries(previous)) {
      const weapon = id as keyof typeof previous;
      expect(WEAPON_INFO[weapon].cooldown, weapon).toBeGreaterThan(0);
      expect(WEAPON_INFO[weapon].cooldown, weapon).toBeLessThan(cooldown);
    }
    expect(WEAPON_INFO.orbital.cooldown).toBe(7);
    expect(WEAPON_INFO.cannon.cooldown).toBe(0.9);
    expect(WEAPON_INFO.cryoball.cooldown).toBe(2.8);
  });
});
