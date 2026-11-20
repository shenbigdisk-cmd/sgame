import * as THREE from 'three';
import { Collapse } from './collapse';
import { nearObstacles, obsDist, removeObstacle, type Obstacle } from './colliders';
import { enhanceObstacleMaterial } from './saltlineVisuals';

/** Sector-owned registry. Rubble stays in worldRoot for normal teardown. */
export class StructureField {
  readonly sites = new Map<Obstacle, { model: THREE.Group; hp: number; max: number; name: string }>();
  private falling: Collapse[] = [];
  private stone = new THREE.DodecahedronGeometry(1, 0);
  private patina: THREE.MeshStandardMaterial;
  private amber = new THREE.MeshStandardMaterial({ color: 0xddaa48, emissive: 0x503309, roughness: 0.8 });
  constructor(
    private obstacles: Obstacle[],
    private ground: (x: number, z: number) => number = () => 0,
  ) {
    this.patina = new THREE.MeshStandardMaterial({ color: 0x625d51, roughness: 0.96, flatShading: true });
    enhanceObstacleMaterial(this.patina, { wearAmount: 0.6, rustAmount: 0.5 });
  }
  register(o: Obstacle, model: THREE.Group, name: string, hp: number) {
    this.sites.set(o, { model, hp, max: hp, name });
    // A hazard collar distinguishes breachable cover on every approach.
    const band = new THREE.Mesh(
      new THREE.BoxGeometry((o.box?.hw ?? o.r) * 2 + 0.12, 0.36, (o.box?.hd ?? o.r) * 2 + 0.12),
      this.amber,
    );
    band.name = 'breach-band';
    band.position.y = Math.min(2.7, o.h * 0.7);
    model.add(band);
  }
  blast(pos: THREE.Vector3, radius: number, damage: number) {
    const hits: { o: Obstacle; remaining: number; name: string }[] = [];
    for (const o of nearObstacles(pos.x, pos.z, radius + 1)) {
      const site = this.sites.get(o);
      if (!site) continue;
      const d = Math.hypot(
        Math.max(0, obsDist(o, pos.x, pos.z)),
        Math.max(0, o.y0 - pos.y, pos.y - o.y0 - o.h),
      );
      if (d > radius) continue;
      site.hp = Math.max(0, site.hp - damage * (1 - (0.6 * d) / Math.max(1, radius)));
      hits.push({ o, name: site.name, remaining: Math.ceil((100 * site.hp) / site.max) });
      if (site.hp === 0) {
        this.sites.delete(o);
        removeObstacle(o, this.obstacles);
        this.falling.push(new Collapse(site.model, o, pos, this.stone, this.patina, this.ground));
      }
    }
    return hits;
  }
  animate(dt: number, dust?: (point: THREE.Vector3, scale: number) => void) {
    for (let i = this.falling.length - 1; i >= 0; i--)
      if (this.falling[i].step(dt, dust)) this.falling.splice(i, 1);
  }
}
