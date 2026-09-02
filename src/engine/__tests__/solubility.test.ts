import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { applyCommand } from "../reducer";
import { equilibrateSolubility } from "../solubility";
import { getMoles, SP } from "../species";
import type { Container, Observation } from "../types";
import { applyOk, approx, makeContainer, placeBeakers, sandboxState } from "./helpers";

const KNO3_MOLAR_MASS = 101.1;

function withKno3Solid(massG: number, overrides: Partial<Container> = {}): Container {
  return makeContainer({ solids: [{ species: SP.KNO3Solid, moles: massG / KNO3_MOLAR_MASS, suspended: 1 }], ...overrides });
}

function undissolvedG(container: Container): number {
  const deposit = container.solids.find((s) => s.species === SP.KNO3Solid);
  return (deposit?.moles ?? 0) * KNO3_MOLAR_MASS;
}

function dissolvedG(container: Container): number {
  return getMoles(container.species, SP.K) * KNO3_MOLAR_MASS;
}

describe("equilibrateSolubility", () => {
  it("dissolves 5 g of KNO3 in 10 mL at 20 C up to the curve's 3.16 g limit, leaving 1.84 g solid", () => {
    const c = withKno3Solid(5, { volumeMl: 10, temperatureC: 20 });
    const { container } = equilibrateSolubility(c);
    expect(approx(dissolvedG(container), 3.16, 0.01)).toBe(true);
    expect(approx(undissolvedG(container), 1.84, 0.01)).toBe(true);
  });

  it("fully dissolves 5 g once heated to 60 C, where the limit (11 g) exceeds the total", () => {
    const c = withKno3Solid(5, { volumeMl: 10, temperatureC: 60 });
    const { container } = equilibrateSolubility(c);
    expect(approx(dissolvedG(container), 5, 1e-6)).toBe(true);
    expect(container.solids).toHaveLength(0);
  });

  it("crystallizes back out on cooling from a fully dissolved state", () => {
    const dissolved = equilibrateSolubility(withKno3Solid(5, { volumeMl: 10, temperatureC: 60 })).container;
    const cooled = equilibrateSolubility({ ...dissolved, temperatureC: 20 }).container;
    expect(approx(dissolvedG(cooled), 3.16, 0.01)).toBe(true);
    expect(approx(undissolvedG(cooled), 1.84, 0.01)).toBe(true);
  });

  it("keeps a solid entirely undissolved in a container with no water", () => {
    const c = withKno3Solid(5, { volumeMl: 0, temperatureC: 20 });
    const { container } = equilibrateSolubility(c);
    expect(approx(dissolvedG(container), 0, 1e-9)).toBe(true);
    expect(approx(undissolvedG(container), 5, 1e-9)).toBe(true);
  });

  it("conserves total KNO3 mass (dissolved + undissolved) through a heat/cool round trip", () => {
    const start = withKno3Solid(5, { volumeMl: 10, temperatureC: 20 });
    const heated = equilibrateSolubility({ ...start, temperatureC: 80 }).container;
    const cooled = equilibrateSolubility({ ...heated, temperatureC: 20 }).container;
    for (const c of [start, heated, cooled]) {
      expect(approx(dissolvedG(c) + undissolvedG(c), 5, 1e-6)).toBe(true);
    }
  });

  it("emits SOLUBILITY_CHANGE only when the dissolved mass moves by more than 0.05 g", () => {
    const c = withKno3Solid(5, { volumeMl: 10, temperatureC: 20 });
    const { events } = equilibrateSolubility(c);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "SOLUBILITY_CHANGE", species: SP.KNO3Solid });

    const settled = equilibrateSolubility(c).container;
    const { events: noChange } = equilibrateSolubility(settled);
    expect(noChange).toHaveLength(0);
  });
});

function containerOf(state: ReturnType<typeof applyOk>, id: string): Container {
  const found = state.objects.find((o) => o.id === id);
  if (!found || found.kind !== "container") throw new Error(`unreachable: ${id} is not a container`);
  return found;
}

