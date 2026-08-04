import * as THREE from 'three';

/**
 * Shared geometry constants for the looping L-hallway plus collision helpers.
 * The walkable space is the union of two rectangles (main corridor + the
 * perpendicular turn corridor). Kept dependency-free so every system agrees.
 */
export const LAYOUT = {
  wallH: 2.8,
  half: 1.0,          // walkable half-width (inner wall face)
  wallX: 1.05,        // wall centre offset
  // main corridor runs along Z
  mainZFront: 1.9,    // landing (behind spawn) inner face
  mainZBack: -11.9,   // far wall inner face
  // turn corridor runs along -X, occupying the far strip of Z
  turnZNear: -9.9,    // inner face of the near wall of the turn corridor
  turnXEnd: -10.9,    // inner face of the end-door wall
  eyeHeight: 1.62,
} as const;

export const SPAWN = new THREE.Vector3(0, LAYOUT.eyeHeight, 0.6);
export const SPAWN_YAW = 0; // 0 = looking toward -Z, down the corridor
export const DOOR_POS = new THREE.Vector3(-11, 0, -10.9);
export const DOOR_CENTER = new THREE.Vector3(-10.9, 1.0, -10.9);

/** Rect list making up the walkable floor (inner faces, before player radius). */
const RECTS = [
  // main corridor
  { xMin: -LAYOUT.half, xMax: LAYOUT.half, zMin: LAYOUT.mainZBack, zMax: LAYOUT.mainZFront },
  // turn corridor
  { xMin: LAYOUT.turnXEnd, xMax: LAYOUT.half, zMin: LAYOUT.mainZBack, zMax: LAYOUT.turnZNear },
];

/** Is a disc of `r` at (x,z) fully inside the walkable union? */
export function walkable(x: number, z: number, r = 0.32): boolean {
  return RECTS.some(
    (R) => x >= R.xMin + r && x <= R.xMax - r && z >= R.zMin + r && z <= R.zMax - r,
  );
}

/** Per-axis slide resolution: returns an allowed (x,z) near the target. */
export function resolveMove(fromX: number, fromZ: number, toX: number, toZ: number, r = 0.32): [number, number] {
  let x = fromX;
  let z = fromZ;
  if (walkable(toX, z, r)) x = toX;
  if (walkable(x, toZ, r)) z = toZ;
  return [x, z];
}

/** Progress along the path from spawn to the end door, 0..1 (for pacing/scares). */
export function pathProgress(x: number, z: number): number {
  // leg 1: z from mainZFront -> mainZBack ; leg 2: x from half -> turnXEnd
  const leg1 = THREE.MathUtils.clamp((LAYOUT.mainZFront - z) / (LAYOUT.mainZFront - LAYOUT.mainZBack), 0, 1);
  if (leg1 < 0.999) return leg1 * 0.6;
  const leg2 = THREE.MathUtils.clamp((LAYOUT.half - x) / (LAYOUT.half - LAYOUT.turnXEnd), 0, 1);
  return 0.6 + leg2 * 0.4;
}
