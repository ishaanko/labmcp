import { describe, expect, it } from "vitest";
import { mintReagentId } from "../ids";
import { applyCommand } from "../reducer";
import { applyOk, placeBeakers, sandboxState } from "./helpers";

describe("NO_REACTION", () => {
  it("mixing NaCl and CuSO4 fires no reaction rule and reports exactly one NO_REACTION with no solids formed", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    const afterSalt = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("nacl"), volumeMl: 20, concentrationM: 0.1 });
    const res = applyCommand(afterSalt, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("cuso4"), volumeMl: 20, concentrationM: 0.1 });
    if (!res.ok) throw new Error("unreachable");

    const noReactionEvents = res.value.events.filter((o) => o.event.kind === "NO_REACTION");
    expect(noReactionEvents).toHaveLength(1);
    const reactionEvents = res.value.events.filter((o) => o.event.kind === "REACTION" || o.event.kind === "PRECIPITATE_FORMED");
    expect(reactionEvents).toHaveLength(0);

    const container = res.value.state.objects.find((o) => o.id === id);
    expect(container && container.kind === "container" ? container.solids : []).toHaveLength(0);
  });

  it("adding water to HCl never reports NO_REACTION, and pH rises as the acid dilutes", () => {
    const placed = placeBeakers(sandboxState(), 1);
    const id = placed.ids[0];
    if (!id) throw new Error("unreachable");

    const afterAcid = applyOk(placed.state, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("hcl"), volumeMl: 20, concentrationM: 0.1 });
    const res = applyCommand(afterAcid, { kind: "ADD_REAGENT", containerId: id, reagentId: mintReagentId("water"), volumeMl: 60 });
    if (!res.ok) throw new Error("unreachable");

    expect(res.value.events.some((o) => o.event.kind === "NO_REACTION")).toBe(false);
    const phChange = res.value.events.find((o) => o.event.kind === "PH_CHANGE");
    if (!phChange || phChange.event.kind !== "PH_CHANGE") throw new Error("expected a PH_CHANGE observation from diluting a strong acid");
    expect(phChange.event.to).toBeGreaterThan(phChange.event.from);
  });
});
