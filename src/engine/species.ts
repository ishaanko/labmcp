import { EPS_MOL } from "./constants";
import { mintSpeciesId, type SpeciesId } from "./ids";
import type { Container, SpeciesDef, SpeciesMoles } from "./types";

/** Species registry. The one place formulas turn into typed ids and definitions. */
export const SPECIES: ReadonlyArray<SpeciesDef> = [
  { kind: "aqueous", id: mintSpeciesId("H+"), name: "hydrogen ion", charge: 1, molarMass: 1.008, tint: null },
  { kind: "aqueous", id: mintSpeciesId("OH-"), name: "hydroxide ion", charge: -1, molarMass: 17.007, tint: null },
  { kind: "aqueous", id: mintSpeciesId("Na+"), name: "sodium ion", charge: 1, molarMass: 22.99, tint: null },
  { kind: "aqueous", id: mintSpeciesId("Cl-"), name: "chloride ion", charge: -1, molarMass: 35.45, tint: null },
  { kind: "aqueous", id: mintSpeciesId("Ag+"), name: "silver ion", charge: 1, molarMass: 107.87, tint: null },
  { kind: "aqueous", id: mintSpeciesId("NO3-"), name: "nitrate ion", charge: -1, molarMass: 62.0, tint: null },
  { kind: "aqueous", id: mintSpeciesId("Ca2+"), name: "calcium ion", charge: 2, molarMass: 40.08, tint: null },
  { kind: "aqueous", id: mintSpeciesId("CO3^2-"), name: "carbonate ion", charge: -2, molarMass: 60.01, tint: null },
  { kind: "aqueous", id: mintSpeciesId("HCO3-"), name: "bicarbonate ion", charge: -1, molarMass: 61.02, tint: null },
  { kind: "aqueous", id: mintSpeciesId("SO4^2-"), name: "sulfate ion", charge: -2, molarMass: 96.06, tint: null },
  {
    kind: "aqueous",
    id: mintSpeciesId("Cu2+"),
    name: "copper(II) ion",
    charge: 2,
    molarMass: 63.55,
    tint: { rgb: { r: 40, g: 120, b: 220, a: 1 }, refM: 0.1, alphaMax: 0.75 },
  },
  { kind: "aqueous", id: mintSpeciesId("Ba2+"), name: "barium ion", charge: 2, molarMass: 137.33, tint: null },
  { kind: "aqueous", id: mintSpeciesId("K+"), name: "potassium ion", charge: 1, molarMass: 39.1, tint: null },
  { kind: "aqueous", id: mintSpeciesId("CH3COOH"), name: "acetic acid", charge: 0, molarMass: 60.05, tint: null },
  { kind: "aqueous", id: mintSpeciesId("CH3COO-"), name: "acetate ion", charge: -1, molarMass: 59.04, tint: null },
  { kind: "aqueous", id: mintSpeciesId("NH3"), name: "ammonia", charge: 0, molarMass: 17.03, tint: null },
  { kind: "aqueous", id: mintSpeciesId("NH4+"), name: "ammonium ion", charge: 1, molarMass: 18.04, tint: null },
  {
    kind: "solid",
    id: mintSpeciesId("AgCl(s)"),
    name: "silver chloride",
    molarMass: 143.32,
    color: { r: 240, g: 240, b: 235, a: 1 },
  },
  {
    kind: "solid",
    id: mintSpeciesId("CaCO3(s)"),
    name: "calcium carbonate",
    molarMass: 100.09,
    color: { r: 245, g: 245, b: 240, a: 1 },
  },
  {
    kind: "solid",
    id: mintSpeciesId("Cu(OH)2(s)"),
    name: "copper(II) hydroxide",
    molarMass: 97.56,
    color: { r: 80, g: 140, b: 210, a: 1 },
  },
  {
    kind: "solid",
    id: mintSpeciesId("BaSO4(s)"),
    name: "barium sulfate",
    molarMass: 233.39,
    color: { r: 245, g: 245, b: 240, a: 1 },
  },
  {
    kind: "solid",
    id: mintSpeciesId("KNO3(s)"),
    name: "potassium nitrate",
    molarMass: 101.1,
    color: { r: 250, g: 250, b: 248, a: 1 },
  },
  { kind: "gas", id: mintSpeciesId("CO2(g)"), name: "carbon dioxide", molarMass: 44.01 },
];

