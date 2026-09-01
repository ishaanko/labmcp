import type { IndicatorId, ReagentId } from "./ids";
import type { IndicatorDef, ReagentDef, SpeciesMoles } from "./types";
// STUB: replaced by engine-leaf.
export const REAGENTS: ReadonlyArray<ReagentDef> = [];
export const REAGENT_IDS: ReadonlyArray<ReagentId> = [];
export const INDICATORS: ReadonlyArray<IndicatorDef> = [];
export const INDICATOR_IDS: ReadonlyArray<IndicatorId> = [];
export function reagentDef(_id: ReagentId): ReagentDef | undefined { throw new Error("not implemented"); }
export function indicatorDef(_id: IndicatorId): IndicatorDef | undefined { throw new Error("not implemented"); }
export function stockToMoles(_def: ReagentDef, _volumeMl: number, _concentrationM: number): SpeciesMoles { throw new Error("not implemented"); }
export function suggestReagents(_query: string, _available: ReadonlyArray<ReagentId>): ReadonlyArray<ReagentId> { throw new Error("not implemented"); }
