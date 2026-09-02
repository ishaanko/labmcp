import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { applyCommand } from "../reducer";
import { loadScenario } from "../scenarios";
import type { LabState } from "../types";
import { applyOk, placeBeakers, sandboxState } from "./helpers";

/** Everything UNDO promises to restore exactly: not the append-only notebook or the id/seq counter. */
function physicalState(state: LabState): Omit<LabState, "observations" | "history" | "nextSeq"> {
  const { observations: _observations, history: _history, nextSeq: _nextSeq, ...rest } = state;
  return rest;
}

describe("UNDO", () => {
  it("restores the exact prior physical state after AgNO3 + NaCl, and shrinks history", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    const before = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("agno3"), volumeMl: 10, concentrationM: 0.1 });
    const beforePhysical = physicalState(before);
    const beforeHistoryLength = before.history.length;

    const after = applyOk(before, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("nacl"), volumeMl: 30, concentrationM: 0.1 });
    expect(after.history.length).toBe(beforeHistoryLength + 1);

    const undone = applyCommand(after, { kind: "UNDO" });
    expect(undone.ok).toBe(true);
    if (!undone.ok) throw new Error("unreachable");

    expect(physicalState(undone.value.state)).toEqual(beforePhysical);
    expect(undone.value.state.history.length).toBe(beforeHistoryLength);
  });

  it("rejects UNDO with NOTHING_TO_UNDO when history is empty", () => {
    const res = applyCommand(sandboxState(), { kind: "UNDO" });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error).toEqual({ kind: "NOTHING_TO_UNDO" });
  });

  it("TICK is not itself undoable, so UNDO after a TICK reverts the clock back through it via the prior command's snapshot", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    const beforeTick = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("water"), volumeMl: 10 });
    expect(beforeTick.clockS).toBe(0);

    const afterTick = applyOk(beforeTick, { kind: "TICK", dtS: 5 });
    expect(afterTick.clockS).toBe(5);
    expect(afterTick.history.length).toBe(beforeTick.history.length);

    const undone = applyCommand(afterTick, { kind: "UNDO" });
    expect(undone.ok).toBe(true);
    if (!undone.ok) throw new Error("unreachable");
    expect(undone.value.state.clockS).toBe(0);
  });

  it("undoing HEAT reverts the thermal target but keeps the temperature the ramp reached", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    const filled = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("water"), volumeMl: 50 });
    const heating = applyOk(filled, { kind: "HEAT", containerId: id, targetC: 80 });
    const warmed = applyOk(heating, { kind: "TICK", dtS: 20 });
    const beakerWarm = warmed.objects.find((o) => o.id === id);
    if (!beakerWarm || beakerWarm.kind !== "container") throw new Error("unreachable");
    expect(beakerWarm.temperatureC).toBeGreaterThan(40);

    const undone = applyCommand(warmed, { kind: "UNDO" });
    if (!undone.ok) throw new Error("unreachable");
    const beaker = undone.value.state.objects.find((o) => o.id === id);
    if (!beaker || beaker.kind !== "container") throw new Error("unreachable");
    expect(beaker.thermal).toEqual({ kind: "idle" });
    expect(beaker.temperatureC).toBe(beakerWarm.temperatureC);
  });

  it("REVEAL is not itself a history entry, so it survives an UNDO of an earlier command", () => {
    const titration = loadScenario("titration", 1);
    if (titration.scenario.kind !== "titration") throw new Error("unreachable");
    const flaskId = titration.scenario.flaskId;

    const afterAdd = applyOk(titration, { kind: "ADD_REAGENT", containerId: flaskId, reagentId: mintReagentId("water"), volumeMl: 1 });
    const revealed = applyOk(afterAdd, { kind: "REVEAL" });
    if (revealed.scenario.kind !== "titration") throw new Error("unreachable");
    expect(revealed.scenario.revealed).toBe(true);

    const undone = applyCommand(revealed, { kind: "UNDO" });
    expect(undone.ok).toBe(true);
    if (!undone.ok) throw new Error("unreachable");
    if (undone.value.state.scenario.kind !== "titration") throw new Error("unreachable");
    expect(undone.value.state.scenario.revealed).toBe(true);
  });
});
