import type { UpgradeDef, WeaponId } from './types';
import type { WeaponSocket } from './vehicles';

/** The first installation has no suffix; only installed stacks advance the name. */
export function upgradeName(name: string, rank: number): string {
  return rank > 1 ? `${name} ${rank}` : name;
}

export function offerName(upgrade: UpgradeDef, installed: number): string {
  return upgradeName(upgrade.name, upgrade.max === 1 || upgrade.id === 'medkit' ? 1 : installed + 1);
}

/** Multipliers and flat bonuses accumulated from picked upgrades. */
export interface PlayerStats {
  maxHpMul: number;
  regen: number;
  reloadMul: number;
  cannonDmgMul: number;
  splashMul: number;
  mgHeatMul: number;
  mgDmgMul: number;
  speedMul: number;
  critChance: number;
  pickupMul: number;
  missileCount: number;
  missileCdMul: number;
  missileDmgMul: number;
  shieldMax: number;
  shieldCdMul: number;
  strikeShells: number;
  strikeCdMul: number;
  railDmgMul: number;
  empRadiusMul: number;
  turretDmgMul: number;
  turretLifeMul: number;
  flameDmgMul: number;
  cryoDmgMul: number;
  cryoSlowMul: number;
  assistMul: number;
  armor: number; // flat damage reduction 0..0.5
  salvage: number; // score multiplier
  vampire: number; // hp per kill
  // signature mechanics (stacks)
  cluster: number; // submunitions per cannon shell
  reactive: number; // reactive armor shockwave damage
  overcharge: number; // every Nth cannon shot is overcharged
  nanites: number; // passive hull + shield regeneration
  haste: number; // killstreak surge buff
  arc: number; // auto chain-lightning damage
  bulwark: number; // shield capacity + recharge
  surge: number; // missile barrage size
  dropRate: number; // supply drop frequency
  overdriveStacks: number; // overdrive vent tuning
}

export const defaultStats = (): PlayerStats => ({
  maxHpMul: 1,
  regen: 0,
  reloadMul: 1,
  cannonDmgMul: 1,
  splashMul: 1,
  mgHeatMul: 1,
  mgDmgMul: 1,
  speedMul: 1,
  critChance: 0,
  pickupMul: 1,
  missileCount: 4,
  missileCdMul: 1,
  missileDmgMul: 1,
  shieldMax: 80,
  shieldCdMul: 1,
  strikeShells: 3,
  strikeCdMul: 1,
  railDmgMul: 1,
  empRadiusMul: 1,
  turretDmgMul: 1,
  turretLifeMul: 1,
  flameDmgMul: 1,
  cryoDmgMul: 1,
  cryoSlowMul: 1,
  assistMul: 1,
  armor: 0,
  salvage: 1,
  vampire: 0,
  cluster: 0,
  reactive: 0,
  overcharge: 0,
  nanites: 0,
  haste: 0,
  arc: 0,
  bulwark: 0,
  surge: 0,
  dropRate: 0,
  overdriveStacks: 0,
});

