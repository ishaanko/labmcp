import { describe, expect, it, vi } from "vitest";

const SECRET_SPECIES = "Ag+";
const SECRET_SOLID = "AgCl(s)";
const KNOWN_SPECIES = "Cl-";

vi.mock("@/engine", () => ({
  publicView: (lab: { pub: unknown }) => lab.pub,
  scenarioObjective: () => "Find the concentration of the unknown acid.",
  describeEvent: (e: { kind: string }) =>
    e.kind === "REACTION" ? `Reaction produced ${SECRET_SPECIES}` : e.kind === "PRECIPITATE_FORMED" ? `${SECRET_SOLID} formed` : `desc:${e.kind}`,
}));

import { summarizeLab } from "../../lib/summary";

function hiddenContainer() {
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

function labWith(observations: ReadonlyArray<{ event: { kind: string; containerId?: string } }>) {
  return {
    observations,
    pub: {
      clockS: 10,
      ambientC: 22,
      objects: [hiddenContainer(), visibleContainer()],
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
});
