import { constants, type ContainerType, type InstrumentType, type Vec2 } from "@/engine";
import { liquidSurfaceY, VESSEL_VIEWBOX, vesselFloorY } from "./glassware/liquid";
import { PH_METER_DOCK } from "./glassware/PHMeter";
import { THERMOMETER_DOCK } from "./glassware/Thermometer";
import type { InstrumentDockGeometry } from "./glassware/types";
import type { WorkspaceRect } from "./objectDom";

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

type InstrumentDockSide = "left" | "right";

/** Which shoulder each instrument type docks to, so the pH meter and thermometer never collide when both are attached to one container; the geometry `dockedInstrumentPose` needs to place it there; and the px width it renders at while docked (matches `INSTRUMENT_DOCKED_SIZE` in BenchObject.tsx). Only types with an entry here ever dock; a hotplate never does. */
const DOCK_SPEC: Readonly<Partial<Record<InstrumentType, { readonly side: InstrumentDockSide; readonly geometry: InstrumentDockGeometry; readonly sizePx: number }>>> = {
  ph_meter: { side: "right", geometry: PH_METER_DOCK, sizePx: 64 },
  thermometer: { side: "left", geometry: THERMOMETER_DOCK, sizePx: 44 },
};

export interface DockTargetContainer {
  readonly type: ContainerType;
  readonly volumeMl: number;
  readonly capacityMl: number;
}

export interface DockedInstrumentPose {
  /** Workspace-px point the instrument's own bounding box is centered on: its body/shoulder mount, fixed regardless of fill. */
  readonly bodyPx: XY;
  /**
   * Screen-px distance from the instrument's fixed rod/tube anchor down to where its tip belongs,
   * given the container's live fill. Feeds each instrument's `dockDepthPx` prop, which converts it
   * into its own viewBox units.
   */
  readonly tipDepthPx: number;
}

/** Clear of a burette tip hanging in from behind, and inset from the rim so the mount reads as sitting on the vessel, not floating off its edge. */
const DOCK_MARGIN_X = 10;
const DOCK_BODY_INSET_Y = 16;
/**
 * How far below the liquid surface a probe tip rests, and how far above the floor an empty
 * vessel's tip rests. A few px past the geometric minimum: a probe's own bulb has some radius, so
 * resting it exactly on the surface would only half-submerge it.
 */
const TIP_LIQUID_MARGIN = 10;
const TIP_FLOOR_MARGIN = 8;

/**
 * Where an instrument docks on a container: the body/shoulder mount is a fixed point near the
 * rim (left for the thermometer, right for the pH meter), independent of fill, so it never jumps
 * as the liquid level changes. The tip depth is derived from the live liquid surface (or the
 * cavity floor when the vessel is empty), so the probe or bulb visibly sits in the liquid at any
 * fill level, for any vessel type. Null for an instrument type that never docks (a hotplate).
 *
 * `containerBodyPx` is the container's own `<svg>` art measured live (`objectBodyPx` in
 * objectDom.ts), not derived from its cell position: a container's rendered box includes its
 * caption below the glass (present or not, and sometimes wider than a narrow vessel), which an
 * analytic cell-to-box calculation cannot see. Measuring it directly is what keeps the probe's
 * tip pinned to the vessel's true rim and floor at every fill level.
 */
export function dockedInstrumentPose(container: DockTargetContainer, containerBodyPx: WorkspaceRect, instrumentType: InstrumentType): DockedInstrumentPose | null {
  const spec = DOCK_SPEC[instrumentType];
  if (!spec) return null;

  const declared = VESSEL_VIEWBOX[container.type];
  const scaleY = containerBodyPx.height / declared.height;

  const bodyPx: XY = {
    x: spec.side === "right" ? containerBodyPx.left + containerBodyPx.width - DOCK_MARGIN_X : containerBodyPx.left + DOCK_MARGIN_X,
    y: containerBodyPx.top + DOCK_BODY_INSET_Y * scaleY,
  };

  const tipLocalY =
    container.volumeMl > 0
      ? liquidSurfaceY(container.type, container.volumeMl, container.capacityMl) + TIP_LIQUID_MARGIN
      : vesselFloorY(container.type) - TIP_FLOOR_MARGIN;
  const tipScreenY = containerBodyPx.top + tipLocalY * scaleY;

  const instrumentScale = spec.sizePx / spec.geometry.viewBoxWidth;
  const anchorScreenY = bodyPx.y - (spec.geometry.viewBoxHeight / 2) * instrumentScale + spec.geometry.anchorY * instrumentScale;

  return { bodyPx, tipDepthPx: tipScreenY - anchorScreenY };
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