export const EVOLUTIONS: UpgradeDef[] = [
  { id: 'evo_autocannon', name: 'STATIC LINK', desc: 'Every sixth autocannon round arcs to a nearby enemy on impact for 14 lightning damage.', rarity: 'epic', icon: 'bolt', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'autocannon', max: 1 },
  { id: 'evo_cannon', name: 'CONCUSSION CORE', desc: 'Cannon explosions briefly stun every enemy caught in the blast.', rarity: 'epic', icon: 'blast', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'cannon', max: 1 },
  { id: 'evo_missiles', name: 'HUNTER SWARM', desc: '+2 missiles per salvo. Smart targeting distributes missiles across visible enemies.', rarity: 'epic', icon: 'missile', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'missiles', max: 1 },
  { id: 'evo_turret', name: 'ARC SENTRY', desc: 'Your sentry becomes a lightning turret. Each shot jumps to a second target.', rarity: 'epic', icon: 'turret', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'turret', max: 1 },
  { id: 'evo_scatter', name: 'SLAG SHOT', desc: 'Scattergun pellets ignite targets, adding 8 burn damage per second for 3 seconds.', rarity: 'epic', icon: 'scatter', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'scatter', max: 1 },
  { id: 'evo_flame', name: 'FIRESTORM', desc: 'Burning enemies explode on death, damaging and igniting nearby challengers.', rarity: 'epic', icon: 'flame', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'flame', max: 1 },
  { id: 'evo_orbital', name: 'ZENITH PROTOCOL', desc: 'Skyfall strikes are 25% wider and deal 20% more damage.', rarity: 'epic', icon: 'strike', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'orbital', max: 1 },
  { id: 'evo_cinder', name: 'FOUNDRY SPILL', desc: 'Canister blasts and their fire patches spread 35% wider. Ground fire lasts 10 seconds instead of 6.', rarity: 'epic', icon: 'flame', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'cinder', max: 1 },
  { id: 'evo_mines', name: 'CLUSTER MINES', desc: 'Deploy three mines at once. Mine blasts are 50% larger and ignite enemies.', rarity: 'epic', icon: 'mines', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'mines', max: 1 },
  { id: 'evo_coil', name: 'SPLINTER NEEDLES', desc: 'Coil rounds deal 45% more damage against chilled or frozen enemies.', rarity: 'epic', icon: 'coil', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'coil', max: 1 },
  { id: 'evo_cryoball', name: 'ABSOLUTE ZERO', desc: 'Ice grenades freeze for 2 extra seconds and leave targets brittle: +25% damage taken for 5s.', rarity: 'epic', icon: 'cryoball', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'cryoball', max: 1 },
  { id: 'evo_emp', name: 'CIRCUIT BREAKER', desc: 'EMP pulses arc to one nearby enemy for half damage and a shorter disruption. Both targets resist repeat EMP for 4s.', rarity: 'epic', icon: 'bolt', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'emp', max: 1 },
  { id: 'evo_rail', name: 'CHAIN REACTION', desc: 'Your railgun lightning jumps to two more targets for 55% and 35% damage.', rarity: 'epic', icon: 'target', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'rail', max: 1 },
  { id: 'evo_smoke', name: 'CHOKE SCREEN', desc: 'Smoke is wider, lasts 2s longer, and restores up to 30 shield points inside the cloud.', rarity: 'epic', icon: 'smoke', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'smoke', max: 1 },
  { id: 'evo_mortar', name: 'THERMAL DRUMS', desc: 'Mortar pools burn 55% hotter and 65% longer, and your own fire never scorches you.', rarity: 'epic', icon: 'mortar', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'mortar', max: 1 },
  { id: 'evo_nova', name: 'GLACIAL SHATTER', desc: 'The stasis nova deals 20 damage and leaves enemies brittle for 6s: they take 25% more damage.', rarity: 'epic', icon: 'nova', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'nova', max: 1 },
  { id: 'evo_overdrive', name: 'REACTOR PURGE', desc: 'Venting overdrive restores 50 shield, breaks the shield lock, and purges all weapon heat.', rarity: 'epic', icon: 'overdrive', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'overdrive', max: 1 },
  { id: 'evo_cryo', name: 'GLACIAL LOCK', desc: 'Chilled targets accumulate frost. Every 10 stacks freezes them solid for 4 seconds.', rarity: 'epic', icon: 'cryo', tag: 'SIGNATURE', signature: true, evolution: true, evolves: 'cryo', max: 1 },
];

