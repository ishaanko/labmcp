import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Applied, LabError, LabState, Result } from "@/engine";

// Stub engine: labStore only needs applyCommand/createEmptyState/loadScenario/describeError to
// exist and behave predictably. The real reducer is covered by the engine agent's own tests.
vi.mock("@/engine", () => {
  const assertNever = (x: never): never => {
    throw new Error(`unexpected: ${JSON.stringify(x)}`);
  };
  return {
    assertNever,
    describeEvent: () => "",
    describeError: () => "rejected",
    SCENARIO_TITLES: { sandbox: "Sandbox", titration: "Titration" },
    loadScenario: vi.fn(() => baseLab()),
    createEmptyState: vi.fn(() => baseLab()),
    applyCommand: vi.fn(),
    publicView: (state: LabState) => ({ ...state, scenario: state.scenario }),
  };
});

function baseLab(): LabState {
  return {
    clockS: 0,
    ambientC: 22,
    objects: [],
    shelf: [],
    indicatorsAvailable: [],
    reactions: [],
    observations: [],
    history: [],
    scenario: { kind: "sandbox", seed: 42, visibility: { inspectContents: "full", revealShelfConcentrations: true, instrumentsRequired: false } },
    rng: { seed: 42, s: 42 },
    nextSeq: 0,
  };
}

const ok = (state: LabState): Result<Applied, LabError> => ({ ok: true, value: { state, events: [], historyEntry: null } });

// applyCommand and useLabStore are re-imported fresh per test via vi.resetModules, since the
// store is created once at module load and dispatch reads state through the queue.
async function freshStore() {
  vi.resetModules();
  const engine = await import("@/engine");
  const { useLabStore } = await import("../labStore");
  return { useLabStore, applyCommand: vi.mocked(engine.applyCommand) };
}

describe("labStore.dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("commits on success: lab and stateVersion advance", async () => {
    const { useLabStore, applyCommand } = await freshStore();
    const nextLab = { ...baseLab(), clockS: 5 };
    applyCommand.mockReturnValue(ok(nextLab));

    const before = useLabStore.getState().stateVersion;
    const result = await useLabStore.getState().dispatch({ kind: "TICK", dtS: 0.25 }, "system");

    expect(result.ok).toBe(true);
    expect(useLabStore.getState().lab).toBe(nextLab);
    expect(useLabStore.getState().stateVersion).toBe(before + 1);
  });

  it("leaves lab reference-equal on failure and records a human feed entry", async () => {
    const { useLabStore, applyCommand } = await freshStore();
    const labBefore = useLabStore.getState().lab;
    applyCommand.mockReturnValue({ ok: false, error: { kind: "NOTHING_TO_UNDO" } });

    const result = await useLabStore.getState().dispatch({ kind: "UNDO" }, "human");

    expect(result.ok).toBe(false);
    expect(useLabStore.getState().lab).toBe(labBefore);
    expect(useLabStore.getState().feed[0]).toMatchObject({ source: "human", kind: "action", ok: false });
  });

  it("serializes concurrent human and agent dispatches so each sees the other's commit", async () => {
    const { useLabStore, applyCommand } = await freshStore();
    applyCommand.mockImplementation((prev) => ok({ ...prev, clockS: prev.clockS + 1 }));

    const first = useLabStore.getState().dispatch({ kind: "TICK", dtS: 0.25 }, "human");
    const second = useLabStore.getState().dispatch({ kind: "TICK", dtS: 0.25 }, "agent");
    await Promise.all([first, second]);

    expect(useLabStore.getState().lab.clockS).toBe(2);
  });

  it("resets the feed to one note and deselects on LOAD_SCENARIO", async () => {
    const { useLabStore, applyCommand } = await freshStore();
    useLabStore.getState().select("c_1");
    applyCommand.mockReturnValue(ok(baseLab()));

    await useLabStore.getState().dispatch({ kind: "LOAD_SCENARIO", scenarioId: "titration", seed: 42 }, "human");

    expect(useLabStore.getState().feed).toHaveLength(1);
    expect(useLabStore.getState().feed[0]?.kind).toBe("note");
    expect(useLabStore.getState().ui.selectedId).toBeNull();
  });

  it("keeps lab state JSON round-trippable, with no functions in it", async () => {
    const { useLabStore } = await freshStore();
    const json = JSON.stringify(useLabStore.getState().lab);
    expect(json).toBeTruthy();
    expect(JSON.parse(json)).toEqual(useLabStore.getState().lab);
  });
});
