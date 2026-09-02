/**
 * Titration curve helpers and the narrow answer-checking functions for titration and unknown_id.
 * Split out of scenarios.ts to keep it under the file-length budget; grouped with
 * scenarioProgress.ts's concerns since both read (never leak) a scenario's `secrets`.
 */
import type { ReagentId } from "./ids";
import type { CurvePoint, LabState } from "./types";

export function titrationCurve(state: LabState): ReadonlyArray<CurvePoint> {
  return state.scenario.kind === "titration" ? state.scenario.curve : [];
}

/** Midpoint of the steepest ΔpH/ΔmL interval; null when fewer than two readings have a pH value. */
export function estimateEquivalenceMl(curve: ReadonlyArray<CurvePoint>): number | null {
  const valid = curve.filter((p): p is CurvePoint & { pH: number } => p.pH !== null).slice().sort((a, b) => a.titrantMl - b.titrantMl);
  if (valid.length < 2) return null;
  let bestSlope = -Infinity;
  let bestMid: number | null = null;
  for (let i = 0; i < valid.length - 1; i++) {
    const a = valid[i];
    const b = valid[i + 1];
    if (!a || !b) continue;
    const dv = b.titrantMl - a.titrantMl;
    if (dv <= 0) continue;
    const slope = Math.abs(b.pH - a.pH) / dv;
    if (slope > bestSlope) {
      bestSlope = slope;
      bestMid = (a.titrantMl + b.titrantMl) / 2;
    }
  }
  return bestMid;
}

export function titrationSolution(state: LabState): { readonly analyteM: number; readonly equivalenceMl: number } | null {
  if (state.scenario.kind !== "titration") return null;
  const { analyteMl, titrantM, secrets } = state.scenario;
  return { analyteM: secrets.analyteM, equivalenceMl: (analyteMl * secrets.analyteM) / titrantM };
}

export function checkTitrationAnswer(state: LabState, claimedM: number): { readonly correct: boolean; readonly relError: number; readonly analyteM: number } | null {
  if (state.scenario.kind !== "titration") return null;
  const analyteM = state.scenario.secrets.analyteM;
  const relError = Math.abs(claimedM - analyteM) / analyteM;
  return { correct: relError <= state.scenario.toleranceRel, relError, analyteM };
}

export function checkUnknownAnswers(state: LabState, guesses: Readonly<Record<string, ReagentId>>): { readonly correct: number; readonly total: number } | null {
  if (state.scenario.kind !== "unknown_id") return null;
  let correct = 0;
  for (const sample of state.scenario.samples) {
    const recipe = state.scenario.secrets[sample.shelfId];
    if (recipe && guesses[sample.shelfId] === recipe.reagentId) correct += 1;
  }
  return { correct, total: state.scenario.samples.length };
}
