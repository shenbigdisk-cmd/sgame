import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_GARAGE,
  GARAGE_STORAGE_KEY,
  LEGACY_GARAGE_STORAGE_KEY,
  MAX_BLUEPRINTS,
  STARTING_CREDITS,
  buyComponent,
  creditsForRun,
  equipComponent,
  fitOutCost,
  fitOutPreset,
  grantCredits,
  loadBlueprint,
  loadGarage,
  renameMech,
  saveBlueprint,
  saveGarage,
  selectMech,
  unequipSlot,
  type GarageState,
} from './garage';
import { buildConfig, getComponent, PRESETS, STARTER_COMPONENTS, STARTER_EQUIPPED } from './forge';
import type { GameStats } from './types';

const stats = (over: Partial<GameStats> = {}): GameStats => ({
  score: 1000,
  wave: 2,
  kills: 10,
  timeSurvived: 60,
  vehicle: 'warden',
  perks: [],
  seed: 'TEST-01',
  zone: 0,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
});

describe('garage persistence', () => {
  it('starts with the starter parts and a starter purse', () => {
    const garage = loadGarage();
    expect(garage.credits).toBe(STARTING_CREDITS);
    for (const id of STARTER_COMPONENTS) expect(garage.owned).toContain(id);
  });

  it('round-trips through storage', () => {
    const garage = loadGarage();
    const spent = grantCredits(garage, 900);
    saveGarage(spent);
    const loaded = loadGarage();
    expect(loaded.credits).toBe(STARTING_CREDITS + 900);
  });

  it('ignores a corrupted save', () => {
    localStorage.setItem(GARAGE_STORAGE_KEY, '{not json');
    expect(loadGarage().credits).toBe(STARTING_CREDITS);
  });

  it('drops unknown components from a tampered save', () => {
    localStorage.setItem(
      GARAGE_STORAGE_KEY,
      JSON.stringify({ credits: 10, mechName: 'X', owned: ['h_ablation', 'not_a_part'], equipped: { primary: 'not_a_part' } }),
    );
    const garage = loadGarage();
    expect(garage.owned).not.toContain('not_a_part');
    expect(garage.equipped.primary).not.toBe('not_a_part');
  });

  it('keeps the starter parts even when a save forgets them', () => {
    localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify({ credits: 0, owned: [], equipped: {} }));
    const garage = loadGarage();
    for (const id of STARTER_COMPONENTS) expect(garage.owned).toContain(id);
  });

  it('never lets a save go negative', () => {
    localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify({ credits: -500, owned: [], equipped: {} }));
    expect(loadGarage().credits).toBe(0);
  });

  it('keeps deliberately stripped sockets empty across a reload', () => {
    let garage = loadGarage();
    garage = unequipSlot(garage, 'primary');
    garage = unequipSlot(garage, 'specialQ');
    garage = unequipSlot(garage, 'specialE');
    saveGarage(garage);
    const loaded = loadGarage();
    expect(loaded.equipped.primary).toBeUndefined();
    expect(loaded.equipped.specialQ).toBeUndefined();
    expect(loaded.equipped.specialE).toBeUndefined();
    expect(loaded.equipped.reactor).toBe('c_standard');
  });
});

describe('credits', () => {
  it('pays out for a run', () => {
    expect(creditsForRun(stats({ score: 2000, wave: 4, kills: 30 }), false)).toBeGreaterThan(0);
  });

  it('pays more for a better run', () => {
    const small = creditsForRun(stats({ score: 500, wave: 1, kills: 5 }), false);
    const large = creditsForRun(stats({ score: 9000, wave: 8, kills: 90 }), false);
    expect(large).toBeGreaterThan(small);
  });

  it('pays a bonus for a personal best', () => {
    const plain = creditsForRun(stats(), false);
    const best = creditsForRun(stats(), true);
    expect(best).toBe(plain + 150);
  });

  it('always pays something for showing up', () => {
    expect(creditsForRun(stats({ score: 0, wave: 0, kills: 0 }), false)).toBeGreaterThan(0);
  });

  it('adds credits to the wallet', () => {
    const next = grantCredits(loadGarage(), 250);
    expect(next.credits).toBe(STARTING_CREDITS + 250);
    expect(loadGarage().credits).toBe(STARTING_CREDITS + 250);
  });
});

