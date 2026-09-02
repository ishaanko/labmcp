import { describe, expect, it, vi } from "vitest";
import { mintContainerId, SP, type Container, type LabState, type PublicLabState } from "@/engine";

function toPublicContainer(container: Container, revealed: boolean) {
  const hidden = container.containsUnknown && !revealed;
  const concentrationsM: Record<string, number> = {};
  for (const [species, moles] of Object.entries(container.species)) {
    concentrationsM[species] = (moles ?? 0) / (container.volumeMl / 1000);
  }
  return {
    kind: "container" as const,
    id: container.id,
    type: container.type,
    label: container.label,
    capacityMl: container.capacityMl,
    position: container.position,
    rotationDeg: container.rotationDeg,
    volumeMl: container.volumeMl,
    temperatureC: container.temperatureC,
    solids: container.solids.map((s) => ({ ...s, color: { r: 200, g: 200, b: 200, a: 1 }, scale: "small" as const })),
    gasEffects: container.gasEffects,
    indicators: container.indicators,
    stir: container.stir,
    thermal: container.thermal,
    contents: hidden ? { kind: "hidden" as const, reason: "unidentified sample" } : { kind: "visible" as const, species: container.species, concentrationsM },
    pH: null,
    color: { r: 200, g: 220, b: 240, a: 0.2 },
    colorName: hidden ? "pale yellow" : "colorless",
    reactionsOccurred: [],
  };
}

// scenarios.ts (publicView, scenarioObjective) is still an engine stub. This fake mirrors the
// real permission contract closely enough to exercise the tool-layer policy checks in isolation:
// a container tainted by an unknown sample is hidden until its scenario is revealed.
vi.mock("@/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/engine")>();
  return {
    ...actual,
    scenarioObjective: () => "test objective",
    publicView: (state: LabState): PublicLabState => {
      const revealed = state.scenario.kind === "sandbox" ? true : state.scenario.revealed;
      return {
        clockS: state.clockS,
        ambientC: state.ambientC,
        objects: state.objects.map((o) => (o.kind === "instrument" ? o : toPublicContainer(o, revealed))),
        shelf: state.shelf,
        indicatorsAvailable: state.indicatorsAvailable,
        scenario:
          state.scenario.kind === "titration"
            ? {
                kind: "titration" as const,
                seed: state.scenario.seed,
                visibility: state.scenario.visibility,
                flaskId: state.scenario.flaskId,
                buretteId: state.scenario.buretteId,
                analyteMl: state.scenario.analyteMl,
                titrantM: state.scenario.titrantM,
                curve: state.scenario.curve,
                revealed: state.scenario.revealed,
                analyteM: state.scenario.revealed ? state.scenario.secrets.analyteM : null,
              }
            : state.scenario.kind === "sandbox"
              ? state.scenario
              : {
                  kind: "unknown_id" as const,
                  seed: state.scenario.seed,
                  visibility: state.scenario.visibility,
                  samples: state.scenario.samples,
                  revealed: state.scenario.revealed,
                  identities: state.scenario.revealed ? state.scenario.secrets : null,
                },
        nextSeq: state.nextSeq,
      };
    },
  };
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
    dispatch: vi.fn(async () => ({ ok: true, stateVersion: 2, events: [], historyEntry: null, observation: "measured" })),
  },
}));

vi.mock("@/store/labStore", () => ({ useLabStore: { getState: () => fakeStore } }));

const { runTool } = await import("../runtime");
const { readTools } = await import("../tools/read");
const { inspectTools } = await import("../tools/inspect");

const tools = [...readTools, ...inspectTools];
const tool = (name: string) => {
  const def = tools.find((t) => t.name === name);
  if (!def) throw new Error(`missing tool: ${name}`);
  return def;
};

const FLASK = mintContainerId(1);
const BURETTE = mintContainerId(2);

function flaskContainer(overrides: Partial<Container> = {}): Container {
  return {
    kind: "container",
    id: FLASK,
    type: "flask",
    label: "Unknown acid",
    capacityMl: 250,
    position: { x: 0, y: 0 },
    rotationDeg: 0,
    volumeMl: 25,
    temperatureC: 22,
    species: { [SP.H]: 0.0025, [SP.Cl]: 0.0025 },
    solids: [],
    gasEffects: [],
    indicators: [],
    stir: { kind: "still" },
    thermal: { kind: "idle" },
    containsUnknown: true,
    ...overrides,
  };
}

