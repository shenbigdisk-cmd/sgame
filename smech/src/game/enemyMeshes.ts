import * as THREE from 'three';

/**
 * Procedural meshes for the hostile chassis (raider tanks, hound walkers and
 * goliath heavies) plus the floating health bar used above every unit.
 */

export interface Palette {
  hull: number;
  dark: number;
  glow: number;
  glowIntensity: number;
}

/** A tracked chassis: hull, tracks and a rotating turret. */
export interface TankMesh {
  group: THREE.Group;
  turret: THREE.Group;
  flashMats: THREE.MeshStandardMaterial[];
}

/** A bipedal chassis: legs, torso and arm-mounted guns. */
export interface MechMesh {
  group: THREE.Group;
  torso: THREE.Group;
  legs: THREE.Object3D[];
  flashMats: THREE.MeshStandardMaterial[];
}

export interface HealthBar {
  bar: THREE.Group;
  fg: THREE.Mesh;
}

// ---------------------------------------------------------------------------
// Mesh factories
// ---------------------------------------------------------------------------
export function setShadows(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

function makeMats(p: Palette) {
  const hull = new THREE.MeshStandardMaterial({ color: p.hull, roughness: 0.72, metalness: 0.35, emissive: 0xffffff, emissiveIntensity: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: p.dark, roughness: 0.9, metalness: 0.25 });
  const glow = new THREE.MeshStandardMaterial({ color: p.glow, emissive: p.glow, emissiveIntensity: p.glowIntensity });
  return { hull, dark, glow };
}

export function createTankMesh(p: Palette): TankMesh {
  const { hull, dark, glow } = makeMats(p);
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.3, 6.6), hull);
  body.position.y = 1.2;
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.7, 1.8), hull);
  glacis.position.set(0, 1.05, 3.55);
  glacis.rotation.x = 0.55;
  const trackL = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 7.0), dark);
  trackL.position.set(2.65, 0.6, 0);
  const trackR = trackL.clone();
  trackR.position.x = -2.65;
  const skirtL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 6.8), hull);
  skirtL.position.set(2.65, 1.35, 0);
  const skirtR = skirtL.clone();
  skirtR.position.x = -2.65;
  const turret = new THREE.Group();
  turret.position.set(0, 1.85, -0.4);
  const tBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 3.8), hull);
  tBody.position.y = 0.5;
  const tBack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.2), dark);
  tBack.position.set(0, 0.5, -2.3);
  const mantlet = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.9), dark);
  mantlet.position.set(0, 0.5, 2.0);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 5.6, 10), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.5, 4.8);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 10), dark);
  hatch.position.set(0.8, 1.1, -0.6);
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.12), glow);
  sensor.position.set(-0.9, 0.85, 1.92);
  const lampL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), glow);
  lampL.position.set(1.6, 1.5, 3.32);
  const lampR = lampL.clone();
  lampR.position.x = -1.6;
  turret.add(tBody, tBack, mantlet, barrel, hatch, sensor);
  group.add(body, glacis, trackL, trackR, skirtL, skirtR, turret, lampL, lampR);
  setShadows(group);
  return { group, turret, flashMats: [hull] };
}

export function createMechMesh(p: Palette, heavy: boolean): MechMesh {
  const s = heavy ? 1.75 : 1;
  const { hull, dark, glow } = makeMats(p);
  const group = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.95 * s, 2.55 * s, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 1.5 * s, 0.75 * s), hull);
    upper.position.y = -0.75 * s;
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 8, 8), dark);
    knee.position.y = -1.5 * s;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.48 * s, 1.4 * s, 0.6 * s), dark);
    lower.position.set(0, -2.0 * s, 0.1 * s);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.95 * s, 0.3 * s, 1.5 * s), dark);
    foot.position.set(0, -2.55 * s, 0.3 * s);
    hip.add(upper, knee, lower, foot);
    group.add(hip);
    legs.push(hip);
  }
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(2.0 * s, 0.6 * s, 1.0 * s), dark);
  pelvis.position.y = 2.65 * s;
  group.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 2.95 * s;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(2.6 * s, 1.7 * s, 2.0 * s), hull);
  chest.position.y = 0.85 * s;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.0 * s, 1.0 * s, 0.4 * s), dark);
  plate.position.set(0, 0.8 * s, 1.1 * s);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 0.7 * s, 0.95 * s), hull);
  head.position.set(0, 1.95 * s, 0.4 * s);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.75 * s, 0.14 * s, 0.1 * s), glow);
  eye.position.set(0, 1.98 * s, 0.9 * s);
  torso.add(chest, plate, head, eye);
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 1.8 * s, 1.0 * s, 0);
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 1.1 * s, 1.1 * s), hull);
    const gunHouse = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.6 * s, 1.6 * s), dark);
    gunHouse.position.set(0, -0.2 * s, 1.0 * s);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.17 * s, 2.4 * s, 10), dark);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, -0.2 * s, 2.6 * s);
    arm.add(shoulder, gunHouse, gun);
    if (heavy) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 0.8 * s, 1.3 * s), dark);
      pod.position.set(0, 0.95 * s, 0.1 * s);
      const tips = new THREE.Mesh(new THREE.BoxGeometry(0.7 * s, 0.5 * s, 0.1 * s), glow);
      tips.position.set(0, 0.95 * s, 0.76 * s);
      arm.add(pod, tips);
    }
    torso.add(arm);
  }
  group.add(torso);
  setShadows(group);
  return { group, torso, legs, flashMats: [hull] };
}

export function createBar(): HealthBar {
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x1a0000, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false }),
  );
  bg.renderOrder = 20;
  const fgGeo = new THREE.PlaneGeometry(4, 0.34);
  fgGeo.translate(2, 0, 0);
  const fg = new THREE.Mesh(fgGeo, new THREE.MeshBasicMaterial({ color: 0xff3b3b, depthTest: false, depthWrite: false }));
  fg.position.set(-2, 0, 0.01);
  fg.renderOrder = 21;
  bar.add(bg, fg);
  return { bar, fg };
}

/** A low-altitude twin-duct scout. Its gimballed nose follows its aim independently. */
export function createSkimmerMesh(p:Palette):TankMesh {
  const {hull,dark,glow}=makeMats(p), group=new THREE.Group(), turret=new THREE.Group();
  const pod=new THREE.Mesh(new THREE.OctahedronGeometry(1.4),hull);pod.scale.set(0.86,0.58,1.5);pod.position.y=0.9;group.add(pod);
  for(const side of [-1,1]) {
    const duct=new THREE.Mesh(new THREE.TorusGeometry(1.0,0.23,6,16),dark);duct.rotation.x=Math.PI/2;duct.position.set(side*1.65,0.9,0);group.add(duct);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.11,0.25),glow);blade.position.copy(duct.position);group.add(blade);
  }
  turret.position.y=0.65;const eye=new THREE.Mesh(new THREE.BoxGeometry(0.65,0.32,0.6),glow);eye.position.z=1.48;turret.add(eye);group.add(turret);setShadows(group);
  return {group,turret,flashMats:[hull]};
}