export const UPGRADES: UpgradeDef[] = [
  ...EVOLUTIONS,
  // ---- signature upgrades: new mechanics ----
  { id: 'sig_cluster', name: 'CLUSTER MUNITIONS', desc: 'Cannon and scatter shells split into 6 bomblets on impact.', rarity: 'epic', icon: 'blast', tag: 'SIGNATURE', signature: true, max: 1 },
  { id: 'sig_reactive', name: 'REACTIVE ARMOR', desc: 'Taking a hit detonates an armor-piercing shockwave around you. 4s cooldown.', rarity: 'epic', icon: 'shield', tag: 'SIGNATURE', signature: true, max: 1 },
  { id: 'sig_overcharge', name: 'OVERCHARGED ROUNDS', desc: 'Every 5th shell is overcharged: double damage, much bigger blast.', rarity: 'epic', icon: 'bolt', tag: 'SIGNATURE', signature: true, max: 1 },
  { id: 'sig_nanites', name: 'REPAIR SWARM', desc: 'Nanites continuously rebuild hull armor and recharge your shield, even under fire.', rarity: 'epic', icon: 'regen', tag: 'SIGNATURE', signature: true, max: 1 },
  { id: 'sig_haste', name: 'KILLSTREAK SURGE', desc: 'Chaining 3 kills triggers a surge: 30% faster reload and 20% more speed for 8 seconds.', rarity: 'epic', icon: 'gear', tag: 'SIGNATURE', signature: true, max: 1 },
  { id: 'sig_arc', name: 'ARC DISCHARGER', desc: 'Every 6 seconds lightning arcs to the nearest hostile inside 45m.', rarity: 'epic', icon: 'bolt', tag: 'SIGNATURE', signature: true, max: 1 },
  { id: 'sig_bulwark', name: 'BULWARK FIELD', desc: 'Your shield holds +90 points and recharges 35% faster.', rarity: 'epic', icon: 'battery', tag: 'SIGNATURE', signature: true, max: 1 },
  { id: 'sig_surge', name: 'SATURATION BARRAGE', desc: 'Missile salvos fire +2 warheads and their blasts are 40% wider.', rarity: 'epic', icon: 'missile', tag: 'SIGNATURE', signature: true, max: 1 },
  { id: 'sig_scavenger', name: 'SUPPLY NETWORK', desc: 'Supply drops arrive 35% more often and land closer to you.', rarity: 'epic', icon: 'magnet', tag: 'SIGNATURE', signature: true, max: 1 },

  { id:'breacher', name:'BREACH CHARGES', desc:'Explosive impacts deal +50% base damage to structures per rank. Open a flank without spending a full salvo.', rarity:'common', icon:'blast', tag:'WEAPON', max:3 },
  { id:'induction', name:'INDUCTION LOOP', desc:'Recover 8 kJ on each kill per rank, up to your reactor capacity. Keeps weapons supplied during sustained fire.', rarity:'rare', icon:'bolt', tag:'SYSTEM', max:3 },
  // ---- hull ----
  { id: 'armor', name: 'COMPOSITE PLATING', desc: '+25% max armor and repair 25% now.', rarity: 'common', icon: 'armor', tag: 'HULL' },
  { id: 'regen', name: 'REPAIR CREW', desc: 'Regenerate 2 armor per second.', rarity: 'rare', icon: 'wrench', tag: 'HULL', max: 3 },
  { id: 'ablative', name: 'ABLATIVE LAYERS', desc: 'All incoming damage reduced by 10%.', rarity: 'rare', icon: 'rock', tag: 'HULL', max: 4 },
  { id: 'drive', name: 'TUNED DRIVETRAIN', desc: '+15% top speed and acceleration.', rarity: 'common', icon: 'gear', tag: 'HULL', max: 4 },
  { id: 'medkit', name: 'FIELD REPAIR', desc: 'Fully repair the hull right now.', rarity: 'common', icon: 'wrench', tag: 'HULL' },
  { id: 'magnet', name: 'SALVAGE MAGNET', desc: 'Repair kits heal 50% more and drop 50% more often.', rarity: 'common', icon: 'magnet', tag: 'HULL', max: 2 },
  { id: 'vampire', name: 'SCAVENGER CORE', desc: 'Restore 8 armor for every kill.', rarity: 'rare', icon: 'blood', tag: 'HULL', max: 3 },

  // ---- weapons (generic) ----
  { id: 'autoloader', name: 'AUTOLOADER', desc: 'Gun firing and reload delays are 15% shorter.', rarity: 'common', icon: 'reload', tag: 'WEAPON', max: 4 },
  { id: 'he', name: 'HE SHELLS', desc: '+25% shell damage, +25% blast radius.', rarity: 'common', icon: 'blast', tag: 'WEAPON', max: 4 },
  { id: 'crit', name: 'TUNGSTEN PENETRATORS', desc: '+15% chance for any hit to deal double damage.', rarity: 'rare', icon: 'target', tag: 'WEAPON', max: 4 },
  { id: 'coolant', name: 'LIQUID COOLANT', desc: 'Heat weapons build 30% less heat.', rarity: 'common', icon: 'snow', tag: 'WEAPON', max: 3 },
  { id: 'ap', name: 'AP ROUNDS', desc: '+40% bullet damage.', rarity: 'common', icon: 'armor', tag: 'WEAPON', max: 4 },

  // ---- weapons (per-mech) ----
  { id: 'belt', name: 'EXTENDED BELTS', desc: '+35% autocannon damage.', rarity: 'common', icon: 'reload', tag: 'WEAPON', max: 3 },
  { id: 'coilcap', name: 'OVERCLOCKED COILS', desc: '+35% coil repeater damage.', rarity: 'common', icon: 'bolt', tag: 'WEAPON', max: 3 },
  { id: 'napalm', name: 'PRESSURIZED NAPALM', desc: '+40% flamethrower damage and longer reach.', rarity: 'rare', icon: 'flame', tag: 'WEAPON', max: 3 },
  { id: 'deepfreeze', name: 'DEEP FREEZE', desc: '+35% cryo damage and 50% stronger slow.', rarity: 'rare', icon: 'cryo', tag: 'WEAPON', max: 3 },
  { id: 'missile_count', name: 'EXTENDED RACKS', desc: '+2 missiles per salvo.', rarity: 'rare', icon: 'missile', tag: 'WEAPON', max: 3 },
  { id: 'missile_cd', name: 'RAPID RELOAD RACKS', desc: 'Missile pod recharges 25% faster. +15% missile damage.', rarity: 'common', icon: 'clock', tag: 'WEAPON', max: 3 },
  { id: 'turret_up', name: 'SENTRY PROTOCOLS', desc: 'Sentry turret: +40% damage, +50% lifetime.', rarity: 'rare', icon: 'turret', tag: 'WEAPON', max: 3 },
  { id: 'rail_damage', name: 'RAIL CAPACITORS', desc: 'Railgun damage increased by 35%.', rarity: 'rare', icon: 'target', tag: 'WEAPON', max: 3 },
  { id: 'orbital_uplink', name: 'TARGETING UPLINK', desc: 'Each rank makes Skyfall 10% wider and reduces its base cooldown by 12%.', rarity: 'rare', icon: 'strike', tag: 'WEAPON', max: 2 },
  { id: 'cinder_charge', name: 'WIDE-MOUTH CANISTERS', desc: 'Each rank cuts base launcher cooldown by 18% and adds 1.8 m to the impact radius.', rarity: 'rare', icon: 'flame', tag: 'WEAPON', max: 2 },
  { id: 'mine_stock', name: 'EXTRA CHARGES', desc: 'Carry +2 mines and deploy one extra per use.', rarity: 'rare', icon: 'mines', tag: 'WEAPON', max: 2 },
  { id: 'smoke_belt', name: 'CANISTER BELT', desc: 'Smoke cooldown up to 12% shorter. The cloud lingers 0.5s longer; a brief gap remains between screens.', rarity: 'common', icon: 'smoke', tag: 'WEAPON', max: 2 },
  { id: 'ice_capacity', name: 'CRYO CANISTER', desc: 'Ice grenade blast +20% wider and recharges faster.', rarity: 'rare', icon: 'cryoball', tag: 'WEAPON', max: 2 },
  { id: 'mortar_shells', name: 'HEAP SHELLS', desc: '+1 incendiary shell in every mortar strike.', rarity: 'rare', icon: 'mortar', tag: 'WEAPON', max: 3 },
  { id: 'mortar_cd', name: 'QUICK LAUNCH', desc: 'Mortar cooldown is 25% shorter than its current value.', rarity: 'common', icon: 'clock', tag: 'WEAPON', max: 3 },
  { id: 'overdrive_up', name: 'REACTOR TUNING', desc: 'Overdrive lasts 4s longer and burns 40% hotter.', rarity: 'rare', icon: 'overdrive', tag: 'WEAPON', max: 3 },
  { id: 'nova_radius', name: 'FIELD EXPANSION', desc: 'Stasis nova reaches 30% further and freezes for longer.', rarity: 'rare', icon: 'nova', tag: 'WEAPON', max: 3 },
  { id: 'cryo_lance', name: 'DEEP CRYO LANCE', desc: '+40% cryo lance damage and a much stronger slow.', rarity: 'rare', icon: 'cryo', tag: 'WEAPON', max: 3 },

  // ---- systems ----
  { id: 'targeting', name: 'TARGETING COMPUTER', desc: 'Stronger aim assist and faster target lock for guided weapons.', rarity: 'rare', icon: 'radar', tag: 'SYSTEM', max: 2 },
  { id: 'shield_cap', name: 'CAPACITOR BANKS', desc: 'Shield absorbs +60 damage.', rarity: 'common', icon: 'battery', tag: 'SYSTEM', max: 3 },
  { id: 'shield_cd', name: 'FLUX REGULATOR', desc: 'Your shield begins recharging 30% sooner after damage.', rarity: 'rare', icon: 'bolt', tag: 'SYSTEM', max: 2 },
  { id: 'salvage', name: 'BOUNTY CONTRACT', desc: '+25% score from all kills.', rarity: 'common', icon: 'coin', tag: 'SYSTEM', max: 3 },
  { id: 'veteran', name: 'VETERAN INSTINCT', desc: '+10% hull capacity and repair 30 hull. Always available.', rarity: 'rare', icon: 'armor', tag: 'HULL' },
  { id: 'laurels', name: 'CHAMPION\'S RESOLVE', desc: '+30 shield capacity. Fully recharge your shield.', rarity: 'epic', icon: 'shield', tag: 'SYSTEM', signature: true },
];

