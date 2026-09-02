"use client";

import type { PointerEvent } from "react";
import { Beaker, FlaskConical, TestTube, Ruler, Pipette, Gauge, Thermometer, Flame, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { useLabStore } from "@/store/labStore";
import type { EquipmentType } from "@/engine";
import { Tooltip } from "@/components/ui/Tooltip";

const ICON: Record<EquipmentType, LucideIcon> = {
  beaker: Beaker,
  flask: FlaskConical,
  test_tube: TestTube,
  graduated_cylinder: Ruler,
  burette: Pipette,
  ph_meter: Gauge,
  thermometer: Thermometer,
  hotplate: Flame,
};

const LABEL: Record<EquipmentType, string> = {
  beaker: "Beaker",
  flask: "Flask",
  test_tube: "Test tube",
  graduated_cylinder: "Graduated cylinder",
  burette: "Burette",
  ph_meter: "pH meter",
  thermometer: "Thermometer",
  hotplate: "Hotplate",
};

export interface EquipmentButtonProps {
  equipmentType: EquipmentType;
}

/** Shelf equipment icon button. Pointer-down starts the ghost drag (C4.3). */
export function EquipmentButton({ equipmentType }: EquipmentButtonProps) {
  const setDrag = useLabStore((s) => s.setDrag);
  const dragging = useLabStore(
    (s) => s.ui.drag?.kind === "equipment" && s.ui.drag.equipmentType === equipmentType,
  );
  const Icon = ICON[equipmentType];

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>): void => {
    setDrag({ kind: "equipment", equipmentType, pointer: { x: e.clientX, y: e.clientY }, cell: null });
  };

  return (
    <Tooltip label={LABEL[equipmentType]}>
      <button
        type="button"
        onPointerDown={onPointerDown}
        aria-label={LABEL[equipmentType]}
        className={clsx(
          "pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-2 hover:bg-surface-thin hover:text-ink",
          dragging && "opacity-40",
        )}
      >
        <Icon size={17} />
      </button>
    </Tooltip>
  );
}
