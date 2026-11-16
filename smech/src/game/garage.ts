import {
  STARTER_COMPONENTS,
  STARTER_EQUIPPED,
  buildConfig,
  frameOf,
  getComponent,
  stepWeightOf,
  type ComponentSlot,
} from './forge';
import type { GameStats, VehicleType } from './types';
import type { VehicleConfig } from './vehicles';

export const GARAGE_STORAGE_KEY = 'steel-horizon:garage:v1';
export const MAX_MECH_NAME = 18;
/** A small purse so a new pilot can buy a first component straight away. */
export const STARTING_CREDITS = 600;

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
}

export const DEFAULT_GARAGE: GarageState = {
  credits: STARTING_CREDITS,
  mechName: 'WARDEN-9',
  owned: [...STARTER_COMPONENTS],
  equipped: { ...STARTER_EQUIPPED },
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

function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return DEFAULT_GARAGE.mechName;
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, MAX_MECH_NAME);
  return trimmed || DEFAULT_GARAGE.mechName;
}

export function loadGarage(): GarageState {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_GARAGE, owned: [...STARTER_COMPONENTS], equipped: { ...STARTER_EQUIPPED } };
  try {
    const raw = localStorage.getItem(GARAGE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GARAGE, owned: [...STARTER_COMPONENTS], equipped: { ...STARTER_EQUIPPED } };
    const parsed = JSON.parse(raw) as Partial<GarageState>;
    const owned = Array.isArray(parsed.owned) ? parsed.owned.filter((id) => typeof id === 'string' && getComponent(id)) : [];
    // Starter parts are always available, even if an old save forgot them.
    for (const id of STARTER_COMPONENTS) if (!owned.includes(id)) owned.push(id);

    const equipped: Partial<Record<ComponentSlot, string>> = {};
    for (const slot of SLOTS) {
      const id = parsed.equipped?.[slot];
      const comp = id ? getComponent(id) : undefined;
      if (comp && id && owned.includes(id)) equipped[slot] = id;
      else if (STARTER_EQUIPPED[slot]) equipped[slot] = STARTER_EQUIPPED[slot];
    }
    // A special may sit in either special slot.
    if (equipped.specialQ === equipped.specialE) {
      equipped.specialE = STARTER_EQUIPPED.specialE;
      if (equipped.specialQ === equipped.specialE) equipped.specialQ = STARTER_EQUIPPED.specialQ;
    }

    return {
      credits: Math.max(0, Math.floor(Number(parsed.credits) || 0)),
      mechName: sanitizeName(parsed.mechName),
      owned,
      equipped,
    };
  } catch {
    return { ...DEFAULT_GARAGE, owned: [...STARTER_COMPONENTS], equipped: { ...STARTER_EQUIPPED } };
  }
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