/**
 * Which weapons use each installed upgrade in the simulation. Keep this based
 * on effects rather than reward tags: some system/signature upgrades change a
 * weapon, while many perks have no bearing on one at all. Evolutions use the
 * catalogue's `evolves` field instead of a second hand-maintained list.
 */
const WEAPON_UPGRADE_EFFECTS: Readonly<Record<string, readonly WeaponId[]>> = {
  autoloader: ['autocannon', 'coil', 'scatter', 'cannon', 'cryoball', 'emp'],
  he: ['cannon', 'scatter', 'missiles', 'mortar'],
  crit: ['autocannon', 'cannon', 'scatter', 'coil', 'flame', 'cryo', 'cryoball', 'emp', 'cinder', 'orbital', 'mines', 'missiles', 'turret', 'mortar', 'overdrive', 'rail'],
  coolant: ['autocannon', 'coil', 'flame'],
  ap: ['autocannon', 'coil'],
  breacher: ['cannon', 'scatter', 'missiles', 'mortar', 'cinder', 'orbital'],
  targeting: ['autocannon', 'coil', 'cannon', 'emp', 'missiles', 'mortar', 'rail'],
  sig_cluster: ['cannon', 'scatter', 'cinder', 'mortar'],
  sig_overcharge: ['cannon', 'scatter'],
  sig_haste: ['autocannon', 'coil', 'scatter', 'cannon'],
  sig_surge: ['missiles', 'mortar'],
  belt: ['autocannon'],
  coilcap: ['coil'],
  napalm: ['flame'],
  deepfreeze: ['cryo', 'cryoball'],
  cryo_lance: ['cryo', 'cryoball'],
  ice_capacity: ['cryoball'],
  missile_count: ['missiles'],
  missile_cd: ['missiles'],
  turret_up: ['turret'],
  rail_damage: ['rail'],
  orbital_uplink: ['orbital'],
  cinder_charge: ['cinder'],
  mine_stock: ['mines'],
  smoke_belt: ['smoke'],
  mortar_shells: ['mortar'],
  mortar_cd: ['mortar'],
  overdrive_up: ['overdrive'],
  nova_radius: ['nova'],
};

