/**
 * Public surface of the world generator.
 *
 * `layout` describes the seeded skeleton of a sector, `colliders` stores the
 * static props and `mapBuilder` dresses the arena. This module simply
 * re-exports the pieces the game engine needs.
 */

export {
  MAX_ZONE,
  START_RADIUS,
  WORLD_RADIUS,
  ZONE_STEP,
  districtAt,
  generateLayout,
  heightAt,
  inWater,
  zoneRadius,
} from './layout';
export type { District, DistrictType, Layout, Theme } from './layout';
export { randomSeedCode, seedFromString } from './rng';
export { nearObstacles, obsCorners, obsDist, obsResolve } from './colliders';
export type { Obstacle } from './colliders';
export { buildMap } from './mapBuilder';
export type { ExplosiveBarrel, MapResult } from './mapBuilder';
