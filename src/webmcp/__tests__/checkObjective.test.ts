import { describe, expect, it, vi } from "vitest";
import type { LabState } from "@/engine";

const FAKE_PROGRESS = {
  scenarioId: "neutralize" as const,
  objective: "Bring the beaker to pH 7 ± 0.1 using the available reagents.",
  steps: [
    { label: "Measure the starting pH", done: true },
    { label: "Reach pH 7 ± 0.1", done: false },
  ],
  complete: false,
  detail: "pH 4.20, target 7.0 ± 0.1",
};

// scenarioProgress is a new engine export this tool depends on; faked here so the test exercises
// only check_objective's own envelope mapping, not the engine's (concurrently landing) logic.
vi.mock("@/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/engine")>();
  return { ...actual, scenarioObjective: () => "test objective", scenarioProgress: () => FAKE_PROGRESS };
});

const { fakeStore } = vi.hoisted(() => ({
  fakeStore: {
    lab: undefined as unknown,
    stateVersion: 1,
    ui: { devConsoleOpen: false },
    agentBusy: false,
    pushFeed: vi.fn(() => "f_1"),
    patchFeed: vi.fn(),
    setAgentBusy: vi.fn(),
    dispatch: vi.fn(),
  },
}));

vi.mock("@/store/labStore", () => ({ useLabStore: { getState: () => fakeStore } }));

const { runTool } = await import("../runtime");
const { readTools } = await import("../tools/read");

function emptyLab(): LabState {
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
    nextSeq: 1,
  };
}

describe("check_objective", () => {
  it("is registered, read-only, and takes no input", () => {
    const def = readTools.find((t) => t.name === "check_objective");
    expect(def).toBeDefined();
    expect(def?.readOnly).toBe(true);
    expect(def?.input.safeParse({}).success).toBe(true);
  });

  it("returns scenarioProgress's envelope as its result, with detail as the observation", async () => {
    fakeStore.lab = emptyLab();
    const def = readTools.find((t) => t.name === "check_objective");
    const response = await runTool(def!)({}, { signal: new AbortController().signal });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.result).toEqual(FAKE_PROGRESS);
    expect(response.observation).toBe(FAKE_PROGRESS.detail);
  });
});
