import {
  COMPONENT_SLOTS,
  PRESETS,
  STARTER_COMPONENTS,
  STARTER_EQUIPPED,
  buildConfig,
  frameOf,
  getComponent,
  stepWeightOf,
  type ComponentDef,
  type ComponentSlot,
  type Preset,
} from './forge';
import type { GameStats, VehicleType } from './types';
import type { VehicleConfig } from './vehicles';

export const GARAGE_STORAGE_KEY = 'steel-horizon:garage:v2';
/** the previous schema, read once so old pilots keep their parts */
export const LEGACY_GARAGE_STORAGE_KEY = 'steel-horizon:garage:v1';
export const MAX_MECH_NAME = 18;
/** how many named custom builds the yard keeps on file */
export const MAX_BLUEPRINTS = 8;
/** A small purse so a new pilot can buy a first component straight away. */
export const STARTING_CREDITS = 600;

/** A named custom build the player saved in the yard. */
export interface SavedBuild {
  id: string;
  name: string;
  /** the component mounted in each slot when the build was saved */
  equipped: Partial<Record<ComponentSlot, string>>;
}

/** A custom mech built by the player with credits. */
export interface CustomMech {
  id: string;
  name: string;
  frame: VehicleType;
  equipped: Partial<Record<ComponentSlot, string>>;
  cost: number;
  createdAt: number;
}

/** One of the fixed prebuilt factory mechs that cannot be sold or altered. */
export interface PrebuiltMech {
  id: string;
  frame: VehicleType;
  name: string;
  role: string;
  epithet: string;
  equipped: Partial<Record<ComponentSlot, string>>;
  cost: 0;
  isPrebuilt: true;
}

export const PREBUILT_MECHS: PrebuiltMech[] = [
  {
    id: 'prebuilt:warden',
    frame: 'warden',
    name: 'WARDEN-9 "OATHKEEPER"',
    role: 'BALANCED VETERAN',
    epithet: 'THE OATHKEEPER',
    equipped: { ...PRESETS[0].equipped },
    cost: 0,
    isPrebuilt: true,
  },
  {
    id: 'prebuilt:pyre',
    frame: 'pyre',
    name: 'PYRE-12 "CROWD-EATER"',
    role: 'FIRE BRAWLER',
    epithet: 'THE CROWD-EATER',
    equipped: { ...PRESETS[1].equipped },
    cost: 0,
    isPrebuilt: true,
  },
  {
    id: 'prebuilt:glacier',
    frame: 'glacier',
    name: 'GLACIER-7 "THE EXILE"',
    role: 'CRYO DUELIST',
    epithet: 'THE EXILE',
    equipped: { ...PRESETS[2].equipped },
    cost: 0,
    isPrebuilt: true,
  },
];

export type AnyMech = (CustomMech & { isPrebuilt?: false }) | PrebuiltMech;

/** Everything the player owns between runs. */
export interface GarageState {
  /** currency earned in the pits and spent in the forge */
  credits: number;
  /** the name on the side of the mech */
  mechName: string;
  /** component ids the player owns */
  owned: string[];
  /** the component mounted in each slot */
  equipped: Partial<Record<ComponentSlot, string>>;
  /** named custom builds the player has saved */
  blueprints: SavedBuild[];
  /** custom mechs built by the user */
  customMechs: CustomMech[];
  /** active mech identifier */
  activeMechId: string;
}

export const DEFAULT_GARAGE: GarageState = {
  credits: STARTING_CREDITS,
  mechName: 'WARDEN-9',
  owned: [...STARTER_COMPONENTS],
  equipped: { ...STARTER_EQUIPPED },
  blueprints: [],
  customMechs: [],
  activeMechId: 'prebuilt:warden',
};

const SLOTS: ComponentSlot[] = [
  'frame',
  'primary',
  'secondary',
  'specialQ',
  'specialE',
  'armour',
  'reactor',
  'drive',
];

/** A special can be mounted in either special socket; other slots are strict. */
function fitsSlot(comp: ComponentDef, slot: ComponentSlot): boolean {
  if (slot === 'specialQ' || slot === 'specialE') return comp.id.startsWith('x_');
  return comp.slot === slot;
}

