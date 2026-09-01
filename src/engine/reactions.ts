import type { ReactionRuleId } from "./ids";
import type { Container, ReactionRule } from "./types";
// STUB: replaced by engine-reactions.
export const RULES: ReadonlyArray<ReactionRule> = [];
export function ruleById(_id: ReactionRuleId): ReactionRule | undefined { throw new Error("not implemented"); }
export function predictSupportedReactions(_c: Container): ReadonlyArray<ReactionRule> { throw new Error("not implemented"); }
