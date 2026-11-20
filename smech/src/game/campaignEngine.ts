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
  private destroyedInstallations = new Set<string>();

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

  onEnemyKilled(kind: EnemyKind, _pos?: { x: number; z: number }, isBoss?: boolean): void {
    let changed = false;
    const activeStageObjs = this.objectives.filter(
      (o) => o.stage === this.currentStage && !o.completed,
    );

    for (const obj of activeStageObjs) {
      if (obj.type === 'neutralize_outpost' || obj.type === 'secure_fob') {
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
        if (isBoss && (!obj.targetKind || obj.targetKind === kind)) {
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
    // Remember future targets destroyed by stray fire, so they cannot soft-lock a later stage.
    const obj = this.objectives.find((o) => o.type === 'demolish_installation' &&
      (o.id === idOrName || o.installationName?.toLowerCase() === idOrName.toLowerCase() ||
       (pos && Math.hypot(pos.x - o.pos[0], pos.z - o.pos[1]) < 5)));
    if (!obj || this.destroyedInstallations.has(obj.id)) return;
    this.destroyedInstallations.add(obj.id);
    this.applyDestroyedInstallations();
  }

  private applyDestroyedInstallations(): void {
    for (const obj of this.objectives) {
      if (obj.stage === this.currentStage && !obj.completed && this.destroyedInstallations.has(obj.id)) {
        obj.currentCount = obj.targetCount;
        obj.completed = true;
        this.callbacks.onObjectiveUpdate?.(obj);
      }
    }
    this.evaluateStageProgress();
  }

  update(dt: number, playerX: number, playerZ: number, _playerHpRatio: number): void {
    this.timeElapsed += dt;

    if (this.missionCompleted) return;

    // Check active zone infiltrate objectives
    const activeStageObjs = this.objectives.filter(
      (o) => o.stage === this.currentStage && !o.completed,
    );

    for (const obj of activeStageObjs) {
      if (obj.type === 'hold_zone') {
        const inside = Math.hypot(playerX - obj.pos[0], playerZ - obj.pos[1]) <= (obj.radius || 30);
        if (inside) {
          obj.currentCount = Math.min(obj.targetCount, obj.currentCount + Math.max(0, dt));
          if (obj.currentCount >= obj.targetCount) obj.completed = true;
          this.callbacks.onObjectiveUpdate?.(obj);
          if (obj.completed) { this.evaluateStageProgress(); return; }
        }
      } else if (obj.type === 'infiltrate_zone' && obj.pos) {
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
    const stageObjs = this.objectives.filter((o) => o.stage === this.currentStage);
    const allStageDone = stageObjs.length > 0 && stageObjs.every((o) => o.completed);

    if (allStageDone) {
      const nextStage = this.currentStage + 1;
      const nextStageObjs = this.objectives.filter((o) => o.stage === nextStage);

      if (nextStageObjs.length > 0) {
        // Advance to next stage
        this.currentStage = nextStage;
        const newSpawns = this.getSpawnsForStage(nextStage);

        // Check if next stage opens extraction
        if (nextStageObjs.some((o) => o.type === 'reach_extraction')) {
          this.extractionReady = true;
        }

        this.callbacks.onStageAdvance?.(nextStage, newSpawns);
        this.checkTransmissionsForStage(nextStage);
        this.applyDestroyedInstallations();
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
