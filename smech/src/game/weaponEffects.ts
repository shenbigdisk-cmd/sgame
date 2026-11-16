import * as THREE from 'three';

interface EnergyFlash {
  group: THREE.Group;
  age: number;
  duration: number;
}

/** Layered geometry keeps beams visible on both bloom and low-quality renderers. */
export class WeaponEffects {
  private flashes: EnergyFlash[] = [];
  constructor(private scene: THREE.Scene) {}

  beam(from: THREE.Vector3, to: THREE.Vector3, color = 0x90e5ff, width = 0.06, duration = 0.18, lightning = false) {
    if (from.distanceToSquared(to) < 0.01) return;
    const group = new THREE.Group();
    group.name = lightning ? 'lightning-beam' : 'energy-beam';
    const distance = from.distanceTo(to);
    const forward = to.clone().sub(from).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const steps = Math.min(48, Math.max(5, Math.ceil(distance / 5)));
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = from.clone().lerp(to, t);
      const scatter = lightning && i > 0 && i < steps ? Math.min(1.2, distance * 0.015) * Math.sin(t * Math.PI) : 0;
      point.addScaledVector(right, (Math.random() - 0.5) * scatter).addScaledVector(up, (Math.random() - 0.5) * scatter);
      points.push(point);
    }
    const path = new THREE.CatmullRomCurve3(points);
    const layer = (radius: number, tint: number, opacity: number) => {
      const material = new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      material.userData.initialOpacity = opacity;
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, steps * 3, radius, 5, false), material);
      mesh.frustumCulled = false;
      group.add(mesh);
    };
    layer(width * 4, color, 0.13);
    layer(width * 1.8, color, 0.48);
    layer(width * 0.65, 0xf3fcff, 0.95);
    if (lightning) {
      for (let i = 1; i < points.length - 2; i += 4) {
        const start = points[i];
        const end = points[Math.min(i + 3, points.length - 1)].clone().addScaledVector(right, (Math.random() - 0.5) * 4);
        const branch = new THREE.BufferGeometry().setFromPoints([start, start.clone().lerp(end, 0.5).addScaledVector(up, 1), end]);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
        mat.userData.initialOpacity = 0.85;
        group.add(new THREE.Line(branch, mat));
      }
    }
    this.scene.add(group);
    this.flashes.push({ group, age: 0, duration });
    if (this.flashes.length > 30) this.remove(0);
  }

  update(dt: number) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const flash = this.flashes[i];
      flash.age += dt;
      if (flash.age >= flash.duration) { this.remove(i); continue; }
      const fade = Math.pow(1 - flash.age / flash.duration, 0.6) * (0.86 + Math.random() * 0.14);
      flash.group.traverse((node) => {
        const material = (node as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (material) material.opacity = material.userData.initialOpacity * fade;
      });
    }
  }

  private remove(index: number) {
    const flash = this.flashes[index];
    this.scene.remove(flash.group);
    flash.group.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
    });
    this.flashes.splice(index, 1);
  }

  dispose() { while (this.flashes.length) this.remove(0); }
}