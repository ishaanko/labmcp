"use client";

import { constants } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectPublic } from "@/store/selectors";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ReagentChip } from "./ReagentChip";
import { IndicatorChip } from "./IndicatorChip";
import { EquipmentButton } from "./EquipmentButton";
import { ReagentGhost } from "./ReagentGhost";

/** Bottom-center reagent dock: reagent + indicator tiles, a divider, then equipment tiles. */
export function Shelf() {
  const shelf = useLabStore((s) => s.lab.shelf);
  const indicators = useLabStore(selectPublic).indicatorsAvailable;

  return (
    <div className="pointer-events-auto flex h-24 max-w-[min(980px,calc(100vw-360px))] items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2 shadow-lg">
      <ReagentGhost />
      <ScrollArea className="min-w-0">
        <div className="flex items-center gap-1.5 py-1">
          {shelf.map((stock) => (
            <ReagentChip key={stock.reagentId} reagentId={stock.reagentId} label={stock.label} />
          ))}
          {indicators.map((indicatorId) => (
            <IndicatorChip key={indicatorId} indicatorId={indicatorId} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <Separator orientation="vertical" className="h-14 shrink-0" />
      <div className="flex shrink-0 items-center gap-1.5">
        {constants.EQUIPMENT_TYPES.map((type) => (
          <EquipmentButton key={type} equipmentType={type} />
        ))}
      </div>
    </div>
  );
}
