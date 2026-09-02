import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { applyCommand } from "../reducer";
import { applyOk, placeBeakers, sandboxState } from "./helpers";

describe("capacity and amount validation", () => {
  it("rejects an overflowing ADD_REAGENT with OVER_CAPACITY { maxAddableMl } and never mutates state", () => {
    // graduated_cylinder is 100 mL per CAPACITY_ML, filled to 80 mL then over-filled by 25 mL.
    const cylinderState = applyOk(sandboxState(), { kind: "PLACE_OBJECT", objectType: "graduated_cylinder" });
    const cylinder = cylinderState.objects[cylinderState.objects.length - 1];
    if (!cylinder || cylinder.kind !== "container") throw new Error("unreachable: PLACE_OBJECT did not add a container");

    const filled = applyOk(cylinderState, { kind: "ADD_REAGENT", containerId: cylinder.id, reagentId: mintReagentId("water"), volumeMl: 80 });

    const res = applyCommand(filled, { kind: "ADD_REAGENT", containerId: cylinder.id, reagentId: mintReagentId("water"), volumeMl: 25 });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error).toEqual({ kind: "OVER_CAPACITY", containerId: cylinder.id, capacityMl: 100, currentMl: 80, attemptedMl: 25, maxAddableMl: 20 });

    // Rejections never mutate: `filled` still reads exactly as it did before the failed dispatch.
    const stillFilled = filled.objects.find((o) => o.id === cylinder.id);
    expect(stillFilled && stillFilled.kind === "container" ? stillFilled.volumeMl : null).toBe(80);
  });

  it("rejects DISPENSE beyond what's in the burette with INSUFFICIENT_VOLUME", () => {
    const buretteState = applyOk(sandboxState(), { kind: "PLACE_OBJECT", objectType: "burette" });
    const burette = buretteState.objects[buretteState.objects.length - 1];
    if (!burette || burette.kind !== "container") throw new Error("unreachable");
    const placed = placeBeakers(buretteState, 1);
    const flaskId = placed.ids[0];
    if (!flaskId) throw new Error("unreachable");

    const filled = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: burette.id, reagentId: mintReagentId("naoh"), volumeMl: 20, concentrationM: 0.1 });

    const res = applyCommand(filled, { kind: "DISPENSE", buretteId: burette.id, toId: flaskId, volumeMl: 25 });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error).toEqual({ kind: "INSUFFICIENT_VOLUME", containerId: burette.id, availableMl: 20, requestedMl: 25 });
  });

  it.each([0, -5, Number.NaN])("rejects ADD_REAGENT volumeMl=%s with INVALID_AMOUNT", (volumeMl) => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");
    const res = applyCommand(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("water"), volumeMl });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error.kind).toBe("INVALID_AMOUNT");
  });
});
