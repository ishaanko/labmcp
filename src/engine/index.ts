/**
 * Public engine API. Everything outside src/engine imports from here.
 * The engine is pure: no React, no DOM, no clocks, no randomness outside the seeded RNG.
 */
export * from "./ids";
export * from "./types";
export * as constants from "./constants";
export { applyCommand, advanceTime, createEmptyState } from "./reducer";
export {
  loadScenario,
  publicView,
  titrationCurve,
  estimateEquivalenceMl,
  titrationSolution,
  checkTitrationAnswer,
  checkUnknownAnswers,
  SCENARIO_IDS,
  scenarioObjective,
} from "./scenarios";
export { SPECIES, SPECIES_IDS, speciesDef, speciesKeys, netCharge } from "./species";
export { REAGENTS, REAGENT_IDS, INDICATORS, INDICATOR_IDS, reagentDef, indicatorDef, suggestReagents } from "./reagents";
export { RULES, predictSupportedReactions, ruleById } from "./reactions";
export { derivePh } from "./ph";
export { deriveColor, describeColor } from "./color";
export { describeEvent, eventForError, describeError } from "./observations";
