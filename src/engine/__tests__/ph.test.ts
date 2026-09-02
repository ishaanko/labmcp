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

  it("never reads lower after a trace of strong base is added to a carbonate solution", () => {
    const carbonate = containerWith("na2co3", 50, 0.1);
    const before = derivePh(carbonate) ?? NaN;

    const drop = containerWith("naoh", 0.05, 0.1);
    const species = combine(carbonate.species, drop.species);
    const after = makeContainer({ volumeMl: carbonate.volumeMl + drop.volumeMl, species });
    const afterPh = derivePh(after) ?? NaN;

    // A trace of base must not measurably acidify the buffer; allow only the negligible dip from
    // the drop's own dilution (the pre-fix bug dropped this by ~1.7 units).
    expect(afterPh).toBeGreaterThan(before - 0.01);
  });

  it("reads 2.88 for 0.1 M acetic acid", () => {
    const c = containerWith("acetic_acid", 100, 0.1);
    expect(approx(derivePh(c) ?? NaN, 2.88, 0.03)).toBe(true);
  });

  it("reads 11.13 for 0.1 M ammonia", () => {
    const c = containerWith("ammonia", 100, 0.1);
    expect(approx(derivePh(c) ?? NaN, 11.13, 0.03)).toBe(true);
  });

  it("reads 8.88 for 0.1 M sodium acetate (CH3COO- with its Na+ counterion)", () => {
    const species: SpeciesMoles = { [SP.Na]: 0.01, [SP.AcO]: 0.01 };
    const c = makeContainer({ volumeMl: 100, species });
    expect(approx(derivePh(c) ?? NaN, 8.88, 0.03)).toBe(true);
  });

  it("reads pKa (4.76) for an equal-parts acetic acid / acetate buffer", () => {
    // 0.05 M CH3COOH + 0.05 M CH3COO-, charge-balanced by 0.05 M Na+ for the acetate half.
    const species: SpeciesMoles = { [SP.AcOH]: 0.005, [SP.AcO]: 0.005, [SP.Na]: 0.005 };
    const c = makeContainer({ volumeMl: 100, species });
    expect(approx(derivePh(c) ?? NaN, 4.76, 0.03)).toBe(true);
  });

  it("reads 8.34 for 0.1 M NaHCO3", () => {
    const species: SpeciesMoles = { [SP.Na]: 0.01, [SP.HCO3]: 0.01 };
    const c = makeContainer({ volumeMl: 100, species });
    const ph = derivePh(c) ?? NaN;
    expect(ph).toBeGreaterThanOrEqual(8.2);
    expect(ph).toBeLessThanOrEqual(8.4);
  });

  it("reads 7.00 at the HCl/NaOH equivalence point", () => {
    const analyte = containerWith("hcl", 25, 0.1);
    const titrant = containerWith("naoh", 25, 0.1);
    const species = neutralizeStrong(combine(analyte.species, titrant.species));
    const c = makeContainer({ volumeMl: analyte.volumeMl + titrant.volumeMl, species });
    expect(approx(derivePh(c) ?? NaN, 7.0, 0.03)).toBe(true);
  });

  it("stays at the free acid's pH when excess ammonia protonates only some of it (a buffer, via ammonia_protonation)", () => {
    // 0.15 mol HCl into 0.10 mol ammonia: 0.10 mol NH4+ forms, 0.05 mol H+ remains free.
    const species: SpeciesMoles = { [SP.H]: 0.05, [SP.Cl]: 0.15, [SP.NH4]: 0.1 };
    const c = makeContainer({ volumeMl: 1000, species });
    // Free 0.05 M strong acid dominates once NH4+ is essentially fully protonated at this pH.
    expect(approx(derivePh(c) ?? NaN, 1.3, 0.03)).toBe(true);
  });
});
