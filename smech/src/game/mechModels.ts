import * as THREE from 'three';
import { VEHICLES } from './vehicles';
import { COMPONENTS, getComponent, type ComponentSlot } from './forge';
import type { VehicleType } from './types';
import { getBrushedMetalNormalTexture, createBeveledBox } from './saltlineVisuals';

/**
 * Procedural models for the forge parts.
 *
 * Every component the catalogue sells has a model here, so the factory view
 * can assemble a mech that looks like the machine the player actually
 * bought: the frame's chassis, the weapons bolted to its arms, the armour
 * welded across its chest, the reactor glowing behind the hatch and the
 * drive legs it stands on.
 */

export interface MechPalette {
  hull: number;
  dark: number;
  accent: number;
  glow: number;
}

const mat = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.44,
    metalness: 0.65,
    normalMap: getBrushedMetalNormalTexture(),
    normalScale: new THREE.Vector2(0.22, 0.22),
    ...opts,
  });

const glow = (color: number) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.8,
    roughness: 0.25,
    metalness: 0.1,
    toneMapped: false,
  });

const box = (w: number, h: number, d: number, m: THREE.Material) =>
  new THREE.Mesh(createBeveledBox(w, h, d, Math.min(0.04, Math.min(w, Math.min(h, d)) * 0.2)), m);
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 14) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

/** Axis-aligned barrel pointing down -Z (the mech faces -Z). */
function barrel(length: number, radius: number, m: THREE.Material) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), m);
  g.rotation.x = Math.PI / 2;
  return g;
}

/* ------------------------------------------------------------------ *
 * Weapons
 * ------------------------------------------------------------------ */

type ModelBuilder = (p: MechPalette) => THREE.Group;

