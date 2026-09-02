import { describe, expect, it } from "vitest";
import { mintIndicatorId, mintInstrumentId, mintReagentId, type ContainerId } from "../ids";
import { applyCommand } from "../reducer";
import { loadScenario } from "../scenarios";
import { scenarioProgress } from "../scenarioProgress";
import { SP } from "../species";
import type { Container, LabState, Observation } from "../types";
import { applyOk } from "./helpers";

function objectiveCompletions(observations: ReadonlyArray<Observation>): ReadonlyArray<Observation> {
  return observations.filter((o) => o.event.kind === "OBJECTIVE_COMPLETE");
}

function containerById(state: LabState, id: string): Container {
  const found = state.objects.find((o) => o.id === id);
  if (!found || found.kind !== "container") throw new Error(`unreachable: ${id} is not a container`);
  return found;
}

describe("scenarioProgress: sandbox", () => {
  it("has no steps and is never complete", () => {
    const progress = scenarioProgress(loadScenario("sandbox", 1));
    expect(progress.steps).toHaveLength(0);
    expect(progress.complete).toBe(false);
  });
});

describe("scenarioProgress: titration", () => {
  it("drives probe, indicator, endpoint and reveal to completion, firing OBJECTIVE_COMPLETE once", () => {
    const state = loadScenario("titration", 1);
    if (state.scenario.kind !== "titration") throw new Error("unreachable");
    const { flaskId, buretteId } = state.scenario;

    let cur = applyOk(state, { kind: "ATTACH_INSTRUMENT", instrumentId: mintInstrumentId(3), containerId: flaskId });
    cur = applyOk(cur, { kind: "ADD_INDICATOR", containerId: flaskId, indicator: mintIndicatorId("phenolphthalein"), drops: 2 });

    let progress = scenarioProgress(cur);
    expect(progress.steps.map((s) => s.done)).toEqual([true, true, false, false]);
    expect(progress.complete).toBe(false);

    // 50 mL of 0.1 M NaOH vastly overshoots a 25 mL, 0.08-0.12 M acid flask, so the phenolphthalein
    // band (colorless below pH 8.2) is guaranteed to flip somewhere across the burette's full volume.
    for (let i = 0; i < 10; i++) cur = applyOk(cur, { kind: "DISPENSE", buretteId, toId: flaskId, volumeMl: 5 });

    progress = scenarioProgress(cur);
    expect(progress.steps.map((s) => s.done)).toEqual([true, true, true, false]);
    expect(progress.complete).toBe(false);

    const revealResult = applyCommand(cur, { kind: "REVEAL" }, "agent");
    if (!revealResult.ok) throw new Error("unreachable");
    expect(scenarioProgress(revealResult.value.state).complete).toBe(true);
    expect(objectiveCompletions(revealResult.value.events)).toHaveLength(1);
    expect(objectiveCompletions(revealResult.value.state.observations)).toHaveLength(1);

    // Revealing again (idempotent in real use) must not re-fire the already-complete objective.
    const again = applyCommand(revealResult.value.state, { kind: "REVEAL" }, "agent");
    if (!again.ok) throw new Error("unreachable");
    expect(objectiveCompletions(again.value.events)).toHaveLength(0);
    expect(objectiveCompletions(again.value.state.observations)).toHaveLength(1);
  });
});

