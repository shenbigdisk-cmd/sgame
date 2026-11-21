import * as THREE from 'three';
import { createBeveledBox } from './saltlineVisuals';

export interface SentryTurretModel {
  group: THREE.Group;
  /** The independently rotating gun head; local forward points along +Z. */
  head: THREE.Group;
}

function strutBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, direction.length(), 8), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

/** Build the Warden's field sentry as a compact, armoured three-leg gun platform. */
export function createSentryTurret(accent: THREE.ColorRepresentation): SentryTurretModel {
  const group = new THREE.Group();
  group.name = 'warden-field-sentry';

  const baseSteel = new THREE.MeshStandardMaterial({ color: 0x252d30, roughness: 0.56, metalness: 0.76 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x171e21, roughness: 0.48, metalness: 0.82 });
  const armor = new THREE.MeshStandardMaterial({ color: 0x5b625f, roughness: 0.42, metalness: 0.72 });
  const edgeSteel = new THREE.MeshStandardMaterial({ color: 0x929387, roughness: 0.35, metalness: 0.86 });
  const accentLight = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.4,
    roughness: 0.24,
    metalness: 0.2,
    toneMapped: false,
  });
  const optic = new THREE.MeshStandardMaterial({
    color: 0x8fe9f2,
    emissive: 0x39c7dc,
    emissiveIntensity: 2.1,
    roughness: 0.18,
    metalness: 0.08,
    toneMapped: false,
  });

  const addBox = (
    parent: THREE.Object3D,
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    position: THREE.Vector3,
    bevel = 0.045,
  ) => {
    const mesh = new THREE.Mesh(createBeveledBox(width, height, depth, bevel), material);
    mesh.position.copy(position);
    parent.add(mesh);
    return mesh;
  };
  const addCylinder = (
    parent: THREE.Object3D,
    topRadius: number,
    bottomRadius: number,
    height: number,
    material: THREE.Material,
    position: THREE.Vector3,
    segments = 12,
  ) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, height, segments), material);
    mesh.position.copy(position);
    parent.add(mesh);
    return mesh;
  };

  // Broad shock-footed base: three outriggers keep the sentry planted while it tracks.
  addCylinder(group, 0.92, 1.16, 0.5, baseSteel, new THREE.Vector3(0, 0.34, 0), 12);
  addCylinder(group, 0.89, 0.89, 0.12, edgeSteel, new THREE.Vector3(0, 0.64, 0), 16);
  const bearing = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.055, 8, 20), accentLight);
  bearing.rotation.x = Math.PI / 2;
  bearing.position.y = 0.72;
  group.add(bearing);

  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const radial = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const inner = radial.clone().multiplyScalar(0.57).add(new THREE.Vector3(0, 0.48, 0));
    const outer = radial.clone().multiplyScalar(1.26).add(new THREE.Vector3(0, 0.11, 0));
    group.add(strutBetween(inner, outer, 0.12, edgeSteel));
    addBox(
      group,
      0.76,
      0.16,
      0.42,
      baseSteel,
      radial.clone().multiplyScalar(1.3).add(new THREE.Vector3(0, 0.075, 0)),
      0.035,
    ).rotation.y = angle;
    addCylinder(
      group,
      0.11,
      0.11,
      0.09,
      accentLight,
      radial.clone().multiplyScalar(0.97).add(new THREE.Vector3(0, 0.2, 0)),
      8,
    );
  }

  // Recoil-isolated mast and paired hydraulic elevation rams.
  addCylinder(group, 0.43, 0.56, 0.48, darkSteel, new THREE.Vector3(0, 0.89, 0), 10);
  addCylinder(group, 0.3, 0.38, 0.92, armor, new THREE.Vector3(0, 1.53, 0), 10);
  addCylinder(group, 0.37, 0.45, 0.16, edgeSteel, new THREE.Vector3(0, 1.97, 0), 12);
  for (const side of [-1, 1]) {
    group.add(
      strutBetween(
        new THREE.Vector3(side * 0.32, 1.13, 0),
        new THREE.Vector3(side * 0.38, 2.05, 0.12),
        0.075,
        darkSteel,
      ),
    );
    addCylinder(group, 0.105, 0.105, 0.11, accentLight, new THREE.Vector3(side * 0.46, 1.67, 0), 8);
  }

  const head = new THREE.Group();
  head.name = 'sentry-traverse-head';
  head.position.y = 2.08;
  group.add(head);

  const azimuthRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.065, 8, 20), darkSteel);
  azimuthRing.rotation.x = Math.PI / 2;
  azimuthRing.position.y = -0.14;
  head.add(azimuthRing);

  // Faceted receiver with cheek plates and a sloped roof, rather than a bare box.
  addBox(head, 1.38, 0.72, 1.12, armor, new THREE.Vector3(0, 0.08, -0.02), 0.1);
  addBox(head, 0.88, 0.18, 0.74, baseSteel, new THREE.Vector3(0, 0.51, -0.05), 0.06);
  for (const side of [-1, 1]) {
    const cheek = addBox(head, 0.25, 0.57, 0.88, darkSteel, new THREE.Vector3(side * 0.72, 0.05, 0.02), 0.035);
    cheek.rotation.z = side * -0.12;
    for (let rib = 0; rib < 3; rib += 1) {
      const vent = addBox(
        head,
        0.055,
        0.31,
        0.1,
        edgeSteel,
        new THREE.Vector3(side * 0.86, 0.04, -0.28 + rib * 0.22),
        0.018,
      );
      vent.rotation.z = side * -0.12;
    }
  }

  // Glass-backed target optics sit above the barrel, aimed in the same direction.
  const opticFrame = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 8, 16), edgeSteel);
  opticFrame.position.set(0, 0.24, 0.6);
  head.add(opticFrame);
  const mainOptic = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), optic);
  mainOptic.position.set(0, 0.24, 0.62);
  mainOptic.scale.z = 0.55;
  head.add(mainOptic);
  for (const side of [-1, 1]) {
    const ranging = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), accentLight);
    ranging.position.set(side * 0.3, 0.28, 0.55);
    head.add(ranging);
  }

  // Long-bore autocannon, with recoil sleeve, twin guide rails and a vented muzzle brake.
  const barrelAxis = (radius: number, length: number, material: THREE.Material, z: number, topRadius = radius) => {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, radius, length, 12), material);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.13, z);
    head.add(tube);
    return tube;
  };
  barrelAxis(0.19, 0.42, darkSteel, 0.77, 0.16);
  barrelAxis(0.13, 1.38, edgeSteel, 1.55, 0.105);
  barrelAxis(0.205, 0.34, armor, 2.39, 0.17);
  for (const z of [1.02, 1.23, 2.55]) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(z === 2.55 ? 0.17 : 0.14, 0.035, 6, 12), accentLight);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, -0.13, z);
    head.add(collar);
  }
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.62, 8), darkSteel);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * 0.3, -0.31, 1.47);
    head.add(rail);
  }
  for (let port = 0; port < 3; port += 1) {
    const vent = addBox(
      head,
      0.09,
      0.11,
      0.28,
      darkSteel,
      new THREE.Vector3(-0.25 + port * 0.25, -0.13, 2.39),
      0.025,
    );
    vent.rotation.y = Math.PI / 2;
  }

  return { group, head };
}

export function disposeSentryTurret(group: THREE.Object3D): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
    else mesh.material.dispose();
  });
}
