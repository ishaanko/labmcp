"use client";

import type { ReagentId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { iconFor } from "./icons";
import { ROLE_HEX, reagentRole } from "./roleColor";
import { Tile } from "./Tile";
import { shortReagentLabel } from "./tileLabel";
import { useShelfDrag } from "./useShelfDrag";

export interface ReagentChipProps {
  reagentId: ReagentId;
  label: string;
}

/** Dock reagent tile: a pictogram matched to the specific reagent, tinted by its role. */
export function ReagentChip({ reagentId, label }: ReagentChipProps) {
  const { onReagentPointerDown } = useShelfDrag();
  const dragging = useLabStore((s) => s.ui.drag?.kind === "reagent" && s.ui.drag.reagentId === reagentId);
  const role = reagentRole(reagentId);
  const color = ROLE_HEX[role];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Tile
            onPointerDown={onReagentPointerDown(reagentId)}
            aria-label={label}
            color={color}
            label={shortReagentLabel(reagentId, label)}
            dragging={dragging}
            icon={iconFor("reagent", reagentId)}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
