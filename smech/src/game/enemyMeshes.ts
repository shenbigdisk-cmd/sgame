import * as THREE from 'three';
import { getBrushedMetalNormalTexture, createBeveledBox } from './saltlineVisuals';

/**
 * Procedural high-detail meshes for hostile chassis:
 * - Raider & Bastion heavy battle tanks with articulated road wheels, reactive skirts, and faceted wedge turrets.
 * - Hound & Goliath bipedal combat mechs with hydraulic pistons, thrusters, sensor visors, and shoulder missile silos.
 * - Ember Sapper demolition rigs with caged fuel drums and shaped-charge warheads.
 * - Skimmer gunships with aerodynamic chine fuselage and ducted lift turbines.
 */

export interface Palette {
  hull: number;
  dark: number;
  glow: number;
  glowIntensity: number;
}

export interface TankMesh {
  group: THREE.Group;
  turret: THREE.Group;
  flashMats: THREE.MeshStandardMaterial[];
}

export interface MechMesh {
  group: THREE.Group;
  torso: THREE.Group;
  legs: THREE.Object3D[];
  flashMats: THREE.MeshStandardMaterial[];
}

export interface SapperMesh {
  group: THREE.Group;
  torso: THREE.Group;
  flashMats: THREE.MeshStandardMaterial[];
}

export interface HealthBar {
  bar: THREE.Group;
  fg: THREE.Mesh;
}

