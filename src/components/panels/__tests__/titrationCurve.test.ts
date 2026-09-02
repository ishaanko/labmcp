import { describe, expect, it } from "vitest";
import type { CurvePoint } from "@/engine";
import { curvePath } from "../TitrationCurve";

const point = (titrantMl: number, pH: number | null): CurvePoint => ({ titrantMl, pH, clockS: titrantMl });

describe("curvePath", () => {
  it("returns an empty string with no points that have a pH reading", () => {
    expect(curvePath([point(1, null), point(2, null)], 268, 140, 30)).toBe("");
  });

  it("starts with M and draws one L per remaining point, skipping null pH readings", () => {
    const d = curvePath([point(0, 2), point(5, null), point(10, 12)], 268, 140, 30);
    const commands = d.split(" ");
    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatch(/^M/);
    expect(commands[1]).toMatch(/^L/);
  });

  it("clamps titrant volumes past xMax to the right edge instead of drawing off-canvas", () => {
    const withinRange = curvePath([point(30, 7)], 268, 140, 30);
    const overRange = curvePath([point(60, 7)], 268, 140, 30);
    expect(withinRange).toBe(overRange);
  });

  it("maps pH 0 to the bottom of the plot and pH 14 to the top", () => {
    const width = 268;
    const height = 140;
    const low = curvePath([point(0, 0)], width, height, 30);
    const high = curvePath([point(0, 14)], width, height, 30);
    const yOf = (d: string): number => Number(d.slice(1).split(",")[1]);
    expect(yOf(low)).toBeGreaterThan(yOf(high));
    expect(yOf(low)).toBeCloseTo(height - 16, 0);
  });
});
