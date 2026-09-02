"use client";

import { Beaker, FlaskConical, TestTube, Ruler, Pipette, Gauge, Thermometer, Flame, type LucideIcon } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import type { EquipmentType } from "@/engine";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tile } from "./Tile";
import { useShelfDrag } from "./useShelfDrag";

export const EQUIPMENT_ICON: Record<EquipmentType, LucideIcon> = {
  beaker: Beaker,
  flask: FlaskConical,
  test_tube: TestTube,
  graduated_cylinder: Ruler,
  burette: Pipette,
  ph_meter: Gauge,
  thermometer: Thermometer,
  hotplate: Flame,
};

export const EQUIPMENT_LABEL: Record<EquipmentType, string> = {
  beaker: "Beaker",
  flask: "Flask",
  test_tube: "Test tube",
  graduated_cylinder: "Graduated cyl.",
  burette: "Burette",
  ph_meter: "pH meter",
  thermometer: "Thermometer",
  hotplate: "Hotplate",
};

/** Glassware outline color: no chemistry role of its own, so it reads as the neutral glass line. */
export const EQUIPMENT_COLOR = "#e6e6ee";

export interface EquipmentButtonProps {
  equipmentType: EquipmentType;
}

/** Dock equipment tile. Pointer-down arms the ghost drag; `useShelfDrag` owns the gesture. */
export function EquipmentButton({ equipmentType }: EquipmentButtonProps) {
  const { onEquipmentPointerDown } = useShelfDrag();
  const dragging = useLabStore((s) => s.ui.drag?.kind === "equipment" && s.ui.drag.equipmentType === equipmentType);
  const Icon = EQUIPMENT_ICON[equipmentType];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Tile
            onPointerDown={onEquipmentPointerDown(equipmentType)}
            aria-label={EQUIPMENT_LABEL[equipmentType]}
            color={EQUIPMENT_COLOR}
            label={EQUIPMENT_LABEL[equipmentType]}
            dragging={dragging}
            icon={<Icon size={20} strokeWidth={1.75} />}
          />
        }
      />
      <TooltipContent>{EQUIPMENT_LABEL[equipmentType]}</TooltipContent>
    </Tooltip>
  );
}