// ---------------------------------------------------------------------------
// Mesh Utilities
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
  const normalMap = getBrushedMetalNormalTexture();
  const hull = new THREE.MeshStandardMaterial({
    color: p.hull,
    roughness: 0.42,
    metalness: 0.65,
    normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    emissive: 0xffffff,
    emissiveIntensity: 0,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: p.dark,
    roughness: 0.54,
    metalness: 0.76,
    normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    emissive: 0xffffff,
    emissiveIntensity: 0,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xccd6e0,
    roughness: 0.18,
    metalness: 0.92,
    normalMap,
    normalScale: new THREE.Vector2(0.12, 0.12),
  });
  const tread = new THREE.MeshStandardMaterial({
    color: 0x1a1c1e,
    roughness: 0.76,
    metalness: 0.52,
    normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
  const glow = new THREE.MeshStandardMaterial({
    color: p.glow,
    emissive: p.glow,
    emissiveIntensity: Math.max(2.4, p.glowIntensity * 1.8),
    toneMapped: false,
  });
  return { hull, dark, chrome, tread, glow };
}

// ---------------------------------------------------------------------------
// 1. High-Detail Main Battle Tank
// ---------------------------------------------------------------------------
export function createTankMesh(p: Palette): TankMesh {
  const { hull, dark, chrome, tread, glow } = makeMats(p);
  const group = new THREE.Group();

  // --- Main Hull Chassis ---
  const hullBox = new THREE.Mesh(createBeveledBox(4.2, 1.05, 6.4, 0.08), hull);
  hullBox.position.y = 1.15;
  group.add(hullBox);

  // Lower hull keel (angled underbelly)
  const keel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.6, 5.8), dark);
  keel.position.y = 0.55;
  group.add(keel);

  // Upper front glacis plate (sloped composite armor)
  const glacis = new THREE.Mesh(createBeveledBox(4.0, 0.35, 2.2, 0.06), hull);
  glacis.position.set(0, 1.15, 2.95);
  glacis.rotation.x = 0.58;
  group.add(glacis);

  // Explosive Reactive Armor (ERA) tiles on glacis
  for (let row = 0; row < 2; row++) {
    for (let col = -1.4; col <= 1.45; col += 0.95) {
      const era = new THREE.Mesh(createBeveledBox(0.85, 0.12, 0.5, 0.02), dark);
      era.position.set(col, 1.25 + row * 0.28, 2.65 + row * 0.45);
      era.rotation.x = 0.58;
      group.add(era);
    }
  }

  // Driver viewport prism (glowing optics)
  const driverSight = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.18), glow);
  driverSight.position.set(-0.7, 1.58, 2.05);
  group.add(driverSight);

  // Front towing hooks / clevis shackles
  for (const side of [-1.55, 1.55]) {
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 16), dark);
    shackle.position.set(side, 0.72, 3.8);
    group.add(shackle);
  }

  // Armored headlights with protective brush guards
  for (const side of [-1.85, 1.85]) {
    const lightHousing = new THREE.Mesh(createBeveledBox(0.42, 0.3, 0.25, 0.03), dark);
    lightHousing.position.set(side, 1.35, 3.25);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22), glow);
    lens.position.set(side, 1.35, 3.38);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 12), chrome);
    guard.position.set(side, 1.35, 3.42);
    group.add(lightHousing, lens, guard);
  }

  // Rear Engine Deck details: Radiator louvers, exhaust mufflers & fuel drums
  const grille = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.8), dark);
  grille.position.set(0, 1.7, -1.8);
  group.add(grille);

  for (const side of [-1.4, 1.4]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 12), dark);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side, 1.3, -3.2);
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.2, 12, 1, true), chrome);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(side, 1.3, -3.1);
    group.add(exhaust, shroud);
  }

  // External rear fuel drums
  for (const side of [-1.1, 1.1]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.3, 16), hull);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(side, 1.1, -3.6);
    const straps = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.35, 16, 1, true), dark);
    straps.rotation.z = Math.PI / 2;
    straps.position.copy(drum.position);
    group.add(drum, straps);
  }

  // --- Track & Running Gear Assemblies ---
  for (const side of [-1, 1]) {
    const posX = side * 2.65;
    const trackGroup = new THREE.Group();
    trackGroup.position.x = posX;

    // Continuous track rubber/steel belt
    const trackTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 6.8), tread);
    trackTop.position.set(0, 1.12, 0);
    const trackBot = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 6.6), tread);
    trackBot.position.set(0, 0.1, 0);
    const trackFront = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.9, 0.18), tread);
    trackFront.position.set(0, 0.62, 3.35);
    trackFront.rotation.x = 0.55;
    const trackRear = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.9, 0.18), tread);
    trackRear.position.set(0, 0.62, -3.35);
    trackRear.rotation.x = -0.55;
    trackGroup.add(trackTop, trackBot, trackFront, trackRear);

    // Front Idler Wheel (large front wheel)
    const idler = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.05, 18), dark);
    idler.rotation.z = Math.PI / 2;
    idler.position.set(0, 0.65, 3.1);
    const idlerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.12, 14), chrome);
    idlerHub.rotation.z = Math.PI / 2;
    idlerHub.position.copy(idler.position);
    trackGroup.add(idler, idlerHub);

    // Rear Drive Sprocket (toothed drive wheel)
    const sprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.05, 18), dark);
    sprocket.rotation.z = Math.PI / 2;
    sprocket.position.set(0, 0.65, -3.1);
    const sprocketHub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.12, 14), chrome);
    sprocketHub.rotation.z = Math.PI / 2;
    sprocketHub.position.copy(sprocket.position);
    trackGroup.add(sprocket, sprocketHub);

    // 5 Intermediate Dual Road Wheels
    for (let i = 0; i < 5; i++) {
      const wz = -2.0 + i * 1.0;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 16), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.46, wz);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.12, 12), chrome);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      trackGroup.add(wheel, hub);
    }

    // Top Return Rollers (3 small track support rollers)
    for (const rz of [-1.5, 0, 1.5]) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.0, 12), dark);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(0, 0.98, rz);
      trackGroup.add(roller);
    }

    // Modular Segmented Side Skirt Armor Panels
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const pz = -2.25 + pIdx * 1.5;
      const panel = new THREE.Mesh(createBeveledBox(0.16, 0.72, 1.38, 0.03), hull);
      panel.position.set(side * 0.6, 0.88, pz);
      trackGroup.add(panel);
    }

    // Flexible rubber front & rear mudflaps
    const flapF = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.08), tread);
    flapF.position.set(0, 0.55, 3.65);
    flapF.rotation.x = 0.35;
    const flapR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.08), tread);
    flapR.position.set(0, 0.55, -3.65);
    flapR.rotation.x = -0.35;
    trackGroup.add(flapF, flapR);

    group.add(trackGroup);
  }

  // --- Turret Assembly ---
  const turret = new THREE.Group();
  turret.position.set(0, 1.82, -0.3);

  // Turret Ring Collar
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.28, 24), dark);
  ring.position.y = 0.14;
  turret.add(ring);

  // Main Turret Body (faceted composite chassis)
  const tMain = new THREE.Mesh(createBeveledBox(3.1, 0.95, 3.6, 0.08), hull);
  tMain.position.set(0, 0.65, 0.1);
  turret.add(tMain);

  // Sloped Arrowhead Wedge Cheeks (Leopard 2 / Abrams faceted composite armor)
  const wedgeGeo = createBeveledBox(1.2, 0.88, 1.8, 0.06);
  const cheekL = new THREE.Mesh(wedgeGeo, hull);
  cheekL.position.set(1.42, 0.65, 0.75);
  cheekL.rotation.y = -0.32;
  const cheekR = new THREE.Mesh(wedgeGeo, hull);
  cheekR.position.set(-1.42, 0.65, 0.75);
  cheekR.rotation.y = 0.32;
  turret.add(cheekL, cheekR);

  // Armored Gun Mantlet & Recoil Shroud
  const mantlet = new THREE.Mesh(createBeveledBox(1.6, 0.82, 0.95, 0.06), dark);
  mantlet.position.set(0, 0.65, 1.85);
  const dustCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.48, 16), dark);
  dustCollar.rotation.x = Math.PI / 2;
  dustCollar.position.set(0, 0.65, 2.3);
  turret.add(mantlet, dustCollar);

  // Heavy Cannon Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 5.8, 16), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.65, 5.2);

  // Mid-barrel Bore Evacuator (fume extractor)
  const evacuator = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.3, 16), hull);
  evacuator.rotation.x = Math.PI / 2;
  evacuator.position.set(0, 0.65, 4.4);

  // Dual-baffle Slotted Muzzle Brake
  const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.65, 16), chrome);
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.65, 8.1);
  const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 14), dark);
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.65, 8.45);
  turret.add(barrel, evacuator, muzzleBrake, muzzleTip);

  // Coaxial Heavy Machine Gun Barrel
  const coax = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8), dark);
  coax.rotation.x = Math.PI / 2;
  coax.position.set(0.65, 0.65, 2.6);
  turret.add(coax);

  // Gunner's Primary Targeting Sight (GPS Doghouse)
  const gpsBox = new THREE.Mesh(createBeveledBox(0.6, 0.42, 0.55, 0.03), dark);
  gpsBox.position.set(0.95, 1.25, 0.7);
  const gpsOptic = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.22), glow);
  gpsOptic.position.set(0.95, 1.25, 0.98);
  turret.add(gpsBox, gpsOptic);

  // Commander's Independent Thermal Viewer (CITV Rotating Sensor Ball)
  const citvMount = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.35, 12), dark);
  citvMount.position.set(-0.85, 1.25, 0.3);
  const citvBall = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), dark);
  citvBall.position.set(-0.85, 1.5, 0.3);
  const citvLens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 12), glow);
  citvLens.rotation.x = Math.PI / 2;
  citvLens.position.set(-0.85, 1.5, 0.42);
  turret.add(citvMount, citvBall, citvLens);

  // Commander's Cupola with Ring of Vision Blocks
  const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.3, 14), dark);
  cupola.position.set(-0.75, 1.2, -0.65);
  turret.add(cupola);

  // Turret Rear Bustle Stowage Basket & Electronics Cage
  const bustle = new THREE.Mesh(createBeveledBox(2.6, 0.7, 1.4, 0.04), dark);
  bustle.position.set(0, 0.65, -2.2);
  const fanGrille = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16), chrome);
  fanGrille.position.set(0, 1.02, -2.2);
  turret.add(bustle, fanGrille);

  // Smoke Grenade Discharger Arrays (bank of 4 angled tubes on each cheek)
  for (const side of [-1, 1]) {
    for (let tubeIdx = 0; tubeIdx < 4; tubeIdx++) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.38, 8), dark);
      tube.rotation.x = -0.4;
      tube.rotation.z = side * (0.35 + tubeIdx * 0.12);
      tube.position.set(side * (1.35 + tubeIdx * 0.12), 1.1, 0.1 + tubeIdx * 0.22);
      turret.add(tube);
    }
  }

  group.add(turret);
  setShadows(group);
  return { group, turret, flashMats: [hull, dark] };
}