const WEAPON_MODELS: Record<string, ModelBuilder> = {
  autocannon: (p) => {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const arm = box(0.34, 0.34, 2.3, mat(p.dark, { metalness: 0.7 }));
      arm.position.set(side * 0.24, 0, -0.7);
      const tube = barrel(2.6, 0.13, mat(p.hull, { metalness: 0.8 }));
      tube.position.set(side * 0.24, 0.02, -1.3);
      const drum = cyl(0.34, 0.34, 0.36, mat(p.accent, { metalness: 0.5 }), 14);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(side * 0.24, -0.22, -0.15);
      g.add(arm, tube, drum);
    }
    return g;
  },
  scatter: (p) => {
    const g = new THREE.Group();
    const body = box(0.7, 0.5, 0.9, mat(p.dark));
    body.position.z = -0.1;
    g.add(body);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const tube = barrel(1.25, 0.09, mat(p.hull, { metalness: 0.75 }));
      tube.position.set(Math.cos(angle) * 0.16, Math.sin(angle) * 0.16, -0.85);
      g.add(tube);
    }
    return g;
  },
  coil: (p) => {
    const g = new THREE.Group();
    const spine = box(0.26, 0.26, 2.6, mat(p.dark, { metalness: 0.7 }));
    spine.position.z = -1;
    g.add(spine);
    const needle = barrel(3.2, 0.07, mat(0xe9f3ff, { metalness: 0.95, roughness: 0.2 }));
    needle.position.z = -1.6;
    g.add(needle);
    for (let i = 0; i < 4; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, 16), glow(p.accent));
      ring.position.z = -0.5 - i * 0.7;
      g.add(ring);
    }
    return g;
  },
  cannon: (p) => {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const tube = barrel(2.3, 0.26, mat(p.hull, { metalness: 0.8 }));
      tube.position.set(side * 0.3, 0, -1.1);
      const brake = cyl(0.32, 0.26, 0.34, mat(p.dark), 12);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(side * 0.3, 0, -2.25);
      g.add(tube, brake);
    }
    const mount = box(0.9, 0.45, 0.7, mat(p.dark));
    g.add(mount);
    return g;
  },
  cryoball: (p) => {
    const g = new THREE.Group();
    const drum = cyl(0.42, 0.42, 0.8, mat(p.dark), 16);
    drum.rotation.x = Math.PI / 2;
    drum.position.z = -0.5;
    const mouth = cyl(0.46, 0.3, 0.3, glow(0x9fe8ff), 16);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.z = -0.98;
    g.add(drum, mouth);
    for (let i = 0; i < 3; i += 1) {
      const shell = cyl(0.1, 0.1, 0.3, mat(0xd7f4ff, { emissive: 0x2b6c8f, emissiveIntensity: 0.6 }), 8);
      shell.rotation.x = Math.PI / 2;
      shell.position.set(-0.26 + i * 0.26, 0.3, -0.3);
      g.add(shell);
    }
    return g;
  },
  flame: (p) => {
    const g = new THREE.Group();
    const tank = cyl(0.3, 0.3, 1.1, mat(0x8c3a22, { metalness: 0.4 }), 14);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(0.28, -0.1, 0.25);
    const nozzle = barrel(1.5, 0.2, mat(p.dark, { metalness: 0.75 }));
    nozzle.position.set(-0.1, 0, -0.8);
    const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), glow(0xff8a3d));
    pilot.position.set(-0.1, 0, -1.5);
    g.add(tank, nozzle, pilot);
    return g;
  },
  cryo: (p) => {
    const g = new THREE.Group();
    const lance = barrel(2.6, 0.13, mat(0xbfe9ff, { metalness: 0.9, roughness: 0.2 }));
    lance.position.z = -1.3;
    const shroud = box(0.42, 0.42, 0.9, mat(p.dark, { metalness: 0.7 }));
    g.add(lance, shroud);
    const emitter = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 14), glow(0x8fd8ff));
    emitter.position.z = -0.5;
    g.add(emitter);
    return g;
  },
  emp: (p) => {
    const g = new THREE.Group();
    g.name = 'emp-disruptor';
    const housing = box(0.65, 0.58, 1.35, mat(p.dark, { metalness: 0.75 }));
    housing.position.z = -0.35;
    const core = barrel(1.9, 0.15, glow(0x6feaff));
    core.position.z = -1.1;
    g.add(housing, core);
    for (const side of [-1, 1]) {
      const rail = box(0.1, 0.32, 1.9, mat(p.hull, { metalness: 0.85 }));
      rail.position.set(side * 0.32, 0, -0.9);
      g.add(rail);
    }
    for (const z of [-0.75, -1.25, -1.75]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 16), glow(0x6feaff));
      ring.position.z = z;
      g.add(ring);
    }
    return g;
  },
  missiles: (p) => {
    const g = new THREE.Group();
    const boxy = box(1.1, 0.62, 0.8, mat(p.dark));
    boxy.position.z = -0.15;
    g.add(boxy);
    for (let i = 0; i < 4; i += 1) {
      const tube = cyl(0.11, 0.11, 0.7, mat(p.hull, { metalness: 0.6 }), 10);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(-0.33 + (i % 2) * 0.66, -0.16 + Math.floor(i / 2) * 0.32, -0.62);
      g.add(tube);
    }
    return g;
  },
  turret: (p) => {
    const g = new THREE.Group();
    g.name = 'arc-sentry-module';
    const base = cyl(0.48, 0.55, 0.28, mat(p.dark, { metalness: 0.82 }), 16);
    base.position.y = -0.08;
    const bearing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 20), glow(p.glow));
    bearing.rotation.x = Math.PI / 2;
    bearing.position.y = 0.08;
    const pedestal = cyl(0.24, 0.31, 0.42, mat(p.hull, { metalness: 0.82 }), 12);
    pedestal.position.y = 0.25;
    const pivot = new THREE.Group();
    pivot.position.y = 0.44;

    // Armoured yoke, exposed elevation pivots and a sensor mast give the pod a
    // readable silhouette instead of a box with a tube glued to it.
    const receiver = box(0.92, 0.52, 0.78, mat(p.dark, { metalness: 0.8 }));
    receiver.position.set(0, 0.03, 0.02);
    pivot.add(receiver);
    for (const side of [-1, 1]) {
      const cheek = box(0.22, 0.62, 0.68, mat(p.hull, { metalness: 0.78 }));
      cheek.position.set(side * 0.54, -0.02, 0.03);
      cheek.rotation.z = side * -0.12;
      const axle = cyl(0.18, 0.18, 0.16, mat(p.dark), 12);
      axle.rotation.z = Math.PI / 2;
      axle.position.set(side * 0.58, -0.02, 0.02);
      const bolt = cyl(0.075, 0.075, 0.18, glow(p.glow), 8);
      bolt.rotation.z = Math.PI / 2;
      bolt.position.copy(axle.position);
      pivot.add(cheek, axle, bolt);
    }
    const roof = box(0.74, 0.14, 0.56, mat(p.hull, { metalness: 0.78 }));
    roof.position.set(0, 0.36, 0.02);
    pivot.add(roof);

    const gunShroud = cyl(0.19, 0.23, 0.44, mat(p.dark, { metalness: 0.86 }), 12);
    gunShroud.rotation.x = Math.PI / 2;
    gunShroud.position.set(0, -0.08, -0.47);
    const gun = barrel(1.35, 0.115, mat(0x8b9695, { metalness: 0.9, roughness: 0.28 }));
    gun.position.set(0, -0.08, -1.2);
    const muzzle = cyl(0.18, 0.15, 0.3, mat(p.dark, { metalness: 0.85 }), 12);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, -0.08, -1.93);
    const muzzleBand = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.032, 6, 14), glow(p.glow));
    muzzleBand.position.set(0, -0.08, -2.1);
    const eyeFrame = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16), mat(p.hull));
    eyeFrame.position.set(0, 0.17, -0.43);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), glow(p.glow));
    eye.position.set(0, 0.17, -0.46);
    const mast = box(0.12, 0.3, 0.16, mat(p.dark));
    mast.position.set(0.29, 0.5, 0.05);
    const mastLens = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), glow(0x9ceeff));
    mastLens.position.set(0.29, 0.68, 0.05);
    const railL = barrel(1.14, 0.045, mat(p.dark));
    railL.position.set(-0.25, -0.28, -1.12);
    const railR = barrel(1.14, 0.045, mat(p.dark));
    railR.position.set(0.25, -0.28, -1.12);
    pivot.add(gunShroud, gun, muzzle, muzzleBand, eyeFrame, eye, mast, mastLens, railL, railR);
    g.add(base, bearing, pedestal, pivot);
    return g;
  },
  orbital: (p) => {
    const g = new THREE.Group();
    g.name = 'orbital-uplink';
    const base = box(0.9, 0.24, 0.8, mat(p.dark, { metalness: 0.75 }));
    const pedestal = cyl(0.13, 0.19, 0.4, mat(p.hull, { metalness: 0.8 }), 12);
    pedestal.position.y = 0.28;
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.26, 0.24, 20, 1, true),
      mat(p.hull, { metalness: 0.85, side: THREE.DoubleSide }),
    );
    dish.position.y = 0.57;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 24), glow(0x80ddff));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.69;
    const antenna = cyl(0.035, 0.05, 0.45, mat(p.dark, { metalness: 0.8 }), 8);
    antenna.position.y = 0.82;
    const signal = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), glow(0xb9efff));
    signal.position.y = 1.08;
    g.add(base, pedestal, dish, rim, antenna, signal);
    return g;
  },
  cinder: (p) => {
    const g = new THREE.Group();
    const cradle = box(0.94, 0.28, 0.86, mat(p.dark));
    g.add(cradle);
    for (const x of [-0.3, 0, 0.3]) {
      const tube = cyl(0.16, 0.16, 0.88, mat(p.hull), 10);
      tube.rotation.x = Math.PI / 2; tube.position.set(x, 0.25, -0.1);
      const cap = cyl(0.12, 0.12, 0.05, glow(0xff8743), 10);
      cap.rotation.x = tube.rotation.x; cap.position.set(x, 0.25, -0.56);
      g.add(tube, cap);
    }
    return g;
  },
  mines: (p) => {
    const g = new THREE.Group();
    const drum = cyl(0.34, 0.34, 0.42, mat(p.dark, { metalness: 0.6 }), 14);
    drum.rotation.z = Math.PI / 2;
    for (let i = 0; i < 3; i += 1) {
      const pod = cyl(0.14, 0.14, 0.2, glow(0xff7a3d), 10);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(-0.2 + i * 0.2, -0.3, -0.1);
      g.add(pod);
    }
    g.add(drum);
    return g;
  },
  smoke: (p) => {
    const g = new THREE.Group();
    const can = cyl(0.28, 0.28, 0.8, mat(0x4b5b4f, { metalness: 0.35 }), 12);
    can.rotation.z = Math.PI / 2;
    can.position.set(0.2, 0, 0.1);
    const horn = cyl(0.1, 0.22, 0.34, mat(p.dark), 10);
    horn.rotation.x = Math.PI / 2;
    horn.position.set(-0.2, 0, -0.35);
    g.add(can, horn);
    return g;
  },
  rail: (p) => {
    const g = new THREE.Group();
    const spine = box(0.3, 0.3, 3, mat(p.dark, { metalness: 0.85 }));
    spine.position.z = -1.3;
    const rail1 = box(0.08, 0.2, 3.2, mat(0xdfe9f5, { metalness: 1, roughness: 0.15 }));
    rail1.position.set(-0.12, 0.12, -1.4);
    const rail2 = rail1.clone();
    rail2.position.x = 0.12;
    g.add(spine, rail1, rail2);
    for (let i = 0; i < 3; i += 1) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 8, 16), glow(p.glow));
      coil.position.z = -0.9 - i * 0.9;
      g.add(coil);
    }
    return g;
  },
  mortar: (p) => {
    const g = new THREE.Group();
    const tube = cyl(0.24, 0.28, 1.5, mat(p.hull, { metalness: 0.75 }), 12);
    tube.rotation.x = Math.PI / 2 - 0.35;
    tube.position.set(0, 0.24, -0.6);
    const base = box(0.6, 0.3, 0.6, mat(p.dark));
    g.add(tube, base);
    const shell = cyl(0.1, 0.1, 0.34, glow(0xffb347), 8);
    shell.rotation.x = Math.PI / 2;
    shell.position.set(0, 0.52, -0.2);
    g.add(shell);
    return g;
  },
  overdrive: (p) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const stack = cyl(0.11, 0.14, 0.8, mat(p.dark, { metalness: 0.7 }), 10);
      stack.position.set(-0.26 + i * 0.26, 0.3, 0.1);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 10), glow(0xff7a3d));
      tip.position.set(-0.26 + i * 0.26, 0.76, 0.1);
      g.add(stack, tip);
    }
    return g;
  },
  gatling: (p) => {
    const g = new THREE.Group();
    const body = box(0.8, 0.6, 0.8, mat(p.dark, { metalness: 0.7 }));
    body.position.z = -0.2;
    const drum = cyl(0.42, 0.42, 0.62, mat(p.hull, { metalness: 0.8 }), 14);
    drum.rotation.x = Math.PI / 2;
    drum.position.z = -0.72;
    g.add(body, drum);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const tube = barrel(1.1, 0.07, mat(p.dark, { metalness: 0.85 }));
      tube.position.set(Math.cos(angle) * 0.2, Math.sin(angle) * 0.2, -1.42);
      g.add(tube);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 8, 16), glow(p.accent));
    ring.position.z = -0.72;
    g.add(ring);
    return g;
  },
  bore: (p) => {
    const g = new THREE.Group();
    const breech = box(0.66, 0.66, 1.0, mat(p.dark, { metalness: 0.7 }));
    breech.position.z = 0.05;
    const tube = barrel(2.3, 0.24, mat(p.hull, { metalness: 0.85 }));
    tube.position.z = -1.35;
    const brake = cyl(0.32, 0.24, 0.4, mat(p.dark), 12);
    brake.rotation.x = Math.PI / 2;
    brake.position.z = -2.45;
    g.add(breech, tube, brake);
    return g;
  },
  railcoil: (p) => {
    const g = new THREE.Group();
    const spine = box(0.4, 0.34, 2.4, mat(p.dark, { metalness: 0.85 }));
    spine.position.z = -1.1;
    g.add(spine);
    for (const side of [-1, 1]) {
      const rail = box(0.07, 0.18, 3.0, mat(0xdfe9f5, { metalness: 1, roughness: 0.14 }));
      rail.position.set(side * 0.17, 0.13, -1.3);
      g.add(rail);
    }
    for (let i = 0; i < 4; i += 1) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), glow(p.glow));
      coil.position.z = -0.6 - i * 0.6;
      g.add(coil);
    }
    return g;
  },
  atlas: (p) => {
    const g = new THREE.Group();
    const mount = box(1.2, 0.7, 0.9, mat(p.dark, { metalness: 0.8 }));
    g.add(mount);
    for (const side of [-1, 1]) {
      const tube = barrel(2.7, 0.33, mat(p.hull, { metalness: 0.9 }));
      tube.position.set(side * 0.38, 0.05, -1.3);
      const brake = cyl(0.4, 0.32, 0.5, mat(p.dark), 12);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(side * 0.38, 0.05, -2.75);
      g.add(tube, brake);
    }
    const sight = box(0.3, 0.2, 0.5, glow(p.glow));
    sight.position.set(0, 0.45, -0.4);
    g.add(sight);
    return g;
  },
  vent: (p) => {
    const g = new THREE.Group();
    const tank = cyl(0.36, 0.36, 1.4, mat(0x8c3a22, { metalness: 0.4 }), 14);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(0.34, -0.12, 0.3);
    const nozzle = barrel(1.8, 0.3, mat(p.dark, { metalness: 0.8 }));
    nozzle.position.set(-0.1, 0, -1);
    const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), glow(0xff8a3d));
    pilot.position.set(-0.1, 0, -1.8);
    g.add(tank, nozzle, pilot);
    return g;
  },
  deepfreeze: (p) => {
    const g = new THREE.Group();
    const lance = barrel(3.0, 0.18, mat(0xbfe9ff, { metalness: 0.9, roughness: 0.2 }));
    lance.position.z = -1.5;
    const shroud = box(0.56, 0.56, 1.2, mat(p.dark, { metalness: 0.75 }));
    shroud.position.z = 0.1;
    g.add(lance, shroud);
    for (let i = 0; i < 3; i += 1) {
      const fin = box(0.08, 0.3, 0.8, mat(p.hull, { metalness: 0.8 }));
      fin.position.set((i - 1) * 0.22, 0.3, 0.1);
      g.add(fin);
    }
    const emitter = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 14), glow(0x8fd8ff));
    emitter.position.z = -0.6;
    g.add(emitter);
    return g;
  },
  swarm: (p) => {
    const g = new THREE.Group();
    const boxy = box(1.4, 0.8, 0.9, mat(p.dark));
    boxy.position.z = -0.2;
    g.add(boxy);
    for (let i = 0; i < 6; i += 1) {
      const tube = cyl(0.08, 0.08, 0.6, mat(p.hull, { metalness: 0.6 }), 8);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(-0.45 + (i % 3) * 0.45, -0.2 + Math.floor(i / 3) * 0.4, -0.74);
      g.add(tube);
    }
    return g;
  },
  nova: (p) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.08, 10, 24), glow(0x8fd8ff));
    ring.rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), glow(0xdff4ff));
    const mount = box(0.5, 0.36, 0.5, mat(p.dark));
    g.add(ring, core, mount);
    return g;
  },
  mk2: (p) => {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const receiver = box(0.42, 0.42, 2.0, mat(p.dark, { metalness: 0.78 }));
      receiver.position.set(side * 0.26, 0, -0.55);
      const tube = barrel(2.9, 0.17, mat(p.hull, { metalness: 0.9, roughness: 0.25 }));
      tube.position.set(side * 0.26, 0.03, -1.45);
      const brake = cyl(0.21, 0.17, 0.34, mat(p.accent, { metalness: 0.7 }), 12);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(side * 0.26, 0.03, -2.85);
      g.add(receiver, tube, brake);
      for (let i = 0; i < 3; i += 1) {
        const fin = box(0.52, 0.07, 0.12, mat(0x9b5c3c, { roughness: 0.75 }));
        fin.position.set(side * 0.26, 0.28, -0.35 - i * 0.42);
        g.add(fin);
      }
    }
    return g;
  },
  sawed: (p) => {
    const g = new THREE.Group();
    const receiver = box(0.84, 0.58, 0.78, mat(p.dark, { metalness: 0.72 }));
    receiver.position.z = 0.05;
    g.add(receiver);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const tube = barrel(0.82, 0.115, mat(p.hull, { metalness: 0.82 }));
      tube.position.set(Math.cos(angle) * 0.19, Math.sin(angle) * 0.19, -0.55);
      g.add(tube);
    }
    const band = cyl(0.34, 0.34, 0.18, glow(p.accent), 12);
    band.rotation.x = Math.PI / 2;
    band.position.z = -0.96;
    g.add(band);
    return g;
  },
  cannon90: (p) => {
    const g = new THREE.Group();
    const mount = box(1.15, 0.6, 0.85, mat(p.dark, { metalness: 0.8 }));
    g.add(mount);
    for (const side of [-1, 1]) {
      const tube = barrel(2.7, 0.34, mat(p.hull, { metalness: 0.88 }));
      tube.position.set(side * 0.36, 0, -1.25);
      const brake = cyl(0.4, 0.32, 0.44, mat(p.dark), 12);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(side * 0.36, 0, -2.62);
      const recoil = box(0.18, 0.18, 1.2, mat(p.accent, { metalness: 0.7 }));
      recoil.position.set(side * 0.36, -0.36, -0.7);
      const drum = cyl(0.3, 0.3, 0.38, mat(p.dark), 12);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(side * 0.62, -0.28, 0.15);
      g.add(tube, brake, recoil, drum);
    }
    return g;
  },
};