function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return DEFAULT_GARAGE.mechName;
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, MAX_MECH_NAME);
  return trimmed || DEFAULT_GARAGE.mechName;
}

export function loadGarage(): GarageState {
  const fresh = (): GarageState => ({
    ...DEFAULT_GARAGE,
    owned: [...STARTER_COMPONENTS],
    equipped: { ...STARTER_EQUIPPED },
    blueprints: [],
  });
  if (typeof localStorage === 'undefined') return fresh();
  try {
    let raw = localStorage.getItem(GARAGE_STORAGE_KEY);
    // Pilots who played before the yard kept blueprints still have their
    // parts on file: carry the old save over instead of starting over.
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_GARAGE_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
        localStorage.setItem(GARAGE_STORAGE_KEY, legacy);
      }
    }
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<GarageState>;
    const owned = Array.isArray(parsed.owned) ? parsed.owned.filter((id) => typeof id === 'string' && getComponent(id)) : [];
    // Starter parts are always available, even if an old save forgot them.
    for (const id of STARTER_COMPONENTS) if (!owned.includes(id)) owned.push(id);

    const equippedData = parsed.equipped && typeof parsed.equipped === 'object'
      ? parsed.equipped as Partial<Record<ComponentSlot, string | null>>
      : {};
    // Old saves can predate activeMechId. Recognise the complete original Pyre
    // preset without changing custom Pyre builds that happen to use Cinder.
    const oldPyre = SLOTS.every(
      (slot) => equippedData[slot] === (slot === 'specialQ' ? 'x_jump' : (slot === 'specialE' ? 'x_mines' : PRESETS[1].equipped[slot]))
        || equippedData[slot] === (slot === 'specialQ' ? 'x_orbital' : (slot === 'specialE' ? 'x_mines' : PRESETS[1].equipped[slot])),
    );
    const activeMechId = typeof parsed.activeMechId === 'string' && parsed.activeMechId
      ? parsed.activeMechId
      : oldPyre ? 'prebuilt:pyre' : PREBUILT_MECHS[0].id;

    // Migrate prebuilt:pyre if it still has the old factory slots (x_orbital in Q and x_mines in E)
    if (activeMechId === 'prebuilt:pyre') {
      if (equippedData.specialQ === 'x_orbital' && equippedData.specialE === 'x_mines') {
        equippedData.specialQ = 'x_mines';
        equippedData.specialE = 'x_orbital';
      } else if (equippedData.specialQ === 'x_jump') {
        equippedData.specialQ = 'x_mines';
        equippedData.specialE = 'x_orbital';
      }
    }

    const prebuilt = PREBUILT_MECHS.find((mech) => mech.id === activeMechId);
    const equipped: Partial<Record<ComponentSlot, string>> = {};
    for (const slot of SLOTS) {
      // A missing or null key is a deliberately stripped mount, not a corrupt
      // save. Only an invalid component id falls back to the starter part.
      if (!Object.prototype.hasOwnProperty.call(equippedData, slot)) continue;
      const savedId = equippedData[slot];
      const oldFactoryCanister = activeMechId === 'prebuilt:pyre' && (
        (slot === 'specialQ' && savedId === 'x_jump') ||
        (slot === 'specialE' && savedId === 'x_jump')
      );
      const id = oldFactoryCanister ? (slot === 'specialQ' ? 'x_mines' : 'x_orbital') : savedId;
      if (id === null || id === undefined || id === '') continue;
      const comp = typeof id === 'string' ? getComponent(id) : undefined;
      // Fixed factory mechs can use their supplied parts without purchasing
      // them; a player-built mech still requires its own owned components.
      if (comp && typeof id === 'string' && (owned.includes(id) || prebuilt?.equipped[slot] === id) && fitsSlot(comp, slot)) {
        equipped[slot] = id;
      } else {
        equipped[slot] = STARTER_EQUIPPED[slot];
      }
    }
    // A special may sit in either special slot, but duplicate mounts are not legal.
    if (equipped.specialQ && equipped.specialQ === equipped.specialE) {
      equipped.specialE = STARTER_EQUIPPED.specialE;
      if (equipped.specialQ === equipped.specialE) equipped.specialQ = STARTER_EQUIPPED.specialQ;
    }

    const customMechs = sanitizeCustomMechs(parsed.customMechs);

    return {
      credits: Math.max(0, Math.floor(Number(parsed.credits) || 0)),
      mechName: sanitizeName(parsed.mechName),
      owned,
      equipped,
      blueprints: sanitizeBlueprints(parsed.blueprints, owned),
      customMechs,
      activeMechId,
    };
  } catch {
    return fresh();
  }
}

