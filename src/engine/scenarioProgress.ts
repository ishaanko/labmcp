/**
 * scenarioProgress (A4.5): one ScenarioProgress per ScenarioId, derived from the full internal
 * LabState so it can read a challenge's secrets (e.g. neutralize's target) without leaking them
 * in its output. `check_objective` and the objective UI are both thin wrappers over this.
 */
import { mintReactionRuleId, mintReagentId, type ContainerId } from "./ids";
import { derivePh } from "./ph";
import { ruleById } from "./reactions";
import { reagentDef } from "./reagents";
import { scenarioObjective } from "./scenarios";
import { getMoles, SP } from "./species";
import { assertNever, type Container, type LabState, type ScenarioId, type ScenarioProgress, type ScenarioState, type SolubilityMilestones } from "./types";

const EMPTY_MILESTONES: SolubilityMilestones = { addedEnoughSolute: false, hadUndissolved: false, heatedFullyDissolved: false, cooledWithCrystals: false };

function containerById(state: LabState, id: ContainerId): Container | undefined {
  return state.objects.find((o): o is Container => o.kind === "container" && o.id === id);
}

function step(label: string, done: boolean): { readonly label: string; readonly done: boolean } {
  return { label, done };
}

function progressFor(
  scenarioId: ScenarioId,
  steps: ReadonlyArray<{ readonly label: string; readonly done: boolean }>,
  detail: string,
): ScenarioProgress {
  return { scenarioId, objective: scenarioObjective(scenarioId), steps, complete: steps.length > 0 && steps.every((s) => s.done), detail };
}

function titrationProgress(state: LabState, scenario: Extract<ScenarioState, { kind: "titration" }>): ScenarioProgress {
  const flask = containerById(state, scenario.flaskId);
  const probeAttached = state.objects.some((o) => o.kind === "instrument" && o.type === "ph_meter" && o.attachedTo === scenario.flaskId);
  const indicatorAdded = flask !== undefined && flask.indicators.length > 0;
  const endpointReached = state.observations.some((o) => o.event.kind === "COLOR_SHIFT" && o.event.containerId === scenario.flaskId && o.event.indicatorTransition);
  const steps = [step("Attach the pH probe", probeAttached), step("Add indicator", indicatorAdded), step("Reach the endpoint", endpointReached), step("Reveal the result", scenario.revealed)];
  const done = steps.filter((s) => s.done).length;
  const detail = scenario.revealed ? "Revealed." : endpointReached ? "Endpoint reached; submit your conclusion." : `${done}/${steps.length} steps done.`;
  return progressFor("titration", steps, detail);
}

function unknownIdProgress(state: LabState, scenario: Extract<ScenarioState, { kind: "unknown_id" }>): ScenarioProgress {
  const gasObserved = state.reactions.some((r) => ruleById(r.ruleId)?.kind === "gas");
  const precipitateObserved = state.reactions.some((r) => ruleById(r.ruleId)?.kind === "precipitation");
  const steps = [step("Observe a precipitate", precipitateObserved), step("Observe a gas", gasObserved), step("Name all four unknowns", scenario.revealed)];
  const done = steps.filter((s) => s.done).length;
  const detail = scenario.revealed ? "All four named." : `${done}/${steps.length} steps done.`;
  return progressFor("unknown_id", steps, detail);
}

const SECOND_PRECIPITATION_RULES = [mintReactionRuleId("baso4_ppt"), mintReactionRuleId("caco3_ppt"), mintReactionRuleId("cuoh2_ppt")];

function precipitationProgress(state: LabState): ScenarioProgress {
  const agClFormed = state.reactions.some((r) => r.ruleId === mintReactionRuleId("agcl_ppt"));
  const secondFormed = state.reactions.some((r) => SECOND_PRECIPITATION_RULES.includes(r.ruleId));
  const steps = [step("Form silver chloride", agClFormed), step("Form a second, different precipitate", secondFormed)];
  const detail = agClFormed && secondFormed ? "Two precipitates formed." : agClFormed ? "AgCl formed; find a second precipitate." : secondFormed ? "A precipitate formed; find silver chloride too." : "No precipitate yet.";
  return progressFor("precipitation", steps, detail);
}

