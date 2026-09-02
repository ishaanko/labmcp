import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { applyCommand } from "../reducer";
import { getMoles, SP } from "../species";
import type { Container } from "../types";
import { applyOk, approx, placeBeakers, sandboxState } from "./helpers";

function containerOf(state: ReturnType<typeof applyOk>, id: string): Container {
  const found = state.objects.find((o) => o.id === id);
  if (!found || found.kind !== "container") throw new Error(`unreachable: ${id} is not a container`);
  return found;
}

describe("neutralization via the reducer", () => {
  it("25 mL 0.1 M HCl + 10 mL 0.1 M NaOH leaves excess H+, consumes all OH-, and heats by ~0.39 C", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable: placeBeakers(1) returns 1 id");

    const afterAcid = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("hcl"), volumeMl: 25, concentrationM: 0.1 });
    const tempBefore = containerOf(afterAcid, id).temperatureC;

    const state = applyOk(afterAcid, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("naoh"), volumeMl: 10, concentrationM: 0.1 });
    const container = containerOf(state, id);

    expect(approx(getMoles(container.species, SP.H), 0.0015, 1e-9)).toBe(true);
    expect(approx(getMoles(container.species, SP.OH), 0, 1e-12)).toBe(true);
    expect(approx(getMoles(container.species, SP.Na), 0.001, 1e-9)).toBe(true);
    expect(approx(getMoles(container.species, SP.Cl), 0.0025, 1e-9)).toBe(true);
    expect(approx(container.temperatureC - tempBefore, 0.39, 0.02)).toBe(true);
  });

  it("emits a REACTION observation limited by OH-", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable: placeBeakers(1) returns 1 id");
    const afterAcid = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("hcl"), volumeMl: 25, concentrationM: 0.1 });

    const dispatched = applyCommand(afterAcid, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("naoh"), volumeMl: 10, concentrationM: 0.1 });
    if (!dispatched.ok) throw new Error("unreachable: valid ADD_REAGENT rejected");

    const reaction = dispatched.value.events.find((o) => o.event.kind === "REACTION");
    if (!reaction || reaction.event.kind !== "REACTION") throw new Error("expected a REACTION observation");
    expect(reaction.event.limiting).toBe(SP.OH);
    expect(approx(reaction.event.extentMol, 0.001, 1e-9)).toBe(true);
  });
});