/* ------------------------------------------------------------------ *
 * Armour, reactor, drive
 * ------------------------------------------------------------------ */

const ARMOUR_MODELS: Record<string, ModelBuilder> = {
  h_service: (p) => {
    const g = new THREE.Group();
    const plate = box(2.2, 1.0, 0.3, mat(p.hull, { metalness: 0.55 }));
    plate.position.set(0, 0.75, 0.95);
    g.add(plate);
    return g;
  },
  h_lattice: (p) => {
    const g = new THREE.Group();
    const plate = box(2.4, 1.3, 0.34, mat(p.dark, { metalness: 0.6 }));
    plate.position.set(0, 0.75, 1.0);
    g.add(plate);
    for (let i = 0; i < 5; i += 1) {
      const bar = box(2.5, 0.09, 0.12, mat(p.hull, { metalness: 0.8 }));
      bar.position.set(0, 0.25 + i * 0.25, 1.18);
      bar.rotation.z = i % 2 === 0 ? 0.22 : -0.22;
      g.add(bar);
    }
    return g;
  },
  h_ballistic: (p) => {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const slab = box(0.9, 1.5, 0.55, mat(0x6b5a4a, { metalness: 0.3, roughness: 0.9 }));
      slab.position.set(side * 1.15, 0.7, 1.05);
      slab.rotation.z = side * 0.14;
      g.add(slab);
    }
    const collar = box(2.3, 0.4, 0.5, mat(p.dark, { metalness: 0.7 }));
    collar.position.set(0, 1.5, 0.95);
    g.add(collar);
    return g;
  },
  h_reactive: () => {
    const g = new THREE.Group();
    const skin = box(2.3, 1.6, 0.42, mat(0x2f5a4a, { metalness: 0.2, roughness: 0.7, emissive: 0x0d2a22, emissiveIntensity: 0.5 }));
    skin.position.set(0, 0.8, 0.98);
    g.add(skin);
    for (let i = 0; i < 4; i += 1) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), glow(0x7fe0c0));
      stud.position.set(-0.75 + i * 0.5, 0.35, 1.22);
      g.add(stud);
    }
    return g;
  },
  h_ablation: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const slab = box(2.7 - i * 0.15, 0.42, 0.5 - i * 0.05, mat(0x6b5a4a, { metalness: 0.35, roughness: 0.85 }));
      slab.position.set(0, 0.35 + i * 0.5, 1.05 - i * 0.12);
      g.add(slab);
    }
    return g;
  },
};

