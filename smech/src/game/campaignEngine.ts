import type { CampaignMission, CampaignObjective, RadioTransmission, TacticalSpawn } from './campaign';
import type { EnemyKind } from './types';

export interface CampaignEngineCallbacks {
  onTransmission?: (transmission: RadioTransmission) => void;
  onObjectiveUpdate?: (objective: CampaignObjective) => void;
  onStageAdvance?: (stage: number, newSpawns: TacticalSpawn[]) => void;
  onMissionSuccess?: () => void;
}

export class CampaignEngine {
  mission: CampaignMission;
  objectives: CampaignObjective[];
  currentStage = 1;
  firedTransmissions: Set<string> = new Set();
  callbacks: CampaignEngineCallbacks;
  extractionReady = false;
  missionCompleted = false;
  timeElapsed = 0;

  constructor(mission: CampaignMission, callbacks: CampaignEngineCallbacks = {}) {
    this.mission = mission;
    this.objectives = mission.objectives.map((obj) => ({ ...obj }));
    this.callbacks = callbacks;

    // Check if initial stage includes extraction
    const currentObjs = this.objectives.filter((o) => o.stage === this.currentStage);
    if (currentObjs.some((o) => o.type === 'reach_extraction')) {
      this.extractionReady = true;
    }

    // Fire stage 1 transmissions
    this.checkTransmissionsForStage(1);
  }

  checkTransmissionsForStage(stage: number): void {
    for (const t of this.mission.transmissions) {
      if (t.stageTrigger === stage && !this.firedTransmissions.has(t.id)) {
        this.firedTransmissions.add(t.id);
        this.callbacks.onTransmission?.(t);
      }
    }
  }

  getSpawnsForStage(stage: number): TacticalSpawn[] {
    return this.mission.tacticalSpawns.filter((s) => s.stage === stage);
  }

  onEnemyKilled(kind: EnemyKind, pos?: { x: number; z: number }, isBoss?: boolean): void {
    let changed = false;
    const activeStageObjs = this.objectives.filter(
      (o) => o.stage === this.currentStage && !o.completed,
    );

    for (const obj of activeStageObjs) {
      if (obj.type === 'neutralize_outpost' || obj.type === 'secure_fob') {
        // If coordinate radius is specified, check if enemy was within the outpost perimeter
        if (pos && obj.pos) {
          const dx = pos.x - obj.pos[0];
          const dz = pos.z - obj.pos[1];
          const dist = Math.hypot(dx, dz);
          const maxRadius = (obj.radius || 35) + 35; // allow margin for enemy pursuit
          if (dist > maxRadius) continue;
        }

        if (obj.targetKind && obj.targetKind !== kind) {
          continue;
        }

        obj.currentCount += 1;
        if (obj.currentCount >= obj.targetCount) {
          obj.completed = true;
        }
        changed = true;
        this.callbacks.onObjectiveUpdate?.(obj);
        break; // Count each kill toward one active objective
      } else if (obj.type === 'eliminate_warlord') {
        if (isBoss || (obj.targetKind && obj.targetKind === kind) || !obj.targetKind) {
          obj.currentCount += 1;
          if (obj.currentCount >= obj.targetCount) {
            obj.completed = true;
          }
          changed = true;
          this.callbacks.onObjectiveUpdate?.(obj);
          break;
        }
      }
    }

    if (changed) {
      this.evaluateStageProgress();
    }
  }

  onInstallationDestroyed(idOrName: string, pos?: { x: number; z: number }): void {
    let changed = false;
    const activeStageObjs = this.objectives.filter(
      (o) => o.stage === this.currentStage && !o.completed && o.type === 'demolish_installation',
    );

    for (const obj of activeStageObjs) {
      const nameMatch =
        obj.installationName &&
        (obj.installationName.toLowerCase().includes(idOrName.toLowerCase()) ||
          idOrName.toLowerCase().includes(obj.installationName.toLowerCase()));

      let posMatch = false;
      if (pos && obj.pos) {
        const dist = Math.hypot(pos.x - obj.pos[0], pos.z - obj.pos[1]);
        if (dist < 40) posMatch = true;
      }

      if (nameMatch || posMatch || activeStageObjs.length === 1) {
        obj.currentCount += 1;
        if (obj.currentCount >= obj.targetCount) {
          obj.completed = true;
        }
        changed = true;
        this.callbacks.onObjectiveUpdate?.(obj);
        break;
      }
    }

    if (changed) {
      this.evaluateStageProgress();
    }
  }

