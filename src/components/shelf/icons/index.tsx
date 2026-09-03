import type { ReactNode } from "react";
import { constants, type EquipmentType, type IndicatorKind } from "@/engine";
import { BottleIcon } from "./reagentIcons";
import { equipmentIcon } from "./equipmentIcons";
import { indicatorIcon } from "./indicatorIcons";
import { reagentIcon } from "./reagentIcons";

export type { IconProps } from "./base";
export { ICON_SIZE } from "./base";

const INDICATOR_KINDS: ReadonlyArray<IndicatorKind> = ["phenolphthalein", "universal", "litmus"];

function isIndicatorKind(id: string): id is IndicatorKind {
  return INDICATOR_KINDS.some((k) => k === id);
}

function isEquipmentType(id: string): id is EquipmentType {
  return constants.EQUIPMENT_TYPES.some((t) => t === id);
}

/**
 * The one place every dock tile (`ReagentChip`, `IndicatorChip`, `EquipmentButton`,
 * `ReagentGhost`) asks for its pictogram. `id` is the reagent slug, the indicator kind, or the
 * equipment type; each domain has its own exhaustive match, with a fallback bottle for anything
 * an id guard can't place (a reagent outside the shelf registry, or a stale drag payload).
 */
export function iconFor(kind: "reagent", id: string, size?: number, className?: string): ReactNode;
export function iconFor(kind: "indicator", id: IndicatorKind, size?: number, className?: string): ReactNode;
export function iconFor(kind: "equipment", id: EquipmentType, size?: number, className?: string): ReactNode;
export function iconFor(
  kind: "reagent" | "indicator" | "equipment",
  id: string,
  size?: number,
  className?: string,
): ReactNode {
  if (kind === "reagent") return reagentIcon(id, size, className);
  if (kind === "indicator") return isIndicatorKind(id) ? indicatorIcon(id, size, className) : <BottleIcon size={size} className={className} />;
  return isEquipmentType(id) ? equipmentIcon(id, size, className) : <BottleIcon size={size} className={className} />;
}
