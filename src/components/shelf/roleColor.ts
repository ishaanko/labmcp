import { reagentDef, type IndicatorKind, type ReagentId } from "@/engine";

/**
 * Little Alchemy palette: one saturated hex per reagent role, shared by the dock tile, the drag
 * ghost, and the amount dialog's swatch dot. The acid/base/salt/carbonate/water/indicator-pink/
 * indicator-violet hues live as `--role-*` tokens in `globals.css`; the roles added for icon work
 * (weak acid/base, solid, CuSO4, litmus, unknown) are named directly here since nothing else
 * outside the dock reaches for them.
 */
export type RoleColor =
  | "acid"
  | "weak_acid"
  | "base"
  | "weak_base"
  | "salt"
  | "carbonate"
  | "solid"
  | "water"
  | "cuso4"
  | "unknown"
  | "indicator-pink"
  | "indicator-violet"
  | "indicator-litmus";

export const ROLE_HEX: Readonly<Record<RoleColor, string>> = {
  acid: "var(--role-acid)",
  weak_acid: "#ff9f6b",
  base: "var(--role-base)",
  weak_base: "#7fdcff",
  salt: "var(--role-salt)",
  carbonate: "var(--role-carbonate)",
  solid: "#e9d8a6",
  water: "var(--role-water)",
  cuso4: "var(--cu-blue)",
  unknown: "#c9c9d1",
  "indicator-pink": "var(--role-indicator-pink)",
  "indicator-violet": "var(--role-indicator-violet)",
  "indicator-litmus": "#ff8fa3",
};

/**
 * Role color for a shelf reagent. Starts from the engine's own acid/base/salt/carbonate tag, then
 * peels off the three display-only distinctions the engine doesn't track: a solid dosed by mass
 * gets the "solid" hue over its salt/carbonate role, CuSO4 gets its own blue so the crystal-blue
 * pictogram reads correctly, and a mystery sample (not in the shelf registry) gets "unknown".
 */
export function reagentRole(id: ReagentId): RoleColor {
  if (id.startsWith("unknown_")) return "unknown";
  const def = reagentDef(id);
  if (!def || def.kind === "water") return "water";
  if (id === "cuso4") return "cuso4";
  if (def.kind === "solid") return "solid";
  return def.role;
}

/** Indicators get their own hue per color-response curve, so the three read distinctly. */
export function indicatorRole(kind: IndicatorKind): RoleColor {
  if (kind === "universal") return "indicator-violet";
  if (kind === "litmus") return "indicator-litmus";
  return "indicator-pink";
}
