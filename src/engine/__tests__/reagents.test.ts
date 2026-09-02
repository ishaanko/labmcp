import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { reagentDef, REAGENT_IDS, stockToMoles, suggestIndicators, suggestReagents } from "../reagents";
import { SP } from "../species";
import { approx } from "./helpers";

describe("stockToMoles", () => {
  it("HCl 0.1 M, 25 mL -> 2.5 mmol H+ and Cl-", () => {
    const hcl = reagentDef(mintReagentId("hcl"));
    if (!hcl) throw new Error("hcl missing from registry");
    const moles = stockToMoles(hcl, 25, 0.1);
    expect(approx(moles[SP.H] ?? 0, 0.0025)).toBe(true);
    expect(approx(moles[SP.Cl] ?? 0, 0.0025)).toBe(true);
  });

  it("CaCl2 0.1 M, 10 mL -> 1.0 mmol Ca2+, 2.0 mmol Cl-", () => {
    const cacl2 = reagentDef(mintReagentId("cacl2"));
    if (!cacl2) throw new Error("cacl2 missing from registry");
    const moles = stockToMoles(cacl2, 10, 0.1);
    expect(approx(moles[SP.Ca] ?? 0, 0.001)).toBe(true);
    expect(approx(moles[SP.Cl] ?? 0, 0.002)).toBe(true);
  });

  it("Na2CO3 0.1 M, 50 mL -> 10 mmol Na+, 5 mmol CO3^2-", () => {
    const na2co3 = reagentDef(mintReagentId("na2co3"));
    if (!na2co3) throw new Error("na2co3 missing from registry");
    const moles = stockToMoles(na2co3, 50, 0.1);
    expect(approx(moles[SP.Na] ?? 0, 0.01)).toBe(true);
    expect(approx(moles[SP.CO3] ?? 0, 0.005)).toBe(true);
  });

  it("water yields no species regardless of volume", () => {
    const water = reagentDef(mintReagentId("water"));
    if (!water) throw new Error("water missing from registry");
    expect(stockToMoles(water, 100, 0)).toEqual({});
  });
});

describe("suggestReagents", () => {
  it("substring-matches id, label, or formula", () => {
    expect(suggestReagents("hcl", REAGENT_IDS)).toContain(mintReagentId("hcl"));
    expect(suggestReagents("sodium", REAGENT_IDS)).toEqual(
      expect.arrayContaining([mintReagentId("naoh"), mintReagentId("nacl"), mintReagentId("na2co3"), mintReagentId("nahco3")]),
    );
    expect(suggestReagents("agno", REAGENT_IDS)).toContain(mintReagentId("agno3"));
  });

  it("falls back to the 3 closest ids by edit distance when nothing substring-matches", () => {
    const suggestions = suggestReagents("hyrdoclor", REAGENT_IDS);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(suggestions).toContain(mintReagentId("hcl"));
  });

  it("returns nothing for an empty query", () => {
    expect(suggestReagents("", REAGENT_IDS)).toEqual([]);
  });
});

describe("suggestIndicators", () => {
  it("substring-matches indicator ids", () => {
    expect(suggestIndicators("univ")).toContain("universal");
  });

  it("falls back to the closest indicator on a typo", () => {
    const suggestions = suggestIndicators("phenolphtalein");
    expect(suggestions).toContain("phenolphthalein");
  });
});
