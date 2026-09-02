import { describe, expect, it } from "vitest";
import { mintInstrumentId, mintReagentId } from "../ids";
import { applyCommand } from "../reducer";
import { reagentDef, stockToMoles } from "../reagents";
import { estimateEquivalenceMl, loadScenario, titrationCurve } from "../scenarios";
import type { LabState } from "../types";
import { applyOk } from "./helpers";

/** A titration state with a chosen analyteM, so equivalenceMl lands at a known point for the test script below. */
function titrationWith(analyteM: number): LabState {
  const base = loadScenario("titration", 1);
  if (base.scenario.kind !== "titration") throw new Error("unreachable");
  const hcl = reagentDef(mintReagentId("hcl"));
  if (!hcl || hcl.kind !== "solution") throw new Error("unreachable: hcl missing from registry");
  const species = stockToMoles(hcl, base.scenario.analyteMl, analyteM);
  const flaskId = base.scenario.flaskId;
  return {
    ...base,
    objects: base.objects.map((o) => (o.kind === "container" && o.id === flaskId ? { ...o, species } : o)),
    scenario: { ...base.scenario, secrets: { analyteM } },
  };
}

function dispense(state: LabState, volumeMl: number): LabState {
  if (state.scenario.kind !== "titration") throw new Error("unreachable: not a titration scenario");
  return applyOk(state, { kind: "DISPENSE", buretteId: state.scenario.buretteId, toId: state.scenario.flaskId, volumeMl });
}

describe("titration curve", () => {
  it("appends one monotonically increasing titrantMl point per DISPENSE, and estimates equivalence within 0.1 mL", () => {
    // analyteM = 0.101 puts equivalence at 25 * 0.101 / 0.1 = 25.25 mL, inside the fine-step window below.
    let state = titrationWith(0.101);
    if (state.scenario.kind !== "titration") throw new Error("unreachable");

    const phMeterId = mintInstrumentId(3);
    const attach = applyCommand(state, { kind: "ATTACH_INSTRUMENT", instrumentId: phMeterId, containerId: state.scenario.flaskId });
    if (!attach.ok) throw new Error("unreachable: attaching the scenario's own ph_meter should never fail");
    state = attach.value.state;

    for (let i = 0; i < 5; i++) state = dispense(state, 5);
    for (let i = 0; i < 5; i++) state = dispense(state, 0.1);

    const curve = titrationCurve(state);
    expect(curve).toHaveLength(10);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.titrantMl).toBeGreaterThan(curve[i - 1]!.titrantMl);
    }
    expect(curve.every((p) => p.pH !== null)).toBe(true);

    const estimate = estimateEquivalenceMl(curve);
    expect(estimate).not.toBeNull();
    expect(Math.abs((estimate ?? 0) - 25.25)).toBeLessThanOrEqual(0.1);
  });

  it("records a null pH when no ph_meter is attached to the flask", () => {
    const state = titrationWith(0.1);
    const after = dispense(state, 5);
    const curve = titrationCurve(after);
    expect(curve).toHaveLength(1);
    expect(curve[0]?.pH).toBeNull();
  });
});
