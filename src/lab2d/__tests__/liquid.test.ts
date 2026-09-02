import { describe, expect, it } from "vitest";
import { BURETTE_GEOMETRY, VESSEL_GEOMETRY, buretteFill, clampAlpha, fillFraction, liquidRect, mixWithWhite, vibrant } from "../glassware/liquid";

describe("fillFraction", () => {
  it("clamps to 0..1 and treats zero capacity as empty", () => {
    expect(fillFraction(50, 100)).toBe(0.5);
    expect(fillFraction(-10, 100)).toBe(0);
    expect(fillFraction(150, 100)).toBe(1);
    expect(fillFraction(50, 0)).toBe(0);
  });
});

describe("liquidRect", () => {
  it("is bottom-anchored: fixed floor, rising surface as volume grows", () => {
    const geo = VESSEL_GEOMETRY.beaker;
    const empty = liquidRect("beaker", 0, 200);
    expect(empty.height).toBe(0);
    expect(empty.y).toBe(geo.bottomY);

    const full = liquidRect("beaker", 200, 200);
    expect(full.y).toBe(geo.topY);
    expect(full.height).toBe(geo.bottomY - geo.topY);

    const half = liquidRect("beaker", 100, 200);
    expect(half.height).toBeCloseTo((geo.bottomY - geo.topY) / 2, 5);
    expect(half.y).toBeCloseTo(geo.bottomY - half.height, 5);
  });
});

describe("buretteFill", () => {
  it("reads top-down: a full burette's surface sits at the rim, an empty one has no visible column", () => {
    const full = buretteFill(50, 50);
    expect(full.y).toBe(BURETTE_GEOMETRY.topY);
    expect(full.height).toBe(BURETTE_GEOMETRY.bottomY - BURETTE_GEOMETRY.topY);

    const empty = buretteFill(0, 50);
    expect(empty.height).toBe(0);
    expect(empty.y).toBe(BURETTE_GEOMETRY.bottomY);

    const partial = buretteFill(12.5, 50);
    expect(partial.height).toBeCloseTo((BURETTE_GEOMETRY.bottomY - BURETTE_GEOMETRY.topY) * 0.25, 5);
  });
});

describe("clampAlpha", () => {
  it("floors low alpha so liquids read on black, but leaves higher alpha untouched", () => {
    expect(clampAlpha("rgba(10, 20, 30, 0.1)", 0.55)).toBe("rgba(10, 20, 30, 0.55)");
    expect(clampAlpha("rgba(10, 20, 30, 0.8)", 0.55)).toBe("rgba(10, 20, 30, 0.8)");
  });

  it("treats a missing alpha channel as fully opaque", () => {
    expect(clampAlpha("rgb(10, 20, 30)", 0.55)).toBe("rgba(10, 20, 30, 1)");
  });

  it("passes through strings it can't parse", () => {
    expect(clampAlpha("not-a-color", 0.55)).toBe("not-a-color");
  });
});

describe("mixWithWhite", () => {
  it("blends toward white by the given amount, keeping alpha", () => {
    expect(mixWithWhite("rgba(0, 0, 0, 0.6)", 0.5)).toBe("rgba(128, 128, 128, 0.6)");
    expect(mixWithWhite("rgba(100, 150, 200, 1)", 0)).toBe("rgba(100, 150, 200, 1)");
  });
});

describe("vibrant", () => {
  it("floors alpha at 0.85 and boosts a dull color's saturation and lightness into range", () => {
    const result = vibrant("rgba(90, 130, 170, 0.3)");
    const match = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(result);
    expect(match).not.toBeNull();
    const [, r, g, b, a] = match as unknown as [string, string, string, string, string];
    expect(Number.parseFloat(a)).toBeCloseTo(0.85, 5);
    // Boosted saturation and clamped lightness should visibly separate the channels more than the input did.
    const spread = Math.max(Number(r), Number(g), Number(b)) - Math.min(Number(r), Number(g), Number(b));
    expect(spread).toBeGreaterThan(80 - 60); // wider than the input's 80 vs. 60 gap once saturated
  });

  it("leaves alpha alone when it is already above the floor", () => {
    const result = vibrant("rgba(255, 0, 0, 0.95)");
    expect(result).toMatch(/, 0\.95\)$/);
  });

  it("holds the phenolphthalein endpoint pink exactly, only flooring its alpha", () => {
    expect(vibrant("rgba(242, 111, 176, 0.4)")).toBe("rgba(242, 111, 176, 0.85)");
    expect(vibrant("rgba(242, 111, 176, 0.95)")).toBe("rgba(242, 111, 176, 0.95)");
  });

  it("passes through strings it can't parse", () => {
    expect(vibrant("not-a-color")).toBe("not-a-color");
  });
});
