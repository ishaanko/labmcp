import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { reagentDef, stockToMoles } from "../reagents";
import { predictSupportedReactions, resolveReactions, ruleById } from "../reactions";
import { addMoles, getMoles, speciesKeys, SP } from "../species";
import type { SpeciesMoles } from "../types";
import { approx, containerWith, makeContainer } from "./helpers";

function combine(a: SpeciesMoles, b: SpeciesMoles): SpeciesMoles {
  let out = a;
  for (const id of speciesKeys(b)) out = addMoles(out, id, getMoles(b, id));
  return out;
}

/** Mixes two stocks into one container the way ADD_REAGENT would, for hand-built reaction fixtures. */
function mix(a: { reagentId: string; volumeMl: number; concentrationM: number }, b: typeof a): {
  volumeMl: number;
  species: SpeciesMoles;
} {
  const defA = reagentDef(mintReagentId(a.reagentId));
  const defB = reagentDef(mintReagentId(b.reagentId));
  if (!defA || !defB) throw new Error("unknown test reagent");
  const speciesA = stockToMoles(defA, a.volumeMl, a.concentrationM);
  const speciesB = stockToMoles(defB, b.volumeMl, b.concentrationM);
  return { volumeMl: a.volumeMl + b.volumeMl, species: combine(speciesA, speciesB) };
}

