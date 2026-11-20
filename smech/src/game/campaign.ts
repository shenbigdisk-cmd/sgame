/**
 * STEEL HORIZON: SALTLINE — Story Campaign
 *
 * A six-operation revenge arc in the MW tradition: a named pilot and his
 * squad hunt the Warlord who destroyed their unit, and learn the truth
 * about Kestrel Ridge along the way.
 *
 * Design rules (enforced by tests):
 * - Missions unlock sequentially. Operation N+1 opens when N is secured.
 * - Each mission is 4 stages: three combat stages + extraction.
 * - At most ONE kill-count objective (neutralize/secure) per stage, because
 *   the engine credits each kill to a single objective.
 * - Tactical spawns are staged near their objective; kills count for the
 *   active stage even if pursuers chase the player beyond the original ring.
 * - Installation names drive the 3D mesh: "GENERATOR" -> reactor,
 *   "ROADBLOCK" -> barrier wall, "FOB"/"BASE" -> command post, else flak.
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

// ---------------------------------------------------------------------------
// Story bible — the RAVEN squad and the Kestrel Revenge
// ---------------------------------------------------------------------------

export interface SquadMember {
  callsign: string;
  name: string;
  role: string;
  chassis: string;
  color: string;
  bio: string;
}

export const SQUAD: SquadMember[] = [
  {
    callsign: 'RAVEN-1',
    name: 'Lt. Elias "Raven" Cole',
    role: 'Squad Leader — YOU',
    chassis: 'WARDEN-9 "Oathkeeper"',
    color: '#f59e0b',
    bio: 'Forward observer at Kestrel Ridge. His brother Daniel died in the ambush that followed. Quiet, disciplined, haunted. The squad flies because he does.',
  },
  {
    callsign: 'RAVEN-2',
    name: 'Sgt. Mara "Havoc" Voss',
    role: 'Gunner',
    chassis: 'PYRE-12 "Crowd-Eater"',
    color: '#ef4444',
    bio: 'Loud, fearless, and the best shot in the squad. Lost her whole platoon at Kestrel and jokes about it so nobody else has to. Terrified of being left behind.',
  },
  {
    callsign: 'RAVEN-3',
    name: 'Cpl. Jonah "Ghost" Park',
    role: 'Recon / Sniper',
    chassis: 'GLACIER-7 "The Exile"',
    color: '#38bdf8',
    bio: 'The squad\'s eyes. Cold, precise, and the only one who read the Kestrel after-action report cover to cover. He knows something he hasn\'t said yet.',
  },
  {
    callsign: 'RAVEN-4',
    name: 'WO. Ada "Doc" Okafor',
    role: 'Medic / Engineer',
    chassis: 'WARDEN-9 "Field Kit"',
    color: '#10b981',
    bio: 'Keeps the squad alive and the mechs running. Runs the militia clinic at Vessk. The squad\'s conscience — and the one who asks what the revenge is actually for.',
  },
];

export const COMMANDER = {
  callsign: 'OVERLORD',
  name: 'Col. Ingrid Halvorsen',
  role: 'AGC 2nd Armoured Recon — Handler',
  bio: 'Gave the order that started this war and the one that will end it. A flawed ally, not a villain: she will lie to you about Kestrel until the truth costs her everything.',
};

export const ANTAGONIST = {
  callsign: 'AEGIS BANE',
  name: 'Warlord Viktor "Aegis Bane" Kane',
  role: 'Iron Vanguard 1st Legion — Antagonist',
  bio: 'Believes Cole ordered the bombing of his hometown. He killed Daniel Cole in revenge for a crime Cole never ordered. Both men were lied to by the same broker.',
};

export const CAMPAIGN_STORY = {
  title: 'STEEL HORIZON: SALTLINE',
  subtitle: 'THE KESTREL REVENGE',
  premise:
    'Three years ago, at Kestrel Ridge, an Allied strike destroyed the town of Kestrel and Warlord Viktor Kane ambushed the convoy that followed — killing Lt. Cole\'s brother Daniel. Command buried the report. Now Kane commands the 1st Legion citadel on the Saltline Frontier, and Col. Halvorsen has finally authorized the hunt. RAVEN squad will track him across six operations. The truth about Kestrel is worse than either side was told.',
  acts: [
    { act: 1, name: 'ACT I — THE HUNT', missions: [1, 2] },
    { act: 2, name: 'ACT II — THE PRICE', missions: [3, 4] },
    { act: 3, name: 'ACT III — THE RECKONING', missions: [5, 6] },
  ],
};

// ---------------------------------------------------------------------------
// Pilot skills
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Objectives, spawns, transmissions
// ---------------------------------------------------------------------------

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
  /** hold_zone only: seconds the player must remain inside the radius. */
  holdSeconds?: number;
  /** Optional objectives never block stage advance (bonus intel / salvage). */
  optional?: boolean;
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
  // --- Story fields (optional so older test fixtures still typecheck) ---
  /** Act number (1-3) for war-room grouping. */
  act?: number;
  /** One-paragraph synopsis shown in the war room. */
  synopsis?: string;
  /** Tactical intel: enemy counters and battlefield advice. */
  intel?: string[];
  /** Story debrief shown after extraction. */
  debriefTranscript?: string[];
  /** Which squad member leads this operation (for the briefing panel). */
  squadLead?: string;
}