/** Keep only the custom mechs that have valid components. */
function sanitizeCustomMechs(raw: unknown): CustomMech[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomMech[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const m = entry as Partial<CustomMech>;
    if (typeof m.id !== 'string' || !m.id) continue;
    const equipped: Partial<Record<ComponentSlot, string>> = {};
    for (const slot of SLOTS) {
      const id = m.equipped?.[slot];
      const comp = id ? getComponent(id) : undefined;
      if (id && comp && fitsSlot(comp, slot)) equipped[slot] = id;
    }
    if (!Object.keys(equipped).length) continue;
    const frame = frameOf(equipped);
    out.push({
      id: m.id,
      name: sanitizeName(m.name),
      frame,
      equipped,
      cost: Math.max(0, Math.floor(Number(m.cost) || 0)),
      createdAt: Number(m.createdAt) || Date.now(),
    });
  }
  return out;
}

/** Keep only the saved builds that still make sense. */
function sanitizeBlueprints(raw: unknown, owned: string[]): SavedBuild[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedBuild[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const b = entry as Partial<SavedBuild>;
    if (typeof b.id !== 'string' || !b.id) continue;
    const equipped: Partial<Record<ComponentSlot, string>> = {};
    for (const slot of SLOTS) {
      const id = b.equipped?.[slot];
      const comp = id ? getComponent(id) : undefined;
      if (id && comp && owned.includes(id) && fitsSlot(comp, slot)) equipped[slot] = id;
    }
    if (!Object.keys(equipped).length) continue;
    out.push({ id: b.id, name: sanitizeName(b.name), equipped });
    if (out.length >= MAX_BLUEPRINTS) break;
  }
  return out;
}

export function saveGarage(state: GarageState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable */
  }
}

/**
 * Credits earned by a finished run.
 *
 * Score is the main source, waves and kills add a bonus, and a personal best
 * pays out extra so chasing a record is always worth a trip to the sand.
 */
export function creditsForRun(stats: GameStats, isBest: boolean): number {
  const base = Math.floor(Math.max(0, stats.score) / 50);
  const waveBonus = Math.max(0, stats.wave) * 30;
  const killBonus = Math.max(0, stats.kills) * 3;
  const bestBonus = isBest ? 150 : 0;
  return Math.max(25, base + waveBonus + killBonus + bestBonus);
}

/** Add credits to the wallet and persist the garage. */
export function grantCredits(state: GarageState, amount: number): GarageState {
  const next: GarageState = { ...state, credits: Math.max(0, state.credits + Math.floor(amount)) };
  saveGarage(next);
  return next;
}

export interface PurchaseResult {
  state: GarageState;
  ok: boolean;
  reason?: 'owned' | 'poor' | 'unknown';
}

/** Buy a component. Frames and starters are always free. */
export function buyComponent(state: GarageState, id: string): PurchaseResult {
  const comp = getComponent(id);
  if (!comp) return { state, ok: false, reason: 'unknown' };
  if (state.owned.includes(id)) return { state, ok: false, reason: 'owned' };
  if (state.credits < comp.cost) return { state, ok: false, reason: 'poor' };
  const next: GarageState = { ...state, owned: [...state.owned, id], credits: state.credits - comp.cost };
  saveGarage(next);
  return { state: next, ok: true };
}

/**
 * Mount an owned component in a slot.
 *
 * The special catalogue fills either special slot, so the slot is passed
 * explicitly. When the same component is already mounted in the other special
 * slot the two trade places instead of ending up duplicated.
 */
