/**
 * The bench grid: which equipment types live in a cell, and which cells are free. Split out of
 * commands.ts (its only prior home) to keep both files under the 400-line budget; commands.ts's
 * `validate()` and physical.ts's free-cell scan both depend on it.
 */
import { GRID } from "./constants";
import { assertNever, type Container, type EquipmentType, type LabObject, type LabState, type Vec2 } from "./types";

export function isContainerObjectType(t: EquipmentType): t is Container["type"] {
  switch (t) {
    case "beaker":
    case "flask":
    case "test_tube":
    case "graduated_cylinder":
    case "burette":
      return true;
    case "ph_meter":
    case "thermometer":
    case "hotplate":
      return false;
    default:
      return assertNever(t);
  }
}

/** A hotplate and a container may share a cell (a container placed on a hotplate); no other pair may. */
function canShareCell(occupant: LabObject, incoming: EquipmentType): boolean {
  if (occupant.kind === "instrument" && occupant.type === "hotplate") return isContainerObjectType(incoming);
  if (occupant.kind === "container" && incoming === "hotplate") return true;
  return false;
}

export function isOnGrid(position: Vec2): boolean {
  const col = position.x - GRID.minX;
  const row = position.y - GRID.minY;
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < GRID.cols && row >= 0 && row < GRID.rows;
}

/** Whether `objectType` could be placed at `position`: on-grid, and not blocked by an occupant it can't share the cell with. */
export function isSlotFree(state: LabState, position: Vec2, objectType: EquipmentType): boolean {
  if (!isOnGrid(position)) return false;
  return !state.objects.some((o) => o.position.x === position.x && o.position.y === position.y && !canShareCell(o, objectType));
}

/** True once no bench cell is free for `objectType`, scanning the whole grid. */
export function hasFreeCell(state: LabState, objectType: EquipmentType): boolean {
  for (let row = 0; row < GRID.rows; row++) {
    for (let col = 0; col < GRID.cols; col++) {
      if (isSlotFree(state, { x: GRID.minX + col, y: GRID.minY + row }, objectType)) return true;
    }
  }
  return false;
}