const UPGRADE_BY_ID = new Map(UPGRADES.map((upgrade) => [upgrade.id, upgrade]));

/** The sum is a count of installed ranks, not the number of different perks. */
export function weaponUpgradeInfo(weapon: WeaponId | null, socket: WeaponSocket, taken: ReadonlyMap<string, number>) {
  const upgrades: { name: string; rank: number; evolution: boolean }[] = [];
  if (!weapon) return { count: 0, upgrades, evolved: false };
  for (const [id, rank] of taken) {
    const upgrade = UPGRADE_BY_ID.get(id);
    if (!upgrade || rank <= 0) continue;
    const specialCryo = weapon === 'cryo' && (socket === 'specialQ' || socket === 'specialE');
    const affects = upgrade.evolution
      ? upgrade.evolves === weapon
      : (WEAPON_UPGRADE_EFFECTS[id]?.includes(weapon) ?? false)
        // The lance only builds heat as a secondary; its special version
        // instead uses reloadMul for the ability cooldown.
        || (weapon === 'cryo' && id === 'coolant' && socket === 'secondary')
        || (specialCryo && id === 'autoloader')
        // Unevolved stasis is non-damaging, so critical chance cannot affect it.
        || (weapon === 'nova' && id === 'crit' && (taken.get('evo_nova') ?? 0) > 0);
    if (affects) upgrades.push({ name: upgrade.name, rank, evolution: !!upgrade.evolution });
  }
  return {
    count: upgrades.reduce((sum, upgrade) => sum + upgrade.rank, 0),
    upgrades,
    evolved: upgrades.some((upgrade) => upgrade.evolution),
  };
}