  update(dt: number, playerX: number, playerZ: number, _playerHpRatio: number): void {
    this.timeElapsed += dt;

    if (this.missionCompleted) return;

    // Check active zone infiltrate / hold / extraction objectives
    const activeStageObjs = this.objectives.filter(
      (o) => o.stage === this.currentStage && !o.completed,
    );

    for (const obj of activeStageObjs) {
      if (obj.type === 'infiltrate_zone' && obj.pos) {
        const dx = playerX - obj.pos[0];
        const dz = playerZ - obj.pos[1];
        const dist = Math.hypot(dx, dz);
        const radius = obj.radius || 30;
        if (dist <= radius) {
          obj.completed = true;
          obj.currentCount = 1;
          this.callbacks.onObjectiveUpdate?.(obj);
          this.evaluateStageProgress();
          return;
        }
      } else if (obj.type === 'hold_zone' && obj.pos) {
        // Defense stage: the timer only runs while the player holds the ring.
        // Leaving pauses the hold (it never resets) — MW-style forgiveness.
        const dx = playerX - obj.pos[0];
        const dz = playerZ - obj.pos[1];
        const dist = Math.hypot(dx, dz);
        const radius = obj.radius || 35;
        if (dist <= radius) {
          const before = Math.floor(obj.currentCount);
          obj.currentCount += dt;
          const after = Math.floor(obj.currentCount);
          if (after !== before) {
            this.callbacks.onObjectiveUpdate?.(obj);
          }
          if (obj.currentCount >= obj.targetCount) {
            obj.currentCount = obj.targetCount;
            obj.completed = true;
            this.callbacks.onObjectiveUpdate?.(obj);
            this.evaluateStageProgress();
            return;
          }
        }
      } else if (obj.type === 'reach_extraction' && this.extractionReady) {
        const targetX = obj.pos ? obj.pos[0] : this.mission.extractionZone.x;
        const targetZ = obj.pos ? obj.pos[1] : this.mission.extractionZone.z;
        const radius = obj.radius || this.mission.extractionZone.radius || 35;
        const dx = playerX - targetX;
        const dz = playerZ - targetZ;
        const dist = Math.hypot(dx, dz);

        if (dist <= radius) {
          obj.completed = true;
          obj.currentCount = 1;
          this.missionCompleted = true;
          this.callbacks.onObjectiveUpdate?.(obj);
          this.callbacks.onMissionSuccess?.();
          return;
        }
      }
    }
  }

  evaluateStageProgress(): void {
    // Optional objectives are bonus intel/salvage — they never block advance.
    const stageObjs = this.objectives.filter(
      (o) => o.stage === this.currentStage && !o.optional,
    );
    const allStageDone = stageObjs.length > 0 && stageObjs.every((o) => o.completed);

    if (allStageDone) {
      const nextStage = this.currentStage + 1;
      const nextStageObjs = this.objectives.filter((o) => o.stage === nextStage);

      if (nextStageObjs.length > 0) {
        // Advance to next stage
        this.currentStage = nextStage;
        const newSpawns = this.getSpawnsForStage(nextStage);
        this.callbacks.onStageAdvance?.(nextStage, newSpawns);

        // Check if next stage opens extraction
        if (nextStageObjs.some((o) => o.type === 'reach_extraction')) {
          this.extractionReady = true;
        }

        // Fire transmissions for this stage
        this.checkTransmissionsForStage(nextStage);
      } else {
        // No further stages
        if (!this.missionCompleted) {
          this.missionCompleted = true;
          this.callbacks.onMissionSuccess?.();
        }
      }
    }
  }
}
