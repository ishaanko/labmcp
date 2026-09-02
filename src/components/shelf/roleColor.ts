import { reagentDef, type IndicatorKind, type ReagentId } from "@/engine";

/**
 * Little Alchemy palette: one saturated hex per reagent role, shared by the dock tile, the drag
 * ghost, and the amount dialog's swatch dot. `--role-*` tokens live in `globals.css`.
 */
export type RoleColor = "acid" | "base" | "salt" | "carbonate" | "water" | "indicator-pink" | "indicator-violet" | "weak_acid" | "weak_base";

export const ROLE_HEX: Readonly<Record<RoleColor, string>> = {
  acid: "var(--role-acid)",
  base: "var(--role-base)",
  salt: "var(--role-salt)",
  carbonate: "var(--role-carbonate)",
  water: "var(--role-water)",
  "indicator-pink": "var(--role-indicator-pink)",
  "indicator-violet": "var(--role-indicator-violet)",
  /** Weak acid/base share the strong acid/base hue; the 70% fill below is what tells them apart. */
  weak_acid: "var(--role-acid)",
  weak_base: "var(--role-base)",
};

/** Tile fill alpha for roles that need something other than `Tile`'s 22% default. */
export const ROLE_FILL_ALPHA: Partial<Record<RoleColor, number>> = {
  weak_acid: 0.7,
  weak_base: 0.7,
};

/** Role color for a shelf reagent, keyed off the engine's own acid/base/salt/carbonate tag. */
export function reagentRole(id: ReagentId): RoleColor {
  const def = reagentDef(id);
  if (!def || def.kind === "water") return "water";
  return def.role;
}

/** A role's dock-tile fill, or `undefined` to let `Tile` use its own 22% default. */
export function roleFillBackground(role: RoleColor): string | undefined {
  const alpha = ROLE_FILL_ALPHA[role];
  return alpha === undefined ? undefined : `color-mix(in oklch, ${ROLE_HEX[role]} ${alpha * 100}%, transparent)`;
}

/** Indicators alternate pink/violet by their color-response curve, so the three read distinctly. */
export function indicatorRole(kind: IndicatorKind): RoleColor {
  return kind === "universal" ? "indicator-violet" : "indicator-pink";
}
