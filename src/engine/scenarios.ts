import type { ReagentId } from "./ids";
import type { CurvePoint, LabState, PublicLabState, ScenarioId } from "./types";
// STUB: replaced by engine-reducer.
export const SCENARIO_IDS: ReadonlyArray<ScenarioId> = ["sandbox", "titration", "unknown_id"];
export function loadScenario(_id: ScenarioId, _seed: number): LabState { throw new Error("not implemented"); }
export function publicView(_state: LabState): PublicLabState { throw new Error("not implemented"); }
export function scenarioObjective(_id: ScenarioId): string { throw new Error("not implemented"); }
export function titrationCurve(_state: LabState): ReadonlyArray<CurvePoint> { throw new Error("not implemented"); }
export function estimateEquivalenceMl(_curve: ReadonlyArray<CurvePoint>): number | null { throw new Error("not implemented"); }
export function titrationSolution(_state: LabState): { analyteM: number; equivalenceMl: number } | null { throw new Error("not implemented"); }
export function checkTitrationAnswer(_state: LabState, _claimedM: number): { correct: boolean; relError: number; analyteM: number } | null { throw new Error("not implemented"); }
export function checkUnknownAnswers(_state: LabState, _guesses: Readonly<Record<string, ReagentId>>): { correct: number; total: number } | null { throw new Error("not implemented"); }
