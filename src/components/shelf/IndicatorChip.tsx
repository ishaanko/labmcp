"use client";

import { indicatorDef, type IndicatorId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { iconFor } from "./icons";
import { ROLE_HEX, indicatorRole } from "./roleColor";
import { Tile } from "./Tile";
import { shortIndicatorLabel } from "./tileLabel";
import { useShelfDrag } from "./useShelfDrag";

export interface IndicatorChipProps {
  indicatorId: IndicatorId;
}

/** Dock indicator tile: a pictogram matched to the indicator, tinted by its color-response curve. */
export function IndicatorChip({ indicatorId }: IndicatorChipProps) {
  const { onIndicatorPointerDown } = useShelfDrag();
  const dragging = useLabStore((s) => s.ui.drag?.kind === "indicator" && s.ui.drag.indicatorId === indicatorId);
  const def = indicatorDef(indicatorId);
  const kind = def?.kind ?? "phenolphthalein";
  const label = def?.label ?? indicatorId;
  const color = ROLE_HEX[indicatorRole(kind)];

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
            icon={iconFor("indicator", kind)}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
