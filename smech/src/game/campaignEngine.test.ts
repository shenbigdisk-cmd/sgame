import { describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_MISSIONS } from './campaign';
import { CampaignEngine } from './campaignEngine';

describe('CampaignEngine Stage Progression', () => {
  it('fires stage 1 transmission on creation', () => {
    const onTransmission = vi.fn();
    const mission = CAMPAIGN_MISSIONS[0];
    new CampaignEngine(mission, { onTransmission });

    expect(onTransmission).toHaveBeenCalledTimes(1);
    expect(onTransmission.mock.calls[0][0].callsign).toBe('OVERLORD');
    expect(onTransmission.mock.calls[0][0].stageTrigger).toBe(1);
  });

  it('progresses through military operational stages sequentially', () => {
    const onStageAdvance = vi.fn();
    const onTransmission = vi.fn();
    const onObjectiveUpdate = vi.fn();
    const mission = CAMPAIGN_MISSIONS[0];
    const engine = new CampaignEngine(mission, {
      onStageAdvance,
      onTransmission,
      onObjectiveUpdate,
    });

    expect(engine.currentStage).toBe(1);

    // Stage 1: Neutralize Forward Pickets (targetCount: 3)
    // Kill 3 pickets near highway [50, 70]
    engine.onEnemyKilled('skimmer', { x: 50, z: 70 });
    expect(engine.currentStage).toBe(1);
    engine.onEnemyKilled('mech', { x: 52, z: 68 });
    expect(engine.currentStage).toBe(1);
    engine.onEnemyKilled('tank', { x: 48, z: 72 });

    // Should now advance to Stage 2
    expect(engine.currentStage).toBe(2);
    expect(onStageAdvance).toHaveBeenCalledWith(2, expect.any(Array));

    // Stage 2 transmissions should have fired
    const stage2Trans = onTransmission.mock.calls.find(
      (c) => c[0].stageTrigger === 2,
    );
    expect(stage2Trans).toBeDefined();

    // Stage 2: Demolish Flak Battery Alpha and Flak Battery Bravo
    engine.onInstallationDestroyed('FLAK BATTERY ALPHA', { x: -90, z: 80 });
    expect(engine.currentStage).toBe(2);
    engine.onInstallationDestroyed('FLAK BATTERY BRAVO', { x: -120, z: -40 });

    // Should now advance to Stage 3
    expect(engine.currentStage).toBe(3);
    expect(onStageAdvance).toHaveBeenCalledWith(3, expect.any(Array));

    // Stage 3: Secure FOB Falcon (targetCount: 4 garrison defenders)
    for (let i = 0; i < 4; i++) {
      engine.onEnemyKilled('heavy', { x: 80, z: -110 });
    }

    // Should now advance to Stage 4 (Extraction)
    expect(engine.currentStage).toBe(4);
    expect(engine.extractionReady).toBe(true);

    const stage4Trans = onTransmission.mock.calls.find(
      (c) => c[0].stageTrigger === 4,
    );
    expect(stage4Trans).toBeDefined();
  });

  it('completes mission when player enters extraction zone during extraction stage', () => {
    const onMissionSuccess = vi.fn();
    const mission = CAMPAIGN_MISSIONS[0];
    const engine = new CampaignEngine(mission, { onMissionSuccess });

    // Advance Stage 1
    for (let i = 0; i < 3; i++) engine.onEnemyKilled('tank', { x: 50, z: 70 });
    // Advance Stage 2
    engine.onInstallationDestroyed('FLAK BATTERY ALPHA', { x: -90, z: 80 });
    engine.onInstallationDestroyed('FLAK BATTERY BRAVO', { x: -120, z: -40 });
    // Advance Stage 3
    for (let i = 0; i < 4; i++) engine.onEnemyKilled('tank', { x: 80, z: -110 });

    expect(engine.currentStage).toBe(4);
    expect(engine.extractionReady).toBe(true);

    // Outside extraction zone [80, -110], radius 30
    engine.update(0.1, 0, 0, 1.0);
    expect(engine.missionCompleted).toBe(false);
    expect(onMissionSuccess).not.toHaveBeenCalled();

    // Inside extraction zone
    engine.update(0.1, 80, -110, 1.0);
    expect(engine.missionCompleted).toBe(true);
    expect(onMissionSuccess).toHaveBeenCalledTimes(1);
  });
});