const REACTOR_MODELS: Record<string, ModelBuilder> = {
  c_standard: (p) => {
    const g = new THREE.Group();
    const drum = cyl(0.34, 0.34, 0.5, mat(p.dark, { metalness: 0.7 }), 14);
    drum.position.set(0, 0.6, 0.72);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), glow(0x6fe0c0));
    core.position.set(0, 0.6, 0.95);
    g.add(drum, core);
    return g;
  },
  c_fused: () => {
    const g = new THREE.Group();
    const cell = cyl(0.26, 0.26, 0.9, mat(0x2c4a52, { metalness: 0.6 }), 14);
    cell.position.set(0, 0.62, 0.7);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 12), glow(0x7fe0c0));
    core.position.set(0, 0.62, 0.86);
    g.add(cell, core);
    return g;
  },
  c_solar: () => {
    const g = new THREE.Group();
    const panel = box(2.1, 1.1, 0.14, mat(0x14202c, { metalness: 0.5, roughness: 0.4 }));
    panel.position.set(0, 0.78, 1.06);
    const cells = box(1.9, 0.9, 0.06, mat(0x1b3d5c, { emissive: 0x2b6c9f, emissiveIntensity: 0.8, metalness: 0.3 }));
    cells.position.set(0, 0.78, 1.15);
    g.add(panel, cells);
    return g;
  },
  c_volatile: () => {
    const g = new THREE.Group();
    const shell = cyl(0.3, 0.3, 0.7, mat(0x4a3b2c, { metalness: 0.7 }), 14);
    shell.position.set(0, 0.62, 0.7);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), glow(0xff7a3d));
    core.position.set(0, 0.62, 0.92);
    g.add(shell, core);
    for (let i = 0; i < 4; i += 1) {
      const crack = box(0.05, 0.5, 0.05, glow(0xffb347));
      crack.position.set(-0.2 + i * 0.14, 0.62, 1.0);
      crack.rotation.z = i * 0.4;
      g.add(crack);
    }
    return g;
  },
  c_titan: (p) => {
    const g = new THREE.Group();
    const shellMat = mat(0x3a4650, { metalness: 0.8 });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), shellMat);
    shell.position.set(0, 0.66, 0.72);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), glow(0xffd24a));
    core.position.set(0, 0.66, 0.86);
    g.add(shell, core);
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 18), mat(p.hull, { metalness: 0.9 }));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(side * 0.3, 0.66, 0.72);
      g.add(ring);
    }
    return g;
  },
};

