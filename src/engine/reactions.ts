import { GAS_FULL_M, MAX_REACTION_DT_C, MIN_EXTENT_MOL, WATER_J_PER_ML_C } from "./constants";
import { mintReactionRuleId, type ReactionRuleId, type SpeciesId } from "./ids";
import { addMoles, getMoles, SP } from "./species";
import type { Container, GasEffect, PrecipitateScale, ReactionRule, ReagentDef, SolidDeposit, Stoich } from "./types";

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Reaction registry, ordered by priority. Acid protonates/dissolves before precipitation can compete for the same ions. */
const RULES_UNSORTED: ReadonlyArray<ReactionRule> = [
  {
    id: mintReactionRuleId("neutralization"),
    kind: "neutralization",
    priority: 10,
    reactants: [
      { species: SP.H, coef: 1 },
      { species: SP.OH, coef: 1 },
    ],
    products: [],
    minExtentMol: MIN_EXTENT_MOL,
    enthalpyKjPerMol: -57.3,
    equations: {
      molecular: "Acid + Base -> Salt + Water",
      ionic: "H+ (aq) + OH- (aq) -> H2O (l)",
      netIonic: "H+ + OH- -> H2O",
    },
    visual: { kind: "none" },
    notes: ["Runs first so a strong acid consumes hydroxide before Cu(OH)2 or CaCO3 can precipitate it."],
  },
  {
    id: mintReactionRuleId("ammonia_protonation"),
    kind: "proton_transfer",
    priority: 12,
    reactants: [
      { species: SP.NH3, coef: 1 },
      { species: SP.H, coef: 1 },
    ],
    products: [{ species: SP.NH4, coef: 1 }],
    minExtentMol: MIN_EXTENT_MOL,
    enthalpyKjPerMol: 0,
    equations: {
      molecular: "NH3 + HCl -> NH4Cl",
      ionic: "NH3 (aq) + H+ (aq) -> NH4+ (aq)",
      netIonic: "NH3 + H+ -> NH4+",
    },
    visual: { kind: "none" },
    notes: ["Runs right after strong-acid neutralization, so ammonia grabs any leftover H+ before it can reach a carbonate."],
  },
  {
    id: mintReactionRuleId("weak_acid_neutralization"),
    kind: "proton_transfer",
    priority: 15,
    reactants: [
      { species: SP.AcOH, coef: 1 },
      { species: SP.OH, coef: 1 },
    ],
    products: [{ species: SP.AcO, coef: 1 }],
    minExtentMol: MIN_EXTENT_MOL,
    enthalpyKjPerMol: 0,
    equations: {
      molecular: "CH3COOH + NaOH -> CH3COONa + H2O",
      ionic: "CH3COOH (aq) + OH- (aq) -> CH3COO- (aq) + H2O (l)",
      netIonic: "CH3COOH + OH- -> CH3COO- + H2O",
    },
    visual: { kind: "none" },
    notes: ["Runs after strong-acid/base neutralization, so acetic acid only gives up a proton to leftover hydroxide."],
  },
  {
    id: mintReactionRuleId("carbonate_protonation"),
    kind: "proton_transfer",
    priority: 20,
    reactants: [
      { species: SP.H, coef: 1 },
      { species: SP.CO3, coef: 1 },
    ],
    products: [{ species: SP.HCO3, coef: 1 }],
    minExtentMol: MIN_EXTENT_MOL,
    enthalpyKjPerMol: 0,
    equations: {
      molecular: "HCl + Na2CO3 -> NaHCO3 + NaCl",
      ionic: "H+ (aq) + CO3^2- (aq) -> HCO3- (aq)",
      netIonic: "H+ + CO3^2- -> HCO3-",
    },
    visual: { kind: "none" },
    notes: ["First equivalent of acid into a carbonate does not fizz; it only makes bicarbonate."],
  },
  {
    id: mintReactionRuleId("bicarbonate_gas"),
    kind: "gas",
    priority: 30,
    reactants: [
      { species: SP.H, coef: 1 },
      { species: SP.HCO3, coef: 1 },
    ],
    products: [{ species: SP.CO2Gas, coef: 1 }],
    minExtentMol: MIN_EXTENT_MOL,
    enthalpyKjPerMol: 0,
    equations: {
      molecular: "HCl + NaHCO3 -> NaCl + H2O + CO2",
      ionic: "H+ (aq) + HCO3- (aq) -> H2O (l) + CO2 (g)",
      netIonic: "H+ + HCO3- -> H2O + CO2",
    },
    visual: { kind: "bubbles", species: SP.CO2Gas },
    notes: ["Only fires once carbonate has already been protonated to bicarbonate; that is the second equivalent."],
  },
  {
    id: mintReactionRuleId("agcl_ppt"),
    kind: "precipitation",
    priority: 40,
    reactants: [
      { species: SP.Ag, coef: 1 },
      { species: SP.Cl, coef: 1 },
    ],
    products: [{ species: SP.AgClSolid, coef: 1 }],
    minExtentMol: MIN_EXTENT_MOL,
    enthalpyKjPerMol: 0,
    equations: {
      molecular: "AgNO3 + NaCl -> AgCl + NaNO3",
      ionic: "Ag+ (aq) + Cl- (aq) -> AgCl (s)",
      netIonic: "Ag+ + Cl- -> AgCl(s)",
    },
    visual: { kind: "precipitate", species: SP.AgClSolid },
    notes: [],
  },
  {
    id: mintReactionRuleId("caco3_ppt"),
    kind: "precipitation",
    priority: 41,
    reactants: [
      { species: SP.Ca, coef: 1 },
      { species: SP.CO3, coef: 1 },
    ],
    products: [{ species: SP.CaCO3Solid, coef: 1 }],
    minExtentMol: MIN_EXTENT_MOL,
    enthalpyKjPerMol: 0,
    equations: {
      molecular: "CaCl2 + Na2CO3 -> CaCO3 + 2 NaCl",
      ionic: "Ca2+ (aq) + CO3^2- (aq) -> CaCO3 (s)",
      netIonic: "Ca2+ + CO3^2- -> CaCO3(s)",
    },
    visual: { kind: "precipitate", species: SP.CaCO3Solid },
    notes: ["Priority after carbonate_protonation, so acid strips CO3^2- before Ca2+ can claim it."],
  },
  {
    id: mintReactionRuleId("cuoh2_ppt"),
    kind: "precipitation",
    priority: 42,
    reactants: [
      { species: SP.Cu, coef: 1 },
      { species: SP.OH, coef: 2 },
    ],
    products: [{ species: SP.CuOH2Solid, coef: 1 }],
    minExtentMol: MIN_EXTENT_MOL,
    enthalpyKjPerMol: 0,
    equations: {
      molecular: "CuSO4 + 2 NaOH -> Cu(OH)2 + Na2SO4",
      ionic: "Cu2+ (aq) + 2 OH- (aq) -> Cu(OH)2 (s)",
      netIonic: "Cu2+ + 2 OH- -> Cu(OH)2(s)",
    },
    visual: { kind: "precipitate", species: SP.CuOH2Solid },
    notes: [],
  },
  {
    id: mintReactionRuleId("baso4_ppt"),
    kind: "precipitation",
    priority: 43,
    reactants: [
      { species: SP.Ba, coef: 1 },
      { species: SP.SO4, coef: 1 },
    ],
    products: [{ species: SP.BaSO4Solid, coef: 1 }],
    minExtentMol: MIN_EXTENT_MOL,
    enthalpyKjPerMol: 0,
    equations: {
      molecular: "BaCl2 + Na2SO4 -> BaSO4 + 2 NaCl",
      ionic: "Ba2+ (aq) + SO4^2- (aq) -> BaSO4 (s)",
      netIonic: "Ba2+ + SO4^2- -> BaSO4(s)",
    },
    visual: { kind: "precipitate", species: SP.BaSO4Solid },
    notes: [],
  },
];

