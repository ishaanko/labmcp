import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { advanceTime } from "../reducer";
import { approx, applyOk, placeBeakers, sandboxState } from "./helpers";

function containerOf(state: ReturnType<typeof applyOk>, id: string) {
  const found = state.objects.find((o) => o.id === id);
  if (!found || found.kind !== "container") throw new Error(`unreachable: ${id} is not a container`);
  return found;
}

describe("advanceTime", () => {
  it("heats at 1.5 C/s toward the target, then snaps to it once within range", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");
    const heating = applyOk(placed.state, { kind: "HEAT", containerId: id, targetC: 60 });
    expect(containerOf(heating, id).temperatureC).toBe(22);

    const after10s = advanceTime(heating, 10).state;
    expect(approx(containerOf(after10s, id).temperatureC, 37, 1e-9)).toBe(true);

    const after40MoreS = advanceTime(after10s, 40).state;
    expect(containerOf(after40MoreS, id).temperatureC).toBe(60);
  });

  it("a container left idle (thermal never set) relaxes toward ambient at the slow passive rate after reaction heat", () => {
    // Neutralization warms the container by reaction heat alone; thermal stays 'idle' the whole time,
    // so subsequent ticks use PASSIVE_RATE_C_PER_S (0.05 C/s), not the 1.5 C/s active HEAT/COOL rate.
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");
    let state = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("hcl"), volumeMl: 25, concentrationM: 0.1 });
    state = applyOk(state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("naoh"), volumeMl: 25, concentrationM: 0.1 });
    const warmed = containerOf(state, id);
    expect(warmed.thermal.kind).toBe("idle");
    expect(warmed.temperatureC).toBeGreaterThan(22);

    const after10s = advanceTime(state, 10).state;
    const expected = warmed.temperatureC - Math.min(0.5, warmed.temperatureC - 22);
    expect(approx(containerOf(after10s, id).temperatureC, expected, 1e-9)).toBe(true);
    expect(containerOf(after10s, id).temperatureC).toBeLessThan(warmed.temperatureC);
  });

  it("keeps solids fully suspended while stirring and settles them over SETTLE_S once stopped", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    let state = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("agno3"), volumeMl: 10, concentrationM: 0.1 });
    state = applyOk(state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("nacl"), volumeMl: 10, concentrationM: 0.1 });
    expect(containerOf(state, id).solids[0]?.suspended).toBe(1);

    state = applyOk(state, { kind: "STIR", containerId: id, durationS: 3 });
    const stillStirring = advanceTime(state, 2).state;
    expect(containerOf(stillStirring, id).solids[0]?.suspended).toBe(1);
    expect(containerOf(stillStirring, id).stir.kind).toBe("stirring");

    const stopped = advanceTime(stillStirring, 2).state;
    expect(containerOf(stopped, id).stir.kind).toBe("still");

    const halfSettled = advanceTime(stopped, 3).state;
    expect(approx(containerOf(halfSettled, id).solids[0]?.suspended ?? -1, 0.5, 1e-9)).toBe(true);

    const settled = advanceTime(halfSettled, 3).state;
    expect(containerOf(settled, id).solids[0]?.suspended).toBe(0);
    expect(settled.observations.some((o) => o.event.kind === "SOLIDS_SETTLED")).toBe(true);
  });

  it("expires gas effects once their duration elapses", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    let state = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("na2co3"), volumeMl: 20, concentrationM: 0.1 });
    state = applyOk(state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("hcl"), volumeMl: 40, concentrationM: 0.1 });
    const gas = containerOf(state, id).gasEffects[0];
    if (!gas) throw new Error("unreachable: expected a CO2 gas effect");

    const after = advanceTime(state, gas.remainingS + 1).state;
    expect(containerOf(after, id).gasEffects).toHaveLength(0);
  });
});
