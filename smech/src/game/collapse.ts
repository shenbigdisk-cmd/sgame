import * as THREE from 'three';
import type { Obstacle } from './colliders';

/** A short-lived rigid fragment; impact hands it off to a low, static rubble bed. */
type Part = {
  mesh: THREE.Mesh;
  origin: THREE.Vector3;
  angle: THREE.Euler;
  vx: number;
  vz: number;
  spin: number;
  delay: number;
  bottom: number;
  temporary: boolean;
  landed: boolean;
};
type Dust = (point: THREE.Vector3, size: number) => void;

// Keep the original facade UVs on exposed faces. Otherwise every fragment
// shows a miniature copy of the entire building the instant the shot lands.
function panel(
  w: number,
  h: number,
  d: number,
  nx: number,
  ny: number,
  nz: number,
  x: number,
  y: number,
  z: number,
) {
  const g = new THREE.BoxGeometry(w / nx, h / ny, d / nz),
    uv = g.attributes.uv;
  const faces = [
    [nz - 1 - z, y, nz, ny],
    [z, y, nz, ny],
    [x, nz - 1 - z, nx, nz],
    [x, z, nx, nz],
    [x, y, nx, ny],
    [nx - 1 - x, y, nx, ny],
  ];
  faces.forEach(([u, v, cols, rows], face) => {
    for (let j = 0; j < 4; j++) {
      const k = face * 4 + j;
      uv.setXY(k, (u + uv.getX(k)) / cols, (v + uv.getY(k)) / rows);
    }
  });
  return g;
}

export class Collapse {
  private parts: Part[] = [];
  private age = 0;
  private debris: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private world = new THREE.Vector3();
  constructor(
    private model: THREE.Group,
    private o: Obstacle,
    hit: THREE.Vector3,
    stone: THREE.BufferGeometry,
    patina: THREE.Material,
    private ground: (x: number, z: number) => number,
  ) {
    const source = [...model.children];
    const local = model.worldToLocal(hit.clone());
    const add = (mesh: THREE.Mesh, temporary: boolean) => {
      const { x, z } = mesh.position,
        side = Math.sign(x - local.x) || 1;
      mesh.geometry.computeBoundingBox();
      const bottom = Math.max(0.1, Math.min(2, -(mesh.geometry.boundingBox?.min.y ?? 0) * mesh.scale.y));
      this.parts.push({
        mesh,
        origin: mesh.position.clone(),
        angle: mesh.rotation.clone(),
        bottom,
        temporary,
        landed: false,
        delay: Math.min(0.46, 0.015 * Math.hypot(x - local.x, z - local.z)) + 0.06 * Math.random(),
        vx: side * (0.4 + Math.random() * 1.3),
        vz: Math.sign(z - local.z) * (0.4 + Math.random()),
        spin: side * (0.14 + Math.random() * 0.28),
      });
    };
    for (const m of source) {
      if (!(m instanceof THREE.Mesh)) continue;
      if (m.name === 'breach-band') {
        m.visible = false;
        continue;
      }
      const g = m.geometry;
      if (
        g instanceof THREE.BoxGeometry &&
        Math.max(g.parameters.width, g.parameters.height, g.parameters.depth) > 5
      ) {
        m.visible = false;
        const { width: w, height: h, depth: d } = g.parameters;
        const nx = w > 6 ? 2 : 1,
          nz = d > 8 ? 2 : 1,
          ny = h > 20 ? 3 : h > 5 ? 2 : 1;
        for (let x = 0; x < nx; x++)
          for (let y = 0; y < ny; y++)
            for (let z = 0; z < nz; z++) {
              const piece = new THREE.Mesh(panel(w, h, d, nx, ny, nz, x, y, z), m.material);
              piece.scale.copy(m.scale);
              piece.quaternion.copy(m.quaternion);
              piece.position
                .set(((x + 0.5) / nx - 0.5) * w, ((y + 0.5) / ny - 0.5) * h, ((z + 0.5) / nz - 0.5) * d)
                .multiply(m.scale)
                .applyQuaternion(m.quaternion)
                .add(m.position);
              piece.castShadow = m.castShadow;
              piece.receiveShadow = m.receiveShadow;
              model.add(piece);
              add(piece, true);
            }
      } else add(m, false);
    }
    this.debris = new THREE.InstancedMesh(stone, patina, Math.max(1, this.parts.length * 3));
    this.debris.name = 'settled-rubble';
    this.debris.count = 0;
    this.debris.castShadow = true;
    this.debris.receiveShadow = true;
    this.debris.frustumCulled = false;
    model.add(this.debris);
  }
  step(dt: number, dust?: Dust) {
    this.age += dt;
    let active = false;
    for (const p of this.parts) {
      if (p.landed) continue;
      const t = this.age - p.delay;
      if (t <= 0) {
        active = true;
        continue;
      }
      const m = p.mesh;
      m.position.set(p.origin.x + p.vx * t, p.origin.y - 13 * t * t, p.origin.z + p.vz * t);
      m.rotation.set(p.angle.x + p.spin * t * 0.45, p.angle.y, p.angle.z + p.spin * t);
      const floor = this.model.localToWorld(this.world.copy(m.position));
      const gy = this.ground(floor.x, floor.z);
      if (floor.y - p.bottom > gy) {
        active = true;
        continue;
      }
      p.landed = true;
      m.visible = false;
      floor.y = gy + 0.3;
      dust?.(floor, Math.min(2.7, 1 + this.o.h * 0.045));
      for (let j = 0; j < 3; j++) {
        const span = Math.min(3, Math.max(0.8, this.o.r * 0.22));
        this.dummy.position.set(
          m.position.x + (Math.random() - 0.5) * span,
          0,
          m.position.z + (Math.random() - 0.5) * span,
        );
        const wp = this.model.localToWorld(this.world.copy(this.dummy.position));
        this.dummy.position.y = this.ground(wp.x, wp.z) - this.model.position.y + 0.12;
        this.dummy.rotation.set(Math.random() * 0.25, Math.random() * Math.PI, Math.random() * 0.22);
        this.dummy.scale.set(
          span * (0.45 + Math.random() * 0.65),
          0.18 + Math.random() * 0.38,
          span * (0.35 + Math.random() * 0.45),
        );
        this.dummy.updateMatrix();
        this.debris.setMatrixAt(this.debris.count++, this.dummy.matrix);
      }
      this.debris.instanceMatrix.needsUpdate = true;
      if (p.temporary) {
        m.removeFromParent();
        m.geometry.dispose();
      }
    }
    return !active;
  }
}