describe("scenarioProgress: precipitation", () => {
  it("completes once AgCl and a second, different precipitate have both formed", () => {
    const state = loadScenario("precipitation", 2);
    if (state.scenario.kind !== "precipitation") throw new Error("unreachable");
    const beaker2 = state.objects.filter((o) => o.kind === "container")[1];
    if (!beaker2) throw new Error("unreachable");

    let cur = applyOk(state, { kind: "ADD_REAGENT", containerId: state.scenario.beakerId, reagentId: mintReagentId("agno3"), volumeMl: 20, concentrationM: 0.1 });
    cur = applyOk(cur, { kind: "ADD_REAGENT", containerId: state.scenario.beakerId, reagentId: mintReagentId("nacl"), volumeMl: 20, concentrationM: 0.1 });

    let progress = scenarioProgress(cur);
    expect(progress.steps.map((s) => s.done)).toEqual([true, false]);
    expect(progress.complete).toBe(false);

    cur = applyOk(cur, { kind: "ADD_REAGENT", containerId: beaker2.id, reagentId: mintReagentId("cuso4"), volumeMl: 20, concentrationM: 0.1 });
    const finalResult = applyCommand(cur, { kind: "ADD_REAGENT", containerId: beaker2.id, reagentId: mintReagentId("naoh"), volumeMl: 40, concentrationM: 0.1 });
    if (!finalResult.ok) throw new Error("unreachable");

    progress = scenarioProgress(finalResult.value.state);
    expect(progress.steps.map((s) => s.done)).toEqual([true, true]);
    expect(progress.complete).toBe(true);
    expect(objectiveCompletions(finalResult.value.events)).toHaveLength(1);
    expect(objectiveCompletions(finalResult.value.state.observations)).toHaveLength(1);
  });
});

describe("scenarioProgress: neutralize", () => {
  it("completes once the pH meter is attached and the beaker is brought to pH 7.0 ± 0.1", () => {
    const state = loadScenario("neutralize", 3);
    if (state.scenario.kind !== "neutralize") throw new Error("unreachable");
    const { beakerId, secrets } = state.scenario;

    const attached = applyOk(state, { kind: "ATTACH_INSTRUMENT", instrumentId: mintInstrumentId(2), containerId: beakerId });
    expect(scenarioProgress(attached).complete).toBe(false);

    // 50 mL beaker at secrets.startM of a weak acid or base, neutralized exactly with its weak
    // counterpart at 0.1 M: acetic acid (pKa 4.76) against ammonia (pKb 4.76) gives pH 7.00 at
    // equivalence.
    const counterReagent = mintReagentId(secrets.startReagent === "acetic_acid" ? "ammonia" : "acetic_acid");
    const counterMl = (secrets.startM * 50) / 0.1;
    const finalResult = applyCommand(attached, { kind: "ADD_REAGENT", containerId: beakerId, reagentId: counterReagent, volumeMl: counterMl, concentrationM: 0.1 }, "agent");
    if (!finalResult.ok) throw new Error("unreachable");

    const progress = scenarioProgress(finalResult.value.state);
    expect(progress.steps.map((s) => s.done)).toEqual([true, true]);
    expect(progress.complete).toBe(true);
    expect(progress.detail).toMatch(/^pH 7\.00, target 7\.0/);
    expect(objectiveCompletions(finalResult.value.events)).toHaveLength(1);
    expect(objectiveCompletions(finalResult.value.state.observations)).toHaveLength(1);
  });

  it("has no detail line until the target is reached; the readout owns the live pH", () => {
    expect(scenarioProgress(loadScenario("neutralize", 3)).detail).toBe("");
  });
});

