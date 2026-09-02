"use client";

import { reagentDef, type ReagentId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { ROLE_HEX, reagentRole } from "./roleColor";
import { BottleIcon, DropletIcon } from "./TileIcon";
import { Tile } from "./Tile";
import { useShelfDrag } from "./useShelfDrag";

export interface ReagentChipProps {
  reagentId: ReagentId;
  label: string;
}

/** Dock reagent tile: a droplet for water, a bottle for every stock solution, tinted by role. */
export function ReagentChip({ reagentId, label }: ReagentChipProps) {
  const { onReagentPointerDown } = useShelfDrag();
  const dragging = useLabStore((s) => s.ui.drag?.kind === "reagent" && s.ui.drag.reagentId === reagentId);
  const isWater = reagentDef(reagentId)?.kind === "water";
  const color = ROLE_HEX[reagentRole(reagentId)];

  return (
    <Tile
      onPointerDown={onReagentPointerDown(reagentId)}
      color={color}
      label={label}
      dragging={dragging}
      icon={isWater ? <DropletIcon /> : <BottleIcon />}
    />
  );
}
