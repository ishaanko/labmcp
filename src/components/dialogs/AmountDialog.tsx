"use client";

import { useState, type KeyboardEvent } from "react";
import NumberFlow from "@number-flow/react";
import { indicatorDef, isContainerId, isIndicatorIdShape, isReagentId, reagentDef } from "@/engine";
import { useLabStore } from "@/store/labStore";
import type { PendingDialog } from "@/store/types";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { ROLE_HEX, indicatorRole, reagentRole } from "@/components/shelf/roleColor";
import { round2 } from "@/lib/format";
import { FAST_FLOW } from "@/lib/numberFlowTiming";
import { useAnchorRect } from "./useAnchorRect";

const REAGENT_PRESETS_ML = [1, 5, 10, 25, 50];
const INDICATOR_PRESETS_DROPS = [1, 2, 3];
const SOLID_PRESETS_G = [1, 2, 5, 10, 20];
const SOLID_MIN_G = 0.5;
const SOLID_MAX_G = 50;
const SOLID_STEP_G = 0.5;
const SOLID_DEFAULT_G = 1;

type AmountPendingDialog = Extract<PendingDialog, { kind: "add_reagent" | "add_indicator" }>;

function selectAmountDialog(dialog: PendingDialog | null): AmountPendingDialog | null {
  return dialog !== null && (dialog.kind === "add_reagent" || dialog.kind === "add_indicator") ? dialog : null;
}

