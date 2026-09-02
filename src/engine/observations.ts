import { COLOR_EVENT_THRESHOLD, EPS_MOL, MIXING_TEMP_EVENT_C, PH_EVENT_THRESHOLD } from "./constants";
import { colorDistance, describeColor, deriveColor, indicatorBand } from "./color";
import { derivePh } from "./ph";
import { computeGasEffect, precipitateScale, type FiredReaction } from "./reactions";
import { reagentDef } from "./reagents";
import { speciesDef } from "./species";
import type { Container, InstrumentReading, LabCommand, LabError, LabEvent, Rgba, ThermalState } from "./types";
import { assertNever } from "./types";

/** Below this, a reaction's own heat is rounding noise: it would print as "X.X to X.X". */
const TEMP_CHANGE_EVENT_C = 0.05;

const totalMoles = (container: Container): number =>
  Object.values(container.species).reduce<number>((sum, v) => sum + (v ?? 0), 0);

/** Commands that mix or add liquid into a container, the only ones that can drive PH/COLOR/NO_REACTION/mixing events. */
function isMixCommand(command: LabCommand): boolean {
  return command.kind === "ADD_REAGENT" || command.kind === "TRANSFER_LIQUID" || command.kind === "DISPENSE";
}

function indicatorTransitioned(after: Container, phBefore: number | null, phAfter: number | null): boolean {
  if (phBefore === null || phAfter === null) return false;
  return after.indicators.some((dose) => indicatorBand(dose.indicator, phBefore) !== indicatorBand(dose.indicator, phAfter));
}

/**
 * Derives PH_CHANGE, COLOR_SHIFT, NO_REACTION and mixing TEMPERATURE_CHANGE events for one container
 * that just handled `command`. Reaction-caused events (REACTION, PRECIPITATE_FORMED, BUBBLES,
 * TEMPERATURE_CHANGE 'reaction') come from `eventsForFired` instead.
 */
export function deriveObservations(
  before: Container,
  after: Container,
  command: LabCommand,
  fired: ReadonlyArray<FiredReaction>,
): ReadonlyArray<LabEvent> {
  const events: LabEvent[] = [];
  const containerId = after.id;

  const phBefore = derivePh(before);
  const phAfter = derivePh(after);
  if (phBefore !== null && phAfter !== null && Math.abs(phAfter - phBefore) >= PH_EVENT_THRESHOLD) {
    events.push({ kind: "PH_CHANGE", containerId, from: phBefore, to: phAfter });
  }

  const colorBefore = deriveColor(before);
  const colorAfter = deriveColor(after);
  if (colorDistance(colorBefore, colorAfter) > COLOR_EVENT_THRESHOLD) {
    events.push({
      kind: "COLOR_SHIFT",
      containerId,
      from: colorBefore,
      to: colorAfter,
      description: `${describeColor(colorBefore)} -> ${describeColor(colorAfter)}`,
      indicatorTransition: indicatorTransitioned(after, phBefore, phAfter),
    });
  }

  if (isMixCommand(command) && fired.length === 0) {
    const dT = after.temperatureC - before.temperatureC;
    if (Math.abs(dT) > MIXING_TEMP_EVENT_C) {
      events.push({ kind: "TEMPERATURE_CHANGE", containerId, fromC: before.temperatureC, toC: after.temperatureC, cause: "mixing" });
    }

    const destHadSolute = totalMoles(before) > EPS_MOL;
    const addedSolute = totalMoles(after) - totalMoles(before) > EPS_MOL;
    if (destHadSolute && addedSolute) {
      events.push({ kind: "NO_REACTION", containerId, description: "Mixed, no visible reaction." });
    }
  }

  return events;
}

