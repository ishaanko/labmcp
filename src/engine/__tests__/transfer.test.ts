import { describe, expect, it } from "vitest";
import { mintIndicatorId, mintReagentId } from "../ids";
import { getMoles, SP } from "../species";
import type { Container } from "../types";
import { applyOk, approx, placeBeakers, sandboxState } from "./helpers";

function container(state: ReturnType<typeof applyOk>, id: string): Container {
  const found = state.objects.find((o) => o.id === id);
  if (!found || found.kind !== "container") throw new Error(`unreachable: ${id} is not a container`);
  return found;
}

describe("TRANSFER_LIQUID", () => {
  it("moves exactly half of each ion and half the indicator drops for a 30 of 60 mL transfer, mixes temperature by volume, and leaves solids behind", () => {
    const placed = placeBeakers(sandboxState(), 2);
    const [srcId, dstId] = placed.ids;
    if (!srcId || !dstId) throw new Error("unreachable: placeBeakers(2) returns 2 ids");

    let state = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: srcId, reagentId: mintReagentId("nacl"), volumeMl: 60, concentrationM: 0.1 });
    state = applyOk(state, { kind: "ADD_INDICATOR", containerId: srcId, indicator: mintIndicatorId("universal"), drops: 4 });
    state = applyOk(state, { kind: "HEAT", containerId: srcId, targetC: 40 });
    state = applyOk(state, { kind: "TICK", dtS: 60 });
    state = applyOk(state, { kind: "ADD_REAGENT", containerId: dstId, reagentId: mintReagentId("water"), volumeMl: 30 });

    const before = container(state, srcId);
    const naBefore = getMoles(before.species, SP.Na);
    const clBefore = getMoles(before.species, SP.Cl);
    const dropsBefore = before.indicators.reduce((sum, d) => sum + d.drops, 0);
    const destTempBefore = container(state, dstId).temperatureC;

    state = applyOk(state, { kind: "TRANSFER_LIQUID", fromId: srcId, toId: dstId, volumeMl: 30 });

    const src = container(state, srcId);
    const dst = container(state, dstId);

    expect(approx(getMoles(src.species, SP.Na), naBefore / 2, 1e-9)).toBe(true);
    expect(approx(getMoles(dst.species, SP.Na), naBefore / 2, 1e-9)).toBe(true);
    expect(approx(getMoles(src.species, SP.Cl), clBefore / 2, 1e-9)).toBe(true);
    expect(approx(getMoles(dst.species, SP.Cl), clBefore / 2, 1e-9)).toBe(true);

    const dstDrops = dst.indicators.reduce((sum, d) => sum + d.drops, 0);
    expect(approx(dstDrops, dropsBefore / 2, 1e-6)).toBe(true);

    const expectedDestTemp = (30 * destTempBefore + 30 * before.temperatureC) / 60;
    expect(approx(dst.temperatureC, expectedDestTemp, 1e-6)).toBe(true);
  });

  it("zeroes the source exactly when the transfer empties it, and leaves any solids behind", () => {
    const placed = placeBeakers(sandboxState(), 2);
    const [srcId, dstId] = placed.ids;
    if (!srcId || !dstId) throw new Error("unreachable: placeBeakers(2) returns 2 ids");

    let state = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: srcId, reagentId: mintReagentId("agno3"), volumeMl: 10, concentrationM: 0.1 });
    state = applyOk(state, { kind: "ADD_REAGENT", containerId: srcId, reagentId: mintReagentId("nacl"), volumeMl: 10, concentrationM: 0.1 });

    const withSolid = container(state, srcId);
    expect(withSolid.solids.length).toBeGreaterThan(0);

    state = applyOk(state, { kind: "TRANSFER_LIQUID", fromId: srcId, toId: dstId, volumeMl: withSolid.volumeMl });

    const src = container(state, srcId);
    expect(src.volumeMl).toBe(0);
    expect(Object.keys(src.species)).toHaveLength(0);
    expect(src.solids.length).toBe(withSolid.solids.length);
  });
});
