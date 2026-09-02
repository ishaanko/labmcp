"use client";

import { constants } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectPublic } from "@/store/selectors";
import { ReagentChip } from "./ReagentChip";
import { EquipmentButton } from "./EquipmentButton";
import { ReagentGhost } from "./ReagentGhost";
import { useShelfDrag } from "./useShelfDrag";

/** Bottom-center dock: reagent + indicator chips, a divider, then equipment buttons (C2). */
export function Shelf() {
  const shelf = useLabStore((s) => s.lab.shelf);
  const indicators = useLabStore(selectPublic).indicatorsAvailable;
  const { onIndicatorPointerDown } = useShelfDrag();

  return (
    <div className="material-thin pointer-events-auto flex h-12 max-w-[980px] items-stretch px-1">
      <ReagentGhost />
      {/* Only the reagent strip scrolls (the sandbox shelf is wider than the dock); equipment stays put. */}
      <div className="flex items-stretch divide-x divide-hairline overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]">
        {shelf.map((stock) => (
          <ReagentChip key={stock.reagentId} reagentId={stock.reagentId} label={stock.label} />
        ))}
        {indicators.map((indicatorId) => (
          <button
            key={indicatorId}
            type="button"
            onPointerDown={onIndicatorPointerDown(indicatorId)}
            className="pressable flex h-full shrink-0 items-center gap-1.5 px-2.5 text-xs text-ink-2 hover:bg-surface-thin hover:text-ink"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-phenol-pink" aria-hidden />
            {indicatorId}
          </button>
        ))}
      </div>
      <div className="my-2 w-px shrink-0 bg-hairline-strong" aria-hidden />
      <div className="flex items-center gap-0.5 px-1">
        {constants.EQUIPMENT_TYPES.map((type) => (
          <EquipmentButton key={type} equipmentType={type} />
        ))}
      </div>
    </div>
  );
}
