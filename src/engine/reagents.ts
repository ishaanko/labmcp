import { mintIndicatorId, mintReagentId, type IndicatorId, type ReagentId } from "./ids";
import { SP } from "./species";
import type { IndicatorDef, ReagentDef, SpeciesMoles } from "./types";

/** Reagent shelf registry: what stock solutions are available and what they dissociate into. */
export const REAGENTS: ReadonlyArray<ReagentDef> = [
  { kind: "water", id: mintReagentId("water"), label: "Water" },
  {
    kind: "solution",
    id: mintReagentId("hcl"),
    label: "Hydrochloric acid",
    formula: "HCl",
    role: "acid",
    ions: [
      { species: SP.H, perFormulaUnit: 1 },
      { species: SP.Cl, perFormulaUnit: 1 },
    ],
    defaultM: 0.1,
    maxM: 2.0,
  },
  {
    kind: "solution",
    id: mintReagentId("naoh"),
    label: "Sodium hydroxide",
    formula: "NaOH",
    role: "base",
    ions: [
      { species: SP.Na, perFormulaUnit: 1 },
      { species: SP.OH, perFormulaUnit: 1 },
    ],
    defaultM: 0.1,
    maxM: 2.0,
  },
  {
    kind: "solution",
    id: mintReagentId("nacl"),
    label: "Sodium chloride",
    formula: "NaCl",
    role: "salt",
    ions: [
      { species: SP.Na, perFormulaUnit: 1 },
      { species: SP.Cl, perFormulaUnit: 1 },
    ],
    defaultM: 0.1,
    maxM: 2.0,
  },
  {
    kind: "solution",
    id: mintReagentId("agno3"),
    label: "Silver nitrate",
    formula: "AgNO3",
    role: "salt",
    ions: [
      { species: SP.Ag, perFormulaUnit: 1 },
      { species: SP.NO3, perFormulaUnit: 1 },
    ],
    defaultM: 0.1,
    maxM: 0.5,
  },
  {
    kind: "solution",
    id: mintReagentId("cacl2"),
    label: "Calcium chloride",
    formula: "CaCl2",
    role: "salt",
    ions: [
      { species: SP.Ca, perFormulaUnit: 1 },
      { species: SP.Cl, perFormulaUnit: 2 },
    ],
    defaultM: 0.1,
    maxM: 1.0,
  },
  {
    kind: "solution",
    id: mintReagentId("na2co3"),
    label: "Sodium carbonate",
    formula: "Na2CO3",
    role: "carbonate",
    ions: [
      { species: SP.Na, perFormulaUnit: 2 },
      { species: SP.CO3, perFormulaUnit: 1 },
    ],
    defaultM: 0.1,
    maxM: 1.0,
  },
  {
    kind: "solution",
    id: mintReagentId("nahco3"),
    label: "Sodium bicarbonate",
    formula: "NaHCO3",
    role: "carbonate",
    ions: [
      { species: SP.Na, perFormulaUnit: 1 },
      { species: SP.HCO3, perFormulaUnit: 1 },
    ],
    defaultM: 0.1,
    maxM: 1.0,
  },
  {
    kind: "solution",
    id: mintReagentId("cuso4"),
    label: "Copper(II) sulfate",
    formula: "CuSO4",
    role: "salt",
    ions: [
      { species: SP.Cu, perFormulaUnit: 1 },
      { species: SP.SO4, perFormulaUnit: 1 },
    ],
    defaultM: 0.1,
    maxM: 0.5,
  },
];

export const REAGENT_IDS: ReadonlyArray<ReagentId> = REAGENTS.map((r) => r.id);

const REAGENTS_BY_ID = new Map<ReagentId, ReagentDef>(REAGENTS.map((r) => [r.id, r]));

export function reagentDef(id: ReagentId): ReagentDef | undefined {
  return REAGENTS_BY_ID.get(id);
}

export const INDICATORS: ReadonlyArray<IndicatorDef> = [
  {
    id: mintIndicatorId("phenolphthalein"),
    kind: "phenolphthalein",
    label: "Phenolphthalein",
    defaultDrops: 2,
    ranges: "colorless below pH 8.2, pink above pH 10",
  },
  {
    id: mintIndicatorId("universal"),
    kind: "universal",
    label: "Universal indicator",
    defaultDrops: 2,
    ranges: "red (acidic) through green (neutral) to purple (basic)",
  },
  {
    id: mintIndicatorId("litmus"),
    kind: "litmus",
    label: "Litmus",
    defaultDrops: 2,
    ranges: "red below pH 7, blue at or above pH 7",
  },
];

export const INDICATOR_IDS: ReadonlyArray<IndicatorId> = INDICATORS.map((i) => i.id);

const INDICATORS_BY_ID = new Map<IndicatorId, IndicatorDef>(INDICATORS.map((i) => [i.id, i]));

export function indicatorDef(id: IndicatorId): IndicatorDef | undefined {
  return INDICATORS_BY_ID.get(id);
}

/** Moles delivered by adding volumeMl of a stock solution at concentration M. Water yields nothing. */
export function stockToMoles(def: ReagentDef, volumeMl: number, concentrationM: number): SpeciesMoles {
  if (def.kind === "water") return {};
  const liters = volumeMl / 1000;
  const out: Record<string, number> = {};
  for (const ion of def.ions) {
    out[ion.species] = concentrationM * liters * ion.perFormulaUnit;
  }
  return out;
}

/** Levenshtein edit distance, used to suggest a reagent when the query doesn't substring-match anything. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) {
    const row0 = d[0];
    if (row0) row0[j] = j;
  }
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const rowPrev = d[i - 1];
      const row = d[i];
      if (!rowPrev || !row) continue;
      const del = (rowPrev[j] ?? 0) + 1;
      const ins = (row[j - 1] ?? 0) + 1;
      const sub = (rowPrev[j - 1] ?? 0) + cost;
      row[j] = Math.min(del, ins, sub);
    }
  }
  return d[rows - 1]?.[cols - 1] ?? Math.max(a.length, b.length);
}

function haystackFor(reagent: ReagentDef): string {
  return reagent.kind === "water"
    ? `${reagent.id} ${reagent.label}`.toLowerCase()
    : `${reagent.id} ${reagent.label} ${reagent.formula}`.toLowerCase();
}

/** Substring match on id/label/formula among the given ids; falls back to the 3 closest by edit distance. */
export function suggestReagents(query: string, available: ReadonlyArray<ReagentId>): ReadonlyArray<ReagentId> {
  const q = query.trim().toLowerCase();
  const pool = available.map((id) => REAGENTS_BY_ID.get(id)).filter((r): r is ReagentDef => r !== undefined);
  if (q.length === 0) return [];
  const substringHits = pool.filter((r) => haystackFor(r).includes(q));
  if (substringHits.length > 0) return substringHits.map((r) => r.id);
  return pool
    .map((r) => ({ id: r.id, dist: editDistance(q, r.id.toLowerCase()) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((r) => r.id);
}

/** Same fuzzy-match rule as suggestReagents, applied to indicator ids/labels. */
export function suggestIndicators(query: string): ReadonlyArray<IndicatorId> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const substringHits = INDICATORS.filter((i) => `${i.id} ${i.label}`.toLowerCase().includes(q));
  if (substringHits.length > 0) return substringHits.map((i) => i.id);
  return INDICATORS.map((i) => ({ id: i.id, dist: editDistance(q, i.id.toLowerCase()) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((i) => i.id);
}
