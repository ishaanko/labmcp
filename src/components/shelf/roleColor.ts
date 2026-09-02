import { reagentDef, type IndicatorKind, type ReagentId } from "@/engine";

/**
 * Little Alchemy palette: one saturated hex per reagent role, shared by the dock tile, the drag
 * ghost, and the amount dialog's swatch dot. `--role-*` tokens live in `globals.css`.
 */
export type RoleColor = "acid" | "base" | "salt" | "carbonate" | "water" | "indicator-pink" | "indicator-violet";

export const ROLE_HEX: Readonly<Record<RoleColor, string>> = {
  acid: "var(--role-acid)",
  base: "var(--role-base)",
  salt: "var(--role-salt)",
  carbonate: "var(--role-carbonate)",
  water: "var(--role-water)",
  "indicator-pink": "var(--role-indicator-pink)",
  "indicator-violet": "var(--role-indicator-violet)",
};

/** Role color for a shelf reagent, keyed off the engine's own acid/base/salt/carbonate tag. */
export function reagentRole(id: ReagentId): RoleColor {
  const def = reagentDef(id);
  if (!def || def.kind === "water") return "water";
  return def.role;
}

/** Indicators alternate pink/violet by their color-response curve, so the three read distinctly. */
export function indicatorRole(kind: IndicatorKind): RoleColor {
  return kind === "universal" ? "indicator-violet" : "indicator-pink";
}