const RARITY_WEIGHT: Record<UpgradeDef['rarity'], number> = { common: 10, rare: 5, epic: 1.7 };

function hasAny(owned: Set<WeaponId>, ids: WeaponId[]) {
  return ids.some((id) => owned.has(id));
}

/** One STANDARD, one RARE and one UNIQ bonus per victory — always useful to this mech. */
export function rollOffer(taken: Map<string, number>, owned: Set<WeaponId>, fullHull=false): UpgradeDef[] {
  const available = UPGRADES.filter((u) => {
    if(u.id==='medkit' && fullHull) return false;
    if (u.max !== undefined && (taken.get(u.id) ?? 0) >= u.max) return false;
    if (u.evolution) return !!u.evolves && owned.has(u.evolves);
    switch (u.id) {
      case 'missile_count':
      case 'missile_cd':
        return owned.has('missiles');
      case 'mortar_shells':
      case 'mortar_cd':
        return owned.has('mortar');
      case 'turret_up':
        return owned.has('turret');
      case 'orbital_uplink':
        return owned.has('orbital');
      case 'evo_cinder':
      case 'cinder_charge':
        return owned.has('cinder');
      case 'evo_mines':
      case 'mine_stock':
        return owned.has('mines');
      case 'evo_smoke':
      case 'smoke_belt':
        return owned.has('smoke');
      case 'evo_cryoball':
      case 'ice_capacity':
        return owned.has('cryoball');
      case 'overdrive_up':
        return owned.has('overdrive');
      case 'rail_damage':
        return owned.has('rail');
      case 'nova_radius':
        return owned.has('nova');
      case 'belt':
        return owned.has('autocannon');
      case 'coilcap':
        return owned.has('coil');
      case 'napalm':
        return owned.has('flame');
      case 'cryo_lance':
        return owned.has('cryo');
      case 'deepfreeze':
        return owned.has('cryo') || owned.has('cryoball');
      case 'breacher': return hasAny(owned,['cannon','missiles','scatter','mortar','orbital']);
      case 'sig_cluster':
      case 'sig_overcharge':
        return hasAny(owned, ['cannon', 'scatter']);
      case 'sig_surge':
        return hasAny(owned, ['missiles', 'mortar']);
      case 'ap':
        return hasAny(owned, ['autocannon', 'coil']);
      case 'he':
        return hasAny(owned, ['cannon', 'scatter']);
      case 'coolant': return hasAny(owned,['autocannon','coil','flame','cryo']);
      default:
        return true;
    }
  });
  const weighted = (pool: UpgradeDef[]) => {
    const total = pool.reduce((s, u) => s + RARITY_WEIGHT[u.rarity], 0);
    let r = Math.random() * total;
    for (const u of pool) {
      r -= RARITY_WEIGHT[u.rarity];
      if (r <= 0) return u;
    }
    return pool[pool.length - 1];
  };
  const result: UpgradeDef[] = [];
  const pool = [...available];
  // UNIQ slot: prefer a signature mechanic
  const epics = pool.filter((u) => u.rarity === 'epic');
  if (epics.length) {
    const evolutions = epics.filter((u) => u.evolution);
    const pick = evolutions.length && Math.random() < 0.85 ? evolutions[Math.floor(Math.random() * evolutions.length)] : weighted(epics);
    result.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  for (const rarity of ['rare', 'common'] as const) {
    let slot = pool.filter((u) => u.rarity === rarity);
    const weaponChoices = slot.filter((u) => u.tag === 'WEAPON');
    if (rarity === 'rare' && weaponChoices.length && Math.random() < 0.75) slot = weaponChoices;
    if (slot.length) {
      const pick = weighted(slot);
      result.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
  }
  // fill any gaps from whatever remains
  while (result.length < 3 && pool.length) {
    const pick = weighted(pool);
    result.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  // order: standard, rare, uniq
  const order = { common: 0, rare: 1, epic: 2 };
  return result.sort((a, b) => order[a.rarity] - order[b.rarity]);
}