export function equipComponent(state: GarageState, id: string, slot?: ComponentSlot): GarageState {
  const comp = getComponent(id);
  if (!comp || !state.owned.includes(id)) return state;
  const target = slot ?? comp.slot;
  if (!fitsSlot(comp, target)) return state;
  const equipped: Partial<Record<ComponentSlot, string>> = { ...state.equipped };
  const previous = equipped[target];
  const other: ComponentSlot | null =
    target === 'specialQ' ? 'specialE' : target === 'specialE' ? 'specialQ' : null;
  if (other && equipped[other] === id) {
    equipped[other] = previous ?? STARTER_EQUIPPED[other];
  }
  equipped[target] = id;
  const next: GarageState = { ...state, equipped };
  saveGarage(next);
  return next;
}

/** Rename the mech. */
export function renameMech(state: GarageState, name: string): GarageState {
  const next: GarageState = { ...state, mechName: sanitizeName(name) };
  saveGarage(next);
  return next;
}

/** The configuration the simulation should run with. */
export function garageConfig(state: GarageState): VehicleConfig {
  return buildConfig(state.equipped);
}

/** The frame the built mech is based on. */
export function garageFrame(state: GarageState): VehicleType {
  return frameOf(state.equipped);
}

/** Enemy difficulty weight of the equipped frame. */
export function garageStepWeight(state: GarageState): number {
  return stepWeightOf(state.equipped);
}

/* ------------------------------------------------------------------ *
 * Factory presets
 * ------------------------------------------------------------------ */

