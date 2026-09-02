"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Popover as Base } from "@base-ui-components/react/popover";
import NumberFlow from "@number-flow/react";
import { isContainerId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { useProjectedRect } from "@/hooks/useProjectedRect";
import { Slider } from "./Slider";
import { ChipButton } from "./Chip";
import { setTarget } from "@/scene/visualStore";
import { round2 } from "@/lib/format";

/**
 * Pour prompt (C4.4) for a `transfer` dialog: vessel-on-vessel drops from the glassware-drag
 * lane land here too, since both lanes share `ui.dialog`. Anchored to the destination
 * container; slider range is `min(source volume, target free capacity)`.
 */
export function PourPopover() {
  const dialog = useLabStore((s) => (s.ui.dialog?.kind === "transfer" ? s.ui.dialog : null));
  const openDialog = useLabStore((s) => s.openDialog);
  const rect = useProjectedRect(dialog?.destinationId ?? null);

  return (
    <Base.Root open={dialog !== null} onOpenChange={(open) => !open && openDialog(null)}>
      <Base.Portal>
        <Base.Positioner anchor={rect ? { getBoundingClientRect: () => rect } : null} side="top" align="center" sideOffset={12}>
          <Base.Popup className="material-thick origin-[var(--transform-origin)] w-64 p-3 text-sm text-ink transition-[opacity,transform] duration-150 [--ease-out] data-[starting-style]:scale-96 data-[starting-style]:opacity-0 data-[ending-style]:scale-96 data-[ending-style]:opacity-0">
            {dialog ? <PourPopoverContent key={`${dialog.sourceId}:${dialog.destinationId}`} sourceId={dialog.sourceId} destinationId={dialog.destinationId} maxMl={dialog.maxMl} /> : null}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}

interface PourPopoverContentProps {
  sourceId: string;
  destinationId: string;
  maxMl: number;
}

function PourPopoverContent({ sourceId, destinationId, maxMl }: PourPopoverContentProps) {
  const dispatch = useLabStore((s) => s.dispatch);
  const openDialog = useLabStore((s) => s.openDialog);
  const source = useLabStore((s) => s.lab.objects.find((o) => o.id === sourceId));
  const destination = useLabStore((s) => s.lab.objects.find((o) => o.id === destinationId));

  const sourceVolumeMl = source && source.kind === "container" ? source.volumeMl : 0;
  const destVolumeMl = destination && destination.kind === "container" ? destination.volumeMl : 0;
  const destCapacityMl = destination && destination.kind === "container" ? destination.capacityMl : 0;

  const max = Math.max(0.5, maxMl);
  const [value, setValue] = useState(Math.min(max, sourceVolumeMl));

  useEffect(() => {
    return () => {
      setTarget(sourceId, { displayedVolumeMl: sourceVolumeMl });
      setTarget(destinationId, { displayedVolumeMl: destVolumeMl });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!source || !destination) return null;

  const onChange = (next: number): void => {
    setValue(next);
    setTarget(sourceId, { displayedVolumeMl: sourceVolumeMl - next });
    setTarget(destinationId, { displayedVolumeMl: destVolumeMl + next });
  };

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
      <p className="font-medium text-ink">Pour</p>
      <div className="grid grid-cols-2 gap-2 text-2xs text-ink-3">
        <span>{round2(sourceVolumeMl)} mL in source</span>
        <span className="text-right">{round2(destCapacityMl - destVolumeMl)} mL free in target</span>
      </div>

      <div className="flex items-center gap-3">
        <Slider value={value} min={0} max={max} step={0.5} onChange={onChange} aria-label="Pour amount" />
        <NumberFlow value={value} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} suffix=" mL" className="tabular w-20 shrink-0 text-right text-ink" />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <ChipButton size="sm" onClick={() => openDialog(null)}>
          Cancel
        </ChipButton>
        <ChipButton size="sm" tone="accent" onClick={confirm}>
          Pour
        </ChipButton>
      </div>
    </div>
  );
}