describe('buying and equipping', () => {
  const rich = (): GarageState => grantCredits(loadGarage(), 5000 - STARTING_CREDITS);

  it('buys a component and takes the credits', () => {
    const result = buyComponent(rich(), 'h_ablation');
    expect(result.ok).toBe(true);
    expect(result.state.owned).toContain('h_ablation');
    expect(result.state.credits).toBe(5000 - getComponent('h_ablation')!.cost);
  });

  it('refuses a purchase the player cannot afford', () => {
    const result = buyComponent({ ...DEFAULT_GARAGE, credits: 1 }, 'h_ablation');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('poor');
  });

  it('refuses to buy the same component twice', () => {
    const once = buyComponent(rich(), 'h_ablation').state;
    const twice = buyComponent(once, 'h_ablation');
    expect(twice.ok).toBe(false);
    expect(twice.reason).toBe('owned');
  });

  it('refuses an unknown component', () => {
    const result = buyComponent(rich(), 'not_a_component');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unknown');
  });

  it('equips an owned component', () => {
    const bought = buyComponent(rich(), 'h_ablation').state;
    const next = equipComponent(bought, 'h_ablation');
    expect(next.equipped.armour).toBe('h_ablation');
  });

  it('will not equip a component the player does not own', () => {
    const before = rich();
    const after = equipComponent(before, 'h_ablation');
    expect(after.equipped.armour).toBe(before.equipped.armour);
  });

  it('swaps the two specials instead of duplicating one', () => {
    let garage = rich();
    garage = equipComponent(garage, 'x_nova', 'specialQ');
    garage = equipComponent(garage, 'x_nova', 'specialE');
    expect(garage.equipped.specialQ).not.toBe(garage.equipped.specialE);
  });

  it('renames the mech and trims the name', () => {
    const renamed = renameMech(loadGarage(), '  IRON   VANGUARD  ');
    expect(renamed.mechName).toBe('IRON VANGUARD');
    expect(renameMech(loadGarage(), 'x'.repeat(40)).mechName.length).toBeLessThanOrEqual(18);
  });

  it('falls back to a default name for an empty one', () => {
    expect(renameMech(loadGarage(), '   ').mechName).toBe(DEFAULT_GARAGE.mechName);
  });
});

describe('factory blueprints and custom builds', () => {
  const rich = (): GarageState => ({ ...DEFAULT_GARAGE, credits: 10000, owned: [...STARTER_COMPONENTS], equipped: { ...STARTER_EQUIPPED } });

  it('charges once for a whole preset fit-out', () => {
    const preset = PRESETS[1];
    const before = rich();
    const cost = fitOutCost(before, preset);
    const result = fitOutPreset(before, preset);
    expect(result.ok).toBe(true);
    expect(result.spent).toBe(cost);
    expect(result.state.credits).toBe(before.credits - cost);
    for (const id of Object.values(preset.equipped)) expect(result.state.owned).toContain(id);
    expect(result.state.equipped.frame).toBe(preset.equipped.frame);
    expect(result.state.equipped.reactor).toBe(preset.equipped.reactor);
  });

  it('migrates a v1 garage into the v2 key', () => {
    localStorage.setItem(
      LEGACY_GARAGE_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_GARAGE, credits: 1234, mechName: 'OLD IRON' }),
    );
    const garage = loadGarage();
    expect(garage.credits).toBe(1234);
    expect(garage.mechName).toBe('OLD IRON');
    expect(localStorage.getItem(GARAGE_STORAGE_KEY)).toBeTruthy();
  });

  it('restores stripped sockets from a named build and caps the rack', () => {
    let garage = unequipSlot(rich(), 'primary');
    for (let i = 0; i < MAX_BLUEPRINTS + 3; i += 1) garage = saveBlueprint(garage, `BUILD ${i}`);
    expect(garage.blueprints).toHaveLength(MAX_BLUEPRINTS);
    garage = { ...garage, equipped: { ...garage.equipped, primary: 'p_autocannon' } };
    const last = garage.blueprints[garage.blueprints.length - 1];
    const loaded = loadBlueprint(garage, last.id);
    expect(loaded.equipped.primary).toBeUndefined();
    expect(loaded.mechName).toBe(last.name);
  });
});

