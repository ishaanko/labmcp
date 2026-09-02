"use client";

import { clsx } from "clsx";
import { useLabStore } from "@/store/labStore";
import { useShelfDrag } from "./useShelfDrag";

/** Tint dot per reagent. Only CuSO4 reads distinctly blue on the shelf; everything else reads as water. */
export const REAGENT_TINT: Readonly<Record<string, string>> = { cuso4: "var(--cu-blue)" };
export const REAGENT_DEFAULT_TINT = "var(--water)";

export interface ReagentChipProps {
  reagentId: string;
  label: string;
}

/** Shelf reagent chip. Pointer-down arms the drag (C4.3); `useShelfDrag` owns the gesture. */
export function ReagentChip({ reagentId, label }: ReagentChipProps) {
  const { onReagentPointerDown } = useShelfDrag();
  const dragging = useLabStore((s) => s.ui.drag?.kind === "reagent" && s.ui.drag.reagentId === reagentId);

  return (
    <button
      type="button"
      onPointerDown={onReagentPointerDown(reagentId)}
      className={clsx(
        "pressable flex h-full shrink-0 items-center gap-1.5 px-2.5 text-xs text-ink-2 hover:bg-surface-thin hover:text-ink",
        dragging && "opacity-40",
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: REAGENT_TINT[reagentId] ?? REAGENT_DEFAULT_TINT }}
        aria-hidden
      />
      {label}
    </button>
  );
}