/** Every model key the factory floor knows how to assemble. */
export const MODEL_KEYS: ReadonlySet<string> = new Set([
  ...Object.keys(WEAPON_MODELS),
  ...Object.keys(ARMOUR_MODELS),
  ...Object.keys(REACTOR_MODELS),
  ...COMPONENTS.filter((c) => c.slot === 'drive').map((c) => c.model ?? c.id),
]);

/** The model key a mounted component contributes (frames use FRAME_SHAPES). */
export function componentModelKey(id: string): string | null {
  const comp = getComponent(id);
  if (!comp || comp.slot === 'frame') return null;
  return comp.model ?? comp.weapon ?? comp.id;
}

/* ------------------------------------------------------------------ *
 * Chassis
 * ------------------------------------------------------------------ */

interface FrameShape {
  torso: [number, number, number];
  hipWidth: number;
  legLength: number;
  legThickness: number;
  shoulder: number;
}

const FRAME_SHAPES: Record<VehicleType, FrameShape> = {
  warden: { torso: [2.5, 1.8, 1.9], hipWidth: 0.95, legLength: 1.0, legThickness: 0.6, shoulder: 1.75 },
  pyre: { torso: [2.8, 1.7, 2.1], hipWidth: 1.1, legLength: 0.92, legThickness: 0.78, shoulder: 2.0 },
  glacier: { torso: [2.2, 1.9, 1.7], hipWidth: 0.86, legLength: 1.14, legThickness: 0.5, shoulder: 1.6 },
};

