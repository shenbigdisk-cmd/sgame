import { describe, expect, it } from 'vitest';
import {
  COMPONENTS,
  COMPONENT_SLOTS,
  SLOT_WEAPONS,
  STARTER_COMPONENTS,
  STARTER_EQUIPPED,
  buildConfig,
  componentsForSlot,
  frameOf,
  getComponent,
  stepWeightOf,
} from './forge';
import { VEHICLES, WEAPON_INFO } from './vehicles';
import type { WeaponId } from './types';

describe('component catalogue', () => {
  it('uses unique component ids', () => {
    const ids = COMPONENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every component a name, description, cost and icon', () => {
    for (const comp of COMPONENTS) {
      expect(comp.name.length, comp.id).toBeGreaterThan(0);
      expect(comp.desc.length, comp.id).toBeGreaterThan(0);
      expect(comp.icon.length, comp.id).toBeGreaterThan(0);
      expect(comp.cost, comp.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('only mounts real weapons', () => {
    for (const comp of COMPONENTS) {
      if (comp.weapon) expect(WEAPON_INFO[comp.weapon], comp.id).toBeTruthy();
    }
  });

  it('fills every slot with at least one option', () => {
    for (const slot of COMPONENT_SLOTS) {
      expect(componentsForSlot(slot).length, slot).toBeGreaterThan(0);
    }
  });

  it('keeps the special catalogue usable in both special slots', () => {
    expect(componentsForSlot('specialQ')).toEqual(componentsForSlot('specialE'));
  });

  it('never mounts the same weapon twice', () => {
    for (const comp of COMPONENTS) {
      if (!comp.weapon) continue;
      expect(SLOT_WEAPONS.primary.includes(comp.weapon) || SLOT_WEAPONS.secondary.includes(comp.weapon) || SLOT_WEAPONS.special.includes(comp.weapon), comp.id).toBe(true);
    }
  });

  it('starts the player with a frame and a full set of starter parts', () => {
    for (const id of STARTER_COMPONENTS) {
      expect(getComponent(id), id).toBeTruthy();
    }
    expect(Object.keys(STARTER_EQUIPPED).sort()).toEqual([...COMPONENT_SLOTS].sort());
  });
});

describe('buildConfig', () => {
  it('produces the stock chassis when nothing is fitted', () => {
    const cfg = buildConfig({});
    expect(cfg.loadout.primary).toBe(VEHICLES.warden.loadout.primary);
    expect(cfg.maxHp).toBe(VEHICLES.warden.maxHp);
  });

  it('applies the frame baseline', () => {
    const cfg = buildConfig({ ...STARTER_EQUIPPED, frame: 'f_glacier' });
    expect(cfg.maxHp).toBe(VEHICLES.glacier.maxHp);
    expect(cfg.shield).toBe(VEHICLES.glacier.shield);
    expect(cfg.maxSpeed).toBe(VEHICLES.glacier.maxSpeed);
  });

  it('adds the armour, reactor and drive deltas', () => {
    const base = buildConfig(STARTER_EQUIPPED);
    const beefed = buildConfig({
      ...STARTER_EQUIPPED,
      armour: 'h_ablation',
      reactor: 'c_titan',
      drive: 'd_sprint',
    });
    expect(beefed.maxHp).toBe(base.maxHp + 85);
    expect(beefed.shield).toBe(base.shield + 70);
    expect(beefed.maxSpeed).toBeGreaterThan(base.maxSpeed);
  });

  it('mounts the chosen weapons', () => {
    const cfg = buildConfig({
      ...STARTER_EQUIPPED,
      primary: 'p_coil',
      secondary: 's_cryo',
      specialQ: 'x_nova',
      specialE: 'x_mortar',
    });
    expect(cfg.loadout.primary).toBe('coil');
    expect(cfg.loadout.secondary).toBe('cryo');
    expect(cfg.loadout.abilityQ).toBe('nova');
    expect(cfg.loadout.abilityE).toBe('mortar');
  });

  it('applies the weapon tuning of the mounted weapon', () => {
    const cfg = buildConfig({ ...STARTER_EQUIPPED, secondary: 's_cannon_90' });
    expect(cfg.cannonDamage).toBe(52);
  });

  it('never mounts the same weapon twice', () => {
    const cfg = buildConfig({
      ...STARTER_EQUIPPED,
      specialQ: 'x_nova',
      specialE: 'x_nova',
    });
    const weapons = Object.values(cfg.loadout);
    expect(new Set(weapons).size).toBe(weapons.length);
  });

  it('keeps every slot filled after a duplicate request', () => {
    const cfg = buildConfig({
      ...STARTER_EQUIPPED,
      specialQ: 'x_nova',
      specialE: 'x_nova',
    });
    for (const weapon of Object.values(cfg.loadout)) {
      expect(WEAPON_INFO[weapon as WeaponId]).toBeTruthy();
    }
  });

  it('never lets a build go below a playable baseline', () => {
    const cfg = buildConfig({
      ...STARTER_EQUIPPED,
      frame: 'f_warden',
      armour: 'h_ablation',
      drive: 'd_standard',
    });
    expect(cfg.maxHp).toBeGreaterThan(0);
    expect(cfg.maxSpeed).toBeGreaterThan(0);
    expect(cfg.shield).toBeGreaterThanOrEqual(0);
  });
});

describe('frame helpers', () => {
  it('reads the frame off the equipped slot', () => {
    expect(frameOf({ frame: 'f_pyre' })).toBe('pyre');
    expect(frameOf({ frame: 'f_glacier' })).toBe('glacier');
    expect(frameOf({})).toBe('warden');
  });

  it('carries a difficulty weight per frame', () => {
    const weights = (['f_warden', 'f_pyre', 'f_glacier'] as const).map((f) => stepWeightOf({ frame: f }));
    expect(new Set(weights).size).toBe(3);
    for (const w of weights) expect(w).toBeGreaterThan(0);
  });
});
