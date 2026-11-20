import { beforeEach, describe, expect, it } from 'vitest';
import {
  CAMPAIGN_MISSIONS,
  CAMPAIGN_STORY,
  PILOT_SKILLS,
  SQUAD,
  addCampaignXp,
  completeCampaignMission,
  createFreshCampaign,
  isMissionUnlocked,
  loadCampaign,
  missionAct,
  saveCampaign,
  unlockPilotSkill,
  xpForLevel,
} from './campaign';

describe('Campaign data and state persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a fresh campaign with default values', () => {
    const campaign = createFreshCampaign('Valkyrie', 'GHOST-7');
    expect(campaign.pilotName).toBe('Valkyrie');
    expect(campaign.callsign).toBe('GHOST-7');
    expect(campaign.level).toBe(1);
    expect(campaign.skillPoints).toBe(1);
    expect(campaign.completedMissionIds).toHaveLength(0);
    expect(campaign.activeMissionId).toBe(CAMPAIGN_MISSIONS[0].id);
    expect(campaign.factions.allied_command).toBe(30);
  });

  it('round-trips campaign state through localStorage', () => {
    const fresh = createFreshCampaign('Striker', 'VIPER-3');
    saveCampaign(fresh);
    const loaded = loadCampaign();
    expect(loaded.pilotName).toBe('Striker');
    expect(loaded.callsign).toBe('VIPER-3');
  });

  it('handles XP gain and level ups properly', () => {
    const fresh = createFreshCampaign();
    expect(fresh.level).toBe(1);
    expect(xpForLevel(1)).toBe(500);

    // Gain 600 XP -> Level 2 with 100 XP remaining and +1 skill point
    const updated = addCampaignXp(fresh, 600);
    expect(updated.level).toBe(2);
    expect(updated.xp).toBe(100);
    expect(updated.skillPoints).toBe(2);
  });

  it('unlocks pilot skills and deducts skill points', () => {
    let state = createFreshCampaign();
    state.skillPoints = 3;

    const res1 = unlockPilotSkill(state, 'deadly_aim');
    expect(res1.success).toBe(true);
    expect(res1.state.skills.deadly_aim).toBe(1);
    expect(res1.state.skillPoints).toBe(2);

    state = res1.state;
    // Try to unlock skill with cost 3 when having 2 points
    const res2 = unlockPilotSkill(state, 'dash_vector');
    expect(res2.success).toBe(false);
    expect(res2.reason).toBe('not_enough_points');
  });

  it('respects skill max rank limits', () => {
    let state = createFreshCampaign();
    state.skillPoints = 10;
    const maxRank = PILOT_SKILLS.deadly_aim.maxRank;

    for (let i = 0; i < maxRank; i++) {
      const res = unlockPilotSkill(state, 'deadly_aim');
      expect(res.success).toBe(true);
      state = res.state;
    }

    // Try exceeding max rank
    const overRes = unlockPilotSkill(state, 'deadly_aim');
    expect(overRes.success).toBe(false);
    expect(overRes.reason).toBe('already_max_rank');
  });

  it('completes campaign mission, updates factions and unlocks next mission', () => {
    const state = createFreshCampaign();
    const mission = CAMPAIGN_MISSIONS[0];
    const salvageItem = mission.salvagePool[0];

    const completedState = completeCampaignMission(state, mission.id, salvageItem);
    expect(completedState.completedMissionIds).toContain(mission.id);
    expect(completedState.activeMissionId).toBe(CAMPAIGN_MISSIONS[1].id);
    expect(completedState.factions.allied_command).toBe(state.factions.allied_command + 25);
    expect(completedState.salvageInventory).toContainEqual(salvageItem);
  });

  it('unlocks missions sequentially', () => {
    const state = createFreshCampaign();
    expect(isMissionUnlocked(state, CAMPAIGN_MISSIONS[0].id)).toBe(true);
    expect(isMissionUnlocked(state, CAMPAIGN_MISSIONS[1].id)).toBe(false);
    expect(isMissionUnlocked(state, CAMPAIGN_MISSIONS[5].id)).toBe(false);

    const afterFirst = completeCampaignMission(state, CAMPAIGN_MISSIONS[0].id);
    expect(isMissionUnlocked(afterFirst, CAMPAIGN_MISSIONS[1].id)).toBe(true);
    expect(isMissionUnlocked(afterFirst, CAMPAIGN_MISSIONS[2].id)).toBe(false);
  });

  it('ships six missions across three acts with a full squad', () => {
    expect(CAMPAIGN_MISSIONS).toHaveLength(6);
    expect(CAMPAIGN_STORY.acts).toHaveLength(3);
    expect(SQUAD).toHaveLength(4);
    expect(SQUAD[0].callsign).toBe('RAVEN-1');
    for (const mission of CAMPAIGN_MISSIONS) {
      expect(missionAct(mission)).toBeGreaterThanOrEqual(1);
      expect(missionAct(mission)).toBeLessThanOrEqual(3);
      expect(mission.briefingTranscript.length).toBeGreaterThanOrEqual(3);
      expect(mission.debriefTranscript!.length).toBeGreaterThanOrEqual(3);
      expect(mission.transmissions.length).toBeGreaterThanOrEqual(4);
      expect(mission.salvagePool.length).toBeGreaterThanOrEqual(3);
      // Every mission ends with an extraction stage
      const lastStage = Math.max(...mission.objectives.map((o) => o.stage));
      expect(mission.objectives.some((o) => o.stage === lastStage && o.type === 'reach_extraction')).toBe(true);
      // At most one kill-count objective per stage (engine credits one per kill)
      for (let stage = 1; stage <= lastStage; stage++) {
        const killObjs = mission.objectives.filter(
          (o) => o.stage === stage && (o.type === 'neutralize_outpost' || o.type === 'secure_fob'),
        );
        expect(killObjs.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps every kill objective within reach of its spawns', () => {
    for (const mission of CAMPAIGN_MISSIONS) {
      for (const obj of mission.objectives) {
        if (obj.type !== 'neutralize_outpost' && obj.type !== 'secure_fob') continue;
        const spawns = mission.tacticalSpawns.filter((s) => s.stage === obj.stage);
        expect(spawns.length).toBeGreaterThanOrEqual(obj.targetCount);
        for (const spawn of spawns) {
          const dist = Math.hypot(spawn.pos[0] - obj.pos[0], spawn.pos[1] - obj.pos[1]);
          expect(dist).toBeLessThanOrEqual((obj.radius ?? 35) + 35);
        }
      }
    }
  });
});
