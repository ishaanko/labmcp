import { isReagentId, reagentDef } from "@/engine";

/**
 * Short dock-tile text. A tile is 80px wide, so the shelf's full names ("Sodium hydroxide",
 * "Phenolphthalein") truncate to the same first word; the formula or a clipped name fits and
 * still tells the tiles apart. The full name lives in the tile's tooltip and aria-label.
 */
export function shortReagentLabel(reagentId: string, label: string): string {
  const def = isReagentId(reagentId) ? reagentDef(reagentId) : undefined;
  if (def?.kind === "solution") return def.formula;
  if (def?.kind === "water") return "Water";
  return label.replace(/^Unknown acid$/, "Unknown");
}

const INDICATOR_SHORT: Readonly<Record<string, string>> = { phenolphthalein: "Phenolph.", universal: "Universal", litmus: "Litmus" };

export function shortIndicatorLabel(indicatorId: string, label: string): string {
  return INDICATOR_SHORT[indicatorId] ?? label;
}
