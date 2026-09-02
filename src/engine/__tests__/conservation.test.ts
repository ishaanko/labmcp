import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { getMoles, netCharge, speciesKeys, SP } from "../species";
import type { Container, LabCommand, LabState } from "../types";
import { applyOk, approx, placeBeakers, sandboxState } from "./helpers";

function allContainers(state: LabState): ReadonlyArray<Container> {
  return state.objects.filter((o): o is Container => o.kind === "container");
}

function totalMoles(state: LabState, speciesId: (typeof SP)[keyof typeof SP]): number {
  return allContainers(state).reduce((sum, c) => sum + getMoles(c.species, speciesId), 0);
}

describe("conservation", () => {
  it("keeps every container charge-neutral and every inert species' total moles conserved across a 20-command script", () => {
    const placed = placeBeakers(sandboxState(), 3);
    let state = placed.state;
    const [a, b, c] = placed.ids;
    if (!a || !b || !c) throw new Error("unreachable: placeBeakers(3) returns 3 ids");

    // Inert combination: Na+, Cl-, Ca2+, HCO3- never satisfy any rule's reactants (no H+, OH-, CO3^2-, Ag+, Cu2+).
    const script: ReadonlyArray<LabCommand> = [
      { kind: "ADD_REAGENT", containerId: a, reagentId: mintReagentId("nacl"), volumeMl: 20, concentrationM: 0.1 },
      { kind: "ADD_REAGENT", containerId: b, reagentId: mintReagentId("cacl2"), volumeMl: 15, concentrationM: 0.1 },
      { kind: "ADD_REAGENT", containerId: c, reagentId: mintReagentId("nahco3"), volumeMl: 10, concentrationM: 0.1 },
      { kind: "TRANSFER_LIQUID", fromId: a, toId: b, volumeMl: 5 },
      { kind: "TRANSFER_LIQUID", fromId: b, toId: c, volumeMl: 8 },
      { kind: "ADD_REAGENT", containerId: a, reagentId: mintReagentId("water"), volumeMl: 10 },
      { kind: "TRANSFER_LIQUID", fromId: c, toId: a, volumeMl: 6 },
      { kind: "ADD_REAGENT", containerId: b, reagentId: mintReagentId("nacl"), volumeMl: 5, concentrationM: 0.2 },
      { kind: "TRANSFER_LIQUID", fromId: a, toId: c, volumeMl: 4 },
      { kind: "ADD_REAGENT", containerId: c, reagentId: mintReagentId("cacl2"), volumeMl: 7, concentrationM: 0.05 },
      { kind: "TRANSFER_LIQUID", fromId: b, toId: a, volumeMl: 3 },
      { kind: "ADD_REAGENT", containerId: a, reagentId: mintReagentId("nahco3"), volumeMl: 12, concentrationM: 0.1 },
      { kind: "TRANSFER_LIQUID", fromId: c, toId: b, volumeMl: 9 },
      { kind: "DISPOSE", containerId: b },
      { kind: "ADD_REAGENT", containerId: b, reagentId: mintReagentId("nacl"), volumeMl: 20, concentrationM: 0.1 },
      { kind: "TRANSFER_LIQUID", fromId: a, toId: b, volumeMl: 10 },
      { kind: "ADD_REAGENT", containerId: c, reagentId: mintReagentId("water"), volumeMl: 5 },
      { kind: "TRANSFER_LIQUID", fromId: b, toId: c, volumeMl: 4 },
      { kind: "ADD_REAGENT", containerId: a, reagentId: mintReagentId("cacl2"), volumeMl: 6, concentrationM: 0.1 },
      { kind: "TRANSFER_LIQUID", fromId: c, toId: a, volumeMl: 2 },
    ];

    // Running expected total per species: +stockToMoles on ADD_REAGENT, -container's moles on DISPOSE.
    // TRANSFER_LIQUID never changes a bench-wide total, so it needs no bookkeeping here.
    const expected: Record<string, number> = { [SP.Na]: 0, [SP.Cl]: 0, [SP.Ca]: 0, [SP.HCO3]: 0 };
    const STOCK_IONS: Partial<Record<string, ReadonlyArray<{ readonly species: string; readonly perFormulaUnit: number }>>> = {
      [mintReagentId("nacl")]: [{ species: SP.Na, perFormulaUnit: 1 }, { species: SP.Cl, perFormulaUnit: 1 }],
      [mintReagentId("cacl2")]: [{ species: SP.Ca, perFormulaUnit: 1 }, { species: SP.Cl, perFormulaUnit: 2 }],
      [mintReagentId("nahco3")]: [{ species: SP.Na, perFormulaUnit: 1 }, { species: SP.HCO3, perFormulaUnit: 1 }],
    };

    for (const command of script) {
      if (command.kind === "DISPOSE") {
        const container = allContainers(state).find((cnt) => cnt.id === command.containerId);
        if (container) {
          for (const id of speciesKeys(container.species)) expected[id] = (expected[id] ?? 0) - getMoles(container.species, id);
        }
      }
      if (command.kind === "ADD_REAGENT") {
        const ions = STOCK_IONS[command.reagentId];
        if (ions) {
          const liters = command.volumeMl / 1000;
          for (const ion of ions) expected[ion.species] = (expected[ion.species] ?? 0) + (command.concentrationM ?? 0.1) * liters * ion.perFormulaUnit;
        }
      }

      state = applyOk(state, command);
      for (const cont of allContainers(state)) expect(Math.abs(netCharge(cont))).toBeLessThan(1e-9);
    }

    expect(approx(totalMoles(state, SP.Na), expected[SP.Na] ?? 0, 1e-9)).toBe(true);
    expect(approx(totalMoles(state, SP.Cl), expected[SP.Cl] ?? 0, 1e-9)).toBe(true);
    expect(approx(totalMoles(state, SP.Ca), expected[SP.Ca] ?? 0, 1e-9)).toBe(true);
    expect(approx(totalMoles(state, SP.HCO3), expected[SP.HCO3] ?? 0, 1e-9)).toBe(true);
  });

  it("conserves n(Ag+) + n(AgCl solid) through a precipitation and a subsequent transfer", () => {
    const placed = placeBeakers(sandboxState(), 2);
    let state = placed.state;
    const [a, b] = placed.ids;
    if (!a || !b) throw new Error("unreachable: placeBeakers(2) returns 2 ids");

    state = applyOk(state, { kind: "ADD_REAGENT", containerId: a, reagentId: mintReagentId("agno3"), volumeMl: 10, concentrationM: 0.1 });
    const agAdded = getMoles(allContainers(state).find((c) => c.id === a)!.species, SP.Ag);

    state = applyOk(state, { kind: "ADD_REAGENT", containerId: a, reagentId: mintReagentId("nacl"), volumeMl: 30, concentrationM: 0.1 });
    state = applyOk(state, { kind: "TRANSFER_LIQUID", fromId: a, toId: b, volumeMl: 10 });

    const source = allContainers(state).find((c) => c.id === a)!;
    const dest = allContainers(state).find((c) => c.id === b)!;
    const solidAg = source.solids.filter((s) => s.species === SP.AgClSolid).reduce((sum, s) => sum + s.moles, 0);
    const dissolvedAg = getMoles(source.species, SP.Ag) + getMoles(dest.species, SP.Ag);

    expect(approx(solidAg + dissolvedAg, agAdded, 1e-9)).toBe(true);
  });
});
