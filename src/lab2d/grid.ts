import { constants, type Vec2 } from "@/engine";

/**
 * The 2D bench grid: a direct pixel mapping of the engine's 9x4 half-integer cell grid
 * (`constants.GRID`). x grows right, y grows toward the viewer (rendered lower on screen), so a
 * burette one row back (y - 1) draws above the flask it feeds and its tip hangs into the
 * flask's cell.
 */
export const GRID = constants.GRID;

export const CELL_W = 148;
export const CELL_H = 188;

export const WORKSPACE_W = GRID.cols * CELL_W;
export const WORKSPACE_H = GRID.rows * CELL_H;

export interface XY {
  readonly x: number;
  readonly y: number;
}

/** Pixel center of a grid cell, in the bench workspace's local coordinate space. */
export function cellToPx(cell: Vec2): XY {
  return {
    x: (cell.x - GRID.minX + 0.5) * CELL_W,
    y: (cell.y - GRID.minY + 0.5) * CELL_H,
  };
}

/** Inverse of `cellToPx`: a (fractional) grid cell for a workspace-local pixel point. */
export function pxToCell(px: XY): Vec2 {
  return {
    x: px.x / CELL_W + GRID.minX - 0.5,
    y: px.y / CELL_H + GRID.minY - 0.5,
  };
}

/**
 * Where an attached instrument docks: at the container's right shoulder (the flask/beaker body
 * is centered in its cell and about 130px tall, so the shoulder sits roughly a third of the way
 * down from the vessel's rim), clear of a burette tip hanging in from behind.
 */
export function dockedInstrumentPx(containerCell: Vec2): XY {
  const c = cellToPx(containerCell);
  return { x: c.x + CELL_W / 2 - 6, y: c.y - CELL_H / 2 + 50 };
}

/**
 * Snaps a fractional grid coordinate to the nearest cell on the half-integer lattice (`-4.5,
 * -3.5, ...`), independent of bounds.
 */
function snapToLattice(value: number, min: number): number {
  return min + Math.round(value - min);
}

/** Clamps a snapped cell coordinate into the grid's bounds. */
function clampToGrid(cell: Vec2): Vec2 {
  const x = Math.min(GRID.minX + GRID.cols - 1, Math.max(GRID.minX, snapToLattice(cell.x, GRID.minX)));
  const y = Math.min(GRID.minY + GRID.rows - 1, Math.max(GRID.minY, snapToLattice(cell.y, GRID.minY)));
  return { x, y };
}

const cellKey = (cell: Vec2): string => `${cell.x},${cell.y}`;

/** The bench object shape `nearestFreeCell` needs: enough to check the hotplate/container exception. */
export interface GridOccupant {
  readonly id: string;
  readonly kind: "container" | "instrument";
  readonly type: string;
  readonly position: Vec2;
}

/**
 * Whether a container and an instrument may share one cell: only a hotplate under a container
 * (mirrors `engine/commands.ts`'s `canShareCell`, which is internal to the engine and not part
 * of the public API this UI reads from).
 */
type Kinded = Pick<GridOccupant, "kind" | "type">;

function canShareCell(a: Kinded, b: Kinded): boolean {
  const isHotplate = (o: Kinded): boolean => o.kind === "instrument" && o.type === "hotplate";
  return (a.kind === "container" && isHotplate(b)) || (b.kind === "container" && isHotplate(a));
}

/** Occupied cell keys for `moving`, given every other bench object. */
function occupiedCells(objects: ReadonlyArray<GridOccupant>, moving: Pick<GridOccupant, "id" | "kind" | "type">): ReadonlySet<string> {
  const occupied = new Set<string>();
  for (const o of objects) {
    if (o.id === moving.id) continue;
    if (canShareCell(o, moving)) continue;
    occupied.add(cellKey(o.position));
  }
  return occupied;
}

/**
 * Nearest free cell to `from` for `moving`, spiralling outward ring by ring and clamped to the
 * grid. A hotplate cell accepts a container on top (and vice versa); every other pairing blocks.
 */
export function nearestFreeCell(objects: ReadonlyArray<GridOccupant>, from: Vec2, moving: Pick<GridOccupant, "id" | "kind" | "type">): Vec2 {
  const occupied = occupiedCells(objects, moving);
  const start = clampToGrid(from);
  if (!occupied.has(cellKey(start))) return start;

  const maxRadius = GRID.cols + GRID.rows;
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const candidate: Vec2 = { x: start.x + dx, y: start.y + dy };
        if (candidate.x < GRID.minX || candidate.x > GRID.minX + GRID.cols - 1) continue;
        if (candidate.y < GRID.minY || candidate.y > GRID.minY + GRID.rows - 1) continue;
        if (!occupied.has(cellKey(candidate))) return candidate;
      }
    }
  }
  return start;
}
