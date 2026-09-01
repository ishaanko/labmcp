import type { SpeciesId } from "./ids";
import type { Container, SpeciesDef, SpeciesMoles } from "./types";
// STUB: replaced by engine-leaf.
export const SPECIES: ReadonlyArray<SpeciesDef> = [];
export const SPECIES_IDS: ReadonlyArray<SpeciesId> = [];
export function speciesDef(_id: SpeciesId): SpeciesDef { throw new Error("not implemented"); }
export function speciesKeys(_m: SpeciesMoles): ReadonlyArray<SpeciesId> { throw new Error("not implemented"); }
export function netCharge(_c: Container): number { throw new Error("not implemented"); }