function paletteFor(vehicle: VehicleType): MechPalette {
  const v = VEHICLES[vehicle];
  return {
    hull: v.armorColor,
    dark: 0x1d2529,
    accent: new THREE.Color(v.accent).getHex(),
    glow: new THREE.Color(v.accent).getHex(),
  };
}

function buildLegs(p: MechPalette, shape: FrameShape, driveId: string) {
  const g = new THREE.Group();
  const heavy = driveId === 'd_atlas';
  const light = driveId === 'd_sprint';
  const thick = shape.legThickness * (heavy ? 1.35 : light ? 0.78 : 1);
  const len = shape.legLength * (heavy ? 1.02 : light ? 1.06 : 1);
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * shape.hipWidth, 2.5, 0);
    const upper = box(thick, 1.5 * len, thick * 1.2, mat(p.hull));
    upper.position.y = -0.75 * len;
    const knee = new THREE.Mesh(new THREE.SphereGeometry(thick * 0.7, 10, 10), mat(p.dark));
    knee.position.y = -1.5 * len;
    const lower = box(thick * 0.8, 1.4 * len, thick, mat(p.dark));
    lower.position.set(0, -2 * len, 0.1);
    const foot = box(thick * 1.6, 0.3, thick * 2.5, mat(p.dark));
    foot.position.set(0, -2.55 * len, 0.3);
    hip.add(upper, knee, lower, foot);
    if (light) {
      const strut = box(0.12, 1.9 * len, 0.12, glow(p.accent));
      strut.position.set(side * 0.12, -1.6 * len, 0.62);
      hip.add(strut);
    }
    if (heavy) {
      const brace = box(thick * 1.1, 0.5, thick * 1.4, mat(p.dark, { metalness: 0.8 }));
      brace.position.set(0, -0.5 * len, -0.2);
      hip.add(brace);
    }
    if (driveId === 'd_anvil') {
      const anchor = box(thick * 1.7, 0.24, thick * 2.2, mat(p.dark, { metalness: 0.85 }));
      anchor.position.set(0, -2.62 * len, 0.35);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 8), mat(p.hull, { metalness: 0.9 }));
      spike.position.set(0, -2.95 * len, 0.35);
      spike.rotation.x = Math.PI;
      hip.add(anchor, spike);
    }
    if (driveId === 'd_skimmer') {
      const skid = box(thick * 2.2, 0.1, thick * 2.8, mat(p.dark, { metalness: 0.4, roughness: 0.6 }));
      skid.position.set(0, -2.62 * len, 0.3);
      const jet = cyl(0.1, 0.14, 0.24, glow(p.accent), 8);
      jet.rotation.x = Math.PI / 2;
      jet.position.set(0, -2.3 * len, -0.85);
      hip.add(skid, jet);
    }
    g.add(hip);
  }
  return g;
}