export const RULES: ReadonlyArray<ReactionRule> = [...RULES_UNSORTED].sort((a, b) => a.priority - b.priority);

const RULES_BY_ID = new Map<ReactionRuleId, ReactionRule>(RULES.map((r) => [r.id, r]));

export function ruleById(id: ReactionRuleId): ReactionRule | undefined {
  return RULES_BY_ID.get(id);
}

/** A product routes to species/solids/gasEffects by its id suffix: "(s)" solid, "(g)" gas, else aqueous. */
function productShape(id: SpeciesId): "aqueous" | "solid" | "gas" {
  if (id.endsWith("(s)")) return "solid";
  if (id.endsWith("(g)")) return "gas";
  return "aqueous";
}

function mergeSolid(solids: ReadonlyArray<SolidDeposit>, species: SpeciesId, moles: number): ReadonlyArray<SolidDeposit> {
  const existing = solids.find((s) => s.species === species);
  if (!existing) return [...solids, { species, moles, suspended: 1 }];
  return solids.map((s) => (s.species === species ? { ...s, moles: s.moles + moles, suspended: 1 } : s));
}

/** Bubbling readout for a gas product: intensity scales with concentration, duration with intensity. */
export function computeGasEffect(molesReleased: number, volumeMl: number): { readonly intensity: number; readonly durationS: number } {
  const liters = volumeMl / 1000;
  const intensity = liters > 0 ? clamp(molesReleased / (liters * GAS_FULL_M), 0, 1) : 0;
  return { intensity, durationS: 2 + 8 * intensity };
}

