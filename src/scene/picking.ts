import * as THREE from "three";

/**
 * Raycasting and grid-occupancy helpers shared by pointer interactions (C4). This phase does
 * not wire up dragging yet, so only the primitives the drag phase will need are here:
 * projecting a pointer onto the bench's ground plane, and finding a free cell to drop into.
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
 * Finds the nearest unoccupied integer cell to `from`, spiralling outward ring by ring and
 * clamped to `bounds`. Used when a dropped object's target cell is already taken.
 */
export function nearestFreeCell(occupied: ReadonlySet<string>, from: GridCell, bounds: GridBounds): GridCell {
  const start: GridCell = {
    x: Math.round(Math.min(bounds.maxX, Math.max(bounds.minX, from.x))),
    y: Math.round(Math.min(bounds.maxY, Math.max(bounds.minY, from.y))),
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
