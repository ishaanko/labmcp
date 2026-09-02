"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Popover as Base } from "@base-ui-components/react/popover";
import NumberFlow from "@number-flow/react";
import { indicatorDef, isContainerId, isIndicatorIdShape, isReagentId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import type { PendingDialog } from "@/store/types";
import { useProjectedRect } from "@/hooks/useProjectedRect";
import { Slider } from "./Slider";
import { ChipButton } from "./Chip";
import { setTarget } from "@/scene/visualStore";
import { round2 } from "@/lib/format";
import { REAGENT_DEFAULT_TINT, REAGENT_TINT } from "@/components/shelf/ReagentChip";

const REAGENT_PRESETS_ML = [1, 5, 10, 25, 50];
const INDICATOR_PRESETS_DROPS = [1, 2, 3];

interface AmountTarget {
  readonly kind: "add_reagent" | "add_indicator";
  readonly containerId: string;
  readonly speciesId: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly initial: number;
  readonly unit: string;
  readonly presets: ReadonlyArray<number>;
  readonly name: string;
  readonly swatch: string;
  readonly stockLine: string | null;
}

function buildTarget(): AmountTarget | null {
  const state = useLabStore.getState();
  const dialog = state.ui.dialog;
  if (!dialog) return null;

  if (dialog.kind === "add_reagent") {
    const stock = state.lab.shelf.find((s) => s.reagentId === dialog.reagentId);
    return {
      kind: "add_reagent",
      containerId: dialog.containerId,
      speciesId: dialog.reagentId,
      min: 0,
      max: Math.max(0.5, dialog.maxMl),
      step: 0.5,
      initial: Math.min(dialog.defaultMl, dialog.maxMl),
      unit: "mL",
      presets: REAGENT_PRESETS_ML.filter((v) => v <= dialog.maxMl),
      name: stock?.label ?? dialog.reagentId,
      swatch: REAGENT_TINT[dialog.reagentId] ?? REAGENT_DEFAULT_TINT,
      stockLine: stock ? (stock.concentrationM !== null ? `${stock.concentrationM} M stock` : "Concentration hidden") : null,
    };
  }

  if (dialog.kind !== "add_indicator") return null;
  const def = isIndicatorIdShape(dialog.indicatorId) ? indicatorDef(dialog.indicatorId) : undefined;
  return {
    kind: "add_indicator",
    containerId: dialog.containerId,
    speciesId: dialog.indicatorId,
    min: 0,
    max: 3,
    step: 1,
    initial: def?.defaultDrops ?? 2,
    unit: "drops",
    presets: INDICATOR_PRESETS_DROPS,
    name: def?.label ?? dialog.indicatorId,
    swatch: "var(--phenol-pink)",
    stockLine: def?.ranges ?? null,
  };
}

/**
 * Amount/drops prompt (C4.4), opened by `useShelfDrag` on a landed reagent or indicator drop.
 * Anchored to the target container's projected screen rect via a base-ui virtual element; the
 * slider previews the resulting volume on the vessel itself through `visualStore.setTarget`,
 * restored on cancel since only a confirmed `ADD_REAGENT`/`ADD_INDICATOR` should stick.
 */
type AmountDialog = Extract<PendingDialog, { kind: "add_reagent" | "add_indicator" }>;

function selectAmountDialog(dialog: PendingDialog | null): AmountDialog | null {
  return dialog !== null && (dialog.kind === "add_reagent" || dialog.kind === "add_indicator") ? dialog : null;
}

export function AmountPopover() {
  const dialog = useLabStore((s) => selectAmountDialog(s.ui.dialog));
  const openDialog = useLabStore((s) => s.openDialog);
  const rect = useProjectedRect(dialog?.containerId ?? null);

  const close = (): void => openDialog(null);

  return (
    <Base.Root open={dialog !== null} onOpenChange={(open) => !open && close()}>
      <Base.Portal>
        <Base.Positioner
          anchor={rect ? { getBoundingClientRect: () => rect } : null}
          side="top"
          align="center"
          sideOffset={12}
        >
          <Base.Popup
            className="material-thick origin-[var(--transform-origin)] w-64 p-3 text-sm text-ink transition-[opacity,transform] duration-150 [--ease-out] data-[starting-style]:scale-96 data-[starting-style]:opacity-0 data-[ending-style]:scale-96 data-[ending-style]:opacity-0"
          >
            {dialog ? <AmountPopoverContent key={`${dialog.containerId}:${dialog.kind === "add_reagent" ? dialog.reagentId : dialog.indicatorId}`} /> : null}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}

function AmountPopoverContent() {
  const dispatch = useLabStore((s) => s.dispatch);
  const openDialog = useLabStore((s) => s.openDialog);
  const target = buildTarget();
  const container = useLabStore((s) => (target ? s.lab.objects.find((o) => o.id === target.containerId) : undefined));
  const [value, setValue] = useState(target?.initial ?? 0);

  const baseVolumeMl = container && container.kind === "container" ? container.volumeMl : 0;
  const capacityMl = container && container.kind === "container" ? container.capacityMl : 0;

  useEffect(() => {
    if (!target || target.kind !== "add_reagent") return undefined;
    return () => setTarget(target.containerId, { displayedVolumeMl: baseVolumeMl });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!target || !container) return null;

  const onChange = (next: number): void => {
    setValue(next);
    if (target.kind === "add_reagent") setTarget(target.containerId, { displayedVolumeMl: baseVolumeMl + next });
  };

  const confirm = (): void => {
    if (!isContainerId(target.containerId)) {
      openDialog(null);
      return;
    }
    if (target.kind === "add_reagent" && isReagentId(target.speciesId)) {
      void dispatch({ kind: "ADD_REAGENT", containerId: target.containerId, reagentId: target.speciesId, volumeMl: value }, "human");
    } else if (target.kind === "add_indicator" && isIndicatorIdShape(target.speciesId)) {
      void dispatch({ kind: "ADD_INDICATOR", containerId: target.containerId, indicator: target.speciesId, drops: value }, "human");
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
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: target.swatch }} aria-hidden />
        <span className="font-medium text-ink">{target.name}</span>
      </div>
      {target.stockLine ? <p className="text-2xs text-ink-3">{target.stockLine}</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {target.presets.map((preset) => (
          <ChipButton key={preset} size="sm" active={value === preset} onClick={() => onChange(preset)}>
            {preset} {target.unit === "mL" ? "mL" : "drop" + (preset === 1 ? "" : "s")}
          </ChipButton>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Slider
          value={value}
          min={target.min}
          max={target.max}
          step={target.step}
          onChange={onChange}
          aria-label={`${target.name} amount`}
        />
        <NumberFlow
          value={value}
          format={{ minimumFractionDigits: target.step < 1 ? 1 : 0, maximumFractionDigits: target.step < 1 ? 1 : 0 }}
          suffix={` ${target.unit}`}
          className="tabular w-20 shrink-0 text-right text-ink"
        />
      </div>

      {target.kind === "add_reagent" ? (
        <p className="text-2xs text-ink-3">{round2(capacityMl - baseVolumeMl)} mL free of {capacityMl} mL capacity</p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <ChipButton size="sm" onClick={() => openDialog(null)}>
          Cancel
        </ChipButton>
        <ChipButton size="sm" tone="accent" onClick={confirm}>
          Add
        </ChipButton>
      </div>
    </div>
  );
}