describe('custom mech construction and sales', () => {
  it('generates a cool mech name', async () => {
    const { generateCoolMechName } = await import('./garage');
    const name = generateCoolMechName();
    expect(name.length).toBeGreaterThan(4);
    expect(name).toMatch(/[A-Z]+ [A-Z]+-\d/);
    // Long prefixes must still leave room for a complete suffix and number.
    for (let i = 0; i < 200; i++) {
      const generated = generateCoolMechName();
      expect(generated.length).toBeLessThanOrEqual(18);
      expect(generated).toMatch(/^[A-Z]+ [A-Z]+-\d$/);
    }
  });

  it('lists custom mechs at the start, followed by the 3 fixed prebuilt mechs', async () => {
    const { getAllMechs, buildNewMech } = await import('./garage');
    let garage = loadGarage();
    garage = grantCredits(garage, 5000);

    const initialMechs = getAllMechs(garage);
    expect(initialMechs).toHaveLength(3);
    expect(initialMechs[0].id).toBe('prebuilt:warden');
    expect(initialMechs[1].id).toBe('prebuilt:pyre');
    expect(initialMechs[2].id).toBe('prebuilt:glacier');

    const buildRes = buildNewMech(garage, 'TITAN X', garage.equipped);
    expect(buildRes.ok).toBe(true);

    const updatedMechs = getAllMechs(buildRes.state);
    expect(updatedMechs).toHaveLength(4);
    // Custom mech must be at the start
    expect(updatedMechs[0].name).toBe('TITAN X');
    expect(updatedMechs[0].isPrebuilt).toBeFalsy();
    // Prebuilt mechs follow
    expect(updatedMechs[1].id).toBe('prebuilt:warden');
    expect(updatedMechs[2].id).toBe('prebuilt:pyre');
    expect(updatedMechs[3].id).toBe('prebuilt:glacier');
  });

  it('consumes credits when building a mech and adds it to collection', async () => {
    const { buildNewMech, calculateBuildCost } = await import('./garage');
    let garage = loadGarage();
    garage = grantCredits(garage, 2000);
    const startCredits = garage.credits;
    const cost = calculateBuildCost(garage.equipped);

    const res = buildNewMech(garage, 'CYBER REAPER-9', garage.equipped);
    expect(res.ok).toBe(true);
    expect(res.state.credits).toBe(startCredits - cost);
    expect(res.state.customMechs).toHaveLength(1);
    expect(res.state.customMechs[0].name).toBe('CYBER REAPER-9');
    expect(res.state.activeMechId).toBe(res.mech?.id);
  });

  it('allows selling a custom mech at half price', async () => {
    const { buildNewMech, sellCustomMech } = await import('./garage');
    let garage = loadGarage();
    garage = grantCredits(garage, 3000);

    const buildRes = buildNewMech(garage, 'OMEGA STRIKER', garage.equipped);
    expect(buildRes.ok).toBe(true);
    const mech = buildRes.mech!;
    const creditsAfterBuild = buildRes.state.credits;

    const sellRes = sellCustomMech(buildRes.state, mech.id);
    expect(sellRes.ok).toBe(true);
    expect(sellRes.refund).toBe(Math.floor(mech.cost / 2));
    expect(sellRes.state.credits).toBe(creditsAfterBuild + Math.floor(mech.cost / 2));
    expect(sellRes.state.customMechs).toHaveLength(0);
  });

  it('charges the selected range, stability and EMP parts and keeps the paid refund across reloads', async () => {
    const { buildNewMech, calculateBuildCost, sellCustomMech } = await import('./garage');
    const garage = grantCredits(loadGarage(), 6000);
    const basic = { ...STARTER_EQUIPPED };
    const tuned = { ...basic, primary: 'p_coil_rail', secondary: 's_emp', drive: 'd_atlas' };
    const cost = calculateBuildCost(tuned);
    expect(cost).toBeGreaterThan(calculateBuildCost(basic));
    const result = buildNewMech(garage, 'VOLT SCOUT', tuned);
    expect(result.ok).toBe(true);
    expect(result.state.credits).toBe(garage.credits - cost);
    const restored = loadGarage();
    expect(restored.customMechs[0].equipped).toEqual(tuned);
    expect(buildConfig(restored.equipped)).toMatchObject({ primaryRange: 225, secondaryRange: 110, driveStability: 0.22 });
    const sold = sellCustomMech(restored, restored.customMechs[0].id);
    expect(sold.refund).toBe(Math.floor(cost / 2));
    expect(sold.state.credits).toBe(restored.credits + Math.floor(cost / 2));
  });

  it('forbids selling the 3 prebuilt factory mechs', async () => {
    const { sellCustomMech } = await import('./garage');
    const garage = loadGarage();
    const sellRes = sellCustomMech(garage, 'prebuilt:warden');
    expect(sellRes.ok).toBe(false);
    expect(sellRes.reason).toBe('cannot_sell_prebuilt');
  });
});