/**
 * Assemble a mech from an equipped set.
 *
 * The frame supplies the chassis, every mounted component contributes its
 * own model, and the result is a machine that looks like the build the
 * player paid for.
 */
export function buildMech(equipped: Partial<Record<ComponentSlot, string>>): THREE.Group {
  const frameId = equipped.frame ?? 'f_warden';
  const frameComp = getComponent(frameId);
  const vehicle: VehicleType = frameComp?.frame ?? 'warden';
  const p = paletteFor(vehicle);
  const shape = FRAME_SHAPES[vehicle];

  const root = new THREE.Group();
  const hull = mat(p.hull);
  const dark = mat(p.dark, { metalness: 0.55 });

  // legs + pelvis
  root.add(buildLegs(p, shape, equipped.drive ?? 'd_standard'));
  const pelvis = box(2.0 * (shape.torso[0] / 2.5), 0.6, 1.0, dark);
  pelvis.position.y = 2.6;
  root.add(pelvis);

  // torso
  const torso = new THREE.Group();
  torso.position.y = 2.95;
  const chest = box(shape.torso[0], shape.torso[1], shape.torso[2], hull);
  chest.position.y = shape.torso[1] / 2;
  const plate = box(shape.torso[0] * 0.72, shape.torso[1] * 0.5, 0.34, dark);
  plate.position.set(0, shape.torso[1] * 0.48, shape.torso[2] / 2 + 0.1);
  const head = box(0.95, 0.68, 0.9, hull);
  head.position.set(0, shape.torso[1] + 0.35, 0.25);
  const eye = box(0.72, 0.13, 0.1, glow(p.glow));
  eye.position.set(0, shape.torso[1] + 0.38, 0.72);
  torso.add(chest, plate, head, eye);
  root.add(torso);

  // armour and reactor live on the chest
  const armour = getComponent(equipped.armour ?? 'h_service');
  if (armour) {
    const model = ARMOUR_MODELS[componentModelKey(armour.id) ?? ''];
    if (model) {
      const m = model(p);
      m.position.y = torso.position.y;
      root.add(m);
    }
  }
  const reactor = getComponent(equipped.reactor ?? 'c_standard');
  if (reactor) {
    const model = REACTOR_MODELS[componentModelKey(reactor.id) ?? ''];
    if (model) {
      const m = model(p);
      m.position.y = torso.position.y;
      root.add(m);
    }
  }

  // arms carry the primary and secondary weapons
  const armFor = (slot: 'primary' | 'secondary', side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * shape.shoulder, torso.position.y + shape.torso[1] * 0.42, 0);
    const shoulder = box(0.95, 1.15, 1.15, hull);
    const housing = box(0.62, 0.62, 1.5, dark);
    housing.position.set(0, -0.2, 0.9);
    arm.add(shoulder, housing);
    const comp = getComponent(equipped[slot] ?? '');
    const model = comp ? WEAPON_MODELS[componentModelKey(comp.id) ?? ''] : undefined;
    if (model) {
      const m = model(p);
      m.position.set(0, -0.2, 1.25);
      arm.add(m);
    }
    root.add(arm);
  };
  armFor('primary', 1);
  armFor('secondary', -1);

  // specials ride on the shoulders
  const shoulderFor = (slot: 'specialQ' | 'specialE', side: number) => {
    const comp = getComponent(equipped[slot] ?? '');
    const model = comp ? WEAPON_MODELS[componentModelKey(comp.id) ?? ''] : undefined;
    if (!model) return;
    const pod = new THREE.Group();
    pod.position.set(side * (shape.shoulder + 0.15), torso.position.y + shape.torso[1] + 0.1, -0.1);
    const mount = box(0.7, 0.4, 0.7, dark);
    pod.add(mount);
    const m = model(p);
    m.position.y = 0.2;
    m.scale.setScalar(0.85);
    pod.add(m);
    root.add(pod);
  };
  shoulderFor('specialQ', -1);
  shoulderFor('specialE', 1);

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return root;
}

/** Release every GPU resource a built mech holds. */
export function disposeMech(group: THREE.Group): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}
