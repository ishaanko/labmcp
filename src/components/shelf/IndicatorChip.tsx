"use client";

import { indicatorDef, type IndicatorId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { ROLE_HEX, indicatorRole } from "./roleColor";
import { DropperIcon } from "./TileIcon";
import { Tile } from "./Tile";
import { useShelfDrag } from "./useShelfDrag";

export interface IndicatorChipProps {
  indicatorId: IndicatorId;
}

/** Dock indicator tile: a dropper, tinted pink or violet by the indicator's color-response curve. */
export function IndicatorChip({ indicatorId }: IndicatorChipProps) {
  const { onIndicatorPointerDown } = useShelfDrag();
  const dragging = useLabStore((s) => s.ui.drag?.kind === "indicator" && s.ui.drag.indicatorId === indicatorId);
  const def = indicatorDef(indicatorId);
  const color = ROLE_HEX[indicatorRole(def?.kind ?? "phenolphthalein")];

  return (
    <Tile
      onPointerDown={onIndicatorPointerDown(indicatorId)}
      color={color}
      label={def?.label ?? indicatorId}
      dragging={dragging}
      icon={<DropperIcon />}
    />
  );
}
