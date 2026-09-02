import type { LabelLookup, LabState, PublicLabState } from "@/engine";

/**
 * Human-facing display names for bench objects: the one place a raw `ContainerId`/`InstrumentId`
 * turns into prose. `lib/events.ts`, `lib/summary.ts`, and `lib/notebook.ts` all read from here
 * instead of keeping their own copies of this lookup in sync.
 */

export const INSTRUMENT_NAMES: Readonly<Record<string, string>> = { ph_meter: "pH meter", thermometer: "Thermometer", hotplate: "Hotplate" };

/** Display name for a bench object, e.g. "Flask A" or "pH meter". Never the raw id on its own. */
export function labelFor(lab: LabState | PublicLabState, id: string | null | undefined): string {
  if (id === null || id === undefined) return "the bench";
  const obj = lab.objects.find((o) => o.id === id);
  if (!obj) return id;
  return obj.kind === "container" ? obj.label : (INSTRUMENT_NAMES[obj.type] ?? obj.type.replace(/_/g, " "));
}

/** "Flask A (c_1)": the one place an id is allowed to show, for a sentence's first mention of it. */
export function labelWithId(lab: LabState | PublicLabState, id: string): string {
  return `${labelFor(lab, id)} (${id})`;
}

/** Builds the `LabelLookup` `describeEvent` takes: id included, so the agent can act on it in a follow-up tool call. */
export function labelLookup(lab: LabState | PublicLabState): LabelLookup {
  return (id) => labelWithId(lab, id);
}

/** "Flask A": no id, for the notebook. A human reads it next to the bench and never types an id. */
export function plainLabels(lab: LabState | PublicLabState): LabelLookup {
  return (id) => labelFor(lab, id);
}
