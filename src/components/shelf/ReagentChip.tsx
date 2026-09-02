"use client";

import { reagentDef, type ReagentId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROLE_HEX, reagentRole, roleFillBackground } from "./roleColor";
import { BottleIcon, CrystalIcon, DropletIcon } from "./TileIcon";
import { Tile } from "./Tile";
import { shortReagentLabel } from "./tileLabel";
import { useShelfDrag } from "./useShelfDrag";

export interface ReagentChipProps {
  reagentId: ReagentId;
  label: string;
}

/** Dock reagent tile: a droplet for water, a crystal pile for a solid, a bottle for everything else, tinted by role. */
export function ReagentChip({ reagentId, label }: ReagentChipProps) {
  const { onReagentPointerDown } = useShelfDrag();
  const dragging = useLabStore((s) => s.ui.drag?.kind === "reagent" && s.ui.drag.reagentId === reagentId);
  const kind = reagentDef(reagentId)?.kind;
  const role = reagentRole(reagentId);
  const color = ROLE_HEX[role];

  const icon = kind === "water" ? <DropletIcon /> : kind === "solid" ? <CrystalIcon /> : <BottleIcon />;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Tile
            onPointerDown={onReagentPointerDown(reagentId)}
            aria-label={label}
            color={color}
            background={roleFillBackground(role)}
            label={shortReagentLabel(reagentId, label)}
            dragging={dragging}
            icon={icon}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
