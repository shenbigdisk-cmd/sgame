import type { DropKind } from './types';
import { RACK_CAPACITIES } from './ordnance';

/** One legend for the physical crate, radar and pilot manual. Glyphs use a 24×24 view box. */
export const SUPPLIES: Record<
  DropKind,
  { name: string; short: string; effect: string; color: string; path: string }
> = {
  ammo: {
    name: 'Rearm crate', short: '+1 Q / +1 E', effect: `Adds one charge to each mounted special, up to ${RACK_CAPACITIES.Q} in Q and ${RACK_CAPACITIES.E} in E. Does not reset cooldowns or refill reactor energy.`,
    color: '#73defe', path: 'M3 20h18 M5 16V7l2-4 2 4v9z M14 16V7l2-4 2 4v9z',
  },
  repair: {
    name: 'Hull repair',
    short: 'REPAIR',
    effect: 'Restore 65 hull. At full hull, refill shields instead.',
    color: '#76f6a4',
    path: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  },
  shield: {
    name: 'Shield battery',
    short: 'FULL SHIELD',
    effect: 'Refill your shield and restart a broken shield.',
    color: '#78bcff',
    path: 'M12 2l8 3v7q0 6-8 10-8-4-8-10V5z M8 11h8',
  },
  overcharge: {
    name: 'Firepower',
    short: '+35% DMG · 25s',
    effect: 'All offensive systems deal 35% more damage for 25 seconds.',
    color: '#ffa25d',
    path: 'M14 2L4 14h7l-1 8 10-13h-7z',
  },
  rapid: {
    name: 'Rapid reload',
    short: 'RAPID FIRE · 25s',
    effect: 'Fire your guns 35% faster without heat buildup for 25 seconds.',
    color: '#def278',
    path: 'M3 5l7 7-7 7 M12 5l7 7-7 7',
  },
  emp: {
    name: 'EMP pulse',
    short: 'DISABLE · 34m',
    effect: 'Stun nearby hostiles for 5 seconds (bosses: 2.5s) and clear incoming rounds within 34 m.',
    color: '#cb9afa',
    path: 'M2 13h5l3-9 4 16 3-8h5',
  },
  score: {
    name: 'Score chip',
    short: '+600 SCORE',
    effect: 'Add 600 to your score. Not a wallet credit cache.',
    color: '#e3deda',
    path: 'M5 22V3h15l-4 5 4 5H5',
  },
  coins: {
    name: 'Credit cache',
    short: '25–60 CR',
    effect: 'Bank 25–60 credits in the hangar wallet immediately.',
    color: '#ffd263',
    path: 'M12 2l9 5v10l-9 5-9-5V7z M15 8h-5v8h5',
  },
  aegis: {
    name: 'Invincibility',
    short: 'IMMUNE · 6s',
    effect: 'Prevent all damage to hull and shields for 6 seconds.',
    color: '#6aefd9',
    path: 'M12 2l8 3v7q0 6-8 10-8-4-8-10V5z M8 11l3 3 5-6',
  },
};
