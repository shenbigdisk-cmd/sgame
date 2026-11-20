/**
 * Military Operations Campaign Architecture for SMECH
 *
 * Provides expansive tactical operations with narrative stage progression,
 * strategic infrastructure targets (Flak Towers, FOBs, Radar Jamming Relays),
 * and structured forward battlefields.
 */

import type { EnemyKind, WeaponId } from './types';

export type FactionId = 'allied_command' | 'iron_vanguard' | 'free_militia' | 'syndicate_black';

export interface FactionInfo {
  id: FactionId;
  name: string;
  tagline: string;
  color: string;
  description: string;
}

export const FACTIONS: Record<FactionId, FactionInfo> = {
  allied_command: {
    id: 'allied_command',
    name: 'Allied Ground Command',
    tagline: 'Forward Defense Coalition',
    color: '#38bdf8',
    description: 'Central regular military armored division executing tactical operations across the frontier.',
  },
  iron_vanguard: {
    id: 'iron_vanguard',
    name: 'Iron Vanguard Legion',
    tagline: 'Heavy Mechanized Opponents',
    color: '#ef4444',
    description: 'Hostile mechanized forces entrenching anti-air batteries, fortress redoubts, and forward armor pickets.',
  },
  free_militia: {
    id: 'free_militia',
    name: 'Frontier Free Militia',
    tagline: 'Scrap & Survival',
    color: '#f59e0b',
    description: 'Local volunteer defense units defending civilian settlements and supply corridors.',
  },
  syndicate_black: {
    id: 'syndicate_black',
    name: 'Obsidian Syndicate',
    tagline: 'Armored PMC',
    color: '#a855f7',
    description: 'High-tech mercenary armored contractor executing covert black ops in disputed sectors.',
  },
};

export type PilotSkillId =
  | 'deadly_aim'
  | 'overclock'
  | 'kinetic_slugs'
  | 'anchor_stride'
  | 'cushion_plating'
  | 'dash_vector'
  | 'coolant_inject'
  | 'siphon_grid'
  | 'core_shielding'
  | 'sensor_sweep'
  | 'field_rearm'
  | 'orbital_beacon';

export type SkillCategory = 'gunnery' | 'piloting' | 'engineering' | 'tactics';

export interface PilotSkillDef {
  id: PilotSkillId;
  name: string;
  category: SkillCategory;
  desc: string;
  maxRank: number;
  costPerRank: number;
}

export const PILOT_SKILLS: Record<PilotSkillId, PilotSkillDef> = {
  deadly_aim: {
    id: 'deadly_aim',
    name: 'Deadly Aim',
    category: 'gunnery',
    desc: '+15% critical hit damage and softer reticle correction.',
    maxRank: 3,
    costPerRank: 1,
  },
  overclock: {
    id: 'overclock',
    name: 'Overclock Relay',
    category: 'gunnery',
    desc: 'Eliminating an enemy instantly cuts 0.6s off active weapon cooldowns.',
    maxRank: 3,
    costPerRank: 2,
  },
  kinetic_slugs: {
    id: 'kinetic_slugs',
    name: 'Hyper-Velocity Slugs',
    category: 'gunnery',
    desc: '+25% projectile flight speed and +20% structure breach force.',
    maxRank: 2,
    costPerRank: 2,
  },
  anchor_stride: {
    id: 'anchor_stride',
    name: 'Anchor Stride',
    category: 'piloting',
    desc: '+20% reverse drive speed and +15% chassis turning agility.',
    maxRank: 3,
    costPerRank: 1,
  },
  cushion_plating: {
    id: 'cushion_plating',
    name: 'Cushion Dampeners',
    category: 'piloting',
    desc: 'Reduces terrain collisions, ramming, and explosive splash damage by 25%.',
    maxRank: 2,
    costPerRank: 2,
  },
  dash_vector: {
    id: 'dash_vector',
    name: 'Vector Thrusters',
    category: 'piloting',
    desc: 'Double-tapping movement triggers an emergency directional chassis burst.',
    maxRank: 1,
    costPerRank: 3,
  },
  coolant_inject: {
    id: 'coolant_inject',
    name: 'Auxiliary Coolant',
    category: 'engineering',
    desc: '+20% weapon heat dissipation and reduces overheat shutdown time by 1s.',
    maxRank: 3,
    costPerRank: 1,
  },
  siphon_grid: {
    id: 'siphon_grid',
    name: 'Siphon Capacitor',
    category: 'engineering',
    desc: 'Shocking or destroying an enemy restores 12 points of shield.',
    maxRank: 2,
    costPerRank: 2,
  },
  core_shielding: {
    id: 'core_shielding',
    name: 'Emergency Breaker',
    category: 'engineering',
    desc: 'A fatal hull blow leaves the rig at 1 HP and purges all attackers with an EMP pulse (once per sortie).',
    maxRank: 1,
    costPerRank: 4,
  },
  sensor_sweep: {
    id: 'sensor_sweep',
    name: 'Sensor Suite',
    category: 'tactics',
    desc: '+40m radar detection radius and highlights enemy weak points through dust.',
    maxRank: 3,
    costPerRank: 1,
  },
  field_rearm: {
    id: 'field_rearm',
    name: 'Reserve Magazines',
    category: 'tactics',
    desc: 'Mounts +1 extra capacity charge to special ordnance racks (Q/E).',
    maxRank: 2,
    costPerRank: 2,
  },
  orbital_beacon: {
    id: 'orbital_beacon',
    name: 'Ordnance Uplink',
    category: 'tactics',
    desc: 'Guarantees an automated resupply drop lands nearby when shields collapse.',
    maxRank: 1,
    costPerRank: 3,
  },
};