function colorWord(rgb: Rgba): string {
  if (rgb.r > 220 && rgb.g > 220 && rgb.b > 210) return "white";
  if (rgb.b > rgb.r + 40 && rgb.b > rgb.g + 40) return "pale blue";
  return "colored";
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** mg with no decimal: precise enough for a lab-notebook line, never "143.0 mg". */
const fmtMg = (massG: number): string => `${Math.round(massG * 1000)} mg`;

/**
 * Events produced directly by fired reactions: REACTION per rule, PRECIPITATE_FORMED/BUBBLES for
 * rules with a visual effect, and one aggregate TEMPERATURE_CHANGE('reaction') for the total ΔT.
 */
export function eventsForFired(container: Container, fired: ReadonlyArray<FiredReaction>): ReadonlyArray<LabEvent> {
  const events: LabEvent[] = [];
  const totalDeltaT = fired.reduce((sum, f) => sum + f.deltaTempC, 0);
  const startTemp = container.temperatureC - totalDeltaT;

  for (const f of fired) {
    events.push({
      kind: "REACTION",
      containerId: container.id,
      ruleId: f.rule.id,
      extentMol: f.extentMol,
      limiting: f.limiting,
      netIonic: f.rule.equations.netIonic,
    });

    const visual = f.rule.visual;
    if (visual.kind === "precipitate") {
      const produced = f.produced.find((p) => p.species === visual.species);
      if (produced) {
        const def = speciesDef(visual.species);
        const molarMass = def.kind === "solid" ? def.molarMass : 0;
        const color: Rgba = def.kind === "solid" ? def.color : { r: 200, g: 200, b: 200, a: 1 };
        const massG = produced.moles * molarMass;
        events.push({
          kind: "PRECIPITATE_FORMED",
          containerId: container.id,
          species: visual.species,
          moles: produced.moles,
          massG,
          color,
          scale: precipitateScale(massG),
          description: `${capitalize(colorWord(color))} precipitate: ${def.name}, ${fmtMg(massG)}.`,
        });
      }
    } else if (visual.kind === "bubbles") {
      const produced = f.produced.find((p) => p.species === visual.species);
      if (produced) {
        const { intensity, durationS } = computeGasEffect(produced.moles, container.volumeMl);
        events.push({
          kind: "BUBBLES",
          containerId: container.id,
          species: visual.species,
          moles: produced.moles,
          intensity,
          durationS,
        });
      }
    }
  }

  if (Math.abs(totalDeltaT) > TEMP_CHANGE_EVENT_C) {
    events.push({ kind: "TEMPERATURE_CHANGE", containerId: container.id, fromC: startTemp, toC: container.temperatureC, cause: "reaction" });
  }

  return events;
}

function describeReading(reading: InstrumentReading): string {
  switch (reading.kind) {
    case "ph":
      return `pH ${reading.value.toFixed(2)}`;
    case "temperature":
      return `${reading.valueC.toFixed(1)} °C`;
    case "volume":
      return `${reading.valueMl.toFixed(1)} mL`;
    default:
      return assertNever(reading);
  }
}

function describeThermal(thermal: ThermalState): string {
  switch (thermal.kind) {
    case "idle":
      return "left to reach ambient temperature";
    case "heating":
      return `set to heat toward ${thermal.targetC} °C`;
    case "cooling":
      return `set to cool toward ${thermal.targetC} °C`;
    default:
      return assertNever(thermal);
  }
}

const commandLabel = (command: LabCommand): string => command.kind.toLowerCase().replace(/_/g, " ");

/**
 * Resolves an object id to display text for a sentence, e.g. "Flask A (c_1)". Supplied by the
 * caller (`lib/events.ts`'s `labelFor`, or the store's redacted equivalent) so the engine itself
 * never depends on `LabState`/`PublicLabState` shapes; falls back to the bare id when omitted.
 */
export type LabelLookup = (id: string) => string;

const labelOf = (id: string, labels?: LabelLookup): string => (labels ? labels(id) : id);

/** "Silver nitrate", not "agno3": prose names reagents the way the shelf does. */
const reagentLabel = (id: Parameters<typeof reagentDef>[0]): string => reagentDef(id)?.label ?? id;

/**
 * One plain sentence per event kind, for the activity feed, toasts, and notebook.
 *
 * Kinds that only ever fire alongside a preceding command sentence in the same batch (PH_CHANGE,
 * COLOR_SHIFT, TEMPERATURE_CHANGE from a reaction/mixing, NO_REACTION, REACTION, PRECIPITATE_FORMED,
 * BUBBLES) read as short trailing clauses and never repeat the container name; `lib/events.ts`'s
 * `mergeCommandObservation` is what strings a command's clauses into one line. Kinds that can stand
 * on their own (placing/removing objects, dispensing, measuring, a TICK's ambient TEMPERATURE_CHANGE)
 * name their subject once via `labels`, id included, since nothing else in the sentence will.
 */
export function describeEvent(event: LabEvent, labels?: LabelLookup): string {
  switch (event.kind) {
    case "OBJECT_PLACED":
      return `Added ${labelOf(event.objectId, labels)} to the bench.`;
    case "OBJECT_REMOVED":
      return `Removed ${labelOf(event.objectId, labels)}.`;
    case "OBJECT_MOVED":
      return `Moved ${labelOf(event.objectId, labels)}.`;
    case "INSTRUMENT_ATTACHED":
      return event.containerId
        ? `Attached ${labelOf(event.instrumentId, labels)} to ${labelOf(event.containerId, labels)}.`
        : `Detached ${labelOf(event.instrumentId, labels)}.`;
    case "LIQUID_ADDED":
      return `Added ${event.volumeMl.toFixed(1)} mL ${reagentLabel(event.reagentId)} to ${labelOf(event.containerId, labels)}.`;
    case "LIQUID_TRANSFERRED":
      return `Poured ${event.volumeMl.toFixed(1)} mL from ${labelOf(event.fromId, labels)} into ${labelOf(event.toId, labels)}.`;
    case "INDICATOR_ADDED":
      return `Added ${event.drops} drop${event.drops === 1 ? "" : "s"} of ${event.indicator} to ${labelOf(event.containerId, labels)}.`;
    case "STIR_STARTED":
      return `Stirred ${labelOf(event.containerId, labels)} for ${event.durationS.toFixed(0)} s.`;
    case "THERMAL_SET":
      return `${labelOf(event.containerId, labels)} ${describeThermal(event.thermal)}.`;
    case "MEASUREMENT":
      return `Measured ${labelOf(event.containerId, labels)}: ${describeReading(event.reading)}.`;
    case "CONTENTS_INSPECTED":
      return `Inspected ${labelOf(event.containerId, labels)}: ${event.volumeMl.toFixed(1)} mL.`;
    case "REACTION":
      return event.ruleId === "neutralization"
        ? `Neutralized ${(event.extentMol * 1000).toFixed(2)} mmol H+.`
        : `Reacted: ${event.netIonic}.`;
    case "COLOR_SHIFT":
      return `${capitalize(event.description.split("-> ").pop() ?? event.description)}.`;
    case "PRECIPITATE_FORMED":
      return event.description;
    case "BUBBLES":
      return `Bubbling: ${event.species} released, ${(event.moles * 1000).toFixed(2)} mmol.`;
    case "TEMPERATURE_CHANGE": {
      if (event.fromC.toFixed(1) === event.toC.toFixed(1)) return "";
      const verb = event.toC > event.fromC ? "warmed" : "cooled";
      return event.cause === "thermal"
        ? `${labelOf(event.containerId, labels)} ${verb} to ${event.toC.toFixed(1)} °C.`
        : `${capitalize(verb)} to ${event.toC.toFixed(1)} °C.`;
    }
    case "PH_CHANGE":
      return `pH ${event.from.toFixed(2)} to ${event.to.toFixed(2)}.`;
    case "NO_REACTION":
      return event.description;
    case "SOLIDS_SETTLED":
      return `Solids in ${labelOf(event.containerId, labels)} settled.`;
    case "DISPOSED":
      return `Disposed of ${event.volumeMl.toFixed(1)} mL from ${labelOf(event.containerId, labels)}.`;
    case "UNDONE":
      return `Undid: ${commandLabel(event.undoneCommand)}.`;
    case "RESET":
      return "Lab reset.";
    case "SCENARIO_LOADED":
      return `Loaded scenario "${event.scenarioId}".`;
    case "SCENARIO_REVEALED":
      return `Scenario "${event.scenarioId}" revealed.`;
    case "OVERFLOW_REJECTED":
      return `Rejected: ${event.attemptedMl.toFixed(1)} mL would overflow ${labelOf(event.containerId, labels)}. Max addable: ${event.maxAddableMl.toFixed(1)} mL.`;
    case "COMMAND_REJECTED":
      return `Rejected: ${describeError(event.error, labels)}`;
    default:
      return assertNever(event);
  }
}

/**
 * Exhaustive human-readable message for a rejected command, with a suggestion where one is
 * available. `labels` is omitted for UNKNOWN_OBJECT on purpose: the id is exactly what didn't
 * resolve to anything, so there is no label to show instead.
 */
export function describeError(error: LabError, labels?: LabelLookup): string {
  switch (error.kind) {
    case "UNKNOWN_OBJECT":
      return `No object "${error.id}" on the bench. Re-read the lab state and try again.`;
    case "WRONG_OBJECT_TYPE":
      return `${labelOf(error.id, labels)} is the wrong type; expected one of: ${error.expected.join(", ")}.`;
    case "OVER_CAPACITY":
      return `${labelOf(error.containerId, labels)} holds ${error.currentMl.toFixed(1)}/${error.capacityMl.toFixed(1)} mL; adding ${error.attemptedMl.toFixed(1)} mL would overflow it. You can add up to ${error.maxAddableMl.toFixed(1)} mL.`;
    case "INSUFFICIENT_VOLUME":
      return `Only ${error.availableMl.toFixed(1)} mL available, but ${error.requestedMl.toFixed(1)} mL was requested.`;
    case "INVALID_AMOUNT":
      return `Invalid value for ${error.field}: ${error.value} (${error.reason.replace(/_/g, " ")}).`;
    case "SAME_CONTAINER":
      return `Source and destination are the same container (${labelOf(error.containerId, labels)}).`;
    case "UNSUPPORTED_REAGENT":
      return error.suggestions.length > 0
        ? `Unknown reagent "${error.requested}". Did you mean: ${error.suggestions.join(", ")}?`
        : `Unknown reagent "${error.requested}".`;
    case "UNSUPPORTED_CONCENTRATION":
      return `${error.reagentId} supports up to ${error.maxM} M; ${error.requestedM} M was requested.`;
    case "UNSUPPORTED_INDICATOR":
      return error.suggestions.length > 0
        ? `Unknown indicator "${error.requested}". Did you mean: ${error.suggestions.join(", ")}?`
        : `Unknown indicator "${error.requested}".`;
    case "STOCK_DEPLETED":
      return `${error.reagentId} is nearly out (${error.remainingMl.toFixed(1)} mL left on the shelf).`;
    case "NO_INSTRUMENT":
      return `${labelOf(error.containerId, labels)} needs a ${error.needed.replace(/_/g, " ")} attached. ${error.hint}`;
    case "INVALID_TEMPERATURE":
      return `Target ${error.requestedC} °C is outside the supported range ${error.minC}-${error.maxC} °C.`;
    case "RESTRICTED_BY_CHALLENGE":
      return `Can't ${error.action}: ${error.reason}.`;
    case "NOTHING_TO_UNDO":
      return "Nothing to undo.";
    case "UNKNOWN_SCENARIO":
      return `Unknown scenario "${error.requested}". Available: ${error.available.join(", ")}.`;
    default:
      return assertNever(error);
  }
}

export function eventForError(error: LabError): LabEvent {
  return { kind: "COMMAND_REJECTED", error };
}
