import { describe, expect, it } from 'vitest';
import {
  COMPONENTS,
  COMPONENT_SLOTS,
  HULL_DRAW,
  PRESETS,
  SLOT_WEAPONS,
  STARTER_COMPONENTS,
  STARTER_EQUIPPED,
  buildConfig,
  buildMass,
  buildStats,
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

describe('mass and power', () => {
  it('counts every component weight', () => {
    const mass = buildMass(STARTER_EQUIPPED);
    const expected = COMPONENT_SLOTS.reduce((sum, slot) => sum + (getComponent(STARTER_EQUIPPED[slot])!.weight), 0);
    expect(mass).toBeCloseTo(expected, 5);
  });

  it('runs a stripped mech faster than a stock one', () => {
    const stock = buildStats(STARTER_EQUIPPED);
    const stripped = buildStats({
      ...STARTER_EQUIPPED,
      secondary: undefined,
      specialQ: undefined,
      specialE: undefined,
    });
    expect(stripped.mass).toBeLessThan(stock.mass);
    expect(stripped.maxSpeed).toBeGreaterThan(stock.maxSpeed);
    expect(stripped.massFactor).toBeGreaterThan(1);
  });

  it('runs a loaded mech slower than a stock one', () => {
    const stock = buildStats(STARTER_EQUIPPED);
    const loaded = buildStats({
      ...STARTER_EQUIPPED,
      armour: 'h_ablation',
      reactor: 'c_titan',
      secondary: 's_cannon_90',
      specialQ: 'x_rail',
      specialE: 'x_mortar',
    });
    expect(loaded.mass).toBeGreaterThan(stock.mass);
    expect(loaded.maxSpeed).toBeLessThan(stock.maxSpeed);
    expect(loaded.massFactor).toBeLessThan(1);
  });

  it('takes capacity and output from the reactor', () => {
    const standard = buildStats({ ...STARTER_EQUIPPED, reactor: 'c_standard' });
    const titan = buildStats({ ...STARTER_EQUIPPED, reactor: 'c_titan' });
    expect(standard.powerCapacity).toBe(90);
    expect(standard.powerOutput).toBe(26);
    expect(titan.powerCapacity).toBeGreaterThan(standard.powerCapacity);
    expect(titan.powerOutput).toBeGreaterThan(standard.powerOutput);
  });

  it('charges activation costs to the cockpit socket, not the weapon id', () => {
    const stats = buildStats(STARTER_EQUIPPED);
    // hull draw + autocannon + cannon + missiles + sentry
    expect(stats.powerDraw).toBeGreaterThan(HULL_DRAW);
    expect(stats.powerCost).toEqual({
      primary: 0.9,
      secondary: 11,
      specialQ: 16,
      specialE: 12,
    });
  });

  it('keeps the Q and E sockets independently powered', () => {
    const stats = buildStats({
      ...STARTER_EQUIPPED,
      specialQ: 'x_rail',
      specialE: 'x_nova',
    });
    expect(stats.powerCost.specialQ).toBe(55);
    expect(stats.powerCost.specialE).toBe(50);
    expect(stats.powerCost.specialQ).not.toBe(stats.powerCost.specialE);
  });

  it('leaves stripped sockets free of activation cost and draw', () => {
    const full = buildStats(STARTER_EQUIPPED);
    const stripped = buildStats({
      ...STARTER_EQUIPPED,
      primary: undefined,
      secondary: undefined,
      specialQ: undefined,
      specialE: undefined,
    });
    expect(stripped.powerDraw).toBe(HULL_DRAW);
    expect(stripped.powerCost).toEqual({ primary: 0, secondary: 0, specialQ: 0, specialE: 0 });
    expect(stripped.powerDraw).toBeLessThan(full.powerDraw);
  });

  it('balances every factory blueprint on its reactor', () => {
    for (const preset of PRESETS) {
      const stats = buildStats(preset.equipped);
      expect(stats.powerOutput, preset.name).toBeGreaterThanOrEqual(stats.powerDraw);
      expect(stats.powerCost.specialQ, preset.name).toBeGreaterThan(0);
      expect(stats.powerCost.specialE, preset.name).toBeGreaterThan(0);
      expect(stats.powerCost.specialQ, preset.name).not.toBe(stats.powerCost.specialE);
    }
  });

  it('flags a loadout the reactor cannot sustain', () => {
    const greedy = buildStats({
      ...STARTER_EQUIPPED,
      specialQ: 'x_rail',
      specialE: 'x_nova',
      secondary: 's_cryo',
      reactor: 'c_standard',
    });
    expect(greedy.powerDraw).toBeGreaterThan(greedy.powerOutput);
  });
});

describe('buildConfig', () => {
  it('produces a bare chassis when nothing is fitted', () => {
    const cfg = buildConfig({});
    // An empty socket stays empty: the frame alone carries no weapons.
    expect(cfg.loadout.primary).toBeNull();
    expect(cfg.maxHp).toBe(VEHICLES.warden.maxHp);
  });

  it('applies the frame baseline', () => {
    const cfg = buildConfig({ ...STARTER_EQUIPPED, frame: 'f_glacier' });
    expect(cfg.maxHp).toBe(VEHICLES.glacier.maxHp);
    expect(cfg.shield).toBe(VEHICLES.glacier.shield);
    expect(cfg.maxSpeed).toBeCloseTo(VEHICLES.glacier.maxSpeed, 4);
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
    // The heavy armour and the titan core outweigh the light servos.
    expect(beefed.maxSpeed).toBeLessThan(base.maxSpeed);
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
    expect(cfg.cannonDamage).toBe(44);
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

  it('keeps primary scatter tuning from overwriting secondary cannons', () => {
    const cfg = buildConfig({
      ...STARTER_EQUIPPED,
      primary: 'p_bore',
      secondary: 's_cannon_atlas',
    });
    expect(cfg.scatterDamage).toBe(12.1);
    expect(cfg.scatterReload).toBe(1.4);
    expect(cfg.scatterSpeed).toBe(185);
    expect(cfg.scatterSplash).toBe(2.0);
    expect(cfg.cannonDamage).toBe(46);
    expect(cfg.cannonReload).toBe(1.7);
    expect(cfg.shellSpeed).toBe(190);
    expect(cfg.splash).toBe(5.5);
  });

  it('uses the secondary-specific beam and grenade tuning', () => {
    const flame = buildConfig({ ...STARTER_EQUIPPED, secondary: 's_flame_vent' });
    expect(flame.flameDamage).toBe(5.7);
    expect(flame.beamInterval).toBe(0.12);
    expect(flame.cannonDamage).toBe(VEHICLES.warden.cannonDamage);

    const lance = buildConfig({ ...STARTER_EQUIPPED, secondary: 's_cryo_heavy' });
    expect(lance.cryoDamage).toBe(4.1);
    expect(lance.beamInterval).toBe(0.16);
    expect(lance.cannonDamage).toBe(VEHICLES.warden.cannonDamage);

    const grenade = buildConfig({ ...STARTER_EQUIPPED, secondary: 's_cryoball' });
    expect(grenade.cryoGrenadeDamage).toBe(26);
    expect(grenade.cryoGrenadeReload).toBe(2.8);
    expect(grenade.cannonDamage).toBe(VEHICLES.warden.cannonDamage);
  });

  it('carries the mounted ranges and stability independently through the build', () => {
    const stock = buildConfig(STARTER_EQUIPPED);
    const tuned = buildConfig({ ...STARTER_EQUIPPED, primary: 'p_coil_rail', secondary: 's_emp', drive: 'd_atlas' });
    expect(stock.primaryRange).toBe(125);
    expect(stock.secondaryRange).toBe(170);
    expect(stock.primaryStability).toBe(0.3);
    expect(stock.driveStability).toBe(0);
    expect(tuned.primaryRange).toBe(225);
    expect(tuned.secondaryRange).toBe(110);
    expect(tuned.primaryStability).toBe(0.8);
    expect(tuned.secondaryStability).toBe(0.6);
    expect(tuned.driveStability).toBe(0.22);
    expect(tuned.loadout.secondary).toBe('emp');
    expect(tuned.empDamage).toBe(12);
    expect(tuned.empReload).toBe(3.2);
    expect(tuned.powerCost.secondary).toBe(22);
    const bare = buildConfig({ ...STARTER_EQUIPPED, primary: undefined, secondary: undefined });
    expect(bare.primaryRange).toBe(0);
    expect(bare.secondaryRange).toBe(0);
  });

  it('prices reach, stability and status effects without large raw-damage jumps', () => {
    const part = (id: string) => getComponent(id)!;
    for (const comp of COMPONENTS.filter((c) => c.slot === 'primary' || c.slot === 'secondary')) {
      expect(comp.range, comp.id).toBeGreaterThan(0);
    }
    expect(part('p_autocannon_mk2').cost).toBeGreaterThan(part('p_autocannon').cost);
    expect(part('p_autocannon_mk2').range).toBeGreaterThan(part('p_autocannon').range!);
    expect(part('p_autocannon_mk2').stability).toBeGreaterThan(part('p_autocannon').stability!);
    expect(part('p_coil_rail').cost).toBeGreaterThan(part('p_coil').cost);
    expect(part('d_atlas').cost).toBeGreaterThan(part('d_standard').cost);
    expect(part('d_anvil').mods?.driveStability).toBeGreaterThan(part('d_atlas').mods!.driveStability!);
    expect(part('s_emp').cost).toBeGreaterThan(part('s_cannon').cost);
    expect(part('s_emp').weaponStats!.empDamage).toBeLessThan(part('s_cannon').weaponStats!.cannonDamage!);
    const pairs = [
      ['p_autocannon', 'p_autocannon_mk2', 'mgDamage'],
      ['p_autocannon', 'p_gatling', 'mgDamage'],
      ['p_scatter', 'p_scatter_sawed', 'scatterDamage'],
      ['p_scatter', 'p_bore', 'scatterDamage'],
      ['p_coil', 'p_coil_rail', 'mgDamage'],
      ['s_cannon', 's_cannon_90', 'cannonDamage'],
      ['s_cannon', 's_cannon_atlas', 'cannonDamage'],
      ['s_flame', 's_flame_vent', 'flameDamage'],
      ['s_cryo', 's_cryo_heavy', 'cryoDamage'],
    ] as const;
    for (const [base, advanced, stat] of pairs) {
      expect(part(advanced).weaponStats![stat]!, advanced).toBeLessThanOrEqual(part(base).weaponStats![stat]! * 1.15 + 1e-9);
    }
  });

  it('hands the socket-based power costs to the simulation', () => {
    const cfg = buildConfig({
      ...STARTER_EQUIPPED,
      specialQ: 'x_mortar',
      specialE: 'x_rail',
    });
    expect(cfg.powerCost).toEqual({
      primary: 0.9,
      secondary: 11,
      specialQ: 24,
      specialE: 55,
    });
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
