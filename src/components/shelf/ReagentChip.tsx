"use client";

import type { PointerEvent } from "react";
import { clsx } from "clsx";
import { useLabStore } from "@/store/labStore";

/** Tint dot per reagent. Only CuSO4 reads distinctly blue on the shelf; everything else reads as water. */
const TINT: Readonly<Record<string, string>> = { cuso4: "var(--cu-blue)" };
const DEFAULT_TINT = "var(--water)";

export interface ReagentChipProps {
  reagentId: string;
  label: string;
}

/** Shelf reagent chip. Pointer-down starts the drag; the drop target logic lives elsewhere. */
export function ReagentChip({ reagentId, label }: ReagentChipProps) {
  const setDrag = useLabStore((s) => s.setDrag);
  const dragging = useLabStore((s) => s.ui.drag?.kind === "reagent" && s.ui.drag.reagentId === reagentId);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>): void => {
    setDrag({ kind: "reagent", reagentId, pointer: { x: e.clientX, y: e.clientY }, overId: null });
  };

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      className={clsx(
        "pressable flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface-thin px-2.5 text-xs text-ink-2 hover:bg-surface-thick",
        dragging && "opacity-40",
      )}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: TINT[reagentId] ?? DEFAULT_TINT }}
        aria-hidden
      />
      {label}
    </button>
  );
}
