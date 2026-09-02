import { beforeEach, describe, expect, it } from "vitest";
import { applyCommand, createEmptyState, loadScenario, mintContainerId, type LabState, type Observation } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { targets, visualFor, visuals } from "../visualStore";
import { clear, enqueue, tick } from "../animationQueue";

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
function dispenseTitration(): DispenseFixture {
  const before = loadScenario("titration", 1);
  const applied = applyCommand(before, { kind: "DISPENSE", buretteId: BURETTE_ID, toId: FLASK_ID, volumeMl: 5 }, "agent");
  if (!applied.ok) throw new Error(`fixture command was rejected: ${applied.error.kind}`);
  return { before, after: applied.value.state, events: applied.value.events };
}

beforeEach(() => {
  visuals.clear();
  targets.clear();
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
