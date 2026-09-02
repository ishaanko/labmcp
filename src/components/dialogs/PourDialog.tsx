"use client";

import { useState, type KeyboardEvent } from "react";
import NumberFlow from "@number-flow/react";
import { isContainerId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { round2 } from "@/lib/format";
import { FAST_FLOW } from "@/lib/numberFlowTiming";
import { useAnchorRect } from "./useAnchorRect";

/**
 * Pour prompt for a `transfer` dialog: vessel-on-vessel drops land here too, since both lanes
 * share `ui.dialog`. Anchored beside the destination container, so it stays in view; slider range is
 * `min(source volume, target free capacity)`.
 */
export function PourDialog() {
  const dialog = useLabStore((s) => (s.ui.dialog?.kind === "transfer" ? s.ui.dialog : null));
  const openDialog = useLabStore((s) => s.openDialog);
  const rect = useAnchorRect(dialog ? dialog.destinationId : null);

  return (
    <Popover open={dialog !== null} onOpenChange={(open) => !open && openDialog(null)}>
      <PopoverContent anchor={rect ? { getBoundingClientRect: () => rect } : null} side="right" align="start" sideOffset={16} className="w-72">
        {dialog ? (
          <PourDialogContent key={`${dialog.sourceId}:${dialog.destinationId}`} sourceId={dialog.sourceId} destinationId={dialog.destinationId} maxMl={dialog.maxMl} />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

interface PourDialogContentProps {
  sourceId: string;
  destinationId: string;
  maxMl: number;
}

function PourDialogContent({ sourceId, destinationId, maxMl }: PourDialogContentProps) {
  const dispatch = useLabStore((s) => s.dispatch);
  const openDialog = useLabStore((s) => s.openDialog);
  const source = useLabStore((s) => s.lab.objects.find((o) => o.id === sourceId));
  const destination = useLabStore((s) => s.lab.objects.find((o) => o.id === destinationId));

  const sourceVolumeMl = source && source.kind === "container" ? source.volumeMl : 0;
  const destVolumeMl = destination && destination.kind === "container" ? destination.volumeMl : 0;
  const destCapacityMl = destination && destination.kind === "container" ? destination.capacityMl : 0;

  const max = Math.max(0.5, maxMl);
  const [value, setValue] = useState(Math.min(max, sourceVolumeMl));

  if (!source || !destination) return null;

  const confirm = (): void => {
    if (isContainerId(sourceId) && isContainerId(destinationId)) {
      void dispatch({ kind: "TRANSFER_LIQUID", fromId: sourceId, toId: destinationId, volumeMl: value }, "human");
    }
    openDialog(null);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    }
  };

  return (
    <div onKeyDown={onKeyDown} className="flex flex-col gap-3">
      <p className="font-medium text-foreground">Pour</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>{round2(sourceVolumeMl)} mL in source</span>
        <span className="text-right">{round2(destCapacityMl - destVolumeMl)} mL free in target</span>
      </div>

      <div className="flex items-center gap-3">
        <Slider value={value} min={0} max={max} step={0.5} onValueChange={setValue} aria-label="Pour amount" />
        <NumberFlow {...FAST_FLOW} value={value} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} suffix=" mL" className="tabular w-20 shrink-0 text-right text-foreground" />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={() => openDialog(null)}>
          Cancel
        </Button>
        <Button size="sm" onClick={confirm}>
          Pour
        </Button>
      </div>
    </div>
  );
}