interface AmountTarget {
  /** "mass" dispatches `massG` with `volumeMl: 0`; "volume" and "drops" dispatch as before. */
  readonly mode: "volume" | "mass" | "drops";
  readonly containerId: string;
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

function buildSolidTarget(dialog: Extract<AmountPendingDialog, { kind: "add_reagent" }>, formula: string): AmountTarget {
  const stock = useLabStore.getState().lab.shelf.find((s) => s.reagentId === dialog.reagentId);
  return {
    mode: "mass",
    containerId: dialog.containerId,
    min: SOLID_MIN_G,
    max: SOLID_MAX_G,
    step: SOLID_STEP_G,
    initial: SOLID_DEFAULT_G,
    unit: "g",
    presets: SOLID_PRESETS_G,
    name: stock?.label ?? dialog.reagentId,
    swatch: isReagentId(dialog.reagentId) ? ROLE_HEX[reagentRole(dialog.reagentId)] : ROLE_HEX.water,
    stockLine: `${formula}, dry`,
  };
}

function buildTarget(dialog: AmountPendingDialog): AmountTarget {
  const state = useLabStore.getState();

  if (dialog.kind === "add_reagent") {
    const known = isReagentId(dialog.reagentId) ? reagentDef(dialog.reagentId) : undefined;
    if (known?.kind === "solid") return buildSolidTarget(dialog, known.formula);

    const stock = state.lab.shelf.find((s) => s.reagentId === dialog.reagentId);
    // Only a challenge's hidden stock ("unknown_acid") hides its concentration; water has none.
    const stockLine = !stock ? null : stock.concentrationM !== null ? `${stock.concentrationM} M stock` : known ? null : "Concentration hidden";
    return {
      mode: "volume",
      containerId: dialog.containerId,
      min: 0,
      max: Math.max(0.5, dialog.maxMl),
      step: 0.5,
      initial: Math.min(dialog.defaultMl, dialog.maxMl),
      unit: "mL",
      presets: REAGENT_PRESETS_ML.filter((v) => v <= dialog.maxMl),
      name: stock?.label ?? dialog.reagentId,
      swatch: isReagentId(dialog.reagentId) ? ROLE_HEX[reagentRole(dialog.reagentId)] : ROLE_HEX.water,
      stockLine,
    };
  }

  const def = isIndicatorIdShape(dialog.indicatorId) ? indicatorDef(dialog.indicatorId) : undefined;
  return {
    mode: "drops",
    containerId: dialog.containerId,
    min: 0,
    max: 3,
    step: 1,
    initial: def?.defaultDrops ?? 2,
    unit: "drops",
    presets: INDICATOR_PRESETS_DROPS,
    name: def?.label ?? dialog.indicatorId,
    swatch: ROLE_HEX[indicatorRole(def?.kind ?? "phenolphthalein")],
    stockLine: def?.ranges ?? null,
  };
}

/**
 * Amount/drops prompt, opened by `useShelfDrag` on a landed reagent or indicator drop.
 * Anchored beside the target container's projected screen rect via `useAnchorRect`, so the vessel
 * being dosed stays in view. Enter confirms.
 */
export function AmountDialog() {
  const dialog = useLabStore((s) => selectAmountDialog(s.ui.dialog));
  const openDialog = useLabStore((s) => s.openDialog);
  const rect = useAnchorRect(dialog ? dialog.containerId : null);

  const close = (): void => openDialog(null);
  const key = dialog ? `${dialog.containerId}:${dialog.kind === "add_reagent" ? dialog.reagentId : dialog.indicatorId}` : "none";

  return (
    <Popover open={dialog !== null} onOpenChange={(open) => !open && close()}>
      <PopoverContent anchor={rect ? { getBoundingClientRect: () => rect } : null} side="right" align="start" sideOffset={16} className="w-72">
        {dialog ? <AmountDialogContent key={key} dialog={dialog} /> : null}
      </PopoverContent>
    </Popover>
  );
}

function AmountDialogContent({ dialog }: { dialog: AmountPendingDialog }) {
  const dispatch = useLabStore((s) => s.dispatch);
  const openDialog = useLabStore((s) => s.openDialog);
  const target = buildTarget(dialog);
  const container = useLabStore((s) => (target ? s.lab.objects.find((o) => o.id === target.containerId) : undefined));
  const [value, setValue] = useState(target?.initial ?? 0);

  if (!container) return null;
  const capacityMl = container.kind === "container" ? container.capacityMl : 0;
  const baseVolumeMl = container.kind === "container" ? container.volumeMl : 0;

  const confirm = (): void => {
    if (!isContainerId(target.containerId)) {
      openDialog(null);
      return;
    }
    if (target.mode === "mass" && dialog.kind === "add_reagent" && isReagentId(dialog.reagentId)) {
      void dispatch({ kind: "ADD_REAGENT", containerId: target.containerId, reagentId: dialog.reagentId, volumeMl: 0, massG: value }, "human");
    } else if (target.mode === "volume" && dialog.kind === "add_reagent" && isReagentId(dialog.reagentId)) {
      void dispatch({ kind: "ADD_REAGENT", containerId: target.containerId, reagentId: dialog.reagentId, volumeMl: value }, "human");
    } else if (target.mode === "drops" && dialog.kind === "add_indicator" && isIndicatorIdShape(dialog.indicatorId)) {
      void dispatch({ kind: "ADD_INDICATOR", containerId: target.containerId, indicator: dialog.indicatorId, drops: value }, "human");
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
        <span className="font-medium text-foreground">{target.name}</span>
      </div>
      {target.stockLine ? <p className="text-xs text-muted-foreground">{target.stockLine}</p> : null}

      <ToggleGroup
        value={[String(value)]}
        onValueChange={(values) => {
          const picked = values[0];
          if (picked !== undefined) setValue(Number(picked));
        }}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={`${target.name} presets`}
      >
        {target.presets.map((preset) => (
          <ToggleGroupItem key={preset} value={String(preset)} className="tabular-nums">
            {preset} {target.unit === "drops" ? "drop" + (preset === 1 ? "" : "s") : target.unit}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex items-center gap-3">
        <Slider value={value} min={target.min} max={target.max} step={target.step} onValueChange={setValue} aria-label={`${target.name} amount`} />
        <NumberFlow
          {...FAST_FLOW}
          value={value}
          format={{ minimumFractionDigits: target.step < 1 ? 1 : 0, maximumFractionDigits: target.step < 1 ? 1 : 0 }}
          suffix={` ${target.unit}`}
          className="tabular w-20 shrink-0 text-right text-foreground"
        />
      </div>

      {target.mode === "volume" ? (
        <p className="text-xs text-muted-foreground">
          {round2(capacityMl - baseVolumeMl)} mL free of {capacityMl} mL capacity
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={() => openDialog(null)}>
          Cancel
        </Button>
        <Button size="sm" onClick={confirm}>
          Add
        </Button>
      </div>
    </div>
  );
}
