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

/** Bottom-center reagent dock: reagent + indicator tiles, a divider, then equipment tiles, in one strip that scrolls sideways when the bench column is narrower than the tiles. */
export function Shelf() {
  const shelf = useLabStore((s) => s.lab.shelf);
  const indicators = useLabStore(selectPublic).indicatorsAvailable;

  return (
    <div data-shelf="" className="pointer-events-auto flex h-30 max-w-full items-center rounded-2xl border border-border bg-card px-3 py-2 shadow-lg">
      <ReagentGhost />
      <ScrollArea className="min-w-0">
        <div className="flex items-center gap-1.5 py-1">
          {shelf.map((stock) => (
            <ReagentChip key={stock.reagentId} reagentId={stock.reagentId} label={stock.label} />
          ))}
          {indicators.map((indicatorId) => (
            <IndicatorChip key={indicatorId} indicatorId={indicatorId} />
          ))}
          <Separator orientation="vertical" className="mx-1.5 h-16 shrink-0" />
          {constants.EQUIPMENT_TYPES.map((type) => (
            <EquipmentButton key={type} equipmentType={type} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
