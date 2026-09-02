"use client";

import type { PointerEvent } from "react";
import { useLabStore } from "@/store/labStore";
import { selectPublic } from "@/store/selectors";
import { EQUIPMENT_TYPES } from "@/webmcp/schemas";
import { ReagentChip } from "./ReagentChip";
import { EquipmentButton } from "./EquipmentButton";

/** Bottom-center dock: reagent + indicator chips, a divider, then equipment buttons (C2). */
export function Shelf() {
  const shelf = useLabStore((s) => s.lab.shelf);
  const indicators = useLabStore(selectPublic).indicatorsAvailable;
  const setDrag = useLabStore((s) => s.setDrag);

  const onIndicatorPointerDown = (indicatorId: string) => (e: PointerEvent<HTMLButtonElement>) => {
    setDrag({ kind: "indicator", indicatorId, pointer: { x: e.clientX, y: e.clientY }, overId: null });
  };

  return (
    <div className="material-thin pointer-events-auto flex h-14 max-w-[860px] items-center gap-3 overflow-x-auto px-3 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]">
      <div className="flex items-center gap-1.5">
        {shelf.map((stock) => (
          <ReagentChip key={stock.reagentId} reagentId={stock.reagentId} label={stock.label} />
        ))}
        {indicators.map((indicatorId) => (
          <button
            key={indicatorId}
            type="button"
            onPointerDown={onIndicatorPointerDown(indicatorId)}
            className="pressable flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface-thin px-2.5 text-xs text-ink-2 hover:bg-surface-thick"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-phenol-pink" aria-hidden />
            {indicatorId}
          </button>
        ))}
      </div>
      <div className="h-7 w-px shrink-0 bg-hairline-strong" aria-hidden />
      <div className="flex items-center gap-0.5">
        {EQUIPMENT_TYPES.map((type) => (
          <EquipmentButton key={type} equipmentType={type} />
        ))}
      </div>
    </div>
  );
}