export function precipitateScale(massG: number): PrecipitateScale {
  if (massG < 0.001) return "trace";
  if (massG < 0.02) return "small";
  if (massG < 0.2) return "moderate";
  return "heavy";
}

export interface FiredReaction {
  readonly rule: ReactionRule;
  readonly extentMol: number;
  readonly limiting: SpeciesId;
  readonly consumed: ReadonlyArray<{ readonly species: SpeciesId; readonly moles: number }>;
  readonly produced: ReadonlyArray<{ readonly species: SpeciesId; readonly moles: number }>;
  readonly deltaTempC: number;
}

export interface ResolveReactionsResult {
  readonly container: Container;
  readonly fired: ReadonlyArray<FiredReaction>;
}

function limitingReactant(species: Container["species"], reactants: ReadonlyArray<Stoich>): { extent: number; limiting: SpeciesId } | null {
  let extent = Infinity;
  let limiting: SpeciesId | null = null;
  for (const r of reactants) {
    const ratio = getMoles(species, r.species) / r.coef;
    if (ratio < extent) {
      extent = ratio;
      limiting = r.species;
    }
  }
  return limiting === null ? null : { extent, limiting };
}

function tryFireRule(container: Container, rule: ReactionRule): { readonly container: Container; readonly fired: FiredReaction } | null {
  const found = limitingReactant(container.species, rule.reactants);
  if (found === null || found.extent < Math.max(rule.minExtentMol, MIN_EXTENT_MOL)) return null;
  const { extent, limiting } = found;

  let species = container.species;
  const consumed = rule.reactants.map((r) => {
    const moles = r.coef * extent;
    species = addMoles(species, r.species, -moles);
    return { species: r.species, moles };
  });

  let solids = container.solids;
  let gasEffects = container.gasEffects;
  const produced = rule.products.map((p) => {
    const moles = p.coef * extent;
    const shape = productShape(p.species);
    if (shape === "aqueous") {
      species = addMoles(species, p.species, moles);
    } else if (shape === "solid") {
      solids = mergeSolid(solids, p.species, moles);
    } else {
      const { intensity, durationS } = computeGasEffect(moles, container.volumeMl);
      const effect: GasEffect = { species: p.species, molesReleased: moles, intensity, remainingS: durationS };
      gasEffects = [...gasEffects, effect];
    }
    return { species: p.species, moles };
  });

  const deltaTempC = clamp(
    (-rule.enthalpyKjPerMol * 1000 * extent) / (container.volumeMl * WATER_J_PER_ML_C),
    -MAX_REACTION_DT_C,
    MAX_REACTION_DT_C,
  );

  const nextContainer: Container = {
    ...container,
    species,
    solids,
    gasEffects,
    temperatureC: container.temperatureC + deltaTempC,
  };
  return { container: nextContainer, fired: { rule, extentMol: extent, limiting, consumed, produced, deltaTempC } };
}

/**
 * Resolves every rule that can fire against a single container's current species, in priority order,
 * for up to 8 passes (a rule's products can feed a later rule, e.g. carbonate -> bicarbonate -> gas).
 */
export function resolveReactions(container: Container): ResolveReactionsResult {
  let current = container;
  const fired: FiredReaction[] = [];
  for (let pass = 0; pass < 8; pass++) {
    let firedThisPass = false;
    for (const rule of RULES) {
      const result = tryFireRule(current, rule);
      if (result) {
        current = result.container;
        fired.push(result.fired);
        firedThisPass = true;
      }
    }
    if (!firedThisPass) break;
  }
  return { container: current, fired };
}

/** Rules whose reactants are all present above MIN_EXTENT_MOL right now, regardless of whether they'd actually fire first. */
export function predictSupportedReactions(container: Container): ReadonlyArray<ReactionRule> {
  return RULES.filter((rule) => rule.reactants.every((r) => getMoles(container.species, r.species) > MIN_EXTENT_MOL));
}

/** Which rules would become supported if this reagent were added, ignoring volume/concentration (presence only). */
export function reactionsIfAdded(container: Container, reagent: ReagentDef): ReadonlyArray<ReactionRule> {
  if (reagent.kind === "water") return [];
  let species = container.species;
  for (const ion of reagent.ions) {
    species = addMoles(species, ion.species, 1);
  }
  return predictSupportedReactions({ ...container, species });
}