// ---------------------------------------------------------------------------
// 2. High-Detail Bipedal Combat Mech (Raider Walker & Heavy Goliath)
// ---------------------------------------------------------------------------
export function createMechMesh(p: Palette, heavy: boolean): MechMesh {
  const s = heavy ? 1.75 : 1;
  const { hull, dark, chrome, tread, glow } = makeMats(p);
  const group = new THREE.Group();
  const legs: THREE.Object3D[] = [];

  // --- Pelvis & Hip Frame ---
  const pelvis = new THREE.Mesh(createBeveledBox(1.9 * s, 0.65 * s, 1.2 * s, 0.05 * s), dark);
  pelvis.position.y = 2.65 * s;
  const codplate = new THREE.Mesh(createBeveledBox(0.9 * s, 0.8 * s, 0.3 * s, 0.03 * s), hull);
  codplate.position.set(0, 2.5 * s, 0.65 * s);
  codplate.rotation.x = -0.28;
  group.add(pelvis, codplate);

  // --- Articulated Leg Assemblies ---
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 1.05 * s, 2.55 * s, 0);

    // Rotary Hip Pivot Actuator
    const hipActuator = new THREE.Mesh(new THREE.CylinderGeometry(0.38 * s, 0.38 * s, 0.45 * s, 16), chrome);
    hipActuator.rotation.z = Math.PI / 2;
    hip.add(hipActuator);

    // Upper Leg (Thigh) Frame & Angled Armor Carapace
    const thighFrame = new THREE.Mesh(createBeveledBox(0.42 * s, 1.45 * s, 0.52 * s, 0.03 * s), dark);
    thighFrame.position.y = -0.75 * s;
    const thighArmor = new THREE.Mesh(createBeveledBox(0.68 * s, 1.35 * s, 0.35 * s, 0.04 * s), hull);
    thighArmor.position.set(0, -0.72 * s, 0.3 * s);
    thighArmor.rotation.x = -0.12;

    // Rear Hydraulic Thigh Piston
    const pistonCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.85 * s, 10), dark);
    pistonCylinder.position.set(0, -0.6 * s, -0.28 * s);
    const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.85 * s, 10), chrome);
    pistonRod.position.set(0, -1.0 * s, -0.28 * s);
    hip.add(thighFrame, thighArmor, pistonCylinder, pistonRod);

    // Rotary Knee Joint & Armored Kneepad
    const kneeJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.58 * s, 16), dark);
    kneeJoint.rotation.z = Math.PI / 2;
    kneeJoint.position.y = -1.5 * s;
    const kneeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.24 * s, 0.62 * s, 14), chrome);
    kneeCap.rotation.z = Math.PI / 2;
    kneeCap.position.copy(kneeJoint.position);
    const kneePad = new THREE.Mesh(createBeveledBox(0.62 * s, 0.7 * s, 0.35 * s, 0.04 * s), hull);
    kneePad.position.set(0, -1.48 * s, 0.42 * s);
    kneePad.rotation.x = 0.25;
    hip.add(kneeJoint, kneeCap, kneePad);

    // Lower Leg (Shin & Calf)
    const shinFrame = new THREE.Mesh(createBeveledBox(0.46 * s, 1.4 * s, 0.55 * s, 0.03 * s), dark);
    shinFrame.position.set(0, -2.05 * s, 0.1 * s);
    const shinPlate = new THREE.Mesh(createBeveledBox(0.72 * s, 1.35 * s, 0.32 * s, 0.04 * s), hull);
    shinPlate.position.set(0, -2.0 * s, 0.38 * s);
    shinPlate.rotation.x = 0.18;

    // Rear Calf Jet Vector Thruster
    const calfThruster = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 0.65 * s, 14), dark);
    calfThruster.rotation.x = -0.3;
    calfThruster.position.set(0, -1.98 * s, -0.26 * s);
    const thrusterFlameRing = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 0.15 * s, 12), glow);
    thrusterFlameRing.rotation.x = -0.3;
    thrusterFlameRing.position.set(0, -2.25 * s, -0.35 * s);
    hip.add(shinFrame, shinPlate, calfThruster, thrusterFlameRing);

    // Ankle Knuckle Joint
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.26 * s, 10, 10), dark);
    ankle.position.set(0, -2.52 * s, 0.1 * s);

    // Heavy Armored Combat Foot with Articulated Dual Claws & Rear Heel Spur
    const footSole = new THREE.Mesh(createBeveledBox(0.98 * s, 0.25 * s, 1.55 * s, 0.03 * s), tread);
    footSole.position.set(0, -2.65 * s, 0.25 * s);
    // Left & right front stabilizer toes
    const toeL = new THREE.Mesh(createBeveledBox(0.38 * s, 0.28 * s, 0.55 * s, 0.03 * s), dark);
    toeL.position.set(0.24 * s, -2.62 * s, 1.05 * s);
    toeL.rotation.x = 0.22;
    const toeR = toeL.clone();
    toeR.position.x = -0.24 * s;
    // Rear anti-recoil heel spur
    const heelSpur = new THREE.Mesh(createBeveledBox(0.68 * s, 0.3 * s, 0.55 * s, 0.03 * s), dark);
    heelSpur.position.set(0, -2.62 * s, -0.55 * s);
    heelSpur.rotation.x = -0.22;
    hip.add(ankle, footSole, toeL, toeR, heelSpur);

    group.add(hip);
    legs.push(hip);
  }

  // --- Torso & Cockpit Module ---
  const torso = new THREE.Group();
  torso.position.y = 2.95 * s;

  // Waist Swivel Turntable
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * s, 1.1 * s, 0.4 * s, 18), dark);
  waist.position.y = 0.18 * s;
  torso.add(waist);

  // Angular Cockpit Chest Chassis
  const chest = new THREE.Mesh(createBeveledBox(2.7 * s, 1.75 * s, 2.2 * s, 0.1 * s), hull);
  chest.position.y = 0.95 * s;

  // Heavy Composite Chest Glacis & Pilot Hatch
  const chestPlate = new THREE.Mesh(createBeveledBox(2.2 * s, 1.2 * s, 0.45 * s, 0.05 * s), dark);
  chestPlate.position.set(0, 0.9 * s, 1.18 * s);
  chestPlate.rotation.x = -0.15;
  const hatchSeam = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.65 * s, 0.12 * s), chrome);
  hatchSeam.position.set(0, 1.15 * s, 1.38 * s);
  hatchSeam.rotation.x = -0.15;

  // Reinforced Neck Collar & Blast Flanges
  const collar = new THREE.Mesh(createBeveledBox(1.5 * s, 0.45 * s, 1.5 * s, 0.04 * s), dark);
  collar.position.set(0, 1.85 * s, 0.2 * s);
  torso.add(chest, chestPlate, hatchSeam, collar);

  // Armored Sensor Head / Cyclops Visor
  const head = new THREE.Mesh(createBeveledBox(1.15 * s, 0.68 * s, 1.15 * s, 0.04 * s), hull);
  head.position.set(0, 2.12 * s, 0.35 * s);
  const headPlate = new THREE.Mesh(createBeveledBox(0.95 * s, 0.28 * s, 0.45 * s, 0.02 * s), dark);
  headPlate.position.set(0, 2.38 * s, 0.45 * s);
  // High-intensity Cyclops Horizontal Sensor Visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.85 * s, 0.16 * s, 0.12 * s), glow);
  visor.position.set(0, 2.15 * s, 0.94 * s);
  // Telemetry Comms Antenna
  const commsAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 1.1 * s, 6), chrome);
  commsAntenna.position.set(-0.52 * s, 2.7 * s, 0.1 * s);
  commsAntenna.rotation.z = 0.15;
  torso.add(head, headPlate, visor, commsAntenna);

  // Rear Backpack: Reactor Radiator Turbine & Jump Exhaust Cowls
  const backpack = new THREE.Mesh(createBeveledBox(2.2 * s, 1.4 * s, 1.1 * s, 0.06 * s), dark);
  backpack.position.set(0, 1.05 * s, -1.2 * s);
  for (const side of [-0.65 * s, 0.65 * s]) {
    const turbine = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.36 * s, 0.9 * s, 14), dark);
    turbine.position.set(side, 1.35 * s, -1.75 * s);
    const ventGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 0.15 * s, 12), glow);
    ventGlow.position.set(side, 1.82 * s, -1.75 * s);
    const jumpNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.3 * s, 0.55 * s, 12), dark);
    jumpNozzle.rotation.x = Math.PI;
    jumpNozzle.position.set(side, 0.55 * s, -1.65 * s);
    torso.add(turbine, ventGlow, jumpNozzle);
  }
  torso.add(backpack);

  // --- Arm Assemblies & Weapon Hardpoints ---
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 1.95 * s, 1.05 * s, 0);

    // Multi-faceted Layered Shoulder Pauldron
    const pauldron = new THREE.Mesh(createBeveledBox(1.15 * s, 1.15 * s, 1.35 * s, 0.08 * s), hull);
    const shoulderTrim = new THREE.Mesh(createBeveledBox(1.22 * s, 0.35 * s, 1.42 * s, 0.04 * s), dark);
    shoulderTrim.position.y = 0.35 * s;
    arm.add(pauldron, shoulderTrim);

    // Upper Arm Bicep Hydraulic Strut
    const bicep = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.28 * s, 0.9 * s, 12), dark);
    bicep.position.set(0, -0.6 * s, 0);
    const bicepPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.95 * s, 10), chrome);
    bicepPiston.position.set(0, -0.6 * s, 0.18 * s);
    // Armored Elbow Joint
    const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.32 * s, 0.65 * s, 14), dark);
    elbow.rotation.z = Math.PI / 2;
    elbow.position.set(0, -1.05 * s, 0);
    arm.add(bicep, bicepPiston, elbow);

    // Forearm Weapon Housing
    const gunHousing = new THREE.Mesh(createBeveledBox(0.82 * s, 0.82 * s, 1.85 * s, 0.05 * s), dark);
    gunHousing.position.set(0, -1.05 * s, 1.15 * s);
    arm.add(gunHousing);

    if (heavy) {
      // Goliath Heavy Siege Railcannon
      const heavyBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.28 * s, 3.8 * s, 16), dark);
      heavyBarrel.rotation.x = Math.PI / 2;
      heavyBarrel.position.set(0, -1.05 * s, 3.6 * s);
      const thermalShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.38 * s, 0.38 * s, 1.6 * s, 16, 1, true), chrome);
      thermalShroud.rotation.x = Math.PI / 2;
      thermalShroud.position.set(0, -1.05 * s, 2.7 * s);
      const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * s, 0.36 * s, 0.65 * s, 16), chrome);
      muzzleBrake.rotation.x = Math.PI / 2;
      muzzleBrake.position.set(0, -1.05 * s, 5.6 * s);
      arm.add(heavyBarrel, thermalShroud, muzzleBrake);

      // Shoulder Salvo Missile Pod (2x3 honeycomb cluster)
      const missilePod = new THREE.Mesh(createBeveledBox(1.2 * s, 0.95 * s, 1.65 * s, 0.05 * s), dark);
      missilePod.position.set(0, 1.1 * s, 0.1 * s);
      arm.add(missilePod);

      // 6 recessed missile cell tubes with glowing warhead tips
      for (let r = 0; r < 2; r++) {
        for (let c = -1; c <= 1; c++) {
          const tubeOpening = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.2 * s, 10), dark);
          tubeOpening.rotation.x = Math.PI / 2;
          tubeOpening.position.set(c * 0.32 * s, (1.1 + (r - 0.5) * 0.34) * s, 0.95 * s);
          const warhead = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 8), glow);
          warhead.position.set(c * 0.32 * s, (1.1 + (r - 0.5) * 0.34) * s, 0.98 * s);
          arm.add(tubeOpening, warhead);
        }
      }
    } else {
      // Raider / Scout: Rapid-Fire Dual Autocannons
      for (const barrelSide of [-0.22 * s, 0.22 * s]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.15 * s, 2.8 * s, 12), dark);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(barrelSide, -1.05 * s, 2.8 * s);
        const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.15 * s, 0.35 * s, 12), chrome);
        flashHider.rotation.x = Math.PI / 2;
        flashHider.position.set(barrelSide, -1.05 * s, 4.3 * s);
        arm.add(barrel, flashHider);
      }
      // Ammo Feed Drum
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.45 * s, 14), hull);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(side * 0.45 * s, -1.05 * s, 0.65 * s);
      arm.add(drum);
    }

    torso.add(arm);
  }

  group.add(torso);
  setShadows(group);
  return { group, torso, legs, flashMats: [hull, dark] };
}

