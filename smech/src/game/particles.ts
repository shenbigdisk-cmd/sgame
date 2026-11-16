import * as THREE from 'three';

/**
 * Instanced billboard particle system.
 *
 * Every particle lives in a fixed slot of a pre-allocated instance buffer, so
 * spawning smoke, sparks and fire never allocates during a firefight.
 */

const PARTICLE_VERT = `
attribute vec4 pColor;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vColor = pColor;
  vUv = uv;
  vec3 center = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float s = instanceMatrix[0][0];
  vec4 mv = modelViewMatrix * vec4(center, 1.0);
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
}`;

const PARTICLE_FRAG = `
varying vec4 vColor;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.15, d) * vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

export interface ParticleSpec {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  size0: number; size1: number;
  c0: [number, number, number];
  c1: [number, number, number];
  grav: number;
  drag: number;
  alpha: number;
}

export class ParticleSystem {
  mesh: THREE.InstancedMesh;
  private cap: number;
  private count = 0;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array; // size0,size1 pairs
  private col: Float32Array; // c0 rgb, c1 rgb
  private grav: Float32Array;
  private drag: Float32Array;
  private alpha: Float32Array;
  private colorAttr: THREE.InstancedBufferAttribute;

  constructor(capacity: number, additive: boolean) {
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity * 2);
    this.col = new Float32Array(capacity * 6);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    const geo = new THREE.PlaneGeometry(1, 1);
    this.colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('pColor', this.colorAttr);
    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  emit(p: ParticleSpec) {
    let i = this.count;
    if (i >= this.cap) i = Math.floor(Math.random() * this.cap);
    else this.count++;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = p.vx; this.vel[i * 3 + 1] = p.vy; this.vel[i * 3 + 2] = p.vz;
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.size[i * 2] = p.size0; this.size[i * 2 + 1] = p.size1;
    this.col[i * 6] = p.c0[0]; this.col[i * 6 + 1] = p.c0[1]; this.col[i * 6 + 2] = p.c0[2];
    this.col[i * 6 + 3] = p.c1[0]; this.col[i * 6 + 4] = p.c1[1]; this.col[i * 6 + 5] = p.c1[2];
    this.grav[i] = p.grav;
    this.drag[i] = p.drag;
    this.alpha[i] = p.alpha;
  }

  private copy(from: number, to: number) {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
    }
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.size[to * 2] = this.size[from * 2];
    this.size[to * 2 + 1] = this.size[from * 2 + 1];
    for (let k = 0; k < 6; k++) this.col[to * 6 + k] = this.col[from * 6 + k];
    this.grav[to] = this.grav[from];
    this.drag[to] = this.drag[from];
    this.alpha[to] = this.alpha[from];
  }

  update(dt: number) {
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const c = this.colorAttr.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.count--;
        if (i < this.count) this.copy(this.count, i);
        i--;
        continue;
      }
      const d = 1 - this.drag[i] * dt;
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      const s = this.size[i * 2] + (this.size[i * 2 + 1] - this.size[i * 2]) * t;
      const o = i * 16;
      m[o] = s; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
      m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
      m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = s; m[o + 11] = 0;
      m[o + 12] = this.pos[i * 3]; m[o + 13] = this.pos[i * 3 + 1]; m[o + 14] = this.pos[i * 3 + 2]; m[o + 15] = 1;
      const ci = i * 6;
      c[i * 4] = this.col[ci] + (this.col[ci + 3] - this.col[ci]) * t;
      c[i * 4 + 1] = this.col[ci + 1] + (this.col[ci + 4] - this.col[ci + 1]) * t;
      c[i * 4 + 2] = this.col[ci + 2] + (this.col[ci + 5] - this.col[ci + 2]) * t;
      c[i * 4 + 3] = this.alpha[i] * (1 - t * t);
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