function neutralizeProgress(state: LabState, scenario: Extract<ScenarioState, { kind: "neutralize" }>): ScenarioProgress {
  const beaker = containerById(state, scenario.beakerId);
  const meterAttached = state.objects.some((o) => o.kind === "instrument" && o.type === "ph_meter" && o.attachedTo === scenario.beakerId);
  const ph = meterAttached && beaker ? derivePh(beaker) : null;
  const atTarget = ph !== null && Math.abs(ph - scenario.targetPh) <= scenario.tolerance;
  const steps = [step("Attach the pH meter to the beaker", meterAttached), step(`Bring the beaker to pH ${scenario.targetPh.toFixed(1)} ± ${scenario.tolerance.toFixed(1)}`, atTarget)];
  const detail = ph !== null ? `pH ${ph.toFixed(2)}, target ${scenario.targetPh.toFixed(1)} ± ${scenario.tolerance.toFixed(1)}` : "no probe";
  return progressFor("neutralize", steps, detail);
}

/** The container closest to targetMl among those holding any sodium, or null if none do. */
function bestDilutionCandidate(state: LabState, targetMl: number): Container | null {
  const holders = state.objects.filter((o): o is Container => o.kind === "container" && getMoles(o.species, SP.Na) > 1e-9);
  if (holders.length === 0) return null;
  return holders.reduce((best, c) => (Math.abs(c.volumeMl - targetMl) < Math.abs(best.volumeMl - targetMl) ? c : best));
}

function dilutionProgress(state: LabState, scenario: Extract<ScenarioState, { kind: "dilution" }>): ScenarioProgress {
  const candidate = bestDilutionCandidate(state, scenario.targetMl);
  const hasSalt = candidate !== null;
  const atVolume = candidate !== null && Math.abs(candidate.volumeMl - scenario.targetMl) <= scenario.toleranceMl;
  const concentrationM = candidate && candidate.volumeMl > 0 ? getMoles(candidate.species, SP.Na) / (candidate.volumeMl / 1000) : null;
  const atConcentration = concentrationM !== null && Math.abs(concentrationM - scenario.targetM) <= scenario.toleranceM;
  const steps = [
    step("Hold sodium chloride in a container", hasSalt),
    step(`Measure out ${scenario.targetMl.toFixed(0)} mL ± ${scenario.toleranceMl.toFixed(0)} mL`, atVolume),
    step(`Dilute to ${scenario.targetM.toFixed(3)} M ± ${scenario.toleranceM.toFixed(3)} M`, atConcentration),
  ];
  const detail = candidate ? `${candidate.label}: ${candidate.volumeMl.toFixed(1)} mL, ${(concentrationM ?? 0).toFixed(3)} M` : "no sodium chloride yet";
  return progressFor("dilution", steps, detail);
}

function solubilityProgress(state: LabState, scenario: Extract<ScenarioState, { kind: "solubility" }>): ScenarioProgress {
  const m = scenario.milestones ?? EMPTY_MILESTONES;
  const steps = [
    step("Dissolve at least 20 g of potassium nitrate", m.addedEnoughSolute),
    step("Leave some solid undissolved", m.hadUndissolved),
    step("Heat above 60 °C until everything dissolves", m.heatedFullyDissolved),
    step("Cool below 30 °C and watch crystals return", m.cooledWithCrystals),
  ];
  const done = steps.filter((s) => s.done).length;
  return progressFor("solubility", steps, `${done}/${steps.length} milestones reached.`);
}

export function scenarioProgress(state: LabState): ScenarioProgress {
  const { scenario } = state;
  switch (scenario.kind) {
    case "sandbox":
      return { scenarioId: "sandbox", objective: scenarioObjective("sandbox"), steps: [], complete: false, detail: "" };
    case "titration":
      return titrationProgress(state, scenario);
    case "unknown_id":
      return unknownIdProgress(state, scenario);
    case "precipitation":
      return precipitationProgress(state);
    case "neutralize":
      return neutralizeProgress(state, scenario);
    case "dilution":
      return dilutionProgress(state, scenario);
    case "solubility":
      return solubilityProgress(state, scenario);
    default:
      return assertNever(scenario);
  }
}

/**
 * Molar mass of KNO3, the total grams currently in a container (dissolved + undissolved), and
 * whether any undissolved solid remains. Shared by the reducer's per-command milestone hook so
 * both sides agree on what "20 g added" and "fully dissolved" mean.
 */
export function solubilityReading(container: Container): { readonly totalG: number; readonly hasUndissolved: boolean } {
  const molarMass = (() => {
    const def = reagentDef(mintReagentId("kno3"));
    return def && def.kind === "solid" ? def.molarMass : 101.1;
  })();
  const dissolvedMol = getMoles(container.species, SP.K);
  const solidEntry = container.solids.find((s) => s.species === SP.KNO3Solid);
  const undissolvedG = solidEntry ? solidEntry.moles * molarMass : 0;
  return { totalG: dissolvedMol * molarMass + undissolvedG, hasUndissolved: undissolvedG > 1e-6 };
}