/** The components a preset needs that the player does not own yet. */
export function missingParts(garage: GarageState, preset: Preset): string[] {
  const ids: string[] = [];
  for (const slot of COMPONENT_SLOTS) {
    const id = preset.equipped[slot];
    if (id && !garage.owned.includes(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Credits the yard charges to fit out a preset the player cannot afford yet. */
export function fitOutCost(garage: GarageState, preset: Preset): number {
  return missingParts(garage, preset).reduce((sum, id) => sum + (getComponent(id)?.cost ?? 0), 0);
}

/**
 * Load a factory blueprint.
 *
 * Only the parts the player already owns are mounted; the rest of the
 * blueprint waits in the yard until they are bought.
 */
export function applyPreset(garage: GarageState, preset: Preset): GarageState {
  const equipped = { ...garage.equipped };
  for (const slot of COMPONENT_SLOTS) {
    const id = preset.equipped[slot];
    if (!id) continue;
    if (slot === 'frame' || garage.owned.includes(id)) equipped[slot] = id;
  }
  const next = { ...garage, equipped };
  saveGarage(next);
  return next;
}

/**
 * Buy every missing part of a blueprint and fit it in one go.
 *
 * Fails when the player cannot cover the whole order, so the yard never
 * sells a half mech.
 */
export function fitOutPreset(
  garage: GarageState,
  preset: Preset,
): { ok: boolean; state: GarageState; reason?: 'poor'; spent: number } {
  const missing = missingParts(garage, preset);
  if (missing.length === 0) {
    return { ok: true, state: applyPreset(garage, preset), spent: 0 };
  }
  const cost = missing.reduce((sum, id) => sum + (getComponent(id)?.cost ?? 0), 0);
  if (garage.credits < cost) return { ok: false, state: garage, reason: 'poor', spent: 0 };
  // buyComponent() persists as a side effect. Build the whole order in memory
  // instead, so a failed fit-out never leaves a half-purchased garage behind.
  let state: GarageState = { ...garage, credits: garage.credits, owned: [...garage.owned] };
  for (const id of missing) {
    const comp = getComponent(id);
    if (!comp || state.credits < comp.cost) return { ok: false, state: garage, reason: 'poor', spent: 0 };
    state = { ...state, credits: state.credits - comp.cost, owned: [...state.owned, id] };
  }
  state = applyPreset(state, preset);
  saveGarage(state);
  return { ok: true, state, spent: cost };
}

export { PRESETS };

/**
 * Strip a slot bare.
 *
 * An empty socket is a legal build: the mech carries less mass and runs
 * faster, but it also has one less gun.
 */
export function unequipSlot(garage: GarageState, slot: ComponentSlot): GarageState {
  if (slot === 'frame') return garage;
  const equipped = { ...garage.equipped };
  delete equipped[slot];
  const next = { ...garage, equipped };
  saveGarage(next);
  return next;
}

/* ------------------------------------------------------------------ *
 * Named custom builds
 * ------------------------------------------------------------------ */

/** Save the current build under a name so it can be brought back later. */
export function saveBlueprint(state: GarageState, name: string): GarageState {
  const clean = sanitizeName(name);
  const equipped: Partial<Record<ComponentSlot, string>> = {};
  for (const slot of SLOTS) {
    const id = state.equipped[slot];
    if (id) equipped[slot] = id;
  }
  // Several saves can land in the same millisecond; never issue a duplicate id.
  const stamp = Date.now().toString(36);
  let id = `bp_${stamp}`;
  for (let suffix = 1; state.blueprints.some((b) => b.id === id); suffix += 1) {
    id = `bp_${stamp}_${suffix.toString(36)}`;
  }
  const blueprint: SavedBuild = { id, name: clean, equipped };
  const existing = state.blueprints.findIndex((b) => b.name.toUpperCase() === clean.toUpperCase());
  const blueprints = [...state.blueprints];
  if (existing >= 0) blueprints[existing] = blueprint;
  else blueprints.push(blueprint);
  // the yard only keeps so many builds on file
  const trimmed = blueprints.slice(Math.max(0, blueprints.length - MAX_BLUEPRINTS));
  const next: GarageState = { ...state, blueprints: trimmed };
  saveGarage(next);
  return next;
}

/** Load a saved build back onto the mech. */
export function loadBlueprint(state: GarageState, id: string): GarageState {
  const blueprint = state.blueprints.find((b) => b.id === id);
  if (!blueprint) return state;
  const equipped: Partial<Record<ComponentSlot, string>> = { ...state.equipped };
  for (const slot of SLOTS) {
    const id2 = blueprint.equipped[slot];
    if (id2) equipped[slot] = id2;
    else delete equipped[slot];
  }
  const next: GarageState = { ...state, equipped, mechName: sanitizeName(blueprint.name) };
  saveGarage(next);
  return next;
}

/** Strike a saved build off the yard's list. */
export function deleteBlueprint(state: GarageState, id: string): GarageState {
  const next: GarageState = { ...state, blueprints: state.blueprints.filter((b) => b.id !== id) };
  saveGarage(next);
  return next;
}

/* ------------------------------------------------------------------ *
 * Mech Building, Selling and Selection
 * ------------------------------------------------------------------ */

const COOL_PREFIXES = [
  'APEX', 'VOID', 'IRON', 'WAR', 'SHADOW', 'CHRONO', 'TEMPEST', 'NEXUS', 'CYBER',
  'TITAN', 'SOLAR', 'GHOST', 'FROST', 'BLAZE', 'OMEGA', 'SPECTRE', 'VIPER', 'HAVOC',
  'VALKYRIE', 'STRIKE', 'ZERO', 'ECLIPSE', 'ASTRAL', 'PHANTOM', 'CRIMSON', 'ONYX'
];

const COOL_SUFFIXES = [
  'REAPER', 'STRIDER', 'COMMANDER', 'COLOSSUS', 'STRIKER', 'VANGUARD', 'FURY',
  'KNIGHT', 'BEHEMOTH', 'WARLORD', 'ASSASSIN', 'SENTINEL', 'GLADIATOR', 'ENFORCER',
  'BREAKER', 'HUNTER', 'VALIANT', 'BASTION', 'DREADNOUGHT', 'PALADIN', 'DOMINATOR'
];

/** Generate a cool sci-fi mech designation automatically. */
export function generateCoolMechName(): string {
  const p = COOL_PREFIXES[Math.floor(Math.random() * COOL_PREFIXES.length)];
  // Include the separating space and the final hyphen/digit in the limit, so
  // a generated designation remains unchanged when it is built and saved.
  const suffixes = COOL_SUFFIXES.filter((suffix) => p.length + suffix.length + 3 <= MAX_MECH_NAME);
  const s = suffixes[Math.floor(Math.random() * suffixes.length)];
  const num = Math.floor(Math.random() * 9) + 1;
  return `${p} ${s}-${num}`;
}

/** Compute the total credit cost required to construct this mech from components. */
export function calculateBuildCost(equipped: Partial<Record<ComponentSlot, string>>): number {
  let cost = 0;
  for (const slot of SLOTS) {
    const id = equipped[slot];
    if (id) {
      const comp = getComponent(id);
      if (comp) cost += comp.cost;
    }
  }
  return Math.max(300, cost);
}

/**
 * Returns all available mechs:
 * Lists the user's custom-built mechs at the start, followed by always the 3 fixed factory mechs.
 */
export function getAllMechs(garage: GarageState): AnyMech[] {
  const custom = garage.customMechs || [];
  return [...custom, ...PREBUILT_MECHS];
}

/** Get the currently selected active mech. */
export function getActiveMech(garage: GarageState): AnyMech {
  const all = getAllMechs(garage);
  const found = all.find((m) => m.id === garage.activeMechId);
  return found ?? all[0] ?? PREBUILT_MECHS[0];
}

/** Select a mech from the collection as the active battle vehicle. */
export function selectMech(garage: GarageState, mechId: string): GarageState {
  const all = getAllMechs(garage);
  const found = all.find((m) => m.id === mechId);
  if (!found) return garage;
  const next: GarageState = {
    ...garage,
    activeMechId: found.id,
    equipped: { ...found.equipped },
    mechName: found.name,
  };
  saveGarage(next);
  return next;
}

/**
 * Build a new mech consuming total credits.
 * Once built, it is stored in the player's collection and selected as active.
 */
export function buildNewMech(
  garage: GarageState,
  name: string,
  equipped: Partial<Record<ComponentSlot, string>>
): { ok: boolean; state: GarageState; mech?: CustomMech; reason?: 'poor' } {
  const cost = calculateBuildCost(equipped);
  if (garage.credits < cost) {
    return { ok: false, state: garage, reason: 'poor' };
  }
  const cleanName = sanitizeName(name) || generateCoolMechName();
  const frame = frameOf(equipped);
  const id = `mech_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newMech: CustomMech = {
    id,
    name: cleanName,
    frame,
    equipped: { ...equipped },
    cost,
    createdAt: Date.now(),
  };

  // Ensure all parts in the build are registered in owned
  const owned = [...garage.owned];
  for (const slot of SLOTS) {
    const compId = equipped[slot];
    if (compId && !owned.includes(compId)) owned.push(compId);
  }

  const customMechs = [newMech, ...(garage.customMechs || [])];
  const next: GarageState = {
    ...garage,
    credits: garage.credits - cost,
    owned,
    customMechs,
    activeMechId: id,
    mechName: cleanName,
    equipped: { ...equipped },
  };
  saveGarage(next);
  return { ok: true, state: next, mech: newMech };
}

/**
 * Sell a custom mech for 50% (half price) of its build cost.
 * The 3 prebuilt factory mechs cannot be sold.
 */
export function sellCustomMech(
  garage: GarageState,
  mechId: string
): { ok: boolean; state: GarageState; refund: number; reason?: 'cannot_sell_prebuilt' | 'not_found' } {
  if (mechId.startsWith('prebuilt:')) {
    return { ok: false, state: garage, refund: 0, reason: 'cannot_sell_prebuilt' };
  }
  const currentCustom = garage.customMechs || [];
  const mech = currentCustom.find((m) => m.id === mechId);
  if (!mech) {
    return { ok: false, state: garage, refund: 0, reason: 'not_found' };
  }
  const refund = Math.floor(mech.cost / 2);
  const nextCustom = currentCustom.filter((m) => m.id !== mechId);

  let activeMechId = garage.activeMechId;
  let equipped = garage.equipped;
  let mechName = garage.mechName;

  if (activeMechId === mechId) {
    if (nextCustom.length > 0) {
      activeMechId = nextCustom[0].id;
      equipped = { ...nextCustom[0].equipped };
      mechName = nextCustom[0].name;
    } else {
      activeMechId = PREBUILT_MECHS[0].id;
      equipped = { ...PREBUILT_MECHS[0].equipped };
      mechName = PREBUILT_MECHS[0].name;
    }
  }

  const next: GarageState = {
    ...garage,
    credits: garage.credits + refund,
    customMechs: nextCustom,
    activeMechId,
    equipped,
    mechName,
  };
  saveGarage(next);
  return { ok: true, state: next, refund };
}
