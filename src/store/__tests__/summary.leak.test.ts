import { describe, expect, it, vi } from "vitest";

const SECRET_SPECIES = "Ag+";
const SECRET_SOLID = "AgCl(s)";
const KNOWN_SPECIES = "Cl-";
const SECRET_START_REAGENT = "unknown_start_reagent_xyz";

vi.mock("@/engine", () => ({
  constants: { EQUIPMENT_TYPES: ["beaker", "flask", "test_tube", "graduated_cylinder", "burette", "ph_meter", "thermometer", "hotplate"] },
  publicView: (lab: { pub: unknown }) => lab.pub,
  scenarioObjective: () => "Find the concentration of the unknown acid.",
  // Fixed, secret-free status: this test suite checks summarizeLab's own field selection, not
  // the (concurrently landing) engine scenarioProgress implementation.
  scenarioProgress: () => ({ scenarioId: "unknown_id", objective: "test objective", steps: [], complete: false, detail: "in progress" }),
  describeEvent: (e: { kind: string; from?: number; to?: number; cause?: string }) =>
    e.kind === "REACTION"
      ? `Reaction produced ${SECRET_SPECIES}`
      : e.kind === "PRECIPITATE_FORMED"
        ? `${SECRET_SOLID} formed`
        : e.kind === "PH_CHANGE"
          ? `c_1 pH changed from ${e.from} to ${e.to}.`
          : e.kind === "TEMPERATURE_CHANGE"
            ? `c_1 temperature changed (${e.cause}).`
            : `desc:${e.kind}`,
}));

import { summarizeLab } from "../../lib/summary";

function hiddenContainer(overrides: { pH?: number | null } = {}) {
  return {
    kind: "container",
    id: "c_1",
    type: "beaker",
    label: "Unknown acid",
    capacityMl: 250,
    volumeMl: 50,
    temperatureC: 22,
    position: { x: 0, y: 0 },
    solids: [],
    gasEffects: [],
    indicators: [],
    stir: { kind: "still" },
    thermal: { kind: "idle" },
    contents: { kind: "hidden", reason: "unrevealed" },
    colorName: "colorless",
    pH: overrides.pH ?? null,
  };
}

function visibleContainer() {
  return {
    kind: "container",
    id: "c_2",
    type: "flask",
    label: "Flask B",
    capacityMl: 250,
    volumeMl: 100,
    temperatureC: 22,
    position: { x: 1, y: 0 },
    solids: [],
    gasEffects: [],
    indicators: [],
    stir: { kind: "still" },
    thermal: { kind: "idle" },
    contents: { kind: "visible", species: { [KNOWN_SPECIES]: 0.1 } },
    colorName: "pale green",
  };
}

function labWith(
  observations: ReadonlyArray<{ event: { kind: string; containerId?: string } }>,
  hiddenPh: number | null = null,
) {
  return {
    observations,
    pub: {
      clockS: 10,
      ambientC: 22,
      objects: [hiddenContainer({ pH: hiddenPh }), visibleContainer()],
      shelf: [{ reagentId: "unknown_acid_1", label: "Unknown acid", concentrationM: null }],
      indicatorsAvailable: ["phenolphthalein"],
      scenario: { kind: "unknown_id", revealed: false },
    },
  } as unknown as Parameters<typeof summarizeLab>[0];
}

describe("summary.leak", () => {
  it("never includes hidden species, moles, or reaction chemistry for a hidden container", () => {
    const lab = labWith([
      { event: { kind: "REACTION", containerId: "c_1" } },
      { event: { kind: "PRECIPITATE_FORMED", containerId: "c_1" } },
    ]);
    const summary = summarizeLab(lab, 1);
    const json = JSON.stringify(summary);

    expect(json).not.toContain(SECRET_SPECIES);
    expect(json).not.toContain(SECRET_SOLID);
    expect(json).not.toContain("moles");

    const hidden = summary.containers.find((c) => c.id === "c_1");
    expect(hidden?.contentsVisible).toBe(false);
    expect(hidden?.knownContents).toBeUndefined();
  });

  it("still reports species for a container whose contents are visible", () => {
    const summary = summarizeLab(labWith([]), 1);
    const visible = summary.containers.find((c) => c.id === "c_2");
    expect(visible?.contentsVisible).toBe(true);
    expect(visible?.knownContents).toEqual([KNOWN_SPECIES]);
  });

  it("carries the scenario objective and a fixed equipment catalog", () => {
    const summary = summarizeLab(labWith([]), 1);
    expect(summary.scenario.objective).toContain("unknown acid");
    expect(summary.equipmentTypes).toContain("ph_meter");
  });

  it("drops PH_CHANGE for a hidden container with no pH meter attached", () => {
    const lab = labWith([{ event: { kind: "PH_CHANGE", containerId: "c_1" } }], null);
    const summary = summarizeLab(lab, 1);
    expect(summary.lastObservations.some((line) => line.includes("pH"))).toBe(false);
  });

  it("keeps PH_CHANGE for a hidden container once a pH meter is attached", () => {
    const lab = labWith([{ event: { kind: "PH_CHANGE", containerId: "c_1" } }], 1.15);
    const summary = summarizeLab(lab, 1);
    expect(summary.lastObservations.some((line) => line.includes("pH"))).toBe(true);
  });

  it("strips the reaction cause from a hidden container's TEMPERATURE_CHANGE", () => {
    const lab = labWith([{ event: { kind: "TEMPERATURE_CHANGE", containerId: "c_1", cause: "reaction", fromC: 22, toC: 24 } as never }]);
    const summary = summarizeLab(lab, 1);
    expect(summary.lastObservations.some((line) => line.includes("reaction"))).toBe(false);
  });

  it("never surfaces a neutralize scenario's hidden starting reagent before it is revealed", () => {
    // Simulates publicView carrying the neutralize secret on `scenario` (as it does pre-reveal,
    // via `secrets`/`start`): summarizeLab only ever forwards a fixed whitelist of scenario
    // fields, so this must never reach the summary regardless of what publicView returns.
    const lab = {
      observations: [],
      pub: {
        clockS: 5,
        ambientC: 22,
        objects: [visibleContainer()],
        shelf: [],
        indicatorsAvailable: ["phenolphthalein"],
        scenario: {
          kind: "neutralize",
          revealed: false,
          targetPh: 7,
          tolerance: 0.1,
          start: null,
          secrets: { startReagent: SECRET_START_REAGENT, startM: 0.4 },
        },
      },
    } as unknown as Parameters<typeof summarizeLab>[0];

    const summary = summarizeLab(lab, 1);
    const json = JSON.stringify(summary);

    expect(json).not.toContain(SECRET_START_REAGENT);
    expect(summary.scenario.id).toBe("neutralize");
    expect(summary.scenario.revealed).toBe(false);
  });
});
