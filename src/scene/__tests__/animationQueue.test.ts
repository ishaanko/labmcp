import { beforeEach, describe, expect, it } from "vitest";
import {
  applyCommand,
  createEmptyState,
  loadScenario,
  mintContainerId,
  mintIndicatorId,
  mintReagentId,
  type LabState,
  type Observation,
} from "@/engine";
import { useLabStore } from "@/store/labStore";
import { colorTweens, targets, visualFor, visuals } from "../visualStore";
import { clearEffects, isSourceActive, listEffects, nowMs } from "../effectsStore";
import { cancelPoseJobs, clear, enqueue, tick } from "../animationQueue";

const FLASK_ID = mintContainerId(1);
const BURETTE_ID = mintContainerId(2);

interface DispenseFixture {
  readonly before: LabState;
  readonly after: LabState;
  readonly events: ReadonlyArray<Observation>;
}

/**
 * Exercises the queue against the real engine reducer (titration scenario), so these tests
 * catch drift between the event shapes the engine actually emits and what the jobs expect.
 */
function dispenseTitration(volumeMl = 5): DispenseFixture {
  const before = loadScenario("titration", 1);
  const applied = applyCommand(before, { kind: "DISPENSE", buretteId: BURETTE_ID, toId: FLASK_ID, volumeMl }, "agent");
  if (!applied.ok) throw new Error(`fixture command was rejected: ${applied.error.kind}`);
  return { before, after: applied.value.state, events: applied.value.events };
}

/** Two sandbox beakers, the first holding 50 mL of water, ready to pour into the second. */
function pourFixture(): DispenseFixture & { readonly fromId: string; readonly toId: string } {
  const sandbox = loadScenario("sandbox", 1);
  const placedFrom = applyCommand(sandbox, { kind: "PLACE_OBJECT", objectType: "beaker" }, "human");
  if (!placedFrom.ok) throw new Error(`fixture command was rejected: ${placedFrom.error.kind}`);
  const placedTo = applyCommand(placedFrom.value.state, { kind: "PLACE_OBJECT", objectType: "beaker" }, "human");
  if (!placedTo.ok) throw new Error(`fixture command was rejected: ${placedTo.error.kind}`);
  const [fromObj, toObj] = placedTo.value.state.objects.filter((o) => o.kind === "container");
  if (!fromObj || !toObj) throw new Error("fixture: beakers not placed");

  const filled = applyCommand(
    placedTo.value.state,
    { kind: "ADD_REAGENT", containerId: fromObj.id, reagentId: mintReagentId("water"), volumeMl: 50, concentrationM: 0 },
    "human",
  );
  if (!filled.ok) throw new Error(`fixture command was rejected: ${filled.error.kind}`);

  const poured = applyCommand(filled.value.state, { kind: "TRANSFER_LIQUID", fromId: fromObj.id, toId: toObj.id, volumeMl: 10 }, "human");
  if (!poured.ok) throw new Error(`fixture command was rejected: ${poured.error.kind}`);

  return { before: filled.value.state, after: poured.value.state, events: poured.value.events, fromId: fromObj.id, toId: toObj.id };
}

/** Adds phenolphthalein to the titration flask, which already holds liquid. */
function addIndicator(): DispenseFixture {
  const before = loadScenario("titration", 1);
  const applied = applyCommand(before, { kind: "ADD_INDICATOR", containerId: FLASK_ID, indicator: mintIndicatorId("phenolphthalein") }, "human");
  if (!applied.ok) throw new Error(`fixture command was rejected: ${applied.error.kind}`);
  return { before, after: applied.value.state, events: applied.value.events };
}

/** Adds phenolphthalein, then dispenses NaOH 0.5 mL at a time until the indicator crosses (C7 endpoint). */
function endpointFixture(): DispenseFixture {
  const withIndicator = applyCommand(
    loadScenario("titration", 1),
    { kind: "ADD_INDICATOR", containerId: FLASK_ID, indicator: mintIndicatorId("phenolphthalein") },
    "human",
  );
  if (!withIndicator.ok) throw new Error(`fixture command was rejected: ${withIndicator.error.kind}`);

  let state = withIndicator.value.state;
  for (let i = 0; i < 100; i++) {
    const before = state;
    const applied = applyCommand(state, { kind: "DISPENSE", buretteId: BURETTE_ID, toId: FLASK_ID, volumeMl: 0.5 }, "agent");
    if (!applied.ok) throw new Error(`fixture command was rejected: ${applied.error.kind}`);
    state = applied.value.state;
    const transitioned = applied.value.events.some((o) => o.event.kind === "COLOR_SHIFT" && o.event.indicatorTransition);
    if (transitioned) return { before, after: state, events: applied.value.events };
  }
  throw new Error("fixture never reached the indicator transition");
}

