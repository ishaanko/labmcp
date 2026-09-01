import type { Actor, Applied, LabCommand, LabError, LabState, Result } from "./types";
// STUB: replaced by engine-reducer.
export function applyCommand(_state: LabState, _command: LabCommand, _actor: Actor = "human"): Result<Applied, LabError> { throw new Error("not implemented"); }
export function advanceTime(_state: LabState, _dtS: number): Applied { throw new Error("not implemented"); }
export function createEmptyState(_seed: number): LabState { throw new Error("not implemented"); }
