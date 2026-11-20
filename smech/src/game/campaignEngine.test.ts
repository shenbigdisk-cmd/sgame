import { describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_MISSIONS } from './campaign';
import { CampaignEngine } from './campaignEngine';

describe('campaign operations', () => {
  it('plays every operation through its actual stages and completes once', () => {
    for (const mission of CAMPAIGN_MISSIONS) {
      const onMissionSuccess = vi.fn();
      const onTransmission = vi.fn();
      const engine = new CampaignEngine(mission, { onMissionSuccess, onTransmission });
      for (let stage = 1; stage <= Math.max(...mission.objectives.map(o => o.stage)); stage++) {
        expect(engine.currentStage).toBe(stage);
        for (const obj of engine.objectives.filter(o => o.stage === stage)) {
          switch (obj.type) {
            case 'neutralize_outpost':
            case 'secure_fob':
              for (let n = 0; n < obj.targetCount; n++) engine.onEnemyKilled(obj.targetKind || 'tank');
              break;
            case 'eliminate_warlord':
              engine.onEnemyKilled('heavy', undefined, true);
              break;
            case 'demolish_installation':
              engine.onInstallationDestroyed(obj.id);
              break;
            case 'infiltrate_zone':
            case 'reach_extraction':
              engine.update(0.1, ...obj.pos, 1);
              break;
            case 'hold_zone':
              engine.update(obj.targetCount, ...obj.pos, 1);
              break;
          }
        }
      }
      expect(engine.missionCompleted).toBe(true);
      engine.update(1, 0, 0, 1);
      expect(onMissionSuccess).toHaveBeenCalledTimes(1);
      expect(onTransmission).toHaveBeenCalledTimes(mission.transmissions.length);
    }
  });

  it('pauses a defensive hold outside the perimeter', () => {
    const engine = new CampaignEngine(CAMPAIGN_MISSIONS[1]);
    engine.update(1, 0, 90, 1);
    const hold = engine.objectives.find(o => o.type === 'hold_zone')!;
    engine.update(10, 0, 90, 1);
    engine.update(20, 200, 200, 1);
    expect(hold.currentCount).toBe(10);
    expect(hold.completed).toBe(false);
    engine.update(20, 0, 90, 1);
    expect(hold.completed).toBe(true);
  });

  it('remembers future installations destroyed early and ignores duplicate events', () => {
    const engine = new CampaignEngine(CAMPAIGN_MISSIONS[0]);
    engine.onInstallationDestroyed('battery');
    engine.onInstallationDestroyed('battery');
    for (let n = 0; n < 3; n++) engine.onEnemyKilled('tank');
    expect(engine.currentStage).toBe(3);
    expect(engine.objectives.find(o => o.id === 'battery')?.currentCount).toBe(1);
  });

  it('requires the command mech, not an ordinary heavy, for the final target', () => {
    const mission = CAMPAIGN_MISSIONS[4];
    const engine = new CampaignEngine(mission);
    for (let n = 0; n < 3; n++) engine.onEnemyKilled('tank');
    engine.onInstallationDestroyed('strike');
    engine.onEnemyKilled('heavy', undefined, false);
    expect(engine.currentStage).toBe(3);
    engine.onEnemyKilled('heavy', undefined, true);
    expect(engine.currentStage).toBe(4);
    expect(engine.extractionReady).toBe(true);
  });
});