/** A sandbox beaker fizzing CO2: bicarbonate first, then excess acid to fire the gas rule. */
function bubblingBeaker(): DispenseFixture & { readonly beakerId: string } {
  const sandbox = loadScenario("sandbox", 1);
  const placed = applyCommand(sandbox, { kind: "PLACE_OBJECT", objectType: "beaker" }, "human");
  if (!placed.ok) throw new Error(`fixture command was rejected: ${placed.error.kind}`);
  const beaker = placed.value.state.objects.find((o) => o.kind === "container");
  if (!beaker) throw new Error("fixture: beaker not placed");

  const afterBicarb = applyCommand(
    placed.value.state,
    { kind: "ADD_REAGENT", containerId: beaker.id, reagentId: mintReagentId("nahco3"), volumeMl: 50, concentrationM: 0.5 },
    "human",
  );
  if (!afterBicarb.ok) throw new Error(`fixture command was rejected: ${afterBicarb.error.kind}`);

  const afterAcid = applyCommand(
    afterBicarb.value.state,
    { kind: "ADD_REAGENT", containerId: beaker.id, reagentId: mintReagentId("hcl"), volumeMl: 50, concentrationM: 1 },
    "human",
  );
  if (!afterAcid.ok) throw new Error(`fixture command was rejected: ${afterAcid.error.kind}`);

  return { before: afterBicarb.value.state, after: afterAcid.value.state, events: afterAcid.value.events, beakerId: beaker.id };
}

beforeEach(() => {
  visuals.clear();
  targets.clear();
  clearEffects();
  useLabStore.getState().setReducedMotion(false);
});

describe("enqueue + tick", () => {
  it("drains a burette dispense into the flask's target volume/color", () => {
    const { before, after, events } = dispenseTitration();
    clear(before);
    enqueue({ prev: before, next: after, events, actor: "agent", version: 1 });

    // A 5 mL dispense streams for a beat before the level actually moves; the target holds at
    // its pre-dispense value until that beat elapses.
    tick(0.05);
    expect(targets.get("c_1")?.displayedVolumeMl).toBeCloseTo(25, 5);

    tick(0.3);
    expect(targets.get("c_1")?.displayedVolumeMl).toBeCloseTo(30, 5);
    expect(targets.get("c_2")?.displayedVolumeMl).toBeCloseTo(45, 5);
  });

  it("snaps immediately under reduced motion", () => {
    const { before, after, events } = dispenseTitration();
    clear(before);
    useLabStore.getState().setReducedMotion(true);
    enqueue({ prev: before, next: after, events, actor: "human", version: 1 });

    expect(targets.get("c_1")?.displayedVolumeMl).toBeCloseTo(30, 5);
  });

  it("pulses the agent ring and lets it fall back to 0", () => {
    const { before, after, events } = dispenseTitration();
    clear(before);
    enqueue({ prev: before, next: after, events, actor: "agent", version: 1 });

    expect(targets.get("c_1")?.agentRing).toBeCloseTo(0.9, 5);
    for (let i = 0; i < 30; i++) tick(1 / 60);
    expect(targets.get("c_1")?.agentRing).toBe(0);
  });

  it("does not pulse the agent ring for a human action", () => {
    const { before, after, events } = dispenseTitration();
    clear(before);
    enqueue({ prev: before, next: after, events, actor: "human", version: 1 });
    expect(visualFor("c_1").agentRing).toBe(0);
  });

  it("clears bubbling once its duration elapses, even under reduced motion", () => {
    const { before, after, events, beakerId } = bubblingBeaker();
    const bubbles = events.map((o) => o.event).find((e) => e.kind === "BUBBLES");
    if (!bubbles || bubbles.kind !== "BUBBLES") throw new Error("fixture did not fire BUBBLES");

    clear(before);
    useLabStore.getState().setReducedMotion(true);
    enqueue({ prev: before, next: after, events, actor: "human", version: 1 });

    expect(targets.get(beakerId)?.bubbleIntensity).toBeGreaterThan(0);
    tick(bubbles.durationS + 0.1);
    expect(targets.get(beakerId)?.bubbleIntensity).toBe(0);
  });
});

