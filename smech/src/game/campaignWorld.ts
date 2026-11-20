/**
 * 3D Scene Military Installations and Tactical Visual Entities for Campaign Operations
 *
 * Spawns physical 3D military installations (Flak Anti-Air Batteries, Fortress Generators,
 * Bridge Roadblocks, Forward Bases) into the Three.js world with hit detection, health bars,
 * destruction effects, smoke/fire wreckage, and Cockpit Tactical HUD waypoints.
 */

import * as THREE from 'three';
import type { CampaignMission } from './campaign';
import type { AudioManager } from './audio';

export interface ObjectiveWaypoint {
  id: string;
  title: string;
  dist: number;
  relAngle: number; // -PI..PI relative to turret view
  color: string;
  isExtraction?: boolean;
}

export interface MilitaryInstallation {
  id: string;
  name: string;
  type: 'flak' | 'generator' | 'roadblock' | 'fob' | 'outpost';
  x: number;
  z: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  group: THREE.Group;
  turretMesh?: THREE.Object3D;
  beaconMesh?: THREE.Mesh;
  barFg?: THREE.Mesh;
  barGroup?: THREE.Group;
}

export interface CampaignWorldCallbacks {
  onInstallationDestroyed?: (id: string, name: string, x: number, z: number) => void;
  onInstallationHit?: (name: string, hpRemaining: number) => void;
}

export class CampaignWorldManager {
  private scene: THREE.Scene;
  private mission: CampaignMission;
  private audio: AudioManager;
  private callbacks: CampaignWorldCallbacks;
  private installations: MilitaryInstallation[] = [];
  private extractionPad: THREE.Group | null = null;
  private extractionLightRing: THREE.Mesh | null = null;
  private beaconPillar: THREE.Mesh | null = null;
  private time = 0;

  constructor(
    scene: THREE.Scene,
    mission: CampaignMission,
    audio: AudioManager,
    callbacks: CampaignWorldCallbacks = {},
  ) {
    this.scene = scene;
    this.mission = mission;
    this.audio = audio;
    this.callbacks = callbacks;

    this.spawnInstallations();
    this.spawnExtractionPad();
  }

  private spawnInstallations() {
    for (const obj of this.mission.objectives) {
      if (obj.type === 'demolish_installation' || obj.installationName) {
        const [x, z] = obj.pos;
        const name = obj.installationName || obj.title;
        const lower = name.toLowerCase();

        let type: MilitaryInstallation['type'] = 'flak';
        if (lower.includes('generator')) type = 'generator';
        else if (lower.includes('roadblock') || lower.includes('blockade')) type = 'roadblock';
        else if (lower.includes('fob') || lower.includes('base')) type = 'fob';

        const inst = this.createInstallationMesh(obj.id, name, type, x, z);
        this.installations.push(inst);
      }
    }
  }

  private createInstallationMesh(
    id: string,
    name: string,
    type: MilitaryInstallation['type'],
    x: number,
    z: number,
  ): MilitaryInstallation {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    let turretMesh: THREE.Object3D | undefined;
    let beaconMesh: THREE.Mesh | undefined;
    const maxHp = type === 'generator' ? 1200 : type === 'flak' ? 800 : 1000;

    if (type === 'flak') {
      // 1. Reinforced octagonal concrete bunker foundation
      const baseGeo = new THREE.CylinderGeometry(7.5, 9, 3.5, 8);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.8,
        metalness: 0.2,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 1.75;
      group.add(base);

      // Armored upper rim
      const rimGeo = new THREE.CylinderGeometry(6.5, 7.5, 1, 8);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.7,
      });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.y = 4;
      group.add(rim);

      // 2. Rotating Flak Turret Cupola
      const turretGroup = new THREE.Group();
      turretGroup.position.set(0, 4.5, 0);

