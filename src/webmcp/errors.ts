import type { LabError, LabState, LabObject } from "@/engine";
import { assertNever, describeError } from "@/engine";
import { labelLookup } from "@/lib/events";
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
      return { code: "PERMISSION_DENIED", message, suggestions: ["Use measure_ph, measure_temperature, or add a test reagent and observe the result instead of inspecting hidden contents."] };
    case "NOTHING_TO_UNDO":
      return { code: "NOTHING_TO_UNDO", message };
    case "UNKNOWN_SCENARIO":
      return { code: "UNKNOWN_SCENARIO", message, suggestions: [`Available scenarios: ${error.available.join(", ")}.`] };
    default:
      return assertNever(error);
  }
}
