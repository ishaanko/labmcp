"use client";

import { useLabStore } from "@/store/labStore";
import type { EquipmentType } from "@/engine";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { iconFor } from "./icons";
import { Tile } from "./Tile";
import { useShelfDrag } from "./useShelfDrag";

export const EQUIPMENT_LABEL: Record<EquipmentType, string> = {
  beaker: "Beaker",
  flask: "Flask",
  test_tube: "Test tube",
  graduated_cylinder: "Graduated cylinder",
  burette: "Burette",
  ph_meter: "pH meter",
  thermometer: "Thermometer",
  hotplate: "Hotplate",
};

/** Tile text where the full name does not fit the 80px tile; the tooltip carries the full name. */
export const EQUIPMENT_TILE_LABEL: Partial<Record<EquipmentType, string>> = { graduated_cylinder: "Grad. cylinder" };

/** Glassware has no chemistry role: a white glyph on a faint fill with a translucent rim, lighter than the reagent tiles (an opaque grey rim reads as disabled). */
export const EQUIPMENT_COLOR = "#ffffff";
export const EQUIPMENT_FACE = { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.28)" };

export interface EquipmentButtonProps {
  equipmentType: EquipmentType;
}

/** Dock equipment tile. Pointer-down arms the ghost drag; `useShelfDrag` owns the gesture. */
export function EquipmentButton({ equipmentType }: EquipmentButtonProps) {
  const { onEquipmentPointerDown } = useShelfDrag();
  const dragging = useLabStore((s) => s.ui.drag?.kind === "equipment" && s.ui.drag.equipmentType === equipmentType);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Tile
            onPointerDown={onEquipmentPointerDown(equipmentType)}
            aria-label={EQUIPMENT_LABEL[equipmentType]}
            color={EQUIPMENT_COLOR}
            {...EQUIPMENT_FACE}
            label={EQUIPMENT_TILE_LABEL[equipmentType] ?? EQUIPMENT_LABEL[equipmentType]}
            dragging={dragging}
            icon={iconFor("equipment", equipmentType)}
          />
        }
      />
      <TooltipContent>{EQUIPMENT_LABEL[equipmentType]}</TooltipContent>
    </Tooltip>
  );
}