describe("endpoint beat (C5 COLOR_SHIFT indicatorTransition, C7)", () => {
  it("runs a timed color tween and lifts meniscusBoost, scheduled back to 0 at 800ms", () => {
    const { before, after, events } = endpointFixture();
    clear(before);
    enqueue({ prev: before, next: after, events, actor: "agent", version: 1 });

    expect(colorTweens.has(FLASK_ID)).toBe(true);
    expect(colorTweens.get(FLASK_ID)?.durationMs).toBe(800);
    expect(targets.get(FLASK_ID)?.meniscusBoost).toBe(1);

    tick(0.9);
    expect(targets.get(FLASK_ID)?.meniscusBoost).toBe(0);
  });

  it("shortens the beat to 150ms under reduced motion", () => {
    const { before, after, events } = endpointFixture();
    clear(before);
    useLabStore.getState().setReducedMotion(true);
    enqueue({ prev: before, next: after, events, actor: "agent", version: 1 });

    expect(colorTweens.get(FLASK_ID)?.durationMs).toBe(150);
    tick(0.2);
    expect(targets.get(FLASK_ID)?.meniscusBoost).toBe(0);
  });
});

describe("backpressure", () => {
  it("coalesces a burst of small dispenses onto one target instead of queuing them all", () => {
    let state = loadScenario("titration", 2);
    clear(state);

    for (let i = 0; i < 10; i++) {
      const before = state;
      const applied = applyCommand(state, { kind: "DISPENSE", buretteId: BURETTE_ID, toId: FLASK_ID, volumeMl: 0.5 }, "agent");
      if (!applied.ok) throw new Error(`fixture command was rejected: ${applied.error.kind}`);
      state = applied.value.state;
      enqueue({ prev: before, next: state, events: applied.value.events, actor: "agent", version: i });
    }

    // Whatever backpressure did to the individual scheduled actions, once they have all had a
    // chance to run the target lands on the latest canonical volume.
    for (let i = 0; i < 60; i++) tick(1 / 60);
    expect(targets.get("c_1")?.displayedVolumeMl).toBeCloseTo(30, 5);
  });

  it("flushes a stir terminator instead of dropping it when a later burst overflows the queue", () => {
    let state = loadScenario("sandbox", 6);
    const placed = applyCommand(state, { kind: "PLACE_OBJECT", objectType: "beaker" }, "human");
    if (!placed.ok) throw new Error(`fixture command was rejected: ${placed.error.kind}`);
    state = placed.value.state;
    const beaker = state.objects.find((o) => o.kind === "container");
    if (!beaker) throw new Error("fixture: beaker not placed");
    clear(state);

    const stirred = applyCommand(state, { kind: "STIR", containerId: beaker.id, durationS: 3 }, "human");
    if (!stirred.ok) throw new Error(`fixture command was rejected: ${stirred.error.kind}`);
    enqueue({ prev: state, next: stirred.value.state, events: stirred.value.events, actor: "human", version: 1 });
    state = stirred.value.state;
    expect(targets.get(beaker.id)?.stirring).toBe(1);

    // A burst of small reagent additions on the same vessel, past the queue's 6-action limit.
    for (let i = 0; i < 8; i++) {
      const before = state;
      const applied = applyCommand(state, { kind: "ADD_REAGENT", containerId: beaker.id, reagentId: mintReagentId("water"), volumeMl: 1 }, "human");
      if (!applied.ok) throw new Error(`fixture command was rejected: ${applied.error.kind}`);
      state = applied.value.state;
      enqueue({ prev: before, next: state, events: applied.value.events, actor: "human", version: 2 + i });
    }

    // The burst must flush the stir terminator rather than silently drop it.
    expect(targets.get(beaker.id)?.stirring).toBe(0);
  });
});

