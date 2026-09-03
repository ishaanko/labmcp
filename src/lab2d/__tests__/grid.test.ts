import { describe, expect, it } from "vitest";
import { CELL_H, CELL_W, GRID, cellToPx, dockedInstrumentPose, nearestFreeCell, pxToCell, type GridOccupant } from "../grid";

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

describe("dockedInstrumentPose", () => {
  // A beaker's own declared viewBox (108x130, see VESSEL_VIEWBOX in liquid.ts), positioned as if measured at its cell.
  const bodyRect = { left: 100, top: 200, width: 108, height: 130 };
  const beaker = (volumeMl: number) => ({ type: "beaker" as const, volumeMl, capacityMl: 200 });

  it("returns null for a hotplate, which never docks", () => {
    expect(dockedInstrumentPose(beaker(100), bodyRect, "hotplate")).toBeNull();
  });

  it("docks the pH meter to the right shoulder and the thermometer to the left, so both fit on one container", () => {
    const center = bodyRect.left + bodyRect.width / 2;
    const ph = dockedInstrumentPose(beaker(100), bodyRect, "ph_meter");
    const thermo = dockedInstrumentPose(beaker(100), bodyRect, "thermometer");
    expect(ph?.bodyPx.x).toBeGreaterThan(center);
    expect(thermo?.bodyPx.x).toBeLessThan(center);
    expect(ph?.bodyPx.x).toBeGreaterThan(thermo?.bodyPx.x ?? 0);
  });

  it("keeps the body mount fixed regardless of fill, so it never jumps as the liquid level changes", () => {
    const shallow = dockedInstrumentPose(beaker(10), bodyRect, "ph_meter");
    const full = dockedInstrumentPose(beaker(190), bodyRect, "ph_meter");
    expect(shallow?.bodyPx).toEqual(full?.bodyPx);
  });

  it("shortens the tip's reach as the container fills, since a higher surface needs less rod", () => {
    const shallow = dockedInstrumentPose(beaker(10), bodyRect, "ph_meter");
    const full = dockedInstrumentPose(beaker(190), bodyRect, "ph_meter");
    expect(shallow?.tipDepthPx).toBeGreaterThan(full?.tipDepthPx ?? 0);
  });

  it("reaches down to the cavity floor, not the rim, when the vessel is empty", () => {
    const empty = dockedInstrumentPose(beaker(0), bodyRect, "thermometer");
    const nearlyEmpty = dockedInstrumentPose(beaker(5), bodyRect, "thermometer");
    expect(empty?.tipDepthPx).toBeGreaterThan(0);
    expect(nearlyEmpty?.tipDepthPx).toBeGreaterThan(0);
  });

  it("scales the tip and mount to a body rect measured larger than the declared viewBox (e.g. a momentary hover pop)", () => {
    const grown = { left: 100, top: 200, width: 108 * 1.02, height: 130 * 1.02 };
    const base = dockedInstrumentPose(beaker(50), bodyRect, "ph_meter");
    const scaled = dockedInstrumentPose(beaker(50), grown, "ph_meter");
    expect(scaled?.tipDepthPx).toBeGreaterThan(base?.tipDepthPx ?? 0);
  });
});
