import type { LabError, LabState, LabObject } from "@/engine";
import { assertNever, constants, describeError } from "@/engine";
import { labelLookup } from "@/lib/labels";
import type { ToolErrorCode } from "./types";

export interface MappedError {
  readonly code: ToolErrorCode;
  readonly message: string;
  readonly suggestions?: ReadonlyArray<string>;
}

/** Ids of every object on the bench, optionally filtered to the given equipment types. */
function objectIds(lab: LabState, types?: ReadonlyArray<LabObject["type"]>): ReadonlyArray<string> {
  return lab.objects.filter((o) => !types || types.includes(o.type)).map((o) => o.id);
}

function idsSuggestion(lab: LabState, types?: ReadonlyArray<LabObject["type"]>): string {
  const ids = objectIds(lab, types);
  return ids.length > 0 ? `Current ids: ${ids.join(", ")}.` : "No matching objects on the bench.";
}

/** Up to 6 unoccupied bench positions (x, y), for the SLOT_UNAVAILABLE suggestion. */
function freeCellsSuggestion(lab: LabState): string {
  const occupied = new Set(lab.objects.map((o) => `${o.position.x},${o.position.y}`));
  const free: string[] = [];
  for (let row = 0; row < constants.GRID.rows && free.length < 6; row++) {
    for (let col = 0; col < constants.GRID.cols && free.length < 6; col++) {
      const x = constants.GRID.minX + col;
      const y = constants.GRID.minY + row;
      if (!occupied.has(`${x},${y}`)) free.push(`(${x}, ${y})`);
    }
  }
  return free.length > 0 ? `Free bench positions: ${free.join(", ")}.` : "The bench is full.";
}

/** The way around a challenge restriction depends on which action tripped it (see commands.ts). */
function restrictedSuggestion(action: string): string {
  if (action.includes("transfer")) return "Use dispense for the burette so every titrant addition lands on the titration curve.";
  if (action.includes("concentration")) return "Omit concentration_m; the unknown pours at its hidden stock concentration.";
  return "Use measure_ph, measure_temperature, or add a test reagent and observe the result instead of inspecting hidden contents.";
}

/**
 * Turns an engine LabError into the tool-facing { code, message, suggestions } shape, per
 * docs/design/contracts.md #2 and store-webmcp.md B3.1. Suggestions are computed from the
 * current lab so the agent can self-correct without another round trip.
 */
export function mapLabError(error: LabError, lab: LabState): MappedError {
  const message = describeError(error, labelLookup(lab));
  switch (error.kind) {
    case "UNKNOWN_OBJECT":
      return { code: "OBJECT_NOT_FOUND", message, suggestions: [idsSuggestion(lab), "Call get_lab_state to refresh known ids."] };
    case "WRONG_OBJECT_TYPE":
      return { code: "OBJECT_NOT_FOUND", message, suggestions: [idsSuggestion(lab, error.expected)] };
    case "OVER_CAPACITY":
      return { code: "CAPACITY_EXCEEDED", message, suggestions: [`Max addable is ${error.maxAddableMl} mL (capacity ${error.capacityMl} mL, currently ${error.currentMl} mL).`] };
    case "INSUFFICIENT_VOLUME":
      return { code: "INSUFFICIENT_VOLUME", message, suggestions: [`Source holds ${error.availableMl} mL, requested ${error.requestedMl} mL.`] };
    case "INVALID_AMOUNT":
      return { code: "INVALID_AMOUNT", message, suggestions: [`Field "${error.field}" was ${error.value} (${error.reason}).`] };
    case "SAME_CONTAINER":
      return { code: "INVALID_INPUT", message, suggestions: ["Source and destination must be different containers."] };
    case "UNSUPPORTED_REAGENT":
      return { code: "INVALID_INPUT", message, suggestions: [`Available reagents: ${error.suggestions.join(", ") || "none"}.`] };
    case "UNSUPPORTED_CONCENTRATION":
      return { code: "INVALID_INPUT", message, suggestions: [`Max concentration for ${error.reagentId} is ${error.maxM} M.`] };
    case "UNSUPPORTED_INDICATOR":
      return { code: "INVALID_INPUT", message, suggestions: [`Available indicators: ${error.suggestions.join(", ") || "none"}.`] };
    case "STOCK_DEPLETED":
      return { code: "INVALID_INPUT", message, suggestions: [`${error.reagentId} has ${error.remainingMl} mL remaining.`] };
    case "NO_INSTRUMENT":
      return { code: "INSTRUMENT_MISSING", message, suggestions: [error.hint, `add_container({ type: "${error.needed}" }) to place one on the bench.`] };
    case "INVALID_TEMPERATURE":
      return { code: "OUT_OF_RANGE", message, suggestions: [`Valid range is ${error.minC} to ${error.maxC} °C.`] };
    case "RESTRICTED_BY_CHALLENGE":
      return { code: "PERMISSION_DENIED", message, suggestions: [restrictedSuggestion(error.action)] };
    case "NOTHING_TO_UNDO":
      return { code: "NOTHING_TO_UNDO", message };
    case "UNKNOWN_SCENARIO":
      return { code: "UNKNOWN_SCENARIO", message, suggestions: [`Available scenarios: ${error.available.join(", ")}.`] };
    case "SLOT_UNAVAILABLE":
      return { code: "OUT_OF_RANGE", message, suggestions: [freeCellsSuggestion(lab)] };
    default:
      return assertNever(error);
  }
}
