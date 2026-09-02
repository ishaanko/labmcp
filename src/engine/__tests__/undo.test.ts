import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { applyCommand } from "../reducer";
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
});
