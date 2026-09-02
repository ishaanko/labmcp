import { describe, expect, it } from "vitest";
import { derivePh } from "../ph";
import { addMoles, isKnownSpecies, SP } from "../species";
import type { SpeciesMoles } from "../types";
import { approx, containerWith, makeContainer } from "./helpers";

/** Sums two SpeciesMoles maps, as if two solutions were poured into one container. */
function combine(a: SpeciesMoles, b: SpeciesMoles): SpeciesMoles {
  let out = a;
  for (const [id, mol] of Object.entries(b)) {
    if (!isKnownSpecies(id) || mol === undefined) continue;
    out = addMoles(out, id, mol);
  }
  return out;
}

/** Strong acid/base neutralize completely and instantly; only the excess of H+ or OH- survives. */
function neutralizeStrong(species: SpeciesMoles): SpeciesMoles {
  const nH = species[SP.H] ?? 0;
  const nOH = species[SP.OH] ?? 0;
  const net = nH - nOH;
  const { [SP.H]: _h, [SP.OH]: _oh, ...rest } = species;
  if (net > 0) return { ...rest, [SP.H]: net };
  if (net < 0) return { ...rest, [SP.OH]: -net };
  return rest;
}

describe("derivePh", () => {
  it("is null for an empty container", () => {
    expect(derivePh(makeContainer())).toBeNull();
  });

  it("is 7.00 for pure water", () => {
    const c = makeContainer({ volumeMl: 100 });
    expect(approx(derivePh(c) ?? NaN, 7.0, 0.01)).toBe(true);
  });

  it("matches HCl vs NaOH titration checkpoints", () => {
    // 25.00 mL 0.1000 M HCl titrated with 0.1000 M NaOH.
    const checkpoints: ReadonlyArray<readonly [number, number]> = [
      [0, 1.0],
      [12.5, 1.48],
      [24.9, 3.7],
      [25.0, 7.0],
      [25.1, 10.3],
      [50, 12.52],
    ];
    for (const [naohMl, expectedPh] of checkpoints) {
      const analyte = containerWith("hcl", 25, 0.1);
      const titrant = containerWith("naoh", naohMl, 0.1);
      const species = neutralizeStrong(combine(analyte.species, titrant.species));
      const container = makeContainer({ volumeMl: analyte.volumeMl + titrant.volumeMl, species });
      const ph = derivePh(container);
      expect(ph).not.toBeNull();
      expect(approx(ph ?? NaN, expectedPh, 0.05)).toBe(true);
    }
  });

  it("reads 11.66 for 0.1 M Na2CO3", () => {
    const c = containerWith("na2co3", 100, 0.1);
    expect(approx(derivePh(c) ?? NaN, 11.66, 0.02)).toBe(true);
  });

  it("reads pKa2 (10.33) for a 1:1 CO3/HCO3 mixture", () => {
    const carbonate = containerWith("na2co3", 50, 0.1);
    const bicarbonate = containerWith("nahco3", 50, 0.1);
    const species = combine(carbonate.species, bicarbonate.species);
    const c = makeContainer({ volumeMl: 100, species });
    expect(approx(derivePh(c) ?? NaN, 10.33, 0.02)).toBe(true);
  });

  it("clamps to 14 for very concentrated NaOH", () => {
    const c = containerWith("naoh", 100, 2.0);
    const ph = derivePh(c) ?? NaN;
    expect(ph).toBeLessThanOrEqual(14);
    expect(ph).toBeGreaterThan(13);
  });
});
