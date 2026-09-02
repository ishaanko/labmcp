import { describe, expect, it, vi } from "vitest";
import { mintContainerId, mintIndicatorId, mintInstrumentId, mintReagentId, type Container, type Instrument, type LabCommand, type LabState } from "@/engine";
import type { DispatchResult } from "@/store/types";

// scenarios.ts (publicView, scenarioObjective) is still an engine stub; fake it so summarizeLab
// and the tools that read publicView don't throw. Everything else in @/engine is real.
//
// TEST_SOLID_ID stands in for a solid shelf reagent (e.g. the engine's eventual "kno3") so the
// mass_g mapping case below doesn't depend on which solids the shelf actually stocks. Built with
// vi.hoisted since a vi.mock factory can only close over hoisted bindings.
const { TEST_SOLID_ID, TEST_SOLID_DEF } = vi.hoisted(() => {
  const id = "test_solid";
  return {
    TEST_SOLID_ID: id,
    TEST_SOLID_DEF: {
      kind: "solid" as const,
      id,
      label: "Test solid",
      formula: "TS",
      role: "salt" as const,
      ions: [] as ReadonlyArray<never>,
      molarMass: 100,
      solidSpecies: "TS(s)",
      solubilityG100ml: [[20, 30]] as ReadonlyArray<readonly [number, number]>,
    },
  };
});

vi.mock("@/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/engine")>();
  return {
    ...actual,
    scenarioObjective: () => "test objective",
    scenarioProgress: () => ({ scenarioId: "sandbox", objective: "test objective", steps: [], complete: false, detail: "test objective" }),
    SCENARIO_TITLES: {
      sandbox: "test",
      titration: "test",
      unknown_id: "test",
      precipitation: "test",
      neutralize: "test",
      dilution: "test",
      solubility: "test",
    },
    REAGENT_IDS: [...actual.REAGENT_IDS, TEST_SOLID_ID],
    reagentDef: (id: unknown) => (id === TEST_SOLID_ID ? TEST_SOLID_DEF : actual.reagentDef(id as never)),
    publicView: (state: LabState) => ({
      clockS: state.clockS,
      ambientC: state.ambientC,
      objects: state.objects.map((o) =>
        o.kind === "instrument"
          ? o
          : { ...o, contents: { kind: "visible" as const, species: o.species, concentrationsM: {} }, pH: null, color: { r: 200, g: 220, b: 240, a: 0.2 }, colorName: "colorless", reactionsOccurred: [] },
      ),
      shelf: state.shelf,
      indicatorsAvailable: state.indicatorsAvailable,
      scenario: { kind: "sandbox" as const, seed: state.scenario.seed, visibility: state.scenario.visibility },
      nextSeq: state.nextSeq,
    }),
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
    dispatch: vi.fn(),
  },
}));

vi.mock("@/store/labStore", () => ({ useLabStore: { getState: () => fakeStore } }));

const { runTool } = await import("../runtime");
const { readTools } = await import("../tools/read");
const { mutateTools } = await import("../tools/mutate");
const { metaTools } = await import("../tools/meta");

function beaker(id: number, overrides: Partial<Container> = {}): Container {
  return {
    kind: "container",
    id: mintContainerId(id),
    type: "beaker",
    label: `Beaker ${id}`,
    capacityMl: 250,
    position: { x: 0, y: 0 },
    rotationDeg: 0,
    volumeMl: 50,
    temperatureC: 22,
    species: {},
    solids: [],
    gasEffects: [],
    indicators: [],
    stir: { kind: "still" },
    thermal: { kind: "idle" },
    containsUnknown: false,
    ...overrides,
  };
}

function phMeter(id: number, attachedTo: Container["id"] | null = null): Instrument {
  return { kind: "instrument", id: mintInstrumentId(id), type: "ph_meter", position: { x: 0, y: 0 }, attachedTo, lastReading: null };
}

function labWith(objects: ReadonlyArray<Container | Instrument>): LabState {
  return {
    clockS: 0,
    ambientC: 22,
    objects,
    shelf: [],
    indicatorsAvailable: [],
    reactions: [],
    observations: [],
    history: [],
    scenario: { kind: "sandbox", seed: 42, visibility: { inspectContents: "full", revealShelfConcentrations: true, instrumentsRequired: false } },
    rng: { seed: 42, s: 42 },
    nextSeq: 3,
  };
}