export type ObjectiveType =
  | 'infiltrate_zone'
  | 'demolish_installation'
  | 'neutralize_outpost'
  | 'secure_fob'
  | 'eliminate_warlord'
  | 'reach_extraction';

export interface CampaignObjective {
  id: string;
  type: ObjectiveType;
  title: string;
  desc: string;
  stage: number; // Only active during this operational stage
  targetCount: number;
  currentCount: number;
  completed: boolean;
  pos: [number, number]; // [x, z] coordinate
  radius?: number;
  targetKind?: EnemyKind;
  installationName?: string;
}

export interface TacticalSpawn {
  kind: EnemyKind;
  pos: [number, number]; // [x, z]
  stage: number; // Spawns when stage begins
  boss?: boolean;
  name?: string;
}

export interface RadioTransmission {
  id: string;
  sender: string;
  callsign: string;
  text: string;
  stageTrigger?: number; // Plays when this stage activates
}

export interface SalvageItem {
  id: string;
  name: string;
  kind: 'weapon' | 'component' | 'scrap';
  detail: string;
  value: number;
  weaponId?: WeaponId;
}

export interface CampaignMission {
  id: string;
  operationNumber: number;
  title: string;
  operationName: string;
  theater: string;
  briefingTranscript: string[];
  seed: string;
  themeName: string;
  threatLevel: 'TACTICAL' | 'SEVERE' | 'CRITICAL';
  rewards: {
    credits: number;
    xp: number;
  };
  objectives: CampaignObjective[];
  tacticalSpawns: TacticalSpawn[];
  transmissions: RadioTransmission[];
  extractionZone: { x: number; z: number; radius: number };
  salvagePool: SalvageItem[];
}