function titrationLab(revealed: boolean): LabState {
  return {
    clockS: 0,
    ambientC: 22,
    objects: [
      flaskContainer(),
      flaskContainer({ id: BURETTE, type: "burette", label: "Burette", containsUnknown: false, species: { [SP.Na]: 0.005, [SP.OH]: 0.005 } }),
    ],
    shelf: [],
    indicatorsAvailable: [],
    reactions: [],
    observations: [],
    history: [],
    scenario: {
      kind: "titration",
      seed: 42,
      visibility: { inspectContents: "non_unknown_only", revealShelfConcentrations: false, instrumentsRequired: true },
      flaskId: FLASK,
      buretteId: BURETTE,
      analyteMl: 25,
      titrantM: 0.1,
      secrets: { analyteM: 0.1 },
      curve: [],
      toleranceRel: 0.05,
      revealed,
    },
    rng: { seed: 42, s: 42 },
    nextSeq: 3,
  };
}

function sandboxLab(): LabState {
  return {
    clockS: 0,
    ambientC: 22,
    objects: [flaskContainer({ containsUnknown: false, label: "Flask A" })],
    shelf: [],
    indicatorsAvailable: [],
    reactions: [],
    observations: [],
    history: [],
    scenario: { kind: "sandbox", seed: 42, visibility: { inspectContents: "full", revealShelfConcentrations: true, instrumentsRequired: false } },
    rng: { seed: 42, s: 42 },
    nextSeq: 2,
  };
}

describe("challenge permission policy", () => {
  it("titration, unrevealed: inspect_contents on the flask is denied", async () => {
    fakeStore.lab = titrationLab(false);
    const response = await runTool(tool("inspect_contents"))({ container_id: FLASK }, { signal: new AbortController().signal });
    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe("PERMISSION_DENIED");
  });

  it("titration, unrevealed: calculate_moles(flask, 'OH-') is allowed (titrant exception)", async () => {
    fakeStore.lab = titrationLab(false);
    const response = await runTool(tool("calculate_moles"))({ container_id: BURETTE, species_id: "OH-" }, { signal: new AbortController().signal });
    expect(response.ok).toBe(true);
  });

  it("titration, unrevealed: calculate_moles(flask, 'H+') is denied", async () => {
    fakeStore.lab = titrationLab(false);
    const response = await runTool(tool("calculate_moles"))({ container_id: FLASK, species_id: "H+" }, { signal: new AbortController().signal });
    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe("PERMISSION_DENIED");
  });

  it("titration, unrevealed: get_lab_state shows the flask as 'Unknown acid' with contentsVisible false", async () => {
    fakeStore.lab = titrationLab(false);
    const response = await runTool(tool("get_lab_state"))({}, { signal: new AbortController().signal });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    const summary = response.result as { containers: ReadonlyArray<{ id: string; label: string; contentsVisible: boolean }> };
    const flask = summary.containers.find((c) => c.id === FLASK);
    expect(flask?.label).toBe("Unknown acid");
    expect(flask?.contentsVisible).toBe(false);
  });

  it("titration, revealed: inspect_contents and calculate_moles('H+') are both allowed", async () => {
    fakeStore.lab = titrationLab(true);
    const inspect = await runTool(tool("inspect_contents"))({ container_id: FLASK }, { signal: new AbortController().signal });
    expect(inspect.ok).toBe(true);
    const moles = await runTool(tool("calculate_moles"))({ container_id: FLASK, species_id: "H+" }, { signal: new AbortController().signal });
    expect(moles.ok).toBe(true);
  });

  it("sandbox: inspect_contents and calculate_moles are always allowed", async () => {
    fakeStore.lab = sandboxLab();
    const inspect = await runTool(tool("inspect_contents"))({ container_id: FLASK }, { signal: new AbortController().signal });
    expect(inspect.ok).toBe(true);
    const moles = await runTool(tool("calculate_moles"))({ container_id: FLASK, species_id: "H+" }, { signal: new AbortController().signal });
    expect(moles.ok).toBe(true);
  });
});
