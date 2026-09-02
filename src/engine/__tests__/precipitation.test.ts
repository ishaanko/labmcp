import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { applyCommand } from "../reducer";
import { getMoles, SP } from "../species";
import type { Observation } from "../types";
import { applyOk, approx, placeBeakers, sandboxState } from "./helpers";

function containerOf(state: ReturnType<typeof applyOk>, id: string) {
  const found = state.objects.find((o) => o.id === id);
  if (!found || found.kind !== "container") throw new Error(`unreachable: ${id} is not a container`);
  return found;
}

describe("precipitation via the reducer", () => {
  it("10 mL 0.1 M AgNO3 + 30 mL 0.1 M NaCl leaves 2.0 mmol Cl- and forms ~0.1433 g of moderate AgCl", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    const afterAg = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("agno3"), volumeMl: 10, concentrationM: 0.1 });
    const res = applyCommand(afterAg, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("nacl"), volumeMl: 30, concentrationM: 0.1 });
    if (!res.ok) throw new Error("unreachable");

    const container = containerOf(res.value.state, id);
    expect(approx(getMoles(container.species, SP.Ag), 0, 1e-12)).toBe(true);
    expect(approx(getMoles(container.species, SP.Cl), 0.002, 1e-9)).toBe(true);

    const precipitate = res.value.events.find((o) => o.event.kind === "PRECIPITATE_FORMED");
    if (!precipitate || precipitate.event.kind !== "PRECIPITATE_FORMED") throw new Error("expected PRECIPITATE_FORMED");
    expect(approx(precipitate.event.massG, 0.1433, 1e-3)).toBe(true);
    expect(precipitate.event.scale).toBe("moderate");
  });

  it("CuSO4 + NaOH precipitates Cu(OH)2 at 2:1 stoichiometry", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    const afterCu = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("cuso4"), volumeMl: 20, concentrationM: 0.1 });
    const afterOh = applyOk(afterCu, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("naoh"), volumeMl: 40, concentrationM: 0.1 });

    const container = containerOf(afterOh, id);
    expect(approx(getMoles(container.species, SP.Cu), 0, 1e-9)).toBe(true);
    expect(approx(getMoles(container.species, SP.OH), 0, 1e-9)).toBe(true);
    const cuOh2 = container.solids.find((s) => s.species === SP.CuOH2Solid);
    expect(cuOh2 && approx(cuOh2.moles, 0.002, 1e-9)).toBe(true);
  });

  it("BaCl2 + Na2SO4 precipitates white BaSO4", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    const afterBa = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("bacl2"), volumeMl: 10, concentrationM: 0.1 });
    const res = applyCommand(afterBa, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("na2so4"), volumeMl: 10, concentrationM: 0.1 });
    if (!res.ok) throw new Error("unreachable");

    const container = containerOf(res.value.state, id);
    expect(approx(getMoles(container.species, SP.Ba), 0, 1e-12)).toBe(true);
    const solid = container.solids.find((s) => s.species === SP.BaSO4Solid);
    expect(solid && approx(solid.moles, 0.001, 1e-9)).toBe(true);

    const precipitate = res.value.events.find((o) => o.event.kind === "PRECIPITATE_FORMED");
    if (!precipitate || precipitate.event.kind !== "PRECIPITATE_FORMED") throw new Error("expected PRECIPITATE_FORMED");
    expect(precipitate.event.description).toContain("White precipitate");
  });

  it("the first equivalent of HCl into Na2CO3 does not bubble; the second does", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    const afterCarbonate = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("na2co3"), volumeMl: 20, concentrationM: 0.1 });

    const firstEquivalent = applyCommand(afterCarbonate, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("hcl"), volumeMl: 20, concentrationM: 0.1 });
    if (!firstEquivalent.ok) throw new Error("unreachable");
    expect(hasBubbles(firstEquivalent.value.events)).toBe(false);

    const secondEquivalent = applyCommand(firstEquivalent.value.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("hcl"), volumeMl: 20, concentrationM: 0.1 });
    if (!secondEquivalent.ok) throw new Error("unreachable");
    expect(hasBubbles(secondEquivalent.value.events)).toBe(true);
  });
});

function hasBubbles(events: ReadonlyArray<Observation>): boolean {
  return events.some((o) => o.event.kind === "BUBBLES");
}
