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

  it('progresses through Ashes of Kestrel stages sequentially', () => {
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

    // Stage 1: Clear the Memorial Road Pickets (targetCount: 3) at [0, -80]
    engine.onEnemyKilled('skimmer', { x: -8, z: -72 });
    expect(engine.currentStage).toBe(1);
    engine.onEnemyKilled('mech', { x: 8, z: -72 });
    expect(engine.currentStage).toBe(1);
    engine.onEnemyKilled('tank', { x: 0, z: -88 });

    // Should now advance to Stage 2
    expect(engine.currentStage).toBe(2);
    expect(onStageAdvance).toHaveBeenCalledWith(2, expect.any(Array));

    // Stage 2 transmissions should have fired
    const stage2Trans = onTransmission.mock.calls.find(
      (c) => c[0].stageTrigger === 2,
    );
    expect(stage2Trans).toBeDefined();

    // Stage 2: Break the Ridge Ambush (targetCount: 4) at [120, -40]
    engine.onEnemyKilled('tank', { x: 110, z: -30 });
    engine.onEnemyKilled('mech', { x: 130, z: -50 });
    engine.onEnemyKilled('sniper', { x: 115, z: -60 });
    expect(engine.currentStage).toBe(2);
    engine.onEnemyKilled('sapper', { x: 125, z: -25 });

    // Should now advance to Stage 3
    expect(engine.currentStage).toBe(3);
    expect(onStageAdvance).toHaveBeenCalledWith(3, expect.any(Array));

    // Stage 3: Secure the Kestrel Memorial FOB (targetCount: 4) at [180, -140]
    for (let i = 0; i < 4; i++) {
      engine.onEnemyKilled('heavy', { x: 180, z: -140 });
    }

    // Should now advance to Stage 4 (Extraction)
    expect(engine.currentStage).toBe(4);
    expect(engine.extractionReady).toBe(true);

    const stage4Trans = onTransmission.mock.calls.find(
      (c) => c[0].stageTrigger === 4,
    );
    expect(stage4Trans).toBeDefined();
  });

  it('credits pursuers even after they leave the original objective ring', () => {
    const engine = new CampaignEngine(CAMPAIGN_MISSIONS[0]);

    // These kills are 80 m from [0, -80], outside the old radius + pursuit
    // allowance. They are still the three tactical pickets for this stage.
    engine.onEnemyKilled('skimmer', { x: 0, z: 0 });
    engine.onEnemyKilled('mech', { x: 0, z: 0 });
    engine.onEnemyKilled('tank', { x: 0, z: 0 });

    expect(engine.currentStage).toBe(2);
  });

  it('completes mission when player enters extraction zone during extraction stage', () => {
    const onMissionSuccess = vi.fn();
    const mission = CAMPAIGN_MISSIONS[0];
    const engine = new CampaignEngine(mission, { onMissionSuccess });

    // Advance Stage 1
    for (let i = 0; i < 3; i++) engine.onEnemyKilled('tank', { x: 0, z: -80 });
    // Advance Stage 2
    for (let i = 0; i < 4; i++) engine.onEnemyKilled('tank', { x: 120, z: -40 });
    // Advance Stage 3
    for (let i = 0; i < 4; i++) engine.onEnemyKilled('tank', { x: 180, z: -140 });

    expect(engine.currentStage).toBe(4);
    expect(engine.extractionReady).toBe(true);

    // Outside extraction zone [180, -140], radius 30
    engine.update(0.1, 0, 0, 1.0);
    expect(engine.missionCompleted).toBe(false);
    expect(onMissionSuccess).not.toHaveBeenCalled();

    // Inside extraction zone
    engine.update(0.1, 180, -140, 1.0);
    expect(engine.missionCompleted).toBe(true);
    expect(onMissionSuccess).toHaveBeenCalledTimes(1);
  });

  it('holds a defense zone only while the player stays inside the ring', () => {
    const onStageAdvance = vi.fn();
    const mission = CAMPAIGN_MISSIONS[2]; // Iron Harvest — hold_zone stage 1
    const engine = new CampaignEngine(mission, { onStageAdvance });

    expect(engine.currentStage).toBe(1);
    const hold = engine.objectives.find((o) => o.type === 'hold_zone');
    expect(hold).toBeDefined();
    expect(hold!.targetCount).toBe(20);

    // Outside the ring: timer does not run
    engine.update(5, 200, 200, 1.0);
    expect(hold!.currentCount).toBe(0);
    expect(engine.currentStage).toBe(1);

    // Inside the ring: timer accumulates
    engine.update(5, 0, 0, 1.0);
    expect(hold!.currentCount).toBeCloseTo(5, 5);
    expect(engine.currentStage).toBe(1);

    // Leaving pauses (never resets)
    engine.update(5, 200, 200, 1.0);
    expect(hold!.currentCount).toBeCloseTo(5, 5);

    // Finish the hold
    engine.update(15, 0, 0, 1.0);
    expect(hold!.completed).toBe(true);
    expect(engine.currentStage).toBe(2);
    expect(onStageAdvance).toHaveBeenCalledWith(2, expect.any(Array));
  });

  it('does not let optional objectives block stage advance', () => {
    const onStageAdvance = vi.fn();
    const mission = {
      ...CAMPAIGN_MISSIONS[0],
      objectives: [
        {
          id: 'obj_main', stage: 1, type: 'neutralize_outpost' as const,
          title: 'Main', desc: '', targetCount: 1, currentCount: 0,
          completed: false, pos: [0, 0] as [number, number], radius: 40,
        },
        {
          id: 'obj_opt', stage: 1, type: 'neutralize_outpost' as const,
          title: 'Optional', desc: '', targetCount: 5, currentCount: 0,
          completed: false, pos: [0, 0] as [number, number], radius: 40,
          optional: true,
        },
        {
          id: 'obj_extract', stage: 2, type: 'reach_extraction' as const,
          title: 'Extract', desc: '', targetCount: 1, currentCount: 0,
          completed: false, pos: [0, 0] as [number, number], radius: 30,
        },
      ],
    };
    const engine = new CampaignEngine(mission, { onStageAdvance });
    engine.onEnemyKilled('tank', { x: 0, z: 0 });
    // Main objective done, optional still open — stage must still advance.
    expect(engine.currentStage).toBe(2);
    expect(onStageAdvance).toHaveBeenCalledWith(2, expect.any(Array));
  });
});
