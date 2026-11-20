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
  | 'reach_extraction'
  | 'hold_zone';

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
  debrief: string;
}

// Each operation uses the same rules as the live simulation: marked armor, destructible
// installations and timed defensive positions. No off-screen escort is implied.
const objective = (id: string, stage: number, type: ObjectiveType, title: string, desc: string,
  pos: [number, number], targetCount = 1, extra: Partial<CampaignObjective> = {}): CampaignObjective =>
  ({ id, stage, type, title, desc, pos, targetCount, currentCount: 0, completed: false, ...extra });
const radio = (id: string, stageTrigger: number, sender: string, callsign: string, text: string): RadioTransmission =>
  ({ id, stageTrigger, sender, callsign, text });
const salvage = (prefix: string): SalvageItem[] => [
  { id: `${prefix}_alloy`, name: 'Recovered armor plate', kind: 'scrap', detail: 'Field recovery sold for forge credits.', value: 200 },
  { id: `${prefix}_core`, name: 'Reactor components', kind: 'component', detail: 'Damaged components recovered from the battlefield.', value: 250 },
  { id: `${prefix}_gun`, name: 'Recovered cannon assembly', kind: 'weapon', detail: 'A battlefield recovery for the collection.', value: 300, weaponId: 'cannon' },
];

export const CAMPAIGN_MISSIONS: CampaignMission[] = [
  {
    id: 'line_break', operationNumber: 1, title: 'The Broken Line', operationName: 'FIRST CONTACT',
    theater: 'Orison Valley // Southern approach', seed: 'LINE-01', themeName: 'DUSK', threatLevel: 'TACTICAL',
    rewards: { credits: 650, xp: 450 },
    briefingTranscript: [
      'The frontier ceasefire has collapsed. Vanguard armor is advancing through Orison Valley, and civilian traffic is trapped behind our retreating line.',
      'Captain Mara Voss will coordinate your insertion. Clear the forward screen, knock out its air-defense battery, and hold the evacuation junction until the last transports are away.',
      'The junction is a defensive position, not a convoy escort. Stay inside its marked perimeter while the evacuation proceeds.',
    ],
    objectives: [
      objective('screen', 1, 'neutralize_outpost', 'Break the forward screen', 'Destroy the three armored pickets.', [50, 70], 3),
      objective('battery', 2, 'demolish_installation', 'Silence the air-defense battery', 'Destroy the marked flak battery to open the air corridor.', [-90, 80], 1, { installationName: 'FLAK BATTERY ALPHA' }),
      objective('junction', 3, 'hold_zone', 'Hold the evacuation junction', 'Stay inside the marked perimeter for 25 seconds; progress pauses outside it.', [70, -80], 25, { radius: 30 }),
      objective('extract', 4, 'reach_extraction', 'Link up at the junction', 'Enter the marked landing zone.', [70, -80], 1, { radius: 22 }),
    ],
    tacticalSpawns: [
      { kind: 'skimmer', pos: [45, 60], stage: 1 }, { kind: 'mech', pos: [55, 80], stage: 1 }, { kind: 'tank', pos: [35, 75], stage: 1 },
      { kind: 'tank', pos: [-70, 85], stage: 2 }, { kind: 'bastion', pos: [-105, 70], stage: 2 },
      { kind: 'tank', pos: [90, -100], stage: 3 }, { kind: 'sapper', pos: [45, -100], stage: 3 }, { kind: 'mech', pos: [90, -65], stage: 3 },
    ],
    transmissions: [
      radio('l1', 1, 'Captain Mara Voss', 'OVERLORD', 'Nomad, our line is folding. Break their screen; the road behind us is still full of civilians.'),
      radio('l2', 2, 'Captain Mara Voss', 'OVERLORD', 'Good. That battery is denying our evacuation aircraft. Take it apart.'),
      radio('l3', 3, 'Flight Lieutenant Imani Rook', 'ROOK', 'Air corridor is open. Hold the junction while the transports clear; enemy armor is moving to cut them off.'),
      radio('l4', 4, 'Flight Lieutenant Imani Rook', 'ROOK', 'Last transport is out. Nomad, come to the marker. I have room for you.'),
    ],
    extractionZone: { x: 70, z: -80, radius: 22 }, salvagePool: salvage('line'),
    debrief: 'The evacuation survives, but a captured targeting packet shows the battery was receiving coordinates from an Allied relay. Voss orders the source traced before reporting it up the chain.',
  },
  {
    id: 'dead_channel', operationNumber: 2, title: 'Dead Channel', operationName: 'SIGNAL INTERCEPT',
    theater: 'Salt flats // Relay corridor', seed: 'CHANNEL-02', themeName: 'ASHFALL', threatLevel: 'TACTICAL',
    rewards: { credits: 800, xp: 550 },
    briefingTranscript: [
      'The packet points to a remote relay maintained by Allied contractor Obsidian. Its distress signal went silent an hour ago.',
      'Reach the listening post and hold the uplink while analyst Lieutenant Elias Vale copies its logs. Expect a response once the transmission starts.',
    ],
    objectives: [
      objective('approach', 1, 'infiltrate_zone', 'Reach the listening post', 'Move to the marked relay position.', [0, 90], 1, { radius: 24 }),
      objective('uplink', 2, 'hold_zone', 'Download relay logs', 'Remain in the relay perimeter for 30 seconds. Leaving pauses the download.', [0, 90], 30, { radius: 32 }),
      objective('interceptors', 3, 'neutralize_outpost', 'Break the interception force', 'Destroy the four pursuing armored units.', [-50, -30], 4),
      objective('extract', 4, 'reach_extraction', 'Reach the pickup', 'Bring the recovered logs to the extraction marker.', [-110, -70], 1, { radius: 25 }),
    ],
    tacticalSpawns: [
      { kind: 'skimmer', pos: [30, 75], stage: 1 },
      { kind: 'sniper', pos: [-35, 100], stage: 2 }, { kind: 'sapper', pos: [35, 95], stage: 2 }, { kind: 'tank', pos: [10, 55], stage: 2 },
      { kind: 'mech', pos: [-45, -25], stage: 3 }, { kind: 'tank', pos: [-60, -30], stage: 3 }, { kind: 'skimmer', pos: [-40, -45], stage: 3 }, { kind: 'mender', pos: [-65, -45], stage: 3 },
    ],
    transmissions: [
      radio('d1', 1, 'Lieutenant Elias Vale', 'VALE', 'The relay is still powered. Get me close enough to establish a link.'),
      radio('d2', 2, 'Lieutenant Elias Vale', 'VALE', 'I am in. Stay on the relay while I copy the logs. Someone is already trying to cut the connection.'),
      radio('d3', 3, 'Captain Mara Voss', 'OVERLORD', 'The copy is complete. Obsidian armor is closing on your route. Break through.'),
      radio('d4', 4, 'Lieutenant Elias Vale', 'VALE', 'The logs identify a contractor route, not a Vanguard command net. I need time to verify the rest.'),
    ],
    extractionZone: { x: -110, z: -70, radius: 25 }, salvagePool: salvage('channel'),
    debrief: 'Vale verifies the logs: Obsidian forwarded civilian evacuation coordinates to Vanguard units. The timestamps lead to a contractor depot, but do not yet explain who authorized the transfer.',
  },
  {
    id: 'ledger', operationNumber: 3, title: 'The Ledger', operationName: 'DEPOT RAID',
    theater: 'Industrial belt // Contractor depot', seed: 'LEDGER-03', themeName: 'DUSK', threatLevel: 'SEVERE',
    rewards: { credits: 1000, xp: 700 },
    briefingTranscript: [
      'Obsidian is moving its records through a fortified depot. Voss has sent the evidence to command; the response was an order to stand down.',
      'She is sending you anyway. Break the depot perimeter, destroy its communications generator, and hold the records site while Vale transmits a copy to independent receivers.',
    ],
    objectives: [
      objective('perimeter', 1, 'neutralize_outpost', 'Break the depot perimeter', 'Destroy the three depot defenders.', [45, 75], 3),
      objective('generator', 2, 'demolish_installation', 'Cut the depot communications', 'Destroy the marked communications generator.', [-75, 60], 1, { installationName: 'COMMUNICATIONS GENERATOR' }),
      objective('records', 3, 'hold_zone', 'Transmit the records', 'Stay inside the records-site perimeter for 30 seconds.', [65, -85], 30, { radius: 30 }),
      objective('extract', 4, 'reach_extraction', 'Withdraw from the depot', 'Reach the marked withdrawal point.', [-80, -100], 1, { radius: 25 }),
    ],
    tacticalSpawns: [
      { kind: 'tank', pos: [45, 75], stage: 1 }, { kind: 'mech', pos: [60, 80], stage: 1 }, { kind: 'bastion', pos: [30, 65], stage: 1 },
      { kind: 'sniper', pos: [-100, 50], stage: 2 }, { kind: 'tank', pos: [-50, 70], stage: 2 },
      { kind: 'heavy', pos: [95, -80], stage: 3 }, { kind: 'sapper', pos: [40, -100], stage: 3 }, { kind: 'mech', pos: [70, -110], stage: 3 },
    ],
    transmissions: [
      radio('g1', 1, 'Captain Mara Voss', 'OVERLORD', 'Command says leave it alone. People died on that road. We are going in.'),
      radio('g2', 2, 'Lieutenant Elias Vale', 'VALE', 'Cut their generator. It will stop them wiping the records remotely.'),
      radio('g3', 3, 'Lieutenant Elias Vale', 'VALE', 'Uploading now. The authorization carries an Allied command signature. Keep the uplink alive.'),
      radio('g4', 4, 'Captain Mara Voss', 'OVERLORD', 'The copies are away. Command has revoked our orders and marked us hostile. Get out.'),
    ],
    extractionZone: { x: -80, z: -100, radius: 25 }, salvagePool: salvage('ledger'),
    debrief: 'The ledger implicates General Arden, who sold route data to prolong the war and secure a private reconstruction contract. Voss refuses to call the evidence proof of anything beyond Arden and his network; the wider command may still be trusted.',
  },
  {
    id: 'last_witness', operationNumber: 4, title: 'Last Witness', operationName: 'SAFE PASSAGE',
    theater: 'Northern crossing // Disputed sector', seed: 'WITNESS-04', themeName: 'ASHFALL', threatLevel: 'SEVERE',
    rewards: { credits: 1200, xp: 850 },
    briefingTranscript: [
      'A militia dispatcher, Sera, holds the original authorization and can authenticate it. Arden has sent armor to seal her evacuation route.',
      'Reach her position, clear the roadblock, and defend the pickup point. Rook will lift Sera separately; you are securing the route, not driving an escort vehicle.',
    ],
    objectives: [
      objective('contact', 1, 'infiltrate_zone', 'Reach the witness position', 'Move to the marked militia position.', [0, 85], 1, { radius: 25 }),
      objective('roadblock', 2, 'demolish_installation', 'Open the crossing', 'Destroy the marked armored roadblock.', [-80, 20], 1, { installationName: 'CROSSING ROADBLOCK' }),
      objective('pickup', 3, 'hold_zone', 'Defend the pickup', 'Hold the pickup perimeter for 35 seconds while the witness boards.', [70, -80], 35, { radius: 32 }),
      objective('extract', 4, 'reach_extraction', 'Withdraw to Rook', 'Enter the pickup marker.', [70, -80], 1, { radius: 22 }),
    ],
    tacticalSpawns: [
      { kind: 'skimmer', pos: [30, 80], stage: 1 }, { kind: 'sniper', pos: [-30, 100], stage: 1 },
      { kind: 'bastion', pos: [-65, 30], stage: 2 }, { kind: 'tank', pos: [-100, 15], stage: 2 },
      { kind: 'heavy', pos: [95, -90], stage: 3 }, { kind: 'sapper', pos: [45, -100], stage: 3 }, { kind: 'mech', pos: [90, -60], stage: 3 }, { kind: 'sniper', pos: [35, -65], stage: 3 },
    ],
    transmissions: [
      radio('w1', 1, 'Sera Lin', 'SERA', 'I kept the original because I knew they would erase the logs. Please tell me you are not with Arden.'),
      radio('w2', 2, 'Captain Mara Voss', 'OVERLORD', 'We are here for you, Sera. Nomad, clear the crossing so Rook can reach her.'),
      radio('w3', 3, 'Flight Lieutenant Imani Rook', 'ROOK', 'I am coming in low. Hold that position until Sera is aboard.'),
      radio('w4', 4, 'Sera Lin', 'SERA', 'I am aboard. Arden is transmitting a strike order from the old command station. He is targeting the evacuation hub.'),
    ],
    extractionZone: { x: 70, z: -80, radius: 22 }, salvagePool: salvage('witness'),
    debrief: 'Sera authenticates the order. Independent Allied units accept the evidence, but Arden has isolated the command station and is preparing a strike on the evacuation hub. There is no time to wait for a tribunal.',
  },
  {
    id: 'broken_authority', operationNumber: 5, title: 'Broken Authority', operationName: 'COMMAND STATION',
    theater: 'Ash caldera // Command station', seed: 'AUTHORITY-05', themeName: 'HIGH NOON', threatLevel: 'CRITICAL',
    rewards: { credits: 1600, xp: 1200 },
    briefingTranscript: [
      'Arden has barricaded himself inside the old command station. His strike relay is still online; destroying it will interrupt the order before it reaches the guns.',
      'Neutralize the outer armor, destroy the strike generator, and defeat Arden’s command mech. Rook will recover you from the station perimeter.',
    ],
    objectives: [
      objective('outer', 1, 'neutralize_outpost', 'Break the outer armor', 'Destroy the three units covering the station approach.', [40, 75], 3),
      objective('strike', 2, 'demolish_installation', 'Disable the strike relay', 'Destroy the marked strike generator.', [-70, 30], 1, { installationName: 'STRIKE GENERATOR' }),
      objective('arden', 3, 'eliminate_warlord', 'Stop Arden’s command mech', 'Destroy the marked command mech.', [0, -80]),
      objective('extract', 4, 'reach_extraction', 'Leave the command station', 'Reach Rook’s extraction marker.', [80, -90], 1, { radius: 25 }),
    ],
    tacticalSpawns: [
      { kind: 'tank', pos: [40, 75], stage: 1 }, { kind: 'bastion', pos: [55, 80], stage: 1 }, { kind: 'mech', pos: [25, 65], stage: 1 },
      { kind: 'heavy', pos: [-50, 40], stage: 2 }, { kind: 'sniper', pos: [-95, 30], stage: 2 },
      { kind: 'heavy', pos: [0, -80], stage: 3, boss: true, name: 'ARDEN COMMAND MECH' }, { kind: 'mender', pos: [-25, -75], stage: 3 }, { kind: 'skimmer', pos: [25, -75], stage: 3 },
    ],
    transmissions: [
      radio('a1', 1, 'Captain Mara Voss', 'OVERLORD', 'Independent units have the evidence. Our job is to stop the strike before anyone else dies.'),
      radio('a2', 2, 'Lieutenant Elias Vale', 'VALE', 'The relay is still issuing coordinates. Destroy its generator and the order cannot reach the guns.'),
      radio('a3', 3, 'General Arden', 'ARDEN', 'You think a ceasefire holds without leverage? I built that leverage. You are throwing it away.'),
      radio('a4', 4, 'Captain Mara Voss', 'OVERLORD', 'Strike canceled. Allied units are securing the station and taking the records. Nomad, come home.'),
    ],
    extractionZone: { x: 80, z: -90, radius: 25 }, salvagePool: salvage('authority'),
    debrief: 'The strike never reaches the evacuation hub. Sera’s testimony and Vale’s copies expose Arden’s network; independent investigators take custody of the records. The ceasefire remains fragile, but the survivors now have a chance to decide what comes next.',
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

export const CAMPAIGN_STORAGE_KEY = 'steel-horizon:campaign:v3';

export function xpForLevel(level: number): number {
  return level * 500;
}

export function createFreshCampaign(pilotName = 'Raven', callsign = 'NOMAD-1'): CampaignState {
  return {
    version: 3,
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
      activeMissionId: state.completedMissionIds.includes(missionId) ? state.activeMissionId : nextMissionId,
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