      const domeGeo = new THREE.BoxGeometry(4.5, 2.5, 5);
      const domeMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.4,
        metalness: 0.8,
      });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.position.y = 1.25;
      turretGroup.add(dome);

      // Twin Long Flak Barrels angled skyward (40 deg)
      const barrelGeo = new THREE.CylinderGeometry(0.35, 0.45, 9, 12);
      const barrelMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.9,
      });

      const barrelL = new THREE.Mesh(barrelGeo, barrelMat);
      barrelL.position.set(-1.2, 3.5, 3.5);
      barrelL.rotation.x = Math.PI * 0.28;
      turretGroup.add(barrelL);

      const barrelR = new THREE.Mesh(barrelGeo, barrelMat);
      barrelR.position.set(1.2, 3.5, 3.5);
      barrelR.rotation.x = Math.PI * 0.28;
      turretGroup.add(barrelR);

      // Radar dish on the back
      const radarGeo = new THREE.CylinderGeometry(1.5, 0.2, 0.4, 16);
      const radarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
      const radar = new THREE.Mesh(radarGeo, radarMat);
      radar.position.set(0, 3.2, -1.8);
      radar.rotation.x = Math.PI * 0.3;
      turretGroup.add(radar);

      turretMesh = turretGroup;
      group.add(turretGroup);

      // Warning Strobe Beacon
      const strobeGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const strobeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const strobe = new THREE.Mesh(strobeGeo, strobeMat);
      strobe.position.set(0, 7.5, 0);
      group.add(strobe);
      beaconMesh = strobe;
    } else if (type === 'generator') {
      // 1. Heavy power substation base
      const baseGeo = new THREE.CylinderGeometry(6, 7, 2.5, 6);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.6,
        metalness: 0.5,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 1.25;
      group.add(base);

      // 2. Glowing Shield Core Reactor
      const coreGeo = new THREE.CylinderGeometry(2.5, 2.5, 6, 16);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.2,
        roughness: 0.2,
        metalness: 0.8,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.y = 4.5;
      group.add(core);

      // 3. Rotating energy induction rings
      const ringGroup = new THREE.Group();
      ringGroup.position.set(0, 4.5, 0);
      for (let i = 0; i < 3; i++) {
        const ringGeo = new THREE.TorusGeometry(3.6, 0.25, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = (i - 1) * 1.8;
        ring.rotation.x = Math.PI / 2;
        ringGroup.add(ring);
      }
      turretMesh = ringGroup;
      group.add(ringGroup);

      // High-voltage warning beacon
      const strobeGeo = new THREE.SphereGeometry(0.6, 8, 8);
      const strobeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const strobe = new THREE.Mesh(strobeGeo, strobeMat);
      strobe.position.set(0, 8.2, 0);
      group.add(strobe);
      beaconMesh = strobe;
    } else if (type === 'roadblock') {
      // Reinforced armored barrier wall
      const wallGeo = new THREE.BoxGeometry(16, 5, 4);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.8,
        metalness: 0.3,
      });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.y = 2.5;
      group.add(wall);

      // Heavy watchtower
      const towerGeo = new THREE.CylinderGeometry(2, 2.5, 10, 8);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(6, 5, 0);
      group.add(tower);

      const strobeGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const strobeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const strobe = new THREE.Mesh(strobeGeo, strobeMat);
      strobe.position.set(6, 10.5, 0);
      group.add(strobe);
      beaconMesh = strobe;
    } else {
      // FOB command outpost
      const bunkerGeo = new THREE.CylinderGeometry(8, 10, 3, 12);
      const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
      const bunker = new THREE.Mesh(bunkerGeo, bunkerMat);
      bunker.position.y = 1.5;
      group.add(bunker);

      const commsMastGeo = new THREE.CylinderGeometry(0.2, 0.4, 18, 8);
      const commsMastMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
      const mast = new THREE.Mesh(commsMastGeo, commsMastMat);
      mast.position.set(0, 10, 0);
      group.add(mast);

      const strobeGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const strobeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const strobe = new THREE.Mesh(strobeGeo, strobeMat);
      strobe.position.set(0, 19.5, 0);
      group.add(strobe);
      beaconMesh = strobe;
    }

    // Floating Health Bar Billboard
    const barGroup = new THREE.Group();
    barGroup.position.set(0, 11, 0);

    const barBgGeo = new THREE.PlaneGeometry(6, 0.6);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    const barBg = new THREE.Mesh(barBgGeo, barBgMat);
    barGroup.add(barBg);

    const barFgGeo = new THREE.PlaneGeometry(5.8, 0.45);
    const barFgMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const barFg = new THREE.Mesh(barFgGeo, barFgMat);
    barFg.position.z = 0.05;
    barGroup.add(barFg);

    group.add(barGroup);
    this.scene.add(group);

    return {
      id,
      name,
      type,
      x,
      z,
      y: 0,
      radius: type === 'roadblock' ? 10 : 7.5,
      hp: maxHp,
      maxHp,
      destroyed: false,
      group,
      turretMesh,
      beaconMesh,
      barFg,
      barGroup,
    };
  }

  private spawnExtractionPad() {
    if (!this.mission.extractionZone) return;
    const { x, z, radius } = this.mission.extractionZone;

    const group = new THREE.Group();
    group.position.set(x, 0.4, z);

    // Landing ring
    const ringGeo = new THREE.RingGeometry(radius * 0.75, radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    this.extractionLightRing = ring;

    // Center vertical beacon
    const beamGeo = new THREE.CylinderGeometry(1.2, 3.5, 200, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 100;
    group.add(beam);
    this.beaconPillar = beam;

    this.scene.add(group);
    this.extractionPad = group;
  }

  checkHit(start: THREE.Vector3, end: THREE.Vector3, damage: number, _splash: number): boolean {
    for (const inst of this.installations) {
      if (inst.destroyed) continue;

      // Distance from installation center (x, z) to swept segment
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const lenSq = dx * dx + dz * dz;

      let t = 0;
      if (lenSq > 0.0001) {
        t = ((inst.x - start.x) * dx + (inst.z - start.z) * dz) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }

      const closestX = start.x + t * dx;
      const closestZ = start.z + t * dz;
      const dist = Math.hypot(closestX - inst.x, closestZ - inst.z);

      if (dist <= inst.radius) {
        this.damageInstallation(inst, damage);
        return true;
      }
    }
    return false;
  }

  applySplashDamage(pos: THREE.Vector3, damage: number, splashRadius: number): void {
    for (const inst of this.installations) {
      if (inst.destroyed) continue;
      const dist = Math.hypot(pos.x - inst.x, pos.z - inst.z);
      if (dist <= splashRadius + inst.radius) {
        const falloff = 1 - Math.max(0, dist - inst.radius) / splashRadius;
        this.damageInstallation(inst, damage * falloff);
      }
    }
  }

  private damageInstallation(inst: MilitaryInstallation, amount: number): void {
    if (inst.destroyed) return;

    inst.hp = Math.max(0, inst.hp - amount);
    this.callbacks.onInstallationHit?.(inst.name, inst.hp);

    // Update HP bar
    if (inst.barFg) {
      const ratio = inst.hp / inst.maxHp;
      inst.barFg.scale.x = Math.max(0.001, ratio);
      (inst.barFg.material as THREE.MeshBasicMaterial).color.setHSL(ratio * 0.33, 1, 0.5);
    }

    if (inst.hp <= 0) {
      this.destroyInstallation(inst);
    }
  }

  private destroyInstallation(inst: MilitaryInstallation): void {
    inst.destroyed = true;
    inst.hp = 0;

    // Convert materials to charred burnt metal / rubble
    inst.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.color.setHex(0x18181b);
          mesh.material.roughness = 0.95;
          mesh.material.metalness = 0.1;
          mesh.material.emissive.setHex(0x000000);
        }
      }
    });

    if (inst.barGroup) {
      inst.barGroup.visible = false;
    }

    if (inst.beaconMesh) {
      (inst.beaconMesh.material as THREE.MeshBasicMaterial).color.setHex(0x27272a);
    }

    // Wreck collapse rotation
    if (inst.turretMesh) {
      inst.turretMesh.rotation.z = 0.25;
      inst.turretMesh.position.y -= 0.5;
    }

    this.audio.playExplosion?.(25, true, 0);
    this.callbacks.onInstallationDestroyed?.(inst.id, inst.name, inst.x, inst.z);
  }

  update(
    dt: number,
    _playerX: number,
    _playerZ: number,
    extractionReady: boolean,
  ): void {
    this.time += dt;

    // Animate active installation elements (radar rotation, beacon pulse)
    for (const inst of this.installations) {
      if (inst.destroyed) continue;

      if (inst.turretMesh) {
        if (inst.type === 'flak') {
          inst.turretMesh.rotation.y += dt * 0.35;
        } else if (inst.type === 'generator') {
          inst.turretMesh.rotation.y -= dt * 1.2;
        }
      }

      if (inst.beaconMesh) {
        const pulse = 0.4 + Math.sin(this.time * 6) * 0.5;
        (inst.beaconMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.2, pulse);
      }
    }

    // Animate extraction pad visual state
    if (this.extractionPad && this.extractionLightRing && this.beaconPillar) {
      this.extractionPad.rotation.y += dt * 0.2;
      const pulse = 0.4 + Math.sin(this.time * 4) * 0.2;

      if (extractionReady) {
        (this.extractionLightRing.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
        (this.beaconPillar.material as THREE.MeshBasicMaterial).color.setHex(0x34d399);
        (this.beaconPillar.material as THREE.MeshBasicMaterial).opacity = pulse;
      } else {
        (this.extractionLightRing.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);
        (this.beaconPillar.material as THREE.MeshBasicMaterial).color.setHex(0xf87171);
        (this.beaconPillar.material as THREE.MeshBasicMaterial).opacity = 0.2;
      }
    }
  }

  getWaypoints(
    playerX: number,
    playerZ: number,
    turretYaw: number,
    currentStage: number,
    extractionReady: boolean,
    liveObjectives?: import('./campaign').CampaignObjective[],
  ): ObjectiveWaypoint[] {
    const waypoints: ObjectiveWaypoint[] = [];

    // 1. Waypoints for current stage objectives.
    // The engine mutates its own copy of the objectives, so callers must pass
    // the live list — reading the mission template would show stale markers.
    const source = liveObjectives ?? this.mission.objectives;
    for (const obj of source) {
      if (obj.stage !== currentStage || obj.completed) continue;
      if (obj.type === 'reach_extraction' && !extractionReady) continue;

      const [tx, tz] = obj.pos;
      const dx = tx - playerX;
      const dz = tz - playerZ;
      const dist = Math.round(Math.hypot(dx, dz));
      const worldAngle = Math.atan2(dx, dz);
      let relAngle = worldAngle - turretYaw;
      while (relAngle > Math.PI) relAngle -= Math.PI * 2;
      while (relAngle < -Math.PI) relAngle += Math.PI * 2;

      let color = '#f59e0b';
      if (obj.type === 'demolish_installation') color = '#ef4444';
      else if (obj.type === 'infiltrate_zone') color = '#38bdf8';
      else if (obj.type === 'hold_zone') color = '#a78bfa';
      else if (obj.type === 'reach_extraction') color = extractionReady ? '#10b981' : '#64748b';

      waypoints.push({
        id: obj.id,
        title: obj.installationName || obj.title,
        dist,
        relAngle,
        color,
        isExtraction: obj.type === 'reach_extraction',
      });
    }

    return waypoints;
  }

  dispose(): void {
    for (const inst of this.installations) {
      this.scene.remove(inst.group);
      inst.group.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
    }
    this.installations = [];

    if (this.extractionPad) {
      this.scene.remove(this.extractionPad);
      this.extractionPad.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
      this.extractionPad = null;
    }
  }
}
