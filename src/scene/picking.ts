import * as THREE from "three";

/**
 * Raycasting and grid-occupancy helpers shared by pointer interactions (C4): projecting a
 * pointer onto the bench's ground plane, finding a free cell to drop into, and softening a
 * dragged object's position past the grid bounds.
 */

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * Casts a ray from `camera` through normalized device coordinates `ndc` and intersects the
 * bench's ground plane (y = 0). Returns `null` when the ray is parallel to the plane.
 */
export function raycastGroundPlane(camera: THREE.Camera, ndc: THREE.Vector2, out = new THREE.Vector3()): THREE.Vector3 | null {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(GROUND_PLANE, out);
}

export interface GridCell {
  readonly x: number;
  readonly y: number;
}

export function cellKey(cell: GridCell): string {
  return `${cell.x},${cell.y}`;
}

export interface GridBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Snaps `value` to the nearest cell on a lattice spaced 1 apart starting at `min` (the titration
 * layout's columns sit at -4.5, -3.5, ..., so plain `Math.round` would misalign them: `-4.5`
 * rounds to `-4`, one cell in the middle of nowhere).
 */
function snapToLattice(value: number, min: number): number {
  return min + Math.round(value - min);
}

/**
 * Finds the nearest unoccupied cell to `from`, spiralling outward ring by ring and clamped to
 * `bounds`. Used when a dropped object's target cell is already taken.
 */
export function nearestFreeCell(occupied: ReadonlySet<string>, from: GridCell, bounds: GridBounds): GridCell {
  const start: GridCell = {
    x: snapToLattice(Math.min(bounds.maxX, Math.max(bounds.minX, from.x)), bounds.minX),
    y: snapToLattice(Math.min(bounds.maxY, Math.max(bounds.minY, from.y)), bounds.minY),
  };
  if (!occupied.has(cellKey(start))) return start;

  const maxRadius = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) + 1;
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const candidate: GridCell = { x: start.x + dx, y: start.y + dy };
        if (candidate.x < bounds.minX || candidate.x > bounds.maxX) continue;
        if (candidate.y < bounds.minY || candidate.y > bounds.maxY) continue;
        if (!occupied.has(cellKey(candidate))) return candidate;
      }
    }
  }
  return start;
}

/**
 * iOS-style rubber-band: eases a raw overshoot `x` past a boundary into a diminishing-returns
 * displacement, so a drag past the grid edge visibly resists rather than teleporting the object
 * beyond the bench (C1 `damp.snap`-adjacent, C4.2). `dim` is a reference distance (how far one
 * more grid cell would read) and `coeff` (0..1) sets how much of `x` still shows through as it
 * grows; `coeff 0.55` keeps the response fairly stiff near the edge, per the design tokens.
 */
export function rubberband(x: number, dim: number, coeff: number): number {
  if (x === 0) return 0;
  const sign = Math.sign(x);
  const magnitude = Math.abs(x);
  return sign * (1 - 1 / (magnitude * coeff / dim + 1)) * dim;
}

/** Softens `value` back toward `[min, max]` with `rubberband` once it strays past either edge. */
export function rubberbandClamp(value: number, min: number, max: number, dim: number, coeff: number): number {
  if (value > max) return max + rubberband(value - max, dim, coeff);
  if (value < min) return min - rubberband(min - value, dim, coeff);
  return value;
}