describe("resolveReactions", () => {
  it("neutralizes 25 mL 0.1 M HCl with 25 mL 0.1 M NaOH and heats by ~0.68 C", () => {
    const { volumeMl, species } = mix(
      { reagentId: "hcl", volumeMl: 25, concentrationM: 0.1 },
      { reagentId: "naoh", volumeMl: 25, concentrationM: 0.1 },
    );
    const container = makeContainer({ volumeMl, species });
    const { container: after, fired } = resolveReactions(container);

    expect(fired).toHaveLength(1);
    expect(fired[0]?.rule.id).toBe(ruleById(fired[0]!.rule.id)?.id);
    expect(approx(fired[0]!.extentMol, 0.0025, 1e-9)).toBe(true);
    expect(getMoles(after.species, SP.H)).toBeCloseTo(0, 9);
    expect(getMoles(after.species, SP.OH)).toBeCloseTo(0, 9);
    expect(approx(after.temperatureC - container.temperatureC, 0.68, 0.01)).toBe(true);
  });

  it("AgCl precipitation is limited by the scarcer ion", () => {
    // 10 mL 0.1 M AgNO3 (1.0 mmol Ag+) into 30 mL 0.1 M NaCl (3.0 mmol Cl-): Ag+ is limiting.
    const { volumeMl, species } = mix(
      { reagentId: "agno3", volumeMl: 10, concentrationM: 0.1 },
      { reagentId: "nacl", volumeMl: 30, concentrationM: 0.1 },
    );
    const container = makeContainer({ volumeMl, species });
    const { container: after, fired } = resolveReactions(container);

    expect(fired).toHaveLength(1);
    expect(fired[0]?.limiting).toBe(SP.Ag);
    expect(approx(fired[0]!.extentMol, 0.001, 1e-9)).toBe(true);
    expect(getMoles(after.species, SP.Ag)).toBeCloseTo(0, 9);
    expect(approx(getMoles(after.species, SP.Cl), 0.002, 1e-9)).toBe(true);
    const solid = after.solids.find((s) => s.species === SP.AgClSolid);
    expect(solid).toBeDefined();
    expect(approx(solid!.moles, 0.001, 1e-9)).toBe(true);
    expect(solid!.suspended).toBe(1);
  });

  it("Cu(OH)2 consumes hydroxide 2:1 against copper", () => {
    // 10 mL 0.5 M CuSO4 (5 mmol Cu2+) + 10 mL 2.0 M NaOH (20 mmol OH-): Cu2+ is limiting at 2:1.
    const { volumeMl, species } = mix(
      { reagentId: "cuso4", volumeMl: 10, concentrationM: 0.5 },
      { reagentId: "naoh", volumeMl: 10, concentrationM: 2.0 },
    );
    const container = makeContainer({ volumeMl, species });
    const { container: after, fired } = resolveReactions(container);
    const ppt = fired.find((f) => f.rule.id === ruleById(f.rule.id)?.id && f.produced.some((p) => p.species === SP.CuOH2Solid));

    expect(ppt).toBeDefined();
    expect(getMoles(after.species, SP.Cu)).toBeCloseTo(0, 9);
    expect(approx(getMoles(after.species, SP.OH), 0.01, 1e-9)).toBe(true);
    const solid = after.solids.find((s) => s.species === SP.CuOH2Solid);
    expect(approx(solid!.moles, 0.005, 1e-9)).toBe(true);
  });

  it("carbonate needs two equivalents of acid: first protonates, second fizzes", () => {
    // Container with 1 mmol CO3^2- (as if from Na2CO3), then acid added in two steps.
    let container = containerWith("na2co3", 10, 0.1);

    // Step 1: 10 mL 0.1 M HCl = 1.0 mmol H+, the first equivalent, exactly protonates all CO3^2- to HCO3-, no gas.
    const hcl = reagentDef(mintReagentId("hcl"));
    if (!hcl) throw new Error("unknown test reagent: hcl");
    const dose1 = stockToMoles(hcl, 10, 0.1);
    container = { ...container, volumeMl: container.volumeMl + 10, species: combine(container.species, dose1) };
    const afterStep1 = resolveReactions(container);
    expect(afterStep1.fired.some((f) => f.produced.some((p) => p.species === SP.CO2Gas))).toBe(false);
    expect(approx(getMoles(afterStep1.container.species, SP.HCO3), 0.001, 1e-9)).toBe(true);
    expect(getMoles(afterStep1.container.species, SP.CO3)).toBeCloseTo(0, 9);

    // Step 2: the second equivalent has H+ to spare once bicarbonate is the only base present, so it fizzes.
    container = afterStep1.container;
    const dose2 = stockToMoles(hcl, 10, 0.1);
    container = { ...container, volumeMl: container.volumeMl + 10, species: combine(container.species, dose2) };
    const afterStep2 = resolveReactions(container);
    expect(afterStep2.fired.some((f) => f.produced.some((p) => p.species === SP.CO2Gas))).toBe(true);
  });

  it("BaSO4 precipitation is limited by the scarcer ion", () => {
    // 10 mL 0.1 M BaCl2 (1.0 mmol Ba2+) into 30 mL 0.1 M Na2SO4 (3.0 mmol SO4^2-): Ba2+ is limiting.
    const { volumeMl, species } = mix(
      { reagentId: "bacl2", volumeMl: 10, concentrationM: 0.1 },
      { reagentId: "na2so4", volumeMl: 30, concentrationM: 0.1 },
    );
    const container = makeContainer({ volumeMl, species });
    const { container: after, fired } = resolveReactions(container);

    expect(fired).toHaveLength(1);
    expect(fired[0]?.limiting).toBe(SP.Ba);
    expect(getMoles(after.species, SP.Ba)).toBeCloseTo(0, 9);
    expect(approx(getMoles(after.species, SP.SO4), 0.002, 1e-9)).toBe(true);
    const solid = after.solids.find((s) => s.species === SP.BaSO4Solid);
    expect(solid && approx(solid.moles, 0.001, 1e-9)).toBe(true);
  });

  it("acetic acid gives up its proton only to leftover hydroxide, and only after strong neutralization", () => {
    // 10 mL 0.2 M NaOH (2.0 mmol OH-) into 20 mL 0.1 M HCl (2.0 mmol H+) + 10 mL 0.1 M acetic acid
    // (1.0 mmol CH3COOH): strong neutralization consumes all the OH- first, so acetic acid never reacts.
    const hclAndAcetic = combine(
      stockToMoles(reagentDef(mintReagentId("hcl"))!, 20, 0.1),
      stockToMoles(reagentDef(mintReagentId("acetic_acid"))!, 10, 0.1),
    );
    const naoh = stockToMoles(reagentDef(mintReagentId("naoh"))!, 10, 0.2);
    const container = makeContainer({ volumeMl: 40, species: combine(hclAndAcetic, naoh) });
    const { container: after, fired } = resolveReactions(container);

    expect(fired.some((f) => f.rule.id === "weak_acid_neutralization")).toBe(false);
    expect(approx(getMoles(after.species, SP.AcOH), 0.001, 1e-9)).toBe(true);
    expect(getMoles(after.species, SP.H)).toBeCloseTo(0, 9);
  });

  it("ammonia protonates once strong acid is exhausted", () => {
    // 20 mL 0.1 M HCl (2.0 mmol H+) + 30 mL 0.1 M ammonia (3.0 mmol NH3): all H+ converts to NH4+.
    const { volumeMl, species } = mix(
      { reagentId: "hcl", volumeMl: 20, concentrationM: 0.1 },
      { reagentId: "ammonia", volumeMl: 30, concentrationM: 0.1 },
    );
    const container = makeContainer({ volumeMl, species });
    const { container: after, fired } = resolveReactions(container);

    expect(fired.some((f) => f.rule.id === "ammonia_protonation")).toBe(true);
    expect(getMoles(after.species, SP.H)).toBeCloseTo(0, 9);
    expect(approx(getMoles(after.species, SP.NH4), 0.002, 1e-9)).toBe(true);
    expect(approx(getMoles(after.species, SP.NH3), 0.001, 1e-9)).toBe(true);
  });

  it("unsupported pairs (Ag+ + OH-) stay inert", () => {
    const species = addMoles(addMoles({}, SP.Ag, 0.001), SP.OH, 0.001);
    const container = makeContainer({ volumeMl: 50, species });
    const { fired } = resolveReactions(container);
    expect(fired).toHaveLength(0);
  });
});

describe("predictSupportedReactions", () => {
  it("lists only rules whose reactants are all present", () => {
    const species = addMoles(addMoles({}, SP.Ag, 0.001), SP.Cl, 0.001);
    const container = makeContainer({ volumeMl: 50, species });
    const rules = predictSupportedReactions(container);
    expect(rules.map((r) => r.id)).toContain(ruleById(rules[0]!.id)!.id);
    expect(rules.some((r) => r.reactants.every((s) => s.species === SP.Ag || s.species === SP.Cl))).toBe(true);
    expect(rules.some((r) => r.reactants.some((s) => s.species === SP.Ca))).toBe(false);
  });

  it("is empty for a container with no reactive species", () => {
    const species = addMoles(addMoles({}, SP.Na, 0.001), SP.Cl, 0.001);
    const container = makeContainer({ volumeMl: 50, species });
    expect(predictSupportedReactions(container)).toHaveLength(0);
  });
});
