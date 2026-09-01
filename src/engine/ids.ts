/**
 * Branded identifiers. Brands are only ever produced by the guards below, so a
 * ContainerId in hand is always a well-formed "c_<n>" string.
 */

declare const brandSym: unique symbol;
type Brand<T, Name extends string> = T & { readonly [brandSym]: Name };

export type ContainerId = Brand<string, "ContainerId">;
export type InstrumentId = Brand<string, "InstrumentId">;
export type SpeciesId = Brand<string, "SpeciesId">;
export type ReagentId = Brand<string, "ReagentId">;
export type IndicatorId = Brand<string, "IndicatorId">;
export type ReactionRuleId = Brand<string, "ReactionRuleId">;
export type ObjectId = ContainerId | InstrumentId;

export function isContainerId(s: string): s is ContainerId {
  return /^c_\d+$/.test(s);
}

export function isInstrumentId(s: string): s is InstrumentId {
  return /^i_\d+$/.test(s);
}

export function isObjectId(s: string): s is ObjectId {
  return isContainerId(s) || isInstrumentId(s);
}

/** Reagent ids are lowercase slugs; whether one exists is checked against the shelf. */
export function isReagentId(s: string): s is ReagentId {
  return /^[a-z0-9_]+$/.test(s);
}

/** Species ids are formula text such as "Ag+" or "AgCl(s)". Existence is checked by species.ts. */
export function isSpeciesIdShape(s: string): s is SpeciesId {
  return /^[A-Za-z0-9()+\-^]+$/.test(s);
}

export function isIndicatorIdShape(s: string): s is IndicatorId {
  return /^[a-z_]+$/.test(s);
}

export function isReactionRuleId(s: string): s is ReactionRuleId {
  return /^[a-z0-9_]+$/.test(s);
}

function mintOrThrow<T extends string>(s: string, guard: (x: string) => x is T): T {
  if (guard(s)) return s;
  throw new Error(`unreachable: minted id "${s}" failed its own guard`);
}

export const mintContainerId = (seq: number): ContainerId => mintOrThrow(`c_${seq}`, isContainerId);
export const mintInstrumentId = (seq: number): InstrumentId => mintOrThrow(`i_${seq}`, isInstrumentId);
export const mintSpeciesId = (formula: string): SpeciesId => mintOrThrow(formula, isSpeciesIdShape);
export const mintReagentId = (slug: string): ReagentId => mintOrThrow(slug, isReagentId);
export const mintIndicatorId = (slug: string): IndicatorId => mintOrThrow(slug, isIndicatorIdShape);
export const mintReactionRuleId = (slug: string): ReactionRuleId => mintOrThrow(slug, isReactionRuleId);

/** Boundary parsers for strings arriving from tools or the UI. */
export const parseContainerId = (raw: string): ContainerId | undefined => (isContainerId(raw) ? raw : undefined);
export const parseInstrumentId = (raw: string): InstrumentId | undefined => (isInstrumentId(raw) ? raw : undefined);
export const parseObjectId = (raw: string): ObjectId | undefined => (isObjectId(raw) ? raw : undefined);
