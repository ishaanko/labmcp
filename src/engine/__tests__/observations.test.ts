import { describe, expect, it } from "vitest";
import { mintContainerId, mintIndicatorId, mintInstrumentId, mintReagentId, mintReactionRuleId } from "../ids";
import { describeError, describeEvent } from "../observations";
import { ruleById } from "../reactions";
import type { LabError, LabEvent } from "../types";

const containerId = mintContainerId(1);
const rule = ruleById(mintReactionRuleId("neutralization"));
if (!rule) throw new Error("neutralization rule missing");

const eventFixtures: ReadonlyArray<LabEvent> = [
  { kind: "OBJECT_PLACED", objectId: containerId, objectType: "beaker" },
  { kind: "OBJECT_REMOVED", objectId: containerId },
  { kind: "OBJECT_MOVED", objectId: containerId, position: { x: 1, y: 1 } },
  { kind: "INSTRUMENT_ATTACHED", instrumentId: mintInstrumentId(1), containerId },
  { kind: "INSTRUMENT_ATTACHED", instrumentId: mintInstrumentId(1), containerId: null },
  { kind: "LIQUID_ADDED", containerId, reagentId: mintReagentId("hcl"), volumeMl: 25, newVolumeMl: 25 },
  { kind: "LIQUID_TRANSFERRED", fromId: containerId, toId: mintContainerId(2), volumeMl: 10 },
  { kind: "INDICATOR_ADDED", containerId, indicator: mintIndicatorId("phenolphthalein"), drops: 2 },
  { kind: "STIR_STARTED", containerId, durationS: 5 },
  { kind: "THERMAL_SET", containerId, thermal: { kind: "heating", targetC: 60 } },
  { kind: "THERMAL_SET", containerId, thermal: { kind: "cooling", targetC: 10 } },
  { kind: "THERMAL_SET", containerId, thermal: { kind: "idle" } },
  { kind: "MEASUREMENT", containerId, reading: { kind: "ph", value: 7 } },
  { kind: "MEASUREMENT", containerId, reading: { kind: "temperature", valueC: 22 } },
  { kind: "MEASUREMENT", containerId, reading: { kind: "volume", valueMl: 50 } },
  { kind: "CONTENTS_INSPECTED", containerId, species: {}, volumeMl: 50 },
  { kind: "REACTION", containerId, ruleId: rule.id, extentMol: 0.0025, limiting: rule.reactants[0]!.species, netIonic: rule.equations.netIonic },
  {
    kind: "COLOR_SHIFT",
    containerId,
    from: { r: 200, g: 225, b: 240, a: 0.12 },
    to: { r: 236, g: 64, b: 160, a: 0.5 },
    description: "colorless -> pink",
    indicatorTransition: true,
  },
  {
    kind: "PRECIPITATE_FORMED",
    containerId,
    species: rule.reactants[0]!.species,
    moles: 0.001,
    massG: 0.143,
    color: { r: 240, g: 240, b: 235, a: 1 },
    scale: "moderate",
    description: "White precipitate: AgCl, 143 mg.",
  },
  { kind: "BUBBLES", containerId, species: rule.reactants[0]!.species, moles: 0.001, intensity: 0.5, durationS: 6 },
  { kind: "TEMPERATURE_CHANGE", containerId, fromC: 22, toC: 22.68, cause: "reaction" },
  { kind: "TEMPERATURE_CHANGE", containerId, fromC: 22, toC: 21, cause: "thermal" },
  { kind: "TEMPERATURE_CHANGE", containerId, fromC: 22, toC: 23, cause: "mixing" },
  { kind: "PH_CHANGE", containerId, from: 7, to: 5 },
  { kind: "NO_REACTION", containerId, description: "Mixed, no visible reaction." },
  { kind: "SOLIDS_SETTLED", containerId },
  { kind: "DISPOSED", containerId, volumeMl: 50 },
  { kind: "UNDONE", undoneCommand: { kind: "RESET" }, undoneSeq: 3, undoneActor: "human" },
  { kind: "RESET" },
  { kind: "SCENARIO_LOADED", scenarioId: "sandbox", seed: 1 },
  { kind: "SCENARIO_REVEALED", scenarioId: "titration" },
  { kind: "OVERFLOW_REJECTED", containerId, attemptedMl: 30, maxAddableMl: 20 },
  {
    kind: "COMMAND_REJECTED",
    error: { kind: "NOTHING_TO_UNDO" },
  },
];

