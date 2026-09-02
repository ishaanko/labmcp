import { describe, expect, it } from "vitest";
import { CELL_H, CELL_W, GRID, cellToPx, nearestFreeCell, pxToCell, type GridOccupant } from "../grid";

describe("cellToPx / pxToCell", () => {
  it("centers the back-left cell (grid minimum) at half a cell in from the workspace origin", () => {
    expect(cellToPx({ x: GRID.minX, y: GRID.minY })).toEqual({ x: CELL_W / 2, y: CELL_H / 2 });
  });

  it("places a larger y (closer to the viewer) lower on screen", () => {
    const back = cellToPx({ x: 0, y: GRID.minY });
    const front = cellToPx({ x: 0, y: GRID.minY + 1 });
    expect(front.y).toBeGreaterThan(back.y);
  });

  it("round-trips a cell through pxToCell", () => {
    const cell = { x: -1.5, y: 0.5 };
    expect(pxToCell(cellToPx(cell))).toEqual(cell);
  });
});

describe("nearestFreeCell", () => {
  const container = (id: string, position: { x: number; y: number }): GridOccupant => ({ id, kind: "container", type: "beaker", position });
  const hotplate = (id: string, position: { x: number; y: number }): GridOccupant => ({ id, kind: "instrument", type: "hotplate", position });

  it("returns the target cell when it is free", () => {
    expect(nearestFreeCell([], { x: 0.5, y: 0.5 }, { id: "new", kind: "container", type: "beaker" })).toEqual({ x: 0.5, y: 0.5 });
  });

  it("spirals to the nearest open cell when the target is occupied", () => {
    const objects = [container("a", { x: 0.5, y: 0.5 })];
    const free = nearestFreeCell(objects, { x: 0.5, y: 0.5 }, { id: "b", kind: "container", type: "beaker" });
    expect(free).not.toEqual({ x: 0.5, y: 0.5 });
    // The nearest ring by Chebyshev distance (a spiral checks diagonals before further axis cells).
    expect(Math.max(Math.abs(free.x - 0.5), Math.abs(free.y - 0.5))).toBe(1);
  });

  it("lets a container share a hotplate's cell", () => {
    const objects = [hotplate("hp", { x: 1.5, y: 0.5 })];
    const free = nearestFreeCell(objects, { x: 1.5, y: 0.5 }, { id: "beaker", kind: "container", type: "beaker" });
    expect(free).toEqual({ x: 1.5, y: 0.5 });
  });

  it("does not let a second instrument share a hotplate's cell", () => {
    const objects = [hotplate("hp", { x: 1.5, y: 0.5 })];
    const free = nearestFreeCell(objects, { x: 1.5, y: 0.5 }, { id: "thermo", kind: "instrument", type: "thermometer" });
    expect(free).not.toEqual({ x: 1.5, y: 0.5 });
  });

  it("clamps out-of-bounds targets onto the grid", () => {
    const free = nearestFreeCell([], { x: 100, y: -100 }, { id: "new", kind: "container", type: "beaker" });
    expect(free.x).toBeLessThanOrEqual(GRID.minX + GRID.cols - 1);
    expect(free.y).toBeGreaterThanOrEqual(GRID.minY);
  });
});