export const CAMPAIGN_MISSIONS: CampaignMission[] = [
  {
    id: 'op_iron_vanguard',
    operationNumber: 1,
    title: 'Operation Iron Vanguard',
    operationName: 'SPEARHEAD RIVERINE',
    theater: 'Sector 4: Industrial Valley & Flak Corridors',
    briefingTranscript: [
      'Nomad-Actual, this is Command. Vanguard armor has dug into the southern industrial valley.',
      'Their automated Anti-Air Flak batteries have closed our airspace. Friendly dropships are grounded.',
      'Advance along Grid Alpha, demolish both Flak Batteries, secure FOB Falcon, and punch through to the extraction zone.',
      'Dismissed. Good hunting.',
    ],
    seed: 'VANGUARD-01',
    themeName: 'DUSK',
    threatLevel: 'TACTICAL',
    rewards: {
      credits: 650,
      xp: 450,
    },
    objectives: [
      {
        id: 'obj_stage1_picket',
        stage: 1,
        type: 'neutralize_outpost',
        title: 'Neutralize Forward Picket',
        desc: 'Engage and eliminate Vanguard scout pickets guarding Highway Alpha.',
        targetCount: 3,
        currentCount: 0,
        completed: false,
        pos: [50, 70],
        radius: 35,
      },
      {
        id: 'obj_stage2_flak_a',
        stage: 2,
        type: 'demolish_installation',
        title: 'Demolish Flak Battery Alpha',
        desc: 'Destroy the hardened Anti-Air battery tower at Grid 14-B.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-90, 80],
        radius: 20,
        installationName: 'FLAK BATTERY ALPHA',
      },
      {
        id: 'obj_stage2_flak_b',
        stage: 2,
        type: 'demolish_installation',
        title: 'Demolish Flak Battery Bravo',
        desc: 'Destroy the secondary Anti-Air battery tower at Grid 14-C.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-120, -40],
        radius: 20,
        installationName: 'FLAK BATTERY BRAVO',
      },
      {
        id: 'obj_stage3_fob',
        stage: 3,
        type: 'secure_fob',
        title: 'Secure Forward Operating Base (FOB Falcon)',
        desc: 'Clear defending Vanguard garrison and secure the landing perimeter.',
        targetCount: 4,
        currentCount: 0,
        completed: false,
        pos: [80, -110],
        radius: 30,
        installationName: 'FOB FALCON',
      },
      {
        id: 'obj_stage4_extract',
        stage: 4,
        type: 'reach_extraction',
        title: 'Airlift Link-Up',
        desc: 'Drive into the secured FOB extraction landing pad for airlift extraction.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [80, -110],
        radius: 30,
      },
    ],
    tacticalSpawns: [
      // Stage 1 Pickets (Highway Alpha)
      { kind: 'skimmer', pos: [45, 60], stage: 1 },
      { kind: 'mech', pos: [55, 80], stage: 1 },
      { kind: 'tank', pos: [35, 75], stage: 1 },

      // Stage 2 Flak Battery Guards
      { kind: 'tank', pos: [-80, 90], stage: 2 },
      { kind: 'bastion', pos: [-95, 70], stage: 2 },
      { kind: 'sniper', pos: [-130, -30], stage: 2 },

      // Stage 3 FOB Garrison (Counter-attack force)
      { kind: 'heavy', pos: [90, -90], stage: 3 },
      { kind: 'mender', pos: [70, -120], stage: 3 },
      { kind: 'tank', pos: [100, -110], stage: 3 },
      { kind: 'sapper', pos: [60, -80], stage: 3 },
    ],
    transmissions: [
      {
        id: 'trans_start',
        sender: 'Command-Actual',
        callsign: 'OVERLORD',
        text: 'Nomad, you are clear of the insertion drop. Advance along Highway Alpha. Suppress the enemy forward scouts.',
        stageTrigger: 1,
      },
      {
        id: 'trans_stage2',
        sender: 'Command-Actual',
        callsign: 'OVERLORD',
        text: 'Pickets eliminated. Radar confirms both Flak Batteries are active west of your position. Demolish them with heavy shell fire.',
        stageTrigger: 2,
      },
      {
        id: 'trans_stage3',
        sender: 'Dropship Iron Hawk-2',
        callsign: 'HAWK-TWO',
        text: 'All stations, AA fire has ceased! Air corridor is open. Secure FOB Falcon to establish our landing zone!',
        stageTrigger: 3,
      },
      {
        id: 'trans_stage4',
        sender: 'Dropship Iron Hawk-2',
        callsign: 'HAWK-TWO',
        text: 'FOB perimeter secure! Touchdown in 10 seconds. Move to the extraction pad for immediate airlift!',
        stageTrigger: 4,
      },
    ],
    extractionZone: { x: 80, z: -110, radius: 30 },
    salvagePool: [
      { id: 'salv_flak_cannon', name: 'Vanguard 75mm Heavy Breech', kind: 'weapon', detail: 'High-velocity rifled artillery cannon stripped from battery defenses.', value: 350, weaponId: 'cannon' },
      { id: 'salv_armor_plate', name: 'Hardened Chobham Composite', kind: 'component', detail: 'Reinforced ballistic plating matrix.', value: 250 },
      { id: 'salv_scrap_iron', name: 'Refined Military Alloy Ingots', kind: 'scrap', detail: 'Dense titanium-alloy salvaged from demolished fortifications.', value: 200 },
    ],
  },
  {
    id: 'op_black_ice',
    operationNumber: 2,
    title: 'Operation Black Ice',
    operationName: 'CONVOY EXTRACTION',
    theater: 'Sector 9: Glacial Salt Flats & Frozen Canals',
    briefingTranscript: [
      'An allied armored hauler carrying orbital reconnaissance telemetry has been pinned down in the frozen salt flats.',
      'Their escort has taken heavy casualties and their generator is failing.',
      'Advance across the frozen canal, relieve the survivors, break through the sniper line, and escort the convoy home.',
    ],
    seed: 'BLACKICE-02',
    themeName: 'ASHFALL',
    threatLevel: 'SEVERE',
    rewards: {
      credits: 950,
      xp: 700,
    },
    objectives: [
      {
        id: 'obj_reach_convoy',
        stage: 1,
        type: 'infiltrate_zone',
        title: 'Reach Pinned Allied Convoy',
        desc: 'Move across the frozen flats to the allied distress coordinates.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, 90],
        radius: 25,
      },
      {
        id: 'obj_clear_ambush',
        stage: 2,
        type: 'neutralize_outpost',
        title: 'Repel Enemy Canal Ambush',
        desc: 'Eliminate the hostile snipers and demolition sappers attacking the convoy.',
        targetCount: 5,
        currentCount: 0,
        completed: false,
        pos: [0, 90],
        radius: 60,
      },
      {
        id: 'obj_clear_roadblock',
        stage: 3,
        type: 'demolish_installation',
        title: 'Destroy Fortified Canal Roadblock',
        desc: 'Demolish the armored blockade tower blocking the canal extraction bridge.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-110, -70],
        radius: 25,
        installationName: 'CANAL ROADBLOCK',
      },
      {
        id: 'obj_convoy_extract',
        stage: 4,
        type: 'reach_extraction',
        title: 'Bridge Extraction Zone',
        desc: 'Cross the secured bridge into friendly lines.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-110, -70],
        radius: 30,
      },
    ],
    tacticalSpawns: [
      { kind: 'sniper', pos: [30, 110], stage: 2 },
      { kind: 'sniper', pos: [-35, 115], stage: 2 },
      { kind: 'sapper', pos: [15, 60], stage: 2 },
      { kind: 'sapper', pos: [-20, 65], stage: 2 },
      { kind: 'tank', pos: [0, 130], stage: 2 },

      { kind: 'bastion', pos: [-100, -60], stage: 3 },
      { kind: 'heavy', pos: [-120, -80], stage: 3 },
    ],
    transmissions: [
      {
        id: 't_ice_1',
        sender: 'Convoy Hauler Echo',
        callsign: 'ECHO-ONE',
        text: 'Mayday! Echo-1 to all friendly units! We are taking sniper fire on the frozen flats! Hull integrity failing!',
        stageTrigger: 1,
      },
      {
        id: 't_ice_2',
        sender: 'Command-Actual',
        callsign: 'OVERLORD',
        text: 'Nomad has entered the theater. Eliminate those cliffside snipers and suppress the approaching sappers!',
        stageTrigger: 2,
      },
      {
        id: 't_ice_3',
        sender: 'Convoy Hauler Echo',
        callsign: 'ECHO-ONE',
        text: 'Ambush broken! Moving toward the canal bridge. Watch out, they have an armored blockade blocking the crossing!',
        stageTrigger: 3,
      },
      {
        id: 't_ice_4',
        sender: 'Command-Actual',
        callsign: 'OVERLORD',
        text: 'Roadblock destroyed! Bridge is clear! Full throttle across the bridge to safety!',
        stageTrigger: 4,
      },
    ],
    extractionZone: { x: -110, z: -70, radius: 30 },
    salvagePool: [
      { id: 'salv_railgun', name: 'Longbow Precision Rail Core', kind: 'weapon', detail: 'High-power magnetic rail accelerator.', value: 450, weaponId: 'rail' },
      { id: 'salv_cryo_cells', name: 'Cryogenic Cooling Drum', kind: 'component', detail: 'High-efficiency heat sinks.', value: 300 },
      { id: 'salv_scrap_ice', name: 'Hardened Glacial Alloy', kind: 'scrap', detail: 'Cold-treated tungsten scrap.', value: 250 },
    ],
  },
  {
    id: 'op_hammerfall',
    operationNumber: 3,
    title: 'Operation Hammerfall',
    operationName: 'CITADEL SIEGE',
    theater: 'Sector 1: The Ash Caldera Redoubt',
    briefingTranscript: [
      'The enemy mechanized high command has withdrawn inside the central fortified caldera.',
      'This is a full combined-arms siege.',
      'Breach the fortress generators, destroy long-range rocket batteries, eliminate the Warlord Titan, and signal extraction.',
    ],
    seed: 'HAMMER-03',
    themeName: 'HIGH NOON',
    threatLevel: 'CRITICAL',
    rewards: {
      credits: 1600,
      xp: 1200,
    },
    objectives: [
      {
        id: 'obj_breach_generators',
        stage: 1,
        type: 'demolish_installation',
        title: 'Breach Outer Shield Generators',
        desc: 'Demolish the primary power generator feeding the caldera fortress shields.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, 80],
        radius: 20,
        installationName: 'FORTRESS SHIELD GENERATOR',
      },
      {
        id: 'obj_silence_artillery',
        stage: 2,
        type: 'neutralize_outpost',
        title: 'Neutralize Heavy Artillery Batteries',
        desc: 'Destroy the 2 heavy Goliath missile tanks shelling your approach.',
        targetCount: 2,
        currentCount: 0,
        completed: false,
        pos: [-80, 0],
        radius: 35,
        targetKind: 'heavy',
      },
      {
        id: 'obj_kill_warlord',
        stage: 3,
        type: 'eliminate_warlord',
        title: 'Eliminate Warlord Titan "Aegis Bane"',
        desc: 'Engage and destroy the enemy command titan in the center of the citadel.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, -80],
        radius: 40,
        targetKind: 'heavy',
      },
      {
        id: 'obj_citadel_extract',
        stage: 4,
        type: 'reach_extraction',
        title: 'Orbital Extraction LZ',
        desc: 'Reach the central caldera extraction beacon before collapse.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, -80],
        radius: 35,
      },
    ],
    tacticalSpawns: [
      { kind: 'bastion', pos: [15, 85], stage: 1 },
      { kind: 'tank', pos: [-20, 75], stage: 1 },

      { kind: 'heavy', pos: [-75, 10], stage: 2 },
      { kind: 'heavy', pos: [-85, -10], stage: 2 },
      { kind: 'mender', pos: [-65, 0], stage: 2 },

      { kind: 'heavy', pos: [0, -85], stage: 3, boss: true, name: 'WARLORD AEGIS BANE' },
      { kind: 'skimmer', pos: [-25, -75], stage: 3 },
      { kind: 'skimmer', pos: [25, -75], stage: 3 },
    ],
    transmissions: [
      {
        id: 't_ham_1',
        sender: 'Command-Actual',
        callsign: 'OVERLORD',
        text: 'All ground forces: Operation Hammerfall is green. Primary objective: breach the fortress shield generator.',
        stageTrigger: 1,
      },
      {
        id: 't_ham_2',
        sender: 'Command-Actual',
        callsign: 'OVERLORD',
        text: 'Generator destroyed! Fortress shields are down. Target their heavy artillery platforms to the west.',
        stageTrigger: 2,
      },
      {
        id: 't_ham_3',
        sender: 'Warlord Aegis Bane',
        callsign: 'AEGIS BANE',
        text: 'YOU ENTER MY CITADEL ONLY TO BE CRUSHED. ALL UNITS: CORE OVERDRIVE ENGAGED.',
        stageTrigger: 3,
      },
      {
        id: 't_ham_4',
        sender: 'Command-Actual',
        callsign: 'OVERLORD',
        text: 'Warlord Titan confirmed destroyed! Outstanding operational execution. Extraction dropship is inbound!',
        stageTrigger: 4,
      },
    ],
    extractionZone: { x: 0, z: -80, radius: 35 },
    salvagePool: [
      { id: 'salv_orbital_core', name: 'Zenith Orbital Uplink Unit', kind: 'weapon', detail: 'High-command orbital strike relay unit.', value: 700, weaponId: 'orbital' },
      { id: 'salv_titan_reactor', name: 'Warlord Fused Core', kind: 'component', detail: 'Immense power capacity reactor bank.', value: 600 },
      { id: 'salv_scrap_citadel', name: 'Citadel Master Ingot', kind: 'scrap', detail: 'Hyper-dense hardened titan alloy.', value: 500 },
    ],
  },
];