// ---------------------------------------------------------------------------
// 3. High-Detail Ember Sapper (Demolition Drone)
// ---------------------------------------------------------------------------
export function createSapperMesh(p: Palette): SapperMesh {
  const { hull, dark, chrome, tread, glow } = makeMats(p);
  const group = new THREE.Group();
  const torso = new THREE.Group();
  torso.position.y = 0;

  // Heavy Low-Profile Chassis
  const chassis = new THREE.Mesh(createBeveledBox(2.6, 0.92, 3.6, 0.05), hull);
  chassis.position.y = 0.82;
  torso.add(chassis);

  // Angled Demolition Ramming Wedge Prow
  const ramProw = new THREE.Mesh(createBeveledBox(2.8, 0.85, 0.6, 0.04), dark);
  ramProw.position.set(0, 0.72, 2.05);
  ramProw.rotation.x = 0.45;
  torso.add(ramProw);

  // Spiked Shaped-Charge Warhead Nose
  const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.8, 4), dark);
  warhead.rotation.x = Math.PI / 2;
  warhead.rotation.y = Math.PI / 4;
  warhead.position.set(0, 0.82, 2.65);
  const detonatorSpike = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.8, 8), chrome);
  detonatorSpike.rotation.x = Math.PI / 2;
  detonatorSpike.position.set(0, 0.82, 3.8);
  torso.add(warhead, detonatorSpike);

  // Twin Heavy Incendiary Fuel Drums slung along the flanks
  for (const side of [-1, 1]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.4, 16), dark);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(side * 1.62, 0.72, -0.15);
    torso.add(drum);

    // Glowing Charge Bands & Steel Hazard Straps
    for (const off of [-0.68, 0.68]) {
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.24, 16), chrome);
      strap.rotation.x = Math.PI / 2;
      strap.position.set(side * 1.62, 0.72, off - 0.15);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 16), glow);
      band.rotation.x = Math.PI / 2;
      band.position.set(side * 1.62, 0.72, off - 0.15);
      torso.add(strap, band);
    }
  }

  // Glowing Furnace Core with Roll-Cage Heat Baffles
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), glow);
  core.position.set(0, 1.32, 0.5);
  const coreCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.35, 14), dark);
  coreCollar.position.set(0, 1.25, 0.5);
  // Roll cage bars
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const bar = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 12, Math.PI), chrome);
    bar.rotation.x = Math.PI / 2;
    bar.rotation.y = angle;
    bar.position.set(0, 1.32, 0.5);
    torso.add(bar);
  }
  torso.add(core, coreCollar);

  // Telemetry Mast & Sensor Beacon
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.4, 6), dark);
  mast.position.set(0.9, 1.82, -1.15);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), glow);
  tip.position.set(0.9, 2.55, -1.15);
  torso.add(mast, tip);

  // Ground Tracks with Road Wheels
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.58, 3.8), tread);
    track.position.set(side * 1.32, 0.32, 0);
    for (let w = -1.2; w <= 1.25; w += 0.8) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.9, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.32, 0.28, w);
      group.add(wheel);
    }
    group.add(track);
  }

  group.add(torso);
  setShadows(group);
  return { group, torso, flashMats: [hull, dark] };
}