describe("describeEvent", () => {
  it.each(eventFixtures.map((event) => [event.kind, event] as const))("gives a non-empty sentence for %s (except a no-op TEMPERATURE_CHANGE)", (_kind, event) => {
    const text = describeEvent(event);
    expect(typeof text).toBe("string");
    if (event.kind === "TEMPERATURE_CHANGE" && event.fromC.toFixed(1) === event.toC.toFixed(1)) {
      expect(text).toBe("");
    } else {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("shows a container's label with its id once, when a lookup is given", () => {
    const text = describeEvent({ kind: "OBJECT_MOVED", objectId: containerId, position: { x: 0, y: 0 } }, (id) => `Flask A (${id})`);
    expect(text).toBe("Moved Flask A (c_1).");
  });

  it("falls back to the raw id with no lookup", () => {
    const text = describeEvent({ kind: "OBJECT_MOVED", objectId: containerId, position: { x: 0, y: 0 } });
    expect(text).toBe(`Moved ${containerId}.`);
  });

  it("drops a TEMPERATURE_CHANGE that rounds to the same tenth of a degree", () => {
    expect(describeEvent({ kind: "TEMPERATURE_CHANGE", containerId, fromC: 22.68, toC: 22.72, cause: "mixing" })).toBe("");
  });

  it("phrases neutralization by moles, not the raw net-ionic equation", () => {
    const text = describeEvent({ kind: "REACTION", containerId, ruleId: rule.id, extentMol: 0.0005, limiting: rule.reactants[0]!.species, netIonic: rule.equations.netIonic });
    expect(text).toBe("Neutralized 0.50 mmol H+.");
  });

  it("names the precipitate and rounds its mass to whole milligrams", () => {
    const text = describeEvent({
      kind: "PRECIPITATE_FORMED",
      containerId,
      species: rule.reactants[0]!.species,
      moles: 0.001,
      massG: 0.1433,
      color: { r: 240, g: 240, b: 235, a: 1 },
      scale: "moderate",
      description: "White precipitate: silver chloride, 143 mg.",
    });
    expect(text).toBe("White precipitate: silver chloride, 143 mg.");
  });

  it("reads a color shift as just the resulting color, no arrow", () => {
    const text = describeEvent({
      kind: "COLOR_SHIFT",
      containerId,
      from: { r: 200, g: 225, b: 240, a: 0.12 },
      to: { r: 236, g: 64, b: 160, a: 0.5 },
      description: "colorless -> faint pink",
      indicatorTransition: true,
    });
    expect(text).toBe("Faint pink.");
  });
});

const errorFixtures: ReadonlyArray<LabError> = [
  { kind: "UNKNOWN_OBJECT", id: "c_99", hint: "reread_lab_state" },
  { kind: "WRONG_OBJECT_TYPE", id: containerId, expected: ["flask"] },
  { kind: "OVER_CAPACITY", containerId, capacityMl: 100, currentMl: 80, attemptedMl: 25, maxAddableMl: 20 },
  { kind: "INSUFFICIENT_VOLUME", containerId, availableMl: 10, requestedMl: 20 },
  { kind: "INVALID_AMOUNT", field: "volumeMl", value: -1, reason: "not_positive" },
  { kind: "SAME_CONTAINER", containerId },
  { kind: "UNSUPPORTED_REAGENT", requested: "hcI", suggestions: [mintReagentId("hcl")] },
  { kind: "UNSUPPORTED_CONCENTRATION", reagentId: mintReagentId("hcl"), requestedM: 5, maxM: 2 },
  { kind: "UNSUPPORTED_INDICATOR", requested: "phenol", suggestions: [] },
  { kind: "STOCK_DEPLETED", reagentId: mintReagentId("agno3"), remainingMl: 2 },
  { kind: "NO_INSTRUMENT", containerId, needed: "ph_meter", hint: "Attach a pH meter first." },
  { kind: "INVALID_TEMPERATURE", requestedC: 200, minC: 0, maxC: 100 },
  { kind: "RESTRICTED_BY_CHALLENGE", action: "inspect contents", reason: "sample is unidentified" },
  { kind: "NOTHING_TO_UNDO" },
  { kind: "UNKNOWN_SCENARIO", requested: "mystery", available: ["sandbox", "titration", "unknown_id"] },
];

describe("describeError", () => {
  it.each(errorFixtures.map((error) => [error.kind, error] as const))("gives a non-empty message for %s", (_kind, error) => {
    const text = describeError(error);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("includes suggestions when present", () => {
    const text = describeError({ kind: "UNSUPPORTED_REAGENT", requested: "hcI", suggestions: [mintReagentId("hcl")] });
    expect(text).toContain("hcl");
  });
});