export interface CampaignState {
  version: number;
  pilotName: string;
  callsign: string;
  xp: number;
  level: number;
  skillPoints: number;
  skills: Record<PilotSkillId, number>;
  factions: Record<FactionId, number>;
  completedMissionIds: string[];
  activeMissionId: string | null;
  salvageInventory: SalvageItem[];
}

export const CAMPAIGN_STORAGE_KEY = 'steel-horizon:campaign:v2';

export function xpForLevel(level: number): number {
  return level * 500;
}

export function createFreshCampaign(pilotName = 'Raven', callsign = 'NOMAD-1'): CampaignState {
  return {
    version: 2,
    pilotName,
    callsign,
    xp: 0,
    level: 1,
    skillPoints: 1,
    skills: {
      deadly_aim: 0,
      overclock: 0,
      kinetic_slugs: 0,
      anchor_stride: 0,
      cushion_plating: 0,
      dash_vector: 0,
      coolant_inject: 0,
      siphon_grid: 0,
      core_shielding: 0,
      sensor_sweep: 0,
      field_rearm: 0,
      orbital_beacon: 0,
    },
    factions: {
      allied_command: 30,
      iron_vanguard: -80,
      free_militia: 15,
      syndicate_black: 0,
    },
    completedMissionIds: [],
    activeMissionId: CAMPAIGN_MISSIONS[0].id,
    salvageInventory: [],
  };
}