describe("scenarioProgress: dilution", () => {
  it("completes once a container holds 100 mL of 0.10 M sodium chloride diluted from the 1.0 M stock", () => {
    const state = loadScenario("dilution", 4);
    if (state.scenario.kind !== "dilution") throw new Error("unreachable");
    const beaker = state.objects.filter((o) => o.kind === "container")[1];
    if (!beaker) throw new Error("unreachable");

    const withSalt = applyOk(state, { kind: "ADD_REAGENT", containerId: beaker.id, reagentId: mintReagentId("nacl"), volumeMl: 10, concentrationM: 1.0 });
    let progress = scenarioProgress(withSalt);
    expect(progress.steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(progress.complete).toBe(false);

    const finalResult = applyCommand(withSalt, { kind: "ADD_REAGENT", containerId: beaker.id, reagentId: mintReagentId("water"), volumeMl: 90 }, "agent");
    if (!finalResult.ok) throw new Error("unreachable");

    progress = scenarioProgress(finalResult.value.state);
    expect(progress.steps.map((s) => s.done)).toEqual([true, true, true]);
    expect(progress.complete).toBe(true);
    expect(progress.detail).toBe(`${beaker.label}: 100.0 mL, 0.100 M`);
    expect(objectiveCompletions(finalResult.value.events)).toHaveLength(1);
    expect(objectiveCompletions(finalResult.value.state.observations)).toHaveLength(1);
  });
});

describe("scenarioProgress: solubility", () => {
  /**
   * Milestones are sticky and latch from the beaker's actual dissolved/undissolved KNO3 and
   * temperature (computed by the reducer's per-command hook), so this drives them through direct
   * state edits plus a harmless TICK, matching how titration_curve.test.ts's titrationWith()
   * seeds a container's species directly for its own setup.
   */
  it("latches all four sticky milestones in order and fires OBJECTIVE_COMPLETE exactly once", () => {
    const state = loadScenario("solubility", 5);
    if (state.scenario.kind !== "solubility") throw new Error("unreachable");
    const { beakerId } = state.scenario;
    const molarMassKno3 = 101.1;

    const withBeaker = (s: LabState, patch: Partial<Container>): LabState => ({
      ...s,
      objects: s.objects.map((o) => (o.id === beakerId ? { ...containerById(s, beakerId), ...patch } : o)),
    });
    // A no-op MOVE_OBJECT (same position) runs the reducer's generic pipeline, and with it the
    // solubility-milestone hook, without invoking equilibrateSolubility the way TICK or a real
    // ADD_REAGENT/HEAT would; the milestones read the injected state as-is instead of physical.ts
    // correcting these hand-picked (and not necessarily curve-accurate) grams back toward equilibrium.
    const settle = (s: LabState): LabState => {
      const res = applyCommand(s, { kind: "MOVE_OBJECT", objectId: beakerId, position: containerById(s, beakerId).position });
      if (!res.ok) throw new Error("unreachable");
      return res.value.state;
    };

    // A fresh room-temperature deposit with leftover solid must not count as "cooled with
    // crystals": that step only opens once the solute has fully dissolved hot.
    const fresh = settle(withBeaker(state, { species: { [SP.K]: 5 / molarMassKno3 }, solids: [{ species: SP.KNO3Solid, moles: 15 / molarMassKno3, suspended: 0 }], temperatureC: 22 }));
    expect(scenarioProgress(fresh).steps.map((s) => s.done)).toEqual([true, true, false, false]);

    // 25 g dissolved, nothing undissolved: only the "20 g added" milestone latches.
    let cur = settle(withBeaker(state, { species: { [SP.K]: 25 / molarMassKno3 }, solids: [], temperatureC: 22 }));
    expect(scenarioProgress(cur).steps.map((s) => s.done)).toEqual([true, false, false, false]);

    // Some of that 25 g crystallizes back out as undissolved solid, kept above 30 °C so this
    // stage doesn't also (correctly, but not what this stage is testing) satisfy "cooled below
    // 30 °C with crystals" for free.
    cur = settle(withBeaker(cur, { species: { [SP.K]: 15 / molarMassKno3 }, solids: [{ species: SP.KNO3Solid, moles: 10 / molarMassKno3, suspended: 0 }], temperatureC: 35 }));
    expect(scenarioProgress(cur).steps.map((s) => s.done)).toEqual([true, true, false, false]);

    // Heated to exactly 60 °C (the hotplate's own preset settles there) with everything dissolved.
    cur = settle(withBeaker(cur, { species: { [SP.K]: 25 / molarMassKno3 }, solids: [], temperatureC: 60 }));
    expect(scenarioProgress(cur).steps.map((s) => s.done)).toEqual([true, true, true, false]);

    // Cooled well below 30 °C with crystals back: this is the completing step.
    const finalState = settle(
      withBeaker(cur, { species: { [SP.K]: 15 / molarMassKno3 }, solids: [{ species: SP.KNO3Solid, moles: 10 / molarMassKno3, suspended: 0 }], temperatureC: 20 }),
    );

    const progress = scenarioProgress(finalState);
    expect(progress.steps.map((s) => s.done)).toEqual([true, true, true, true]);
    expect(progress.complete).toBe(true);
    expect(progress.detail).toBe("Crystals returned at 20.0 °C.");
    expect(objectiveCompletions(finalState.observations)).toHaveLength(1);
  });
});

describe("scenarioProgress: unknown_id", () => {
  /** The sample whose hidden recipe is `slug`; every draw holds hcl and na2co3 (scenarios.ts). */
  function sampleOf(state: LabState, slug: string): { readonly containerId: ContainerId } {
    if (state.scenario.kind !== "unknown_id") throw new Error("unreachable");
    const { samples, secrets } = state.scenario;
    const found = samples.find((s) => secrets[s.shelfId]?.reagentId === mintReagentId(slug));
    if (!found) throw new Error(`unreachable: no ${slug} sample`);
    return found;
  }

  it("completes once a precipitate, a gas, and REVEAL have all happened, firing OBJECTIVE_COMPLETE once", () => {
    const state = loadScenario("unknown_id", 10);
    if (state.scenario.kind !== "unknown_id") throw new Error("unreachable");
    const acid = sampleOf(state, "hcl");
    const carbonate = sampleOf(state, "na2co3");

    // Shelf AgNO3 into the HCl sample precipitates AgCl.
    let cur = applyOk(state, { kind: "ADD_REAGENT", containerId: acid.containerId, reagentId: mintReagentId("agno3"), volumeMl: 20, concentrationM: 0.1 });
    let progress = scenarioProgress(cur);
    expect(progress.steps.map((s) => s.done)).toEqual([true, false, false]);

    // Na2CO3 sample + shelf HCl: the first equivalent only protonates to bicarbonate. 0.4 M
    // keeps each 5 mL dose within the 50 mL sample beaker's headroom above its starting 20 mL.
    cur = applyOk(cur, { kind: "ADD_REAGENT", containerId: carbonate.containerId, reagentId: mintReagentId("hcl"), volumeMl: 5, concentrationM: 0.4 });
    expect(scenarioProgress(cur).steps.map((s) => s.done)).toEqual([true, false, false]);

    // The second equivalent releases CO2.
    cur = applyOk(cur, { kind: "ADD_REAGENT", containerId: carbonate.containerId, reagentId: mintReagentId("hcl"), volumeMl: 5, concentrationM: 0.4 });
    progress = scenarioProgress(cur);
    expect(progress.steps.map((s) => s.done)).toEqual([true, true, false]);
    expect(progress.complete).toBe(false);

    const finalResult = applyCommand(cur, { kind: "REVEAL" }, "agent");
    if (!finalResult.ok) throw new Error("unreachable");

    progress = scenarioProgress(finalResult.value.state);
    expect(progress.steps.map((s) => s.done)).toEqual([true, true, true]);
    expect(progress.complete).toBe(true);
    expect(progress.detail).toBe("Identities revealed.");
    expect(objectiveCompletions(finalResult.value.events)).toHaveLength(1);
    expect(objectiveCompletions(finalResult.value.state.observations)).toHaveLength(1);
  });

  it("is reachable on every seed: the gas step needs a carbonate sample and an acid, and each draw holds both", () => {
    for (let seed = 1; seed <= 16; seed++) {
      const state = loadScenario("unknown_id", seed);
      const carbonate = sampleOf(state, "na2co3");
      sampleOf(state, "hcl");
      let cur = state;
      for (let i = 0; i < 2; i++) cur = applyOk(cur, { kind: "ADD_REAGENT", containerId: carbonate.containerId, reagentId: mintReagentId("hcl"), volumeMl: 5, concentrationM: 0.4 });
      expect(scenarioProgress(cur).steps[1]?.done, `seed ${seed}`).toBe(true);
    }
  });
});
