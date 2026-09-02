import { describe, expect, it } from "vitest";
import { cellKey, nearestFreeCell, rubberband, rubberbandClamp, type GridBounds } from "../picking";

const BOUNDS: GridBounds = { minX: -4.5, maxX: 3.5, minY: -1.5, maxY: 1.5 };

describe("nearestFreeCell", () => {
  it("returns the clamped starting cell when it is free", () => {
    const cell = nearestFreeCell(new Set(), { x: -2.5, y: -0.5 }, BOUNDS);
    expect(cell).toEqual({ x: -2.5, y: -0.5 });
  });

  it("snaps a half-integer grid correctly instead of rounding toward zero", () => {
    // Math.round(-4.5) is -4 in JS, one cell short of the actual leftmost column; the titration
    // layout's burette sits exactly on this edge, so this is the framing bug in miniature.
    const cell = nearestFreeCell(new Set(), { x: -4.5, y: -1.5 }, BOUNDS);
    expect(cell).toEqual({ x: -4.5, y: -1.5 });
  });

  it("clamps an out-of-bounds point to the nearest edge cell before searching", () => {
    const cell = nearestFreeCell(new Set(), { x: 10, y: -1.5 }, BOUNDS);
    expect(cell).toEqual({ x: 3.5, y: -1.5 });
  });

  it("spirals to the nearest free neighbour when the target cell is occupied", () => {
    const occupied = new Set([cellKey({ x: -0.5, y: 0.5 })]);
    const cell = nearestFreeCell(occupied, { x: -0.5, y: 0.5 }, BOUNDS);
    expect(occupied.has(cellKey(cell))).toBe(false);
    // Adjacent, not clear across the bench: the spiral's first ring is every cell one step away.
    expect(Math.max(Math.abs(cell.x - -0.5), Math.abs(cell.y - 0.5))).toBe(1);
  });

  it("keeps spiralling outward past a fully occupied first ring", () => {
    const center = { x: -0.5, y: 0.5 };
    const occupied = new Set<string>([cellKey(center)]);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        occupied.add(cellKey({ x: center.x + dx, y: center.y + dy }));
      }
    }
    const cell = nearestFreeCell(occupied, center, BOUNDS);
    expect(occupied.has(cellKey(cell))).toBe(false);
    expect(Math.max(Math.abs(cell.x - center.x), Math.abs(cell.y - center.y))).toBe(2);
  });

  it("falls back to the clamped start when every cell in bounds is occupied", () => {
    const occupied = new Set<string>();
    for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x++) {
      for (let y = BOUNDS.minY; y <= BOUNDS.maxY; y++) occupied.add(cellKey({ x, y }));
    }
    const cell = nearestFreeCell(occupied, { x: 0.5, y: 0.5 }, BOUNDS);
    expect(cell).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("rubberband", () => {
  it("passes zero through unchanged", () => {
    expect(rubberband(0, 1, 0.55)).toBe(0);
  });

  it("preserves sign", () => {
    expect(rubberband(2, 1, 0.55)).toBeGreaterThan(0);
    expect(rubberband(-2, 1, 0.55)).toBeLessThan(0);
  });

  it("resists more than it transmits: output magnitude is always less than input past the edge", () => {
    for (const raw of [0.1, 0.5, 1, 2, 5, 20]) {
      expect(Math.abs(rubberband(raw, 1, 0.55))).toBeLessThan(raw);
    }
  });

  it("has diminishing returns as the overshoot grows", () => {
    const small = rubberband(1, 1, 0.55);
    const large = rubberband(10, 1, 0.55);
    // A 10x bigger overshoot reads as much less than 10x further on screen.
    expect(large / small).toBeLessThan(3);
  });
});

describe("rubberbandClamp", () => {
  it("leaves values inside the range untouched", () => {
    expect(rubberbandClamp(0, -1, 1, 1, 0.55)).toBe(0);
    expect(rubberbandClamp(1, -1, 1, 1, 0.55)).toBe(1);
  });

  it("softens a value past the max instead of clamping it flat", () => {
    const result = rubberbandClamp(2.5, -1, 1, 1, 0.55);
    expect(result).toBeGreaterThan(1);
    expect(result).toBeLessThan(2.5);
  });

  it("softens a value past the min symmetrically", () => {
    const result = rubberbandClamp(-2.5, -1, 1, 1, 0.55);
    expect(result).toBeLessThan(-1);
    expect(result).toBeGreaterThan(-2.5);
  });
});