// ---------------------------------------------------------------------------
// 4. High-Detail Skimmer (Hover Gunship)
// ---------------------------------------------------------------------------
export function createSkimmerMesh(p: Palette): TankMesh {
  const { hull, dark, chrome, glow } = makeMats(p);
  const group = new THREE.Group();
  const turret = new THREE.Group();

  // Aerodynamic Stealth Fuselage
  const fuselage = new THREE.Mesh(createBeveledBox(1.5, 0.65, 3.2, 0.06), hull);
  fuselage.position.y = 1.0;
  const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.6, 4), dark);
  noseCone.rotation.x = Math.PI / 2;
  noseCone.rotation.y = Math.PI / 4;
  noseCone.position.set(0, 0.95, 2.1);
  group.add(fuselage, noseCone);

  // Twin Ducted Lift Fan Nacelles
  for (const side of [-1, 1]) {
    const duct = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.25, 8, 20), dark);
    duct.rotation.x = Math.PI / 2;
    duct.position.set(side * 1.85, 0.95, 0);
    const ductCowling = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.38, 20, 1, true), hull);
    ductCowling.position.set(side * 1.85, 0.95, 0);
    // Turbine Rotor Blades
    const rotorBlade = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.22), chrome);
    rotorBlade.position.copy(duct.position);
    const rotorBlade2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 2.1), chrome);
    rotorBlade2.position.copy(duct.position);
    // Glowing Internal Lift Ring
    const liftRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 16), glow);
    liftRing.rotation.x = Math.PI / 2;
    liftRing.position.copy(duct.position);
    group.add(duct, ductCowling, rotorBlade, rotorBlade2, liftRing);
  }

  // Gimballed Nose Sensor Eye Turret
  turret.position.y = 0.72;
  const gimbalHousing = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), dark);
  gimbalHousing.position.z = 1.65;
  const sensorLens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 12), glow);
  sensorLens.rotation.x = Math.PI / 2;
  sensorLens.position.set(0, 0, 1.82);
  turret.add(gimbalHousing, sensorLens);

  group.add(turret);
  setShadows(group);
  return { group, turret, flashMats: [hull, dark] };
}

// ---------------------------------------------------------------------------
// Health Bar UI Billboard
// ---------------------------------------------------------------------------
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
