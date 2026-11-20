import * as THREE from 'three';
import type { HudFloater } from './types';

/**
 * Floating combat readouts ("damage numbers").
 *
 * Hits on the same target inside a short window merge into a single readout so
 * sustained fire on a big chassis produces one climbing number instead of a
 * blizzard of overlapping sprites. The system only owns plain data: positions
 * are anchored in world space and projected to screen fractions on demand, so
 * the HUD can re-project whenever it samples the simulation.
 */

export type { HudFloater };

type FloaterKind = HudFloater['kind'];

interface Floater {
  id: number;
  /** identity of the unit the damage was dealt to; null for unbound readouts */
  target: object | null;
  pos: THREE.Vector3;
  /** accumulated damage for merged hit readouts */
  value: number;
  text: string;
  kind: FloaterKind;
  crit: boolean;
  age: number;
  maxAge: number;
}

const MAX_FLOATERS = 16;
const MERGE_WINDOW = 0.4;
const HIT_MAX_AGE = 0.9;
const CRIT_MAX_AGE = 1.15;
const SCORE_MAX_AGE = 1.5;
/** metres the readout climbs into the air over its lifetime */
const RISE = 2.1;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const formatDamage = (v: number) => `${Math.max(1, Math.round(v))}`;

export class Floaters {
  private items: Floater[] = [];
  private nextId = 1;
  private readonly scratch = new THREE.Vector3();
  /** horizontal jitter so concurrent readouts do not stack perfectly */
  private jitter(): number {
    return (Math.random() - 0.5) * 1.6;
  }

  /** Record damage dealt to a unit; rapid hits on the same target merge. */
  addDamage(target: object, at: THREE.Vector3, amount: number, crit: boolean) {
    if (!(amount > 0)) return;
    const merged = this.items.find((f) => f.kind !== 'score' && f.target === target && f.age < MERGE_WINDOW);
    if (merged) {
      merged.value += amount;
      merged.crit = merged.crit || crit;
      merged.kind = merged.crit ? 'crit' : 'hit';
      merged.text = formatDamage(merged.value);
      merged.age = 0;
      merged.maxAge = merged.crit ? CRIT_MAX_AGE : HIT_MAX_AGE;
      return;
    }
    this.push({
      id: this.nextId++,
      target,
      pos: new THREE.Vector3(at.x + this.jitter(), at.y, at.z + this.jitter()),
      value: amount,
      text: formatDamage(amount),
      kind: crit ? 'crit' : 'hit',
      crit,
      age: 0,
      maxAge: crit ? CRIT_MAX_AGE : HIT_MAX_AGE,
    });
  }

  /** Gold readout for banked score (kills, bonuses). Streak is shown inline. */
  addScore(at: THREE.Vector3, amount: number, streak = 1) {
    if (!(amount > 0)) return;
    this.push({
      id: this.nextId++,
      target: null,
      pos: new THREE.Vector3(at.x + this.jitter(), at.y + 0.4, at.z + this.jitter()),
      value: amount,
      text: streak > 1 ? `+${Math.round(amount)} ×${streak}` : `+${Math.round(amount)}`,
      kind: 'score',
      crit: false,
      age: 0,
      maxAge: SCORE_MAX_AGE,
    });
  }

  update(dt: number) {
    for (const f of this.items) f.age += dt;
    if (this.items.some((f) => f.age >= f.maxAge)) {
      this.items = this.items.filter((f) => f.age < f.maxAge);
    }
  }

  clear() {
    this.items = [];
  }

  /** Project every live readout into 0..1 screen fractions for the HUD. */
  project(camera: THREE.Camera): HudFloater[] {
    const out: HudFloater[] = [];
    for (const f of this.items) {
      const p = this.scratch.copy(f.pos);
      p.y += (f.age / f.maxAge) * RISE;
      p.project(camera);
      // z > 1 means the point sits behind the view plane
      if (p.z > 1) continue;
      out.push({
        id: f.id,
        x: clamp01((p.x + 1) / 2),
        y: clamp01((1 - p.y) / 2),
        text: f.text,
        kind: f.kind,
        age: f.age,
        maxAge: f.maxAge,
      });
    }
    return out;
  }

  get size() {
    return this.items.length;
  }

  private push(f: Floater) {
    if (this.items.length >= MAX_FLOATERS) {
      // evict the oldest non-score readout first so fresh kills stay visible
      let idx = -1;
      for (let i = 0; i < this.items.length; i++) {
        if (this.items[i].kind !== 'score') {
          idx = i;
          break;
        }
      }
      this.items.splice(idx === -1 ? 0 : idx, 1);
    }
    this.items.push(f);
  }
}