export const CAMPAIGN_MISSIONS: CampaignMission[] = [
  // =========================================================================
  // OPERATION 1 — ASHES OF KESTREL (Act I)
  // =========================================================================
  {
    id: 'op_ashes_kestrel',
    operationNumber: 1,
    title: 'Ashes of Kestrel',
    operationName: 'ESCORT OF THE FALLEN',
    theater: 'Kestrel Ridge — Shelled Suburb & Memorial Road',
    briefingTranscript: [
      'RAVEN-1, this is OVERLORD. A Free Militia convoy is moving survivors out of the Kestrel ruins. Vanguard armor is hunting it.',
      'You will escort them along Memorial Road. Expect pickets, then an ambush. Kane\'s 1st Legion is in this sector — his callsign is AEGIS BANE. If he speaks, do not answer.',
      'Bring them home, Raven. All of them. OVERLORD out.',
    ],
    seed: 'KESTREL-01',
    themeName: 'DUSK',
    threatLevel: 'TACTICAL',
    rewards: { credits: 650, xp: 450 },
    act: 1,
    synopsis:
      'The war reopens where it started: Kestrel Ridge. RAVEN squad escorts a militia convoy of Kestrel survivors through the ruins. The ambush is Kane\'s signature — and his voice on the radio is the first time Cole has heard the man who killed his brother in three years.',
    intel: [
      'Wisps (skimmers) are fragile — automatic fire shreds them. They cross low cover, so watch the skyline.',
      'Hound Walkers (mechs) close fast and burst-fire. Fight them down long lanes.',
      'The FOB garrison includes a Mender. Kill it first or it will repair the whole line.',
    ],
    debriefTranscript: [
      'The convoy made it to the militia line. Every survivor accounted for — Doc counted twice, just to be sure.',
      'Kane\'s voice is burned into the squad\'s recordings. "Tell Cole the ridge remembers." He knows exactly who you are.',
      'Ghost pulled Kane\'s signal triangulation: his citadel is north, behind the salt flats. The hunt has a direction now.',
    ],
    squadLead: 'RAVEN-1 — Cole',
    objectives: [
      {
        id: 'obj_kestrel_pickets',
        stage: 1,
        type: 'neutralize_outpost',
        title: 'Clear the Memorial Road Pickets',
        desc: 'Kill all three pickets: a Wisp skimmer, Hound Walker and T-90 Raider. Red radar contacts mark live hostiles.',
        targetCount: 3,
        currentCount: 0,
        completed: false,
        pos: [0, -80],
        radius: 35,
      },
      {
        id: 'obj_kestrel_ambush',
        stage: 2,
        type: 'neutralize_outpost',
        title: 'Break the Ridge Ambush',
        desc: 'Kane\'s armor is springing a trap on the convoy. Destroy the ambush force.',
        targetCount: 4,
        currentCount: 0,
        completed: false,
        pos: [120, -40],
        radius: 40,
      },
      {
        id: 'obj_kestrel_fob',
        stage: 3,
        type: 'secure_fob',
        title: 'Secure the Kestrel Memorial FOB',
        desc: 'Clear the Vanguard garrison holding the memorial landing ground.',
        targetCount: 4,
        currentCount: 0,
        completed: false,
        pos: [180, -140],
        radius: 35,
        installationName: 'FOB KESTREL MEMORIAL',
      },
      {
        id: 'obj_kestrel_extract',
        stage: 4,
        type: 'reach_extraction',
        title: 'Airlift Link-Up',
        desc: 'Reach the secured memorial landing pad for extraction.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [180, -140],
        radius: 30,
      },
    ],
    tacticalSpawns: [
      { kind: 'skimmer', pos: [-8, -72], stage: 1 },
      { kind: 'mech', pos: [8, -72], stage: 1 },
      { kind: 'tank', pos: [0, -88], stage: 1 },
      { kind: 'tank', pos: [110, -30], stage: 2 },
      { kind: 'mech', pos: [130, -50], stage: 2 },
      { kind: 'sniper', pos: [115, -60], stage: 2 },
      { kind: 'sapper', pos: [125, -25], stage: 2 },
      { kind: 'heavy', pos: [190, -130], stage: 3 },
      { kind: 'mender', pos: [170, -150], stage: 3 },
      { kind: 'tank', pos: [200, -150], stage: 3 },
      { kind: 'mech', pos: [175, -120], stage: 3 },
    ],
    transmissions: [
      {
        id: 't_kestrel_1',
        sender: 'Col. Halvorsen',
        callsign: 'OVERLORD',
        text: 'RAVEN-1, convoy is rolling. Memorial Road is hot — Vanguard pickets ahead. Weapons free.',
        stageTrigger: 1,
      },
      {
        id: 't_kestrel_2',
        sender: 'Sgt. Voss',
        callsign: 'HAVOC',
        text: 'Contact! Armor on the ridge line — this is Kane\'s playbook, I\'ve seen it before. Cole, left flank is yours!',
        stageTrigger: 2,
      },
      {
        id: 't_kestrel_3',
        sender: 'Warlord Kane',
        callsign: 'AEGIS BANE',
        text: 'Cole. The ridge remembers you. Three years, and you still hide behind a convoy. Come north when you are done playing shepherd.',
        stageTrigger: 3,
      },
      {
        id: 't_kestrel_4',
        sender: 'WO. Okafor',
        callsign: 'DOC',
        text: 'Convoy is safe, all souls aboard. Raven... whatever he said — we finish this together. Pad is green, let\'s go home.',
        stageTrigger: 4,
      },
    ],
    extractionZone: { x: 180, z: -140, radius: 30 },
    salvagePool: [
      { id: 'salv_kestrel_tags', name: 'Daniel Cole\'s Dog Tags', kind: 'component', detail: 'Recovered from the memorial FOB wreckage. Daniel\'s unit marker, still warm from the sun.', value: 300 },
      { id: 'salv_kestrel_cannon', name: 'Vanguard 75mm Heavy Breech', kind: 'weapon', detail: 'High-velocity rifled artillery cannon stripped from the ambush force.', value: 350, weaponId: 'cannon' },
      { id: 'salv_kestrel_alloy', name: 'Refined Military Alloy Ingots', kind: 'scrap', detail: 'Dense titanium-alloy salvaged from demolished fortifications.', value: 200 },
    ],
  },
  // =========================================================================
  // OPERATION 2 — COLD TRAIL (Act I)
  // =========================================================================
  {
    id: 'op_cold_trail',
    operationNumber: 2,
    title: 'Cold Trail',
    operationName: 'GHOST SIGNAL',
    theater: 'Salt Flats — Relay Station & Frozen Canal',
    briefingTranscript: [
      'RAVEN-1, OVERLORD. Ghost triangulated Kane\'s citadel to the north, but his shield grid is blind to us until we kill his relay.',
      'Infiltrate the relay station, steal his war plans, and demolish the relay generator. Kane\'s snipers own the canal — use the flats, stay low, stay fast.',
      'And Raven — the plans mention a Syndicate broker. Kane isn\'t paying for this war himself. Find out who is. OVERLORD out.',
    ],
    seed: 'TRAIL-02',
    themeName: 'NIGHT OPS',
    threatLevel: 'SEVERE',
    rewards: { credits: 950, xp: 700 },
    act: 1,
    synopsis:
      'Ghost leads the squad deep into Vanguard territory to steal Kane\'s citadel coordinates. The relay holds more than plans: a Syndicate ledger proving Kane\'s war — and Cole\'s brother\'s death — was bought and sold by a third party.',
    intel: [
      'Longbows (snipers) charge a visible laser before firing. Break line of sight to cancel the shot.',
      'Ember Sappers sprint at your hull and detonate. Kill them at range — or drag them into their own squad.',
      'The relay generator is a Bastion-guarded reactor. Shells and rockets hit it hardest.',
    ],
    debriefTranscript: [
      'Citadel coordinates secured. Kane\'s shield grid, his artillery parks, his whole war — on one drive.',
      'Ghost found the ledger entry: "KESTREL RIDGE — TARGETING DATA, SOLD TO BOTH SIDES." The Syndicate broker sold the strike to Command and the ambush to Kane.',
      'Cole\'s brother wasn\'t killed by a soldier\'s choice. He was killed by a receipt. The squad now hunts a broker as well as a Warlord.',
    ],
    squadLead: 'RAVEN-3 — Ghost',
    objectives: [
      {
        id: 'obj_trail_relay',
        stage: 1,
        type: 'infiltrate_zone',
        title: 'Infiltrate the Relay Station',
        desc: 'Drive into the relay perimeter to begin the data theft.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, 100],
        radius: 25,
      },
      {
        id: 'obj_trail_snipers',
        stage: 2,
        type: 'neutralize_outpost',
        title: 'Silence the Canal Snipers',
        desc: 'Eliminate the sniper and sapper teams covering the relay.',
        targetCount: 5,
        currentCount: 0,
        completed: false,
        pos: [0, 100],
        radius: 60,
      },
      {
        id: 'obj_trail_generator',
        stage: 3,
        type: 'demolish_installation',
        title: 'Demolish the Relay Generator',
        desc: 'Destroy the reactor feeding Kane\'s shield grid.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-120, -80],
        radius: 20,
        installationName: 'RELAY GENERATOR',
      },
      {
        id: 'obj_trail_extract',
        stage: 4,
        type: 'reach_extraction',
        title: 'Exfiltrate the Salt Flats',
        desc: 'Reach the extraction beacon with the stolen war plans.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-120, -80],
        radius: 30,
      },
    ],
    tacticalSpawns: [
      { kind: 'sniper', pos: [30, 110], stage: 2 },
      { kind: 'sniper', pos: [-35, 115], stage: 2 },
      { kind: 'sapper', pos: [15, 60], stage: 2 },
      { kind: 'sapper', pos: [-20, 65], stage: 2 },
      { kind: 'tank', pos: [0, 130], stage: 2 },
      { kind: 'bastion', pos: [-110, -70], stage: 3 },
      { kind: 'heavy', pos: [-130, -90], stage: 3 },
      { kind: 'skimmer', pos: [-100, -95], stage: 3 },
    ],
    transmissions: [
      {
        id: 't_trail_1',
        sender: 'Cpl. Park',
        callsign: 'GHOST',
        text: 'Relay is dead ahead. I count snipers on the canal ridge — long glass, no mercy. Flats are flat, Raven. We go straight through.',
        stageTrigger: 1,
      },
      {
        id: 't_trail_2',
        sender: 'Col. Halvorsen',
        callsign: 'OVERLORD',
        text: 'Data theft in progress. Kane\'s reaction force is moving — you have minutes, not hours. Finish it.',
        stageTrigger: 2,
      },
      {
        id: 't_trail_3',
        sender: 'Cpl. Park',
        callsign: 'GHOST',
        text: 'Found it. Kane\'s ledger. "Kestrel Ridge — targeting data sold to both sides." Raven... the Syndicate sold your brother\'s death. To both of you.',
        stageTrigger: 3,
      },
      {
        id: 't_trail_4',
        sender: 'Sgt. Voss',
        callsign: 'HAVOC',
        text: 'Generator\'s down, plans are ours. Cole — we\'re not just hunting Kane anymore. We\'re hunting the man who sold him the knife.',
        stageTrigger: 4,
      },
    ],
    extractionZone: { x: -120, z: -80, radius: 30 },
    salvagePool: [
      { id: 'salv_trail_ledger', name: 'Syndicate Ledger — Kestrel File', kind: 'component', detail: 'The broker\'s own records: targeting data sold to AGC and Vanguard alike. Evidence, and a target list.', value: 400 },
      { id: 'salv_trail_rail', name: 'Longbow Precision Rail Core', kind: 'weapon', detail: 'High-power magnetic rail accelerator stripped from a canal sniper.', value: 450, weaponId: 'rail' },
      { id: 'salv_trail_alloy', name: 'Hardened Glacial Alloy', kind: 'scrap', detail: 'Cold-treated tungsten scrap from the relay wreckage.', value: 250 },
    ],
  },
  // =========================================================================
  // OPERATION 3 — IRON HARVEST (Act II)
  // =========================================================================
  {
    id: 'op_iron_harvest',
    operationNumber: 3,
    title: 'Iron Harvest',
    operationName: 'HOLD THE LINE',
    theater: 'Vessk Township — Market Square & Canal Roadblock',
    briefingTranscript: [
      'RAVEN-1, OVERLORD. Kane is hitting the militia town of Vessk with everything he has. Two hundred civilians. One clinic. You.',
      'Hold the market square until the militia evacuates, break the assault, then demolish the canal roadblock sealing the town.',
      'This is not a raid, Raven. This is a defense. Vessk is Kestrel with a second chance. Do not waste it. OVERLORD out.',
    ],
    seed: 'HARVEST-03',
    themeName: 'DUST STORM',
    threatLevel: 'SEVERE',
    rewards: { credits: 1200, xp: 900 },
    act: 2,
    synopsis:
      'Kane answers the theft with a harvest: a full assault on the militia town of Vessk. RAVEN squad holds the market square under a dust storm while Doc evacuates the clinic. The squad\'s finest hour — and the mission that turns a revenge hunt into a reason to protect people.',
    intel: [
      'Bastions halve bullet damage. Switch to shells or rockets — or flank them.',
      'A Mender in the assault will repair its squad. Target it first, every time.',
      'Hold the square: stay inside the ring. Leaving resets nothing, but the timer only runs while you hold.',
    ],
    debriefTranscript: [
      'Vessk stands. Two hundred civilians evacuated, the clinic intact, the roadblock in pieces.',
      'Doc treated a Vanguard sapper pilot who surrendered — a kid, nineteen, who\'d never seen Kestrel. He\'d only ever been told Cole\'s name.',
      'The squad came to Vessk for revenge. They stayed for the people. Kane\'s war is starting to look like a machine that eats boys on both sides.',
    ],
    squadLead: 'RAVEN-4 — Doc',
    objectives: [
      {
        id: 'obj_harvest_hold',
        stage: 1,
        type: 'hold_zone',
        title: 'Hold the Market Square',
        desc: 'Remain inside the market ring while the militia evacuates. Hold for 20 seconds.',
        targetCount: 20,
        currentCount: 0,
        completed: false,
        pos: [0, 0],
        radius: 35,
        holdSeconds: 20,
      },
      {
        id: 'obj_harvest_assault',
        stage: 2,
        type: 'neutralize_outpost',
        title: 'Break the Vanguard Assault',
        desc: 'Destroy the assault force pressing the town.',
        targetCount: 5,
        currentCount: 0,
        completed: false,
        pos: [40, 60],
        radius: 45,
      },
      {
        id: 'obj_harvest_roadblock',
        stage: 3,
        type: 'demolish_installation',
        title: 'Demolish the Canal Roadblock',
        desc: 'Destroy the armored blockade sealing Vessk.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-100, 120],
        radius: 20,
        installationName: 'CANAL ROADBLOCK',
      },
      {
        id: 'obj_harvest_extract',
        stage: 4,
        type: 'reach_extraction',
        title: 'Evacuate Vessk',
        desc: 'Reach the extraction beacon beyond the demolished roadblock.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-100, 120],
        radius: 30,
      },
    ],
    tacticalSpawns: [
      { kind: 'mech', pos: [30, 30], stage: 1 },
      { kind: 'tank', pos: [-30, 25], stage: 1 },
      { kind: 'skimmer', pos: [10, -35], stage: 1 },
      { kind: 'bastion', pos: [50, 70], stage: 2 },
      { kind: 'tank', pos: [30, 50], stage: 2 },
      { kind: 'mech', pos: [55, 45], stage: 2 },
      { kind: 'mender', pos: [45, 80], stage: 2 },
      { kind: 'sapper', pos: [25, 75], stage: 2 },
      { kind: 'bastion', pos: [-90, 110], stage: 3 },
      { kind: 'heavy', pos: [-110, 130], stage: 3 },
      { kind: 'sniper', pos: [-85, 135], stage: 3 },
    ],
    transmissions: [
      {
        id: 't_harvest_1',
        sender: 'WO. Okafor',
        callsign: 'DOC',
        text: 'Clinic is loading the last families. Hold the square, Raven — twenty seconds of quiet and these people live. I\'ll count.',
        stageTrigger: 1,
      },
      {
        id: 't_harvest_2',
        sender: 'Sgt. Voss',
        callsign: 'HAVOC',
        text: 'Assault wave inbound — Bastion leading, Mender behind it. You know the drill: doctor first, then the wall!',
        stageTrigger: 2,
      },
      {
        id: 't_harvest_3',
        sender: 'Warlord Kane',
        callsign: 'AEGIS BANE',
        text: 'You defend their towns now, Cole? Kestrel had a town too. I remember the smoke. Do you?',
        stageTrigger: 3,
      },
      {
        id: 't_harvest_4',
        sender: 'Col. Halvorsen',
        callsign: 'OVERLORD',
        text: 'Vessk is clear. ...Well done, Raven squad. That is an order I never gave, and the one I am proudest of. Come home.',
        stageTrigger: 4,
      },
    ],
    extractionZone: { x: -100, z: 120, radius: 30 },
    salvagePool: [
      { id: 'salv_harvest_plaque', name: 'Vessk Market Plaque', kind: 'component', detail: 'A militia-carved plaque from the square: "THEY HELD." The squad\'s first medal that isn\'t made of steel.', value: 350 },
      { id: 'salv_harvest_mortar', name: 'Incendiary Mortar Rack', kind: 'weapon', detail: 'Vanguard siege mortar stripped from the roadblock guard.', value: 400, weaponId: 'mortar' },
      { id: 'salv_harvest_alloy', name: 'Town-Forged Alloy', kind: 'scrap', detail: 'Militia-forged plating, traded for the squad\'s protection.', value: 300 },
    ],
  },
  // =========================================================================
  // OPERATION 4 — GHOST SIGNAL (Act II)
  // =========================================================================
  {
    id: 'op_ghost_signal',
    operationNumber: 4,
    title: 'Ghost Signal',
    operationName: 'SABOTAGE THE CITADEL',
    theater: 'Kane\'s Citadel Approaches — Shield Grid & Flak Belt',
    briefingTranscript: [
      'RAVEN-1, OVERLORD. Kane\'s citadel shield is up. Without it, his armor is just armor.',
      'Demolish the citadel shield generator, then both flak batteries of his anti-air belt. His guard will be waiting — Kane fights from the front, and he wants you to know it.',
      'Ghost will call the shots. He has been waiting three years to say them. OVERLORD out.',
    ],
    seed: 'GHOST-04',
    themeName: 'ASHFALL',
    threatLevel: 'CRITICAL',
    rewards: { credits: 1400, xp: 1050 },
    act: 2,
    synopsis:
      'The squad strikes at the heart of Kane\'s defenses: his shield generator and the flak belt that grounds Allied airpower. A night of sabotage, sniper nests and sapper ambushes — and Ghost finally says what he read in the Kestrel report.',
    intel: [
      'Flak batteries are high-HP installations. Bring shells, rockets, or orbital fire.',
      'Kane\'s guard pairs a Goliath with a Mender. Separate them or burn the Mender down first.',
      'Wisps scout the flak belt. Bullets deal them 50% extra damage — hose them down.',
    ],
    debriefTranscript: [
      'Shield down. Flak belt silent. For the first time in three years, the sky over the Saltline belongs to the Allies.',
      'Ghost finally said it: the Kestrel strike order was signed by Halvorsen\'s predecessor — and the Syndicate broker forged the targeting data that made Cole look like the forward observer who called it in.',
      'Cole never ordered the bombing. Kane never ordered the ambush. Both orders were purchased. The squad now knows who to really hunt — and he is hiding behind Kane.',
    ],
    squadLead: 'RAVEN-3 — Ghost',
    objectives: [
      {
        id: 'obj_ghost_generator',
        stage: 1,
        type: 'demolish_installation',
        title: 'Demolish the Citadel Shield Generator',
        desc: 'Destroy the reactor powering Kane\'s citadel shield.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [80, 80],
        radius: 20,
        installationName: 'CITADEL SHIELD GENERATOR',
      },
      {
        id: 'obj_ghost_flak_a',
        stage: 2,
        type: 'demolish_installation',
        title: 'Demolish Flak Battery Alpha',
        desc: 'Destroy the northern anti-air battery of the flak belt.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-90, 60],
        radius: 20,
        installationName: 'FLAK BATTERY ALPHA',
      },
      {
        id: 'obj_ghost_flak_b',
        stage: 2,
        type: 'demolish_installation',
        title: 'Demolish Flak Battery Bravo',
        desc: 'Destroy the southern anti-air battery of the flak belt.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [-110, -60],
        radius: 20,
        installationName: 'FLAK BATTERY BRAVO',
      },
      {
        id: 'obj_ghost_guard',
        stage: 3,
        type: 'neutralize_outpost',
        title: 'Break Kane\'s Citadel Guard',
        desc: 'Destroy the guard force defending the citadel gate.',
        targetCount: 5,
        currentCount: 0,
        completed: false,
        pos: [0, -140],
        radius: 45,
      },
      {
        id: 'obj_ghost_extract',
        stage: 4,
        type: 'reach_extraction',
        title: 'Exfiltrate the Citadel Approaches',
        desc: 'Reach the extraction beacon with the flak belt silenced.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, -140],
        radius: 30,
      },
    ],
    tacticalSpawns: [
      { kind: 'bastion', pos: [70, 90], stage: 1 },
      { kind: 'tank', pos: [90, 70], stage: 1 },
      { kind: 'skimmer', pos: [80, 100], stage: 1 },
      { kind: 'tank', pos: [-80, 70], stage: 2 },
      { kind: 'sniper', pos: [-100, 50], stage: 2 },
      { kind: 'tank', pos: [-100, -50], stage: 2 },
      { kind: 'sapper', pos: [-120, -70], stage: 2 },
      { kind: 'heavy', pos: [10, -130], stage: 3 },
      { kind: 'bastion', pos: [-15, -150], stage: 3 },
      { kind: 'sniper', pos: [20, -155], stage: 3 },
      { kind: 'skimmer', pos: [0, -120], stage: 3 },
      { kind: 'mender', pos: [5, -145], stage: 3 },
    ],
    transmissions: [
      {
        id: 't_ghost_1',
        sender: 'Cpl. Park',
        callsign: 'GHOST',
        text: 'Shield generator is live. Bastion on the door, Wisps on the wire. Raven — the wall first, then the heart.',
        stageTrigger: 1,
      },
      {
        id: 't_ghost_2',
        sender: 'Cpl. Park',
        callsign: 'GHOST',
        text: 'Flak belt ahead. Two batteries, overlapping fields. I\'ve marked them. Cole... I need to tell you what the Kestrel report actually said. After this.',
        stageTrigger: 2,
      },
      {
        id: 't_ghost_3',
        sender: 'Warlord Kane',
        callsign: 'AEGIS BANE',
        text: 'You come for my shield, Cole? Come then. I will be at the gate. I have waited three years to look at you.',
        stageTrigger: 3,
      },
      {
        id: 't_ghost_4',
        sender: 'Cpl. Park',
        callsign: 'GHOST',
        text: 'Sky is ours. And Raven — the report. You never called that strike. The broker forged your observer codes. Kane has been hunting a ghost too.',
        stageTrigger: 4,
      },
    ],
    extractionZone: { x: 0, z: -140, radius: 30 },
    salvagePool: [
      { id: 'salv_ghost_codes', name: 'Forged Observer Codes', kind: 'component', detail: 'The broker\'s forgery kit: Cole\'s observer codes, copied and sold. Proof of innocence — and of a frame-up.', value: 500 },
      { id: 'salv_ghost_orbital', name: 'Zenith Orbital Uplink Unit', kind: 'weapon', detail: 'Citadel orbital-strike relay, now yours. The sky answers to RAVEN squad.', value: 700, weaponId: 'orbital' },
      { id: 'salv_ghost_alloy', name: 'Citadel Master Ingot', kind: 'scrap', detail: 'Hyper-dense hardened titan alloy from the shield reactor.', value: 450 },
    ],
  },
  // =========================================================================
  // OPERATION 5 — THE RECKONING (Act III)
  // =========================================================================
  {
    id: 'op_reckoning',
    operationNumber: 5,
    title: 'The Reckoning',
    operationName: 'CITADEL SIEGE',
    theater: 'The Ash Caldera — Kane\'s Citadel',
    briefingTranscript: [
      'RAVEN-1, OVERLORD. This is it. Kane\'s citadel, his artillery parks, his guard. Break the siege and the war ends.',
      'Silence his Goliath artillery, demolish the citadel core generator, and break the guard. Kane will speak to you in there. Listen to him.',
      'Whatever he says... listen. OVERLORD out.',
    ],
    seed: 'RECKON-05',
    themeName: 'HIGH NOON',
    threatLevel: 'CRITICAL',
    rewards: { credits: 1700, xp: 1300 },
    act: 3,
    synopsis:
      'The full siege of Kane\'s citadel. Artillery, core reactor, and the guard that has never broken. Mid-battle, Kane broadcasts the truth both men were denied: the broker sold the Kestrel strike to Command and the ambush to Kane. Revenge has nowhere left to go — but the war does.',
    intel: [
      'Goliaths (heavies) fire homing rockets. Use terrain to break their lock.',
      'The citadel core generator is the toughest installation in the campaign. Commit everything.',
      'Kane\'s guard fights as one unit with a Mender. Kill the Mender, then the line.',
    ],
    debriefTranscript: [
      'The citadel is broken. Artillery silent, core cold, guard scattered.',
      'Kane\'s broadcast played across every channel: the broker\'s ledger, the forged codes, the purchased war. Halvorsen confirmed it on open comms — her predecessor signed the Kestrel order, and the Syndicate forged the rest.',
      'Two men spent three years hunting each other for a crime a broker invented. Kane has asked for a duel, alone, at the caldera heart. The squad will not stop Cole. They will be there when he goes.',
    ],
    squadLead: 'RAVEN-1 — Cole',
    objectives: [
      {
        id: 'obj_reckon_artillery',
        stage: 1,
        type: 'neutralize_outpost',
        title: 'Silence the Goliath Artillery',
        desc: 'Destroy the two Goliath missile platforms shelling the approach.',
        targetCount: 2,
        currentCount: 0,
        completed: false,
        pos: [-80, 0],
        radius: 40,
        targetKind: 'heavy',
      },
      {
        id: 'obj_reckon_core',
        stage: 2,
        type: 'demolish_installation',
        title: 'Demolish the Citadel Core Generator',
        desc: 'Destroy the core reactor feeding the citadel defenses.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, 100],
        radius: 20,
        installationName: 'CITADEL CORE GENERATOR',
      },
      {
        id: 'obj_reckon_guard',
        stage: 3,
        type: 'neutralize_outpost',
        title: 'Break the Citadel Guard',
        desc: 'Destroy Kane\'s honor guard in the caldera heart.',
        targetCount: 5,
        currentCount: 0,
        completed: false,
        pos: [0, -100],
        radius: 45,
      },
      {
        id: 'obj_reckon_extract',
        stage: 4,
        type: 'reach_extraction',
        title: 'Link Up at the Caldera Heart',
        desc: 'Reach the extraction beacon before Kane\'s duel begins.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, -100],
        radius: 30,
      },
    ],
    tacticalSpawns: [
      { kind: 'heavy', pos: [-75, 10], stage: 1 },
      { kind: 'heavy', pos: [-85, -10], stage: 1 },
      { kind: 'mender', pos: [-65, 0], stage: 1 },
      { kind: 'bastion', pos: [15, 110], stage: 2 },
      { kind: 'tank', pos: [-20, 90], stage: 2 },
      { kind: 'skimmer', pos: [0, 120], stage: 2 },
      { kind: 'heavy', pos: [10, -90], stage: 3 },
      { kind: 'bastion', pos: [-15, -110], stage: 3 },
      { kind: 'mech', pos: [20, -105], stage: 3 },
      { kind: 'sniper', pos: [0, -125], stage: 3 },
      { kind: 'mender', pos: [5, -95], stage: 3 },
    ],
    transmissions: [
      {
        id: 't_reckon_1',
        sender: 'Col. Halvorsen',
        callsign: 'OVERLORD',
        text: 'All ground forces: Operation Reckoning is green. Goliath artillery west, core reactor north, guard at the heart. Break it all.',
        stageTrigger: 1,
      },
      {
        id: 't_reckon_2',
        sender: 'Warlord Kane',
        callsign: 'AEGIS BANE',
        text: 'Cole. Before you burn my citadel — hear me. The broker sold Kestrel to your Command. He sold my family\'s blood to me. We have been fighting his war for three years.',
        stageTrigger: 2,
      },
      {
        id: 't_reckon_3',
        sender: 'Col. Halvorsen',
        callsign: 'OVERLORD',
        text: 'Kane speaks truth. The Kestrel order was my predecessor\'s. The targeting data was Syndicate forgery. Raven... I am sorry. Finish the war, then we will finish the broker.',
        stageTrigger: 3,
      },
      {
        id: 't_reckon_4',
        sender: 'Warlord Kane',
        callsign: 'AEGIS BANE',
        text: 'Citadel is yours, Cole. I will wait at the caldera heart — not for revenge. For an ending. Come alone, or bring your squad. It no longer matters.',
        stageTrigger: 4,
      },
    ],
    extractionZone: { x: 0, z: -100, radius: 30 },
    salvagePool: [
      { id: 'salv_reckon_ledger', name: 'Broker\'s Full Ledger', kind: 'component', detail: 'Every forged order, every purchased death on the Saltline. The Syndicate\'s war, itemized.', value: 650 },
      { id: 'salv_reckon_reactor', name: 'Warlord Fused Core', kind: 'component', detail: 'Immense power capacity reactor bank from the citadel core.', value: 600 },
      { id: 'salv_reckon_alloy', name: 'Caldera Master Ingot', kind: 'scrap', detail: 'Hyper-dense hardened titan alloy from the citadel guard.', value: 500 },
    ],
  },
  // =========================================================================
  // OPERATION 6 — AEGIS BANE (Act III, Finale)
  // =========================================================================
  {
    id: 'op_aegis_bane',
    operationNumber: 6,
    title: 'Aegis Bane',
    operationName: 'THE LAST DUEL',
    theater: 'Caldera Heart — Kane\'s Last Stand',
    briefingTranscript: [
      'RAVEN-1, OVERLORD. Kane is alone at the caldera heart with his honor guard. The broker\'s fleet is inbound to extract him — if he lives.',
      'Break the guard, face Kane, and end this. Whatever you decide when you see him... decide as a soldier, not a ghost.',
      'RAVEN squad: bring him home. All of you. OVERLORD out.',
    ],
    seed: 'BANE-06',
    themeName: 'DUSK',
    threatLevel: 'CRITICAL',
    rewards: { credits: 2200, xp: 1800 },
    act: 3,
    synopsis:
      'The finale. Kane\'s honor guard, the Warlord himself in his siege walker, and a broker extraction fleet on the horizon. Cole must face the man who killed Daniel — knowing now that neither of them chose this war. How it ends is up to the squad.',
    intel: [
      'The Warlord\'s Goliath is a boss: massive hull, paired homing rockets. Use cover to break locks.',
      'His guard will try to repair him. Kill the Mender the moment it appears.',
      'After the duel, the caldera erupts — sappers and Wisps in the death throes. Keep moving to extraction.',
    ],
    debriefTranscript: [
      'Kane is dead. The Warlord who haunted three years of Cole\'s life died at the caldera heart, and the broker\'s fleet turned away from an empty sky.',
      'In his wreck, the squad found Kane\'s last transmission: a recording of the broker selling the Kestrel strike. Evidence enough to hang the Syndicate — and to clear Cole\'s name.',
      'The war on the Saltline is not over. But the revenge is. RAVEN squad flies on — not for vengeance, but for Vessk, for Kestrel, and for every town still waiting for someone to hold the square.',
    ],
    squadLead: 'RAVEN-1 — Cole',
    objectives: [
      {
        id: 'obj_bane_guard',
        stage: 1,
        type: 'neutralize_outpost',
        title: 'Break Kane\'s Honor Guard',
        desc: 'Destroy the guard shielding Kane\'s position.',
        targetCount: 4,
        currentCount: 0,
        completed: false,
        pos: [60, 60],
        radius: 45,
      },
      {
        id: 'obj_bane_duel',
        stage: 2,
        type: 'eliminate_warlord',
        title: 'Face Warlord "Aegis Bane" Kane',
        desc: 'Engage and destroy Kane\'s siege walker in the caldera heart.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, -60],
        radius: 45,
        targetKind: 'heavy',
      },
      {
        id: 'obj_bane_throes',
        stage: 3,
        type: 'neutralize_outpost',
        title: 'Survive the Death Throes',
        desc: 'Kane\'s remaining forces are fighting to the death. Destroy them.',
        targetCount: 4,
        currentCount: 0,
        completed: false,
        pos: [0, -60],
        radius: 50,
      },
      {
        id: 'obj_bane_extract',
        stage: 4,
        type: 'reach_extraction',
        title: 'Final Extraction',
        desc: 'Reach the extraction beacon as the broker fleet withdraws.',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        pos: [0, -60],
        radius: 35,
      },
    ],
    tacticalSpawns: [
      { kind: 'bastion', pos: [70, 70], stage: 1 },
      { kind: 'mech', pos: [50, 50], stage: 1 },
      { kind: 'sniper', pos: [75, 45], stage: 1 },
      { kind: 'mender', pos: [60, 75], stage: 1 },
      { kind: 'heavy', pos: [0, -65], stage: 2, boss: true, name: 'WARLORD AEGIS BANE' },
      { kind: 'skimmer', pos: [-25, -50], stage: 2 },
      { kind: 'skimmer', pos: [25, -50], stage: 2 },
      { kind: 'sapper', pos: [10, -40], stage: 3 },
      { kind: 'sapper', pos: [-10, -40], stage: 3 },
      { kind: 'skimmer', pos: [0, -80], stage: 3 },
      { kind: 'mender', pos: [5, -55], stage: 3 },
    ],
    transmissions: [
      {
        id: 't_bane_1',
        sender: 'Sgt. Voss',
        callsign: 'HAVOC',
        text: 'Honor guard ahead, Cole. Bastion, Mender, the works. We break them, you take Kane. That\'s the deal — we\'ve all got skin in this.',
        stageTrigger: 1,
      },
      {
        id: 't_bane_2',
        sender: 'Warlord Kane',
        callsign: 'AEGIS BANE',
        text: 'Cole. I killed your brother for a lie. I will not beg, and I will not run. Come and end it — or walk away and let the broker win.',
        stageTrigger: 2,
      },
      {
        id: 't_bane_3',
        sender: 'WO. Okafor',
        callsign: 'DOC',
        text: 'Kane is down. Raven... whatever you\'re feeling — we\'re here. Broker fleet is turning away. The sky is clear. Let\'s bring everyone home.',
        stageTrigger: 3,
      },
      {
        id: 't_bane_4',
        sender: 'Col. Halvorsen',
        callsign: 'OVERLORD',
        text: 'All stations: the Saltline war is won. RAVEN squad, you are cleared to extract. ...Thank you. All of you. OVERLORD out.',
        stageTrigger: 4,
      },
    ],
    extractionZone: { x: 0, z: -60, radius: 35 },
    salvagePool: [
      { id: 'salv_bane_recording', name: 'Kane\'s Final Recording', kind: 'component', detail: 'The broker selling the Kestrel strike, in his own voice. Evidence to hang the Syndicate — and to clear a dead man\'s name.', value: 800 },
      { id: 'salv_bane_core', name: 'Aegis Bane Warlord Core', kind: 'component', detail: 'The siege walker\'s fused core. The war\'s most dangerous trophy — and its last.', value: 900 },
      { id: 'salv_bane_alloy', name: 'Caldera Heart Ingot', kind: 'scrap', detail: 'Hyper-dense titan alloy from the caldera heart wreckage.', value: 600 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Campaign state & progression
// ---------------------------------------------------------------------------

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

/** Missions unlock sequentially: Op N+1 opens once Op N is secured. */
export function isMissionUnlocked(state: CampaignState, missionId: string): boolean {
  const index = CAMPAIGN_MISSIONS.findIndex((m) => m.id === missionId);
  if (index <= 0) return index === 0;
  return state.completedMissionIds.includes(CAMPAIGN_MISSIONS[index - 1].id);
}

export function missionAct(mission: CampaignMission): number {
  return mission.act ?? (mission.operationNumber <= 2 ? 1 : mission.operationNumber <= 4 ? 2 : 3);
}

export function createFreshCampaign(pilotName = 'Raven', callsign = 'RAVEN-1'): CampaignState {
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
    if (parsed.version !== 3) return createFreshCampaign(parsed.pilotName, parsed.callsign);
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
        free_militia: (state.factions.free_militia || 0) + 10,
      },
    },
    mission.rewards.xp,
  );

  saveCampaign(withXp);
  return withXp;
}
