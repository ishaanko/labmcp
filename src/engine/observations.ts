import type { LabError, LabEvent } from "./types";
// STUB: replaced by engine-reactions.
export function describeEvent(_e: LabEvent): string { throw new Error("not implemented"); }
export function describeError(_e: LabError): string { throw new Error("not implemented"); }
export function eventForError(_e: LabError): LabEvent { throw new Error("not implemented"); }
