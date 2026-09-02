import { describe, expect, it } from "vitest";
import { formatFormula } from "../format";

describe("formatFormula", () => {
  it("subscripts atom counts and superscripts the charge for every species id shape", () => {
    expect(formatFormula("H+")).toBe("H⁺");
    expect(formatFormula("NO3-")).toBe("NO₃⁻");
    expect(formatFormula("Cu2+")).toBe("Cu²⁺");
    expect(formatFormula("SO4^2-")).toBe("SO₄²⁻");
    expect(formatFormula("Cu(OH)2(s)")).toBe("Cu(OH)₂(s)");
    expect(formatFormula("CO2(g)")).toBe("CO₂(g)");
  });
});
