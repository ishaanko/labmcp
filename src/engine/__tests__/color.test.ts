import { describe, expect, it } from "vitest";
import { colorDistance, deriveColor, describeColor, indicatorBand } from "../color";
import { mintIndicatorId } from "../ids";
import { approx, containerWith, makeContainer } from "./helpers";

const phenolphthalein = mintIndicatorId("phenolphthalein");
const universal = mintIndicatorId("universal");
const litmus = mintIndicatorId("litmus");

describe("indicator colors", () => {
  it("phenolphthalein is colorless at pH 7 and near-full pink by pH 10", () => {
    const neutral = deriveColor(makeContainer({ volumeMl: 100, indicators: [{ indicator: phenolphthalein, drops: 2 }] }));
    const plain = deriveColor(makeContainer({ volumeMl: 100 }));
    // At pH 7 the dye contributes zero alpha, so the color should equal the untinted base liquid.
    expect(approx(neutral.a, plain.a, 1e-6)).toBe(true);

    const basic = deriveColor(
      makeContainer({
        volumeMl: 100,
        species: containerWith("naoh", 100, 1e-4).species,
        indicators: [{ indicator: phenolphthalein, drops: 2 }],
      }),
    );
    expect(basic.a).toBeGreaterThan(0.6);
  });

  it("universal reads green near pH 7 and red at pH 1", () => {
    const neutral = deriveColor(makeContainer({ volumeMl: 100, indicators: [{ indicator: universal, drops: 2 }] }));
    expect(approx(neutral.r, 60, 40)).toBe(true);
    expect(neutral.g).toBeGreaterThan(neutral.r);

    const acidic = deriveColor(
      makeContainer({
        volumeMl: 100,
        species: containerWith("hcl", 100, 0.1).species,
        indicators: [{ indicator: universal, drops: 2 }],
      }),
    );
    expect(acidic.r).toBeGreaterThan(acidic.b);
  });

  it("litmus flips from red to blue across pH 7", () => {
    const acidic = deriveColor(
      makeContainer({
        volumeMl: 100,
        species: containerWith("hcl", 100, 0.001).species,
        indicators: [{ indicator: litmus, drops: 2 }],
      }),
    );
    const basic = deriveColor(
      makeContainer({
        volumeMl: 100,
        species: containerWith("naoh", 100, 0.001).species,
        indicators: [{ indicator: litmus, drops: 2 }],
      }),
    );
    expect(acidic.r).toBeGreaterThan(acidic.b);
    expect(basic.b).toBeGreaterThan(basic.r);
  });

  it("indicatorBand crosses at the endpoint", () => {
    expect(indicatorBand(phenolphthalein, 7)).toBe(0);
    expect(indicatorBand(phenolphthalein, 9)).toBe(1);
    expect(indicatorBand(phenolphthalein, 11)).toBe(2);
    expect(indicatorBand(litmus, 6.9)).toBe(0);
    expect(indicatorBand(litmus, 7.1)).toBe(1);
  });
});

describe("liquid tint", () => {
  it("0.1 M Cu2+ reads a strongly tinted blue", () => {
    const c = containerWith("cuso4", 100, 0.1);
    const color = deriveColor(c);
    expect(color.a).toBeGreaterThanOrEqual(0.75);
    expect(color.b).toBeGreaterThan(color.r);
  });
});

describe("colorDistance / describeColor", () => {
  it("is zero for identical colors and positive for a visible shift", () => {
    const a = { r: 200, g: 225, b: 240, a: 0.12 };
    expect(colorDistance(a, a)).toBe(0);
    const b = { r: 236, g: 64, b: 160, a: 0.5 };
    expect(colorDistance(a, b)).toBeGreaterThan(0.04);
  });

  it("describes near-zero alpha as colorless", () => {
    expect(describeColor({ r: 200, g: 225, b: 240, a: 0.02 })).toBe("colorless");
  });

  it("prefixes faint for low-alpha tints", () => {
    expect(describeColor({ r: 40, g: 120, b: 220, a: 0.2 })).toBe("faint blue");
  });

  it("reads plain water and untinted solutions as colorless, not faint yellow", () => {
    expect(describeColor(deriveColor(makeContainer({ volumeMl: 50 })))).toBe("colorless");
    expect(describeColor(deriveColor(containerWith("nacl", 50, 0.1)))).toBe("colorless");
  });
});

describe("indicator dose scales with concentration, not absolute drops", () => {
  it("transferring liquid leaves both halves at the same intensity", () => {
    const source = deriveColor(
      makeContainer({
        volumeMl: 60,
        species: containerWith("naoh", 60, 0.1).species,
        indicators: [{ indicator: phenolphthalein, drops: 2 }],
      }),
    );
    const halfVolume = deriveColor(
      makeContainer({
        volumeMl: 30,
        species: containerWith("naoh", 30, 0.1).species,
        indicators: [{ indicator: phenolphthalein, drops: 1 }],
      }),
    );
    expect(approx(source.a, halfVolume.a, 1e-6)).toBe(true);
  });

  it("diluting with water fades the indicator", () => {
    const concentrated = deriveColor(
      makeContainer({
        volumeMl: 60,
        species: containerWith("naoh", 60, 0.1).species,
        indicators: [{ indicator: phenolphthalein, drops: 2 }],
      }),
    );
    const diluted = deriveColor(
      makeContainer({
        volumeMl: 180,
        species: containerWith("naoh", 60, 0.1).species,
        indicators: [{ indicator: phenolphthalein, drops: 2 }],
      }),
    );
    expect(diluted.a).toBeLessThan(concentrated.a);
  });
});
