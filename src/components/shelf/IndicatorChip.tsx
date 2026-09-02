"use client";

import { indicatorDef, type IndicatorId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROLE_HEX, indicatorRole } from "./roleColor";
import { DropperIcon } from "./TileIcon";
import { Tile } from "./Tile";
import { shortIndicatorLabel } from "./tileLabel";
import { useShelfDrag } from "./useShelfDrag";

export interface IndicatorChipProps {
  indicatorId: IndicatorId;
}

/** Dock indicator tile: a dropper, tinted pink or violet by the indicator's color-response curve. */
export function IndicatorChip({ indicatorId }: IndicatorChipProps) {
  const { onIndicatorPointerDown } = useShelfDrag();
  const dragging = useLabStore((s) => s.ui.drag?.kind === "indicator" && s.ui.drag.indicatorId === indicatorId);
  const def = indicatorDef(indicatorId);
  const label = def?.label ?? indicatorId;
  const color = ROLE_HEX[indicatorRole(def?.kind ?? "phenolphthalein")];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Tile
            onPointerDown={onIndicatorPointerDown(indicatorId)}
            aria-label={label}
            color={color}
            label={shortIndicatorLabel(indicatorId, label)}
            dragging={dragging}
            icon={<DropperIcon />}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