export const SPECIES_IDS: ReadonlyArray<SpeciesId> = SPECIES.map((s) => s.id);

export const KNOWN_SPECIES: ReadonlySet<string> = new Set(SPECIES_IDS);

export function isKnownSpecies(s: string): s is SpeciesId {
  return KNOWN_SPECIES.has(s);
}

const SPECIES_BY_ID = new Map<SpeciesId, SpeciesDef>(SPECIES.map((s) => [s.id, s]));

/** Looks up a species definition. Throws for unknown ids; this is a closed registry, not user input. */
export function speciesDef(id: SpeciesId): SpeciesDef {
  const def = SPECIES_BY_ID.get(id);
  if (!def) throw new Error(`unknown species: ${id}`);
  return def;
}

export function speciesKeys(m: SpeciesMoles): ReadonlyArray<SpeciesId> {
  return Object.keys(m)
    .filter(isKnownSpecies)
    .sort();
}

export function getMoles(m: SpeciesMoles, species: SpeciesId): number {
  return m[species] ?? 0;
}

/** Adds moles of a species, dropping the key entirely if the result rounds to nothing. */
export function addMoles(m: SpeciesMoles, species: SpeciesId, deltaMol: number): SpeciesMoles {
  const next = (m[species] ?? 0) + deltaMol;
  if (Math.abs(next) < EPS_MOL) {
    const { [species]: _removed, ...rest } = m;
    return rest;
  }
  return { ...m, [species]: next };
}

export function removeMoles(m: SpeciesMoles, species: SpeciesId, deltaMol: number): SpeciesMoles {
  return addMoles(m, species, -deltaMol);
}

/** Sum of charge * moles across dissolved species. Should stay ~0 for any physically valid container. */
export function netCharge(container: Container): number {
  let total = 0;
  for (const id of speciesKeys(container.species)) {
    const def = speciesDef(id);
    if (def.kind !== "aqueous") continue;
    total += def.charge * getMoles(container.species, id);
  }
  return total;
}

/** Typed handles for other engine modules, so reaction rules and pH math never retype formula strings. */
export const SP = {
  H: mintSpeciesId("H+"),
  OH: mintSpeciesId("OH-"),
  Na: mintSpeciesId("Na+"),
  Cl: mintSpeciesId("Cl-"),
  Ag: mintSpeciesId("Ag+"),
  NO3: mintSpeciesId("NO3-"),
  Ca: mintSpeciesId("Ca2+"),
  CO3: mintSpeciesId("CO3^2-"),
  HCO3: mintSpeciesId("HCO3-"),
  SO4: mintSpeciesId("SO4^2-"),
  Cu: mintSpeciesId("Cu2+"),
  Ba: mintSpeciesId("Ba2+"),
  K: mintSpeciesId("K+"),
  AcOH: mintSpeciesId("CH3COOH"),
  AcO: mintSpeciesId("CH3COO-"),
  NH3: mintSpeciesId("NH3"),
  NH4: mintSpeciesId("NH4+"),
  AgClSolid: mintSpeciesId("AgCl(s)"),
  CaCO3Solid: mintSpeciesId("CaCO3(s)"),
  CuOH2Solid: mintSpeciesId("Cu(OH)2(s)"),
  BaSO4Solid: mintSpeciesId("BaSO4(s)"),
  KNO3Solid: mintSpeciesId("KNO3(s)"),
  CO2Gas: mintSpeciesId("CO2(g)"),
} as const satisfies Record<string, SpeciesId>;