describe("ADD_REAGENT with a solid reagent, via the reducer", () => {
  it("adds mass as moles/molarMass and dissolves it up to the curve's limit at the bench's ambient temperature", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    let state = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("water"), volumeMl: 10 });
    state = applyOk(state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("kno3"), volumeMl: 0, massG: 5 });

    const container = containerOf(state, id);
    // Ambient is 22 C, just past the curve's 20 C point (3.16 g/10 mL); 5 g exceeds that, so some stays solid.
    expect(approx(dissolvedG(container) + undissolvedG(container), 5, 1e-6)).toBe(true);
    expect(undissolvedG(container)).toBeGreaterThan(0);
    expect(dissolvedG(container)).toBeGreaterThan(3);
  });

  it("rejects a nonzero volumeMl for a solid reagent", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");
    const res = applyCommand(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("kno3"), volumeMl: 5, massG: 5 });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error.kind).toBe("INVALID_AMOUNT");
  });

  it("rejects a solid reagent with no massG", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");
    const res = applyCommand(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("kno3"), volumeMl: 0 });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error.kind).toBe("INVALID_AMOUNT");
  });

  it("rejects a massG above 500 g", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");
    const res = applyCommand(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("kno3"), volumeMl: 0, massG: 501 });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error).toEqual({ kind: "INVALID_AMOUNT", field: "massG", value: 501, reason: "too_large" });
  });

  it("rejects massG on a liquid reagent", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");
    const res = applyCommand(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("water"), volumeMl: 10, massG: 5 });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error.kind).toBe("INVALID_AMOUNT");
  });

  it("keeps a solid entirely undissolved when added before any water", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");
    const state = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("kno3"), volumeMl: 0, massG: 5 });
    const container = containerOf(state, id);
    expect(approx(dissolvedG(container), 0, 1e-9)).toBe(true);
    expect(approx(undissolvedG(container), 5, 1e-9)).toBe(true);
  });

  it("emits a SOLUBILITY_CHANGE observation for the dissolve", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");
    const withWater = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("water"), volumeMl: 10 });
    const res = applyCommand(withWater, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("kno3"), volumeMl: 0, massG: 5 });
    if (!res.ok) throw new Error("unreachable");
    expect(hasSolubilityChange(res.value.events)).toBe(true);
  });
});

describe("solubility re-equilibrates on transfer", () => {
  it("dissolves more of a container's undissolved solid once diluted by an incoming transfer", () => {
    const placed = placeBeakers(sandboxState(), 2);
    const [srcId, dstId] = placed.ids;
    if (!srcId || !dstId) throw new Error("unreachable");

    let state = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: dstId, reagentId: mintReagentId("water"), volumeMl: 10 });
    state = applyOk(state, { kind: "ADD_REAGENT", containerId: dstId, reagentId: mintReagentId("kno3"), volumeMl: 0, massG: 5 });
    const before = containerOf(state, dstId);
    expect(undissolvedG(before)).toBeGreaterThan(0); // 5 g exceeds the ~10 mL limit at ambient temperature.

    state = applyOk(state, { kind: "ADD_REAGENT", containerId: srcId, reagentId: mintReagentId("water"), volumeMl: 30 });
    state = applyOk(state, { kind: "TRANSFER_LIQUID", fromId: srcId, toId: dstId, volumeMl: 30 });

    const after = containerOf(state, dstId);
    expect(approx(dissolvedG(after) + undissolvedG(after), 5, 1e-6)).toBe(true);
    expect(dissolvedG(after)).toBeGreaterThan(dissolvedG(before));
    expect(undissolvedG(after)).toBeLessThan(undissolvedG(before));
  });
});

function hasSolubilityChange(events: ReadonlyArray<Observation>): boolean {
  return events.some((o) => o.event.kind === "SOLUBILITY_CHANGE");
}
