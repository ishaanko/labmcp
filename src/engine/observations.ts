import { COLOR_EVENT_THRESHOLD, EPS_MOL, MIXING_TEMP_EVENT_C, PH_EVENT_THRESHOLD } from "./constants";
import { colorDistance, describeColor, deriveColor, indicatorBand } from "./color";
import { derivePh } from "./ph";
import { computeGasEffect, precipitateScale, type FiredReaction } from "./reactions";
import { speciesDef } from "./species";
import type { Container, InstrumentReading, LabCommand, LabError, LabEvent, Rgba, ThermalState } from "./types";
import { assertNever } from "./types";

/** Same threshold advanceTime uses for thermal TEMPERATURE_CHANGE events. */
const TEMP_CHANGE_EVENT_C = 1e-3;

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
          description: `${capitalize(colorWord(color))} precipitate formed (${def.name}, ${(massG * 1000).toFixed(1)} mg).`,
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

/** One plain sentence per event kind. Used by the activity feed, toasts, and notebook. */
export function describeEvent(event: LabEvent): string {
  switch (event.kind) {
    case "OBJECT_PLACED":
      return `Placed ${event.objectType.replace(/_/g, " ")} (${event.objectId}) on the bench.`;
    case "OBJECT_REMOVED":
      return `Removed ${event.objectId} from the bench.`;
    case "OBJECT_MOVED":
      return `Moved ${event.objectId}.`;
    case "INSTRUMENT_ATTACHED":
      return event.containerId
        ? `Attached ${event.instrumentId} to ${event.containerId}.`
        : `Detached ${event.instrumentId}.`;
    case "LIQUID_ADDED":
      return `Added ${event.volumeMl.toFixed(1)} mL of ${event.reagentId} to ${event.containerId} (now ${event.newVolumeMl.toFixed(1)} mL).`;
    case "LIQUID_TRANSFERRED":
      return `Transferred ${event.volumeMl.toFixed(1)} mL from ${event.fromId} to ${event.toId}.`;
    case "INDICATOR_ADDED":
      return `Added ${event.drops} drop(s) of ${event.indicator} to ${event.containerId}.`;
    case "STIR_STARTED":
      return `Stirring ${event.containerId} for ${event.durationS.toFixed(0)} s.`;
    case "THERMAL_SET":
      return `${event.containerId} ${describeThermal(event.thermal)}.`;
    case "MEASUREMENT":
      return `Measured ${event.containerId}: ${describeReading(event.reading)}.`;
    case "CONTENTS_INSPECTED":
      return `Inspected contents of ${event.containerId} (${event.volumeMl.toFixed(1)} mL).`;
    case "REACTION":
      return `Reaction in ${event.containerId}: ${event.netIonic} (${(event.extentMol * 1000).toFixed(3)} mmol, limited by ${event.limiting}).`;
    case "COLOR_SHIFT":
      return `${event.containerId} color shifted: ${event.description}.`;
    case "PRECIPITATE_FORMED":
      return event.description;
    case "BUBBLES":
      return `Bubbling in ${event.containerId}: ${event.species} released (${(event.moles * 1000).toFixed(3)} mmol).`;
    case "TEMPERATURE_CHANGE":
      return `${event.containerId} temperature changed from ${event.fromC.toFixed(1)} °C to ${event.toC.toFixed(1)} °C (${event.cause}).`;
    case "PH_CHANGE":
      return `${event.containerId} pH changed from ${event.from.toFixed(2)} to ${event.to.toFixed(2)}.`;
    case "NO_REACTION":
      return event.description;
    case "SOLIDS_SETTLED":
      return `Solids in ${event.containerId} have settled.`;
    case "DISPOSED":
      return `Disposed of ${event.volumeMl.toFixed(1)} mL from ${event.containerId}.`;
    case "UNDONE":
      return `Undid: ${commandLabel(event.undoneCommand)}.`;
    case "RESET":
      return "Lab reset.";
    case "SCENARIO_LOADED":
      return `Loaded scenario "${event.scenarioId}" (seed ${event.seed}).`;
    case "SCENARIO_REVEALED":
      return `Scenario "${event.scenarioId}" revealed.`;
    case "OVERFLOW_REJECTED":
      return `Rejected: ${event.attemptedMl.toFixed(1)} mL would overflow ${event.containerId} (max addable ${event.maxAddableMl.toFixed(1)} mL).`;
    case "COMMAND_REJECTED":
      return `Rejected: ${describeError(event.error)}`;
    default:
      return assertNever(event);
  }
}

/** Exhaustive human-readable message for a rejected command, with a suggestion where one is available. */
export function describeError(error: LabError): string {
  switch (error.kind) {
    case "UNKNOWN_OBJECT":
      return `No object "${error.id}" on the bench. Re-read the lab state and try again.`;
    case "WRONG_OBJECT_TYPE":
      return `${error.id} is the wrong type; expected one of: ${error.expected.join(", ")}.`;
    case "OVER_CAPACITY":
      return `${error.containerId} holds ${error.currentMl.toFixed(1)}/${error.capacityMl.toFixed(1)} mL; adding ${error.attemptedMl.toFixed(1)} mL would overflow it. You can add up to ${error.maxAddableMl.toFixed(1)} mL.`;
    case "INSUFFICIENT_VOLUME":
      return `Only ${error.availableMl.toFixed(1)} mL available, but ${error.requestedMl.toFixed(1)} mL was requested.`;
    case "INVALID_AMOUNT":
      return `Invalid value for ${error.field}: ${error.value} (${error.reason.replace(/_/g, " ")}).`;
    case "SAME_CONTAINER":
      return `Source and destination are the same container (${error.containerId}).`;
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
      return `${error.containerId} needs a ${error.needed.replace(/_/g, " ")} attached. ${error.hint}`;
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