describe("clear", () => {
  it("seeds every container's visual and target to its canonical volume/temperature", () => {
    const state = loadScenario("titration", 3);
    clear(state);
    const flask = state.objects.find((o) => o.id === "c_1");
    if (!flask || flask.kind !== "container") throw new Error("fixture missing c_1");

    expect(visuals.get("c_1")?.displayedVolumeMl).toBeCloseTo(flask.volumeMl, 5);
    expect(targets.get("c_1")?.displayedVolumeMl).toBeCloseTo(flask.volumeMl, 5);
    expect(visuals.get("c_1")?.temperatureC).toBeCloseTo(flask.temperatureC, 5);
  });

  it("drops stale ids from a previous scenario", () => {
    const first = loadScenario("titration", 4);
    clear(first);
    expect(visuals.has("c_1")).toBe(true);

    const empty = createEmptyState(5);
    clear(empty);
    expect(visuals.has("c_1")).toBe(false);
  });
});

describe("effects (C3.7 stream/drop/ripple)", () => {
  it("drops onto the target then ripples on impact for a <=1 mL dispense", () => {
    const { before, after, events } = dispenseTitration(0.5);
    clear(before);
    enqueue({ prev: before, next: after, events, actor: "agent", version: 1 });

    expect(listEffects().some((e) => e.kind === "drop" && e.sourceId === BURETTE_ID)).toBe(true);
    expect(listEffects().some((e) => e.kind === "ripple")).toBe(false);
    expect(isSourceActive(BURETTE_ID, nowMs())).toBe(true);

    tick(0.13);
    expect(listEffects().some((e) => e.kind === "ripple")).toBe(true);
  });

  it("streams from the burette tip for a >1 mL dispense", () => {
    const { before, after, events } = dispenseTitration(5);
    clear(before);
    enqueue({ prev: before, next: after, events, actor: "agent", version: 1 });

    const stream = listEffects().find((e) => e.kind === "stream");
    expect(stream?.sourceId).toBe(BURETTE_ID);
    expect(isSourceActive(BURETTE_ID, nowMs())).toBe(true);
  });

  it("spawns nothing under reduced motion", () => {
    const { before, after, events } = dispenseTitration(0.5);
    clear(before);
    useLabStore.getState().setReducedMotion(true);
    enqueue({ prev: before, next: after, events, actor: "agent", version: 1 });

    expect(listEffects()).toHaveLength(0);
  });

  it("streams from the source vessel once a pour reaches its tilt phase", () => {
    const { before, after, events } = pourFixture();
    clear(before);
    enqueue({ prev: before, next: after, events, actor: "human", version: 1 });

    expect(listEffects().some((e) => e.kind === "stream")).toBe(false);
    tick(0.25);
    expect(listEffects().some((e) => e.kind === "stream" && e.sourceId === undefined)).toBe(true);
  });

  it("spawns three staggered drops for an added indicator, with no volume change", () => {
    const { before, after, events } = addIndicator();
    clear(before);
    enqueue({ prev: before, next: after, events, actor: "human", version: 1 });

    tick(0.25);
    expect(listEffects().filter((e) => e.kind === "drop")).toHaveLength(3);

    const flaskBefore = before.objects.find((o) => o.id === FLASK_ID);
    if (!flaskBefore || flaskBefore.kind !== "container") throw new Error("fixture missing flask");
    expect(targets.get(FLASK_ID)?.displayedVolumeMl).toBeCloseTo(flaskBefore.volumeMl, 5);
  });
});

describe("cancelPoseJobs", () => {
  it("clears a vessel's pending pour stages and resets its pose target", () => {
    const { before, after, events, fromId } = pourFixture();
    clear(before);
    enqueue({ prev: before, next: after, events, actor: "human", version: 1 });

    expect(targets.get(fromId)?.pose).not.toBeNull();
    cancelPoseJobs(fromId);
    expect(targets.get(fromId)?.pose).toBeNull();

    // The pour's later stages (tilt/stream/return) must never fire once cancelled.
    tick(2);
    expect(listEffects().some((e) => e.kind === "stream")).toBe(false);
    expect(targets.get(fromId)?.pose).toBeNull();
  });
});
