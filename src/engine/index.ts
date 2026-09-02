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
export {
  SPECIES,
  SPECIES_IDS,
  KNOWN_SPECIES,
  isKnownSpecies,
  speciesDef,
  speciesKeys,
  getMoles,
  addMoles,
  removeMoles,
  netCharge,
  SP,
} from "./species";
export {
  REAGENTS,
  REAGENT_IDS,
  INDICATORS,
  INDICATOR_IDS,
  reagentDef,
  indicatorDef,
  stockToMoles,
  suggestReagents,
  suggestIndicators,
} from "./reagents";
export { RULES, predictSupportedReactions, reactionsIfAdded, ruleById } from "./reactions";
export { derivePh } from "./ph";
export { liquidTint, deriveColor, colorDistance, describeColor, indicatorBand, rgbaToHex, rgbaToCss } from "./color";
export { describeEvent, eventForError, describeError } from "./observations";
export type { LabelLookup } from "./observations";