export function loadCampaign(): CampaignState {
  if (typeof localStorage === 'undefined') return createFreshCampaign();
  try {
    const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!raw) return createFreshCampaign();
    const parsed = JSON.parse(raw) as Partial<CampaignState>;
    const base = createFreshCampaign(parsed.pilotName, parsed.callsign);
    return {
      ...base,
      ...parsed,
      skills: { ...base.skills, ...(parsed.skills || {}) },
      factions: { ...base.factions, ...(parsed.factions || {}) },
      completedMissionIds: Array.isArray(parsed.completedMissionIds) ? parsed.completedMissionIds : [],
      salvageInventory: Array.isArray(parsed.salvageInventory) ? parsed.salvageInventory : [],
    };
  } catch {
    return createFreshCampaign();
  }
}

export function saveCampaign(state: CampaignState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function unlockPilotSkill(
  state: CampaignState,
  skillId: PilotSkillId,
): { state: CampaignState; success: boolean; reason?: string } {
  const skill = PILOT_SKILLS[skillId];
  if (!skill) return { state, success: false, reason: 'unknown_skill' };
  const currentRank = state.skills[skillId] || 0;
  if (currentRank >= skill.maxRank) return { state, success: false, reason: 'already_max_rank' };
  if (state.skillPoints < skill.costPerRank) return { state, success: false, reason: 'not_enough_points' };

  const nextSkills = { ...state.skills, [skillId]: currentRank + 1 };
  const nextState: CampaignState = {
    ...state,
    skillPoints: state.skillPoints - skill.costPerRank,
    skills: nextSkills,
  };
  saveCampaign(nextState);
  return { state: nextState, success: true };
}

export function addCampaignXp(state: CampaignState, xpAmount: number): CampaignState {
  let xp = state.xp + xpAmount;
  let level = state.level;
  let skillPoints = state.skillPoints;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    skillPoints += 1;
  }

  const nextState: CampaignState = {
    ...state,
    xp,
    level,
    skillPoints,
  };
  saveCampaign(nextState);
  return nextState;
}

export function completeCampaignMission(
  state: CampaignState,
  missionId: string,
  chosenSalvage?: SalvageItem,
): CampaignState {
  const mission = CAMPAIGN_MISSIONS.find((m) => m.id === missionId);
  if (!mission) return state;

  const nextCompleted = state.completedMissionIds.includes(missionId)
    ? state.completedMissionIds
    : [...state.completedMissionIds, missionId];

  const nextMissionIndex = CAMPAIGN_MISSIONS.findIndex((m) => m.id === missionId) + 1;
  const nextMissionId = nextMissionIndex < CAMPAIGN_MISSIONS.length ? CAMPAIGN_MISSIONS[nextMissionIndex].id : null;
  const nextSalvage = chosenSalvage ? [...state.salvageInventory, chosenSalvage] : state.salvageInventory;

  const withXp = addCampaignXp(
    {
      ...state,
      completedMissionIds: nextCompleted,
      activeMissionId: nextMissionId,
      salvageInventory: nextSalvage,
      factions: {
        ...state.factions,
        allied_command: (state.factions.allied_command || 0) + 25,
      },
    },
    mission.rewards.xp,
  );

  saveCampaign(withXp);
  return withXp;
}