const okResult: DispatchResult = { ok: true, stateVersion: 2, events: [], historyEntry: null, observation: "done" };

describe("tool -> command mapping", () => {
  const tools = [...readTools, ...mutateTools, ...metaTools];

  interface Case {
    readonly tool: string;
    readonly input: unknown;
    readonly lab: LabState;
    readonly expected: LabCommand;
  }

  const cases: ReadonlyArray<Case> = [
    {
      tool: "add_container",
      input: { type: "beaker" },
      lab: labWith([]),
      expected: { kind: "PLACE_OBJECT", objectType: "beaker", position: undefined, label: undefined },
    },
    {
      tool: "add_reagent",
      input: { container_id: "c_1", reagent_id: "hcl", volume_ml: 25 },
      lab: labWith([beaker(1)]),
      expected: { kind: "ADD_REAGENT", containerId: mintContainerId(1), reagentId: mintReagentId("hcl"), volumeMl: 25, concentrationM: undefined, massG: undefined },
    },
    {
      tool: "add_reagent",
      input: { container_id: "c_1", reagent_id: TEST_SOLID_ID, mass_g: 5 },
      lab: labWith([beaker(1)]),
      expected: {
        kind: "ADD_REAGENT",
        containerId: mintContainerId(1),
        reagentId: mintReagentId(TEST_SOLID_ID),
        volumeMl: 0,
        concentrationM: undefined,
        massG: 5,
      },
    },
    {
      tool: "transfer",
      input: { source_id: "c_1", destination_id: "c_2", volume_ml: 10 },
      lab: labWith([beaker(1), beaker(2)]),
      expected: { kind: "TRANSFER_LIQUID", fromId: mintContainerId(1), toId: mintContainerId(2), volumeMl: 10 },
    },
    {
      tool: "dispense",
      input: { burette_id: "c_1", destination_id: "c_2", volume_ml: 1 },
      lab: labWith([beaker(1), beaker(2)]),
      expected: { kind: "DISPENSE", buretteId: mintContainerId(1), toId: mintContainerId(2), volumeMl: 1 },
    },
    {
      tool: "stir",
      input: { container_id: "c_1", duration_s: 5 },
      lab: labWith([beaker(1)]),
      expected: { kind: "STIR", containerId: mintContainerId(1), durationS: 5 },
    },
    {
      tool: "heat",
      input: { container_id: "c_1", target_c: 60 },
      lab: labWith([beaker(1)]),
      expected: { kind: "HEAT", containerId: mintContainerId(1), targetC: 60 },
    },
    {
      tool: "cool",
      input: { container_id: "c_1" },
      lab: labWith([beaker(1)]),
      expected: { kind: "COOL", containerId: mintContainerId(1), targetC: undefined },
    },
    {
      tool: "add_indicator",
      input: { container_id: "c_1", indicator_id: "phenolphthalein", drops: 3 },
      lab: labWith([beaker(1)]),
      expected: { kind: "ADD_INDICATOR", containerId: mintContainerId(1), indicator: mintIndicatorId("phenolphthalein"), drops: 3 },
    },
    {
      tool: "remove_container",
      input: { object_id: "c_1" },
      lab: labWith([beaker(1)]),
      expected: { kind: "REMOVE_OBJECT", objectId: mintContainerId(1) },
    },
    {
      tool: "undo_last_action",
      input: {},
      lab: labWith([]),
      expected: { kind: "UNDO" },
    },
    {
      tool: "reset_experiment",
      input: { confirm: true },
      lab: labWith([]),
      expected: { kind: "RESET" },
    },
    {
      tool: "load_scenario",
      input: { scenario_id: "titration" },
      lab: labWith([]),
      expected: { kind: "LOAD_SCENARIO", scenarioId: "titration", seed: 42 },
    },
  ];

  for (const { tool, input, lab, expected } of cases) {
    it(`${tool} dispatches the exact expected LabCommand`, async () => {
      fakeStore.lab = lab;
      fakeStore.dispatch.mockReset();
      fakeStore.dispatch.mockResolvedValue(okResult);

      const def = tools.find((t) => t.name === tool);
      expect(def, `no such tool: ${tool}`).toBeDefined();
      await runTool(def!)(input, { signal: new AbortController().signal });

      expect(fakeStore.dispatch).toHaveBeenCalledTimes(1);
      expect(fakeStore.dispatch).toHaveBeenCalledWith(expected, "agent");
    });
  }

  it("measure_ph dispatches ATTACH_INSTRUMENT then MEASURE when the meter is attached elsewhere", async () => {
    fakeStore.lab = labWith([beaker(1), beaker(2), phMeter(1, mintContainerId(2))]);
    fakeStore.dispatch.mockReset();
    fakeStore.dispatch.mockResolvedValue(okResult);

    const def = tools.find((t) => t.name === "measure_ph");
    await runTool(def!)({ container_id: "c_1" }, { signal: new AbortController().signal });

    expect(fakeStore.dispatch).toHaveBeenNthCalledWith(1, { kind: "ATTACH_INSTRUMENT", instrumentId: mintInstrumentId(1), containerId: mintContainerId(1) }, "agent");
    expect(fakeStore.dispatch).toHaveBeenNthCalledWith(2, { kind: "MEASURE", containerId: mintContainerId(1), quantity: "ph", instrumentId: mintInstrumentId(1) }, "agent");
  });

  it("measure_ph fails with INSTRUMENT_MISSING and never dispatches when no meter is on the bench", async () => {
    fakeStore.lab = labWith([beaker(1)]);
    fakeStore.dispatch.mockReset();

    const def = tools.find((t) => t.name === "measure_ph");
    const response = await runTool(def!)({ container_id: "c_1" }, { signal: new AbortController().signal });

    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe("INSTRUMENT_MISSING");
    expect(fakeStore.dispatch).not.toHaveBeenCalled();
  });

  for (const toolName of ["add_reagent", "transfer", "heat"]) {
    it(`${toolName} returns INVALID_INPUT and never dispatches on malformed input`, async () => {
      fakeStore.lab = labWith([beaker(1), beaker(2)]);
      fakeStore.dispatch.mockReset();

      const def = tools.find((t) => t.name === toolName);
      const response = await runTool(def!)({ nonsense: true }, { signal: new AbortController().signal });

      expect(response.ok).toBe(false);
      if (!response.ok) expect(response.error.code).toBe("INVALID_INPUT");
      expect(fakeStore.dispatch).not.toHaveBeenCalled();
    });
  }

  it("add_reagent rejects an unknown reagent id before dispatching", async () => {
    fakeStore.lab = labWith([beaker(1)]);
    fakeStore.dispatch.mockReset();

    const def = tools.find((t) => t.name === "add_reagent");
    const response = await runTool(def!)({ container_id: "c_1", reagent_id: "not_a_reagent", volume_ml: 10 }, { signal: new AbortController().signal });

    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe("INVALID_INPUT");
    expect(fakeStore.dispatch).not.toHaveBeenCalled();
  });

  it("add_reagent rejects mass_g for a liquid reagent with INVALID_AMOUNT", async () => {
    fakeStore.lab = labWith([beaker(1)]);
    fakeStore.dispatch.mockReset();

    const def = tools.find((t) => t.name === "add_reagent");
    const response = await runTool(def!)({ container_id: "c_1", reagent_id: "hcl", volume_ml: 10, mass_g: 5 }, { signal: new AbortController().signal });

    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe("INVALID_AMOUNT");
    expect(fakeStore.dispatch).not.toHaveBeenCalled();
  });

  it("add_reagent rejects a missing mass_g for a solid reagent with INVALID_AMOUNT", async () => {
    fakeStore.lab = labWith([beaker(1)]);
    fakeStore.dispatch.mockReset();

    const def = tools.find((t) => t.name === "add_reagent");
    const response = await runTool(def!)({ container_id: "c_1", reagent_id: TEST_SOLID_ID }, { signal: new AbortController().signal });

    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe("INVALID_AMOUNT");
    expect(fakeStore.dispatch).not.toHaveBeenCalled();
  });
});
