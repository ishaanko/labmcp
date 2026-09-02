import { describe, expect, it } from "vitest";
import { mintContainerId, mintReagentId, type LabError, type LabState } from "@/engine";
import { mapLabError } from "../errors";

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

const CASES: ReadonlyArray<LabError> = [
  { kind: "UNKNOWN_OBJECT", id: "c_9", hint: "reread_lab_state" },
  { kind: "WRONG_OBJECT_TYPE", id: mintContainerId(1), expected: ["flask"] },
  { kind: "OVER_CAPACITY", containerId: mintContainerId(1), capacityMl: 250, currentMl: 240, attemptedMl: 20, maxAddableMl: 10 },
  { kind: "INSUFFICIENT_VOLUME", containerId: mintContainerId(1), availableMl: 5, requestedMl: 10 },
  { kind: "INVALID_AMOUNT", field: "volume_ml", value: -1, reason: "not_positive" },
  { kind: "SAME_CONTAINER", containerId: mintContainerId(1) },
  { kind: "UNSUPPORTED_REAGENT", requested: "foo", suggestions: [mintReagentId("hcl")] },
  { kind: "UNSUPPORTED_CONCENTRATION", reagentId: mintReagentId("hcl"), requestedM: 5, maxM: 2 },
  { kind: "UNSUPPORTED_INDICATOR", requested: "foo", suggestions: [] },
  { kind: "STOCK_DEPLETED", reagentId: mintReagentId("hcl"), remainingMl: 1 },
  { kind: "NO_INSTRUMENT", containerId: mintContainerId(1), needed: "ph_meter", hint: "add one" },
  { kind: "INVALID_TEMPERATURE", requestedC: 200, minC: 0, maxC: 100 },
  { kind: "RESTRICTED_BY_CHALLENGE", action: "inspect", reason: "unknown sample" },
  { kind: "NOTHING_TO_UNDO" },
  { kind: "UNKNOWN_SCENARIO", requested: "foo", available: ["sandbox", "titration", "unknown_id"] },
  { kind: "SLOT_UNAVAILABLE", position: { x: -4.5, y: -1.5 }, reason: "occupied" },
];

const EXPECTED_CODE: Record<LabError["kind"], string> = {
  UNKNOWN_OBJECT: "OBJECT_NOT_FOUND",
  WRONG_OBJECT_TYPE: "OBJECT_NOT_FOUND",
  OVER_CAPACITY: "CAPACITY_EXCEEDED",
  INSUFFICIENT_VOLUME: "INSUFFICIENT_VOLUME",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  SAME_CONTAINER: "INVALID_INPUT",
  UNSUPPORTED_REAGENT: "INVALID_INPUT",
  UNSUPPORTED_CONCENTRATION: "INVALID_INPUT",
  UNSUPPORTED_INDICATOR: "INVALID_INPUT",
  STOCK_DEPLETED: "INVALID_INPUT",
  NO_INSTRUMENT: "INSTRUMENT_MISSING",
  INVALID_TEMPERATURE: "OUT_OF_RANGE",
  RESTRICTED_BY_CHALLENGE: "PERMISSION_DENIED",
  NOTHING_TO_UNDO: "NOTHING_TO_UNDO",
  UNKNOWN_SCENARIO: "UNKNOWN_SCENARIO",
  SLOT_UNAVAILABLE: "OUT_OF_RANGE",
};

describe("mapLabError", () => {
  const lab = emptyLab();

  it("maps every LabError kind to its documented tool error code", () => {
    for (const error of CASES) {
      const mapped = mapLabError(error, lab);
      expect(mapped.code, error.kind).toBe(EXPECTED_CODE[error.kind]);
      expect(mapped.message.length).toBeGreaterThan(0);
    }
  });

  it("covers every LabError kind declared by the engine", () => {
    const covered = new Set(CASES.map((c) => c.kind));
    expect(covered.size).toBe(Object.keys(EXPECTED_CODE).length);
  });

  it("suggests current ids for UNKNOWN_OBJECT", () => {
    const withObjects: LabState = {
      ...lab,
      objects: [
        {
          kind: "container",
          id: mintContainerId(1),
          type: "beaker",
          label: "Beaker",
          capacityMl: 250,
          position: { x: 0, y: 0 },
          rotationDeg: 0,
          volumeMl: 0,
          temperatureC: 22,
          species: {},
          solids: [],
          gasEffects: [],
          indicators: [],
          stir: { kind: "still" },
          thermal: { kind: "idle" },
          containsUnknown: false,
        },
      ],
    };
    const mapped = mapLabError({ kind: "UNKNOWN_OBJECT", id: "c_9", hint: "reread_lab_state" }, withObjects);
    expect(mapped.suggestions?.some((s) => s.includes("c_1"))).toBe(true);
  });

  it("suggests a free bench position for SLOT_UNAVAILABLE", () => {
    const mapped = mapLabError({ kind: "SLOT_UNAVAILABLE", position: { x: -1.5, y: 0.5 }, reason: "occupied" }, lab);
    expect(mapped.suggestions?.some((s) => s.includes("-4.5"))).toBe(true);
  });
});