describe('Pyre orbital factory upgrade', () => {
  const oldFactoryPyre = { ...PRESETS[1].equipped, specialQ: 'x_jump' };

  it('keeps the new factory loadout when selecting and reloading Pyre without purchased parts', () => {
    const selected = selectMech(loadGarage(), 'prebuilt:pyre');
    expect(selected.equipped.specialQ).toBe('x_orbital');
    expect(selected.owned).not.toContain('x_orbital');
    const restored = loadGarage();
    expect(restored.equipped).toEqual(PRESETS[1].equipped);
    expect(buildConfig(restored.equipped).loadout).toMatchObject({ abilityQ: 'orbital', abilityE: 'mines' });
  });

  it('replaces Cinder on an already selected old factory Pyre and survives another save', () => {
    localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify({ ...DEFAULT_GARAGE, activeMechId: 'prebuilt:pyre', equipped: oldFactoryPyre }));
    const restored = loadGarage();
    expect(restored.equipped).toEqual(PRESETS[1].equipped);
    expect(buildConfig(restored.equipped).loadout.abilityQ).toBe('orbital');
    saveGarage(restored);
    expect(loadGarage().equipped).toEqual(PRESETS[1].equipped);
  });

  it('recognises an exact older factory Pyre even without an active mech id', () => {
    const legacy: Partial<GarageState> = { ...DEFAULT_GARAGE, equipped: oldFactoryPyre };
    delete legacy.activeMechId;
    localStorage.setItem(LEGACY_GARAGE_STORAGE_KEY, JSON.stringify(legacy));
    const restored = loadGarage();
    expect(restored.activeMechId).toBe('prebuilt:pyre');
    expect(restored.equipped.specialQ).toBe('x_orbital');
    expect(restored.equipped.specialE).toBe('x_mines');
  });

  it('does not rewrite custom mechs or saved builds that use Cinder', () => {
    const equipped = { frame: 'f_pyre', specialQ: 'x_jump' };
    const custom = { id: 'mech_old', name: 'OLD PYRE', frame: 'pyre', equipped, cost: 420, createdAt: 1 };
    localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify({
      ...DEFAULT_GARAGE, activeMechId: custom.id, equipped,
      owned: [...STARTER_COMPONENTS, 'x_jump'], customMechs: [custom],
      blueprints: [{ id: 'saved', name: 'OLD BUILD', equipped }],
    }));
    const restored = loadGarage();
    expect(restored.equipped.specialQ).toBe('x_jump');
    expect(restored.customMechs[0].equipped.specialQ).toBe('x_jump');
    expect(restored.blueprints[0].equipped.specialQ).toBe('x_jump');
    expect(buildConfig(restored.equipped).loadout.abilityQ).toBe('cinder');
  });

  it('does not replace deliberately empty sockets on a factory Pyre', () => {
    const equipped = { ...PRESETS[1].equipped } as Partial<GarageState['equipped']>;
    delete equipped.specialQ;
    localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify({ ...DEFAULT_GARAGE, activeMechId: 'prebuilt:pyre', equipped }));
    const restored = loadGarage();
    expect(restored.equipped.specialQ).toBeUndefined();
    expect(restored.equipped.specialE).toBe('x_mines');
  });
});
