"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate } from "motion/react";
import { clsx } from "clsx";
import { constants, indicatorDef, isIndicatorIdShape, type EquipmentType } from "@/engine";
import { useLabStore } from "@/store/labStore";
import type { DragState, XY } from "@/store/types";
import { EQUIPMENT_ICON, EQUIPMENT_LABEL } from "./EquipmentButton";
import { REAGENT_DEFAULT_TINT, REAGENT_TINT } from "./ReagentChip";
import { takeDragOutcome } from "./useShelfDrag";

type GhostDrag = Extract<DragState, { kind: "reagent" | "indicator" | "equipment" }>;

function isGhostDrag(drag: DragState | null): drag is GhostDrag {
  return drag !== null && (drag.kind === "reagent" || drag.kind === "indicator" || drag.kind === "equipment");
}

function isEquipmentType(v: string): v is EquipmentType {
  return constants.EQUIPMENT_TYPES.some((t) => t === v);
}

function labelFor(drag: GhostDrag, shelf: ReadonlyArray<{ reagentId: string; label: string }>): string {
  if (drag.kind === "reagent") return shelf.find((s) => s.reagentId === drag.reagentId)?.label ?? drag.reagentId;
  if (drag.kind === "indicator") return (isIndicatorIdShape(drag.indicatorId) ? indicatorDef(drag.indicatorId)?.label : undefined) ?? drag.indicatorId;
  return isEquipmentType(drag.equipmentType) ? EQUIPMENT_LABEL[drag.equipmentType] : drag.equipmentType;
}

function targetSuffix(drag: GhostDrag, containerLabel: string | null): string | null {
  if (drag.kind === "equipment") return drag.cell ? "→ bench" : null;
  return drag.overId ? `→ ${containerLabel ?? drag.overId}` : null;
}

/** How a ghost leaves: fading in place where it landed, or springing back to its shelf chip. */
type GhostExitMotion = { readonly kind: "fade" } | { readonly kind: "spring"; readonly to: XY; readonly flicked: boolean };

/** A ghost on its way out. */
interface GhostExit {
  readonly ghost: GhostDrag;
  /** Where the ghost is drawn while the exit runs (the release point). */
  readonly at: XY;
  readonly motion: GhostExitMotion;
}

/** Wide enough for "Phenolphthalein → Flask" without truncation. */
const GHOST_W = 188;
const GHOST_H = 32;

/**
 * The floating chip that follows the pointer during a shelf drag (C4.3). Position is written
 * as a raw `translate3d()` transform string every render (never through motion's `x`/`y`
 * props), since `ui.drag.pointer` already arrives rAF-throttled from `useShelfDrag`. Only the
 * unsuccessful-release return trip is a real spring; a landed drop instead fades the ghost out
 * in place over 120ms. Both run imperatively with `motion`'s `animate`, and both snap instantly
 * under `ui.reducedMotion`.
 */
export function ReagentGhost() {
  const drag = useLabStore((s) => s.ui.drag);
  const shelf = useLabStore((s) => s.lab.shelf);
  const objects = useLabStore((s) => s.lab.objects);
  const ref = useRef<HTMLDivElement>(null);
  const prevDrag = useRef<GhostDrag | null>(null);
  const returnControls = useRef<ReturnType<typeof animate> | null>(null);
  const [returning, setReturning] = useState<GhostExit | null>(null);

  // Phase 1: when the drag ends, decide how the ghost leaves (fade in place or spring home).
  useEffect(() => {
    if (isGhostDrag(drag)) {
      prevDrag.current = drag;
      returnControls.current?.stop();
      return;
    }
    const last = prevDrag.current;
    prevDrag.current = null;
    if (!last) return;
    const outcome = takeDragOutcome();
    if (!outcome) return;
    const motion: GhostExitMotion = outcome.landed ? { kind: "fade" } : { kind: "spring", to: outcome.origin, flicked: outcome.flicked };
    setReturning({ ghost: last, at: last.pointer, motion });
  }, [drag]);

  // Phase 2: run the exit once the ghost is mounted for it. Split from phase 1 because on the
  // render where `drag` goes null the element is not in the DOM yet (nothing to animate), and a
  // ghost whose exit never starts stays stuck on screen. Under reduced motion every exit still
  // runs through `animate` (so the same finish/cleanup path applies) but with zero duration, so
  // it snaps to its end state on the next frame instead of fading or springing.
  useEffect(() => {
    const el = ref.current;
    if (!returning || !el) return;
    const reducedMotion = useLabStore.getState().ui.reducedMotion;
    const controls =
      returning.motion.kind === "fade"
        ? animate(el, { opacity: 0 }, reducedMotion ? { duration: 0 } : { duration: 0.12, ease: [0.23, 1, 0.32, 1] })
        : animate(
            el,
            { transform: `translate3d(${returning.motion.to.x - GHOST_W / 2}px, ${returning.motion.to.y - GHOST_H / 2}px, 0) scale(1)` },
            reducedMotion
              ? { duration: 0 }
              : returning.motion.flicked
                ? { type: "spring", visualDuration: 0.4, bounce: 0.2 }
                : { type: "spring", visualDuration: 0.22, bounce: 0 },
          );
    returnControls.current = controls;
    void controls.finished.then(() => setReturning(null));
    return () => controls.stop();
  }, [returning]);

  const live = isGhostDrag(drag) ? drag : null;
  const active = live ?? returning?.ghost ?? null;
  if (!active || typeof document === "undefined") return null;

  const pointer = live ? live.pointer : (returning?.at ?? { x: 0, y: 0 });
  const overContainer = active.kind !== "equipment" && active.overId ? objects.find((o) => o.id === active.overId) : undefined;
  const containerLabel = overContainer && overContainer.kind === "container" ? overContainer.label : null;

  const Icon = active.kind === "equipment" && isEquipmentType(active.equipmentType) ? EQUIPMENT_ICON[active.equipmentType] : null;
  const tint = active.kind === "reagent" ? (REAGENT_TINT[active.reagentId] ?? REAGENT_DEFAULT_TINT) : "var(--phenol-pink)";
  const suffix = targetSuffix(active, containerLabel);
  const hovering = active.kind !== "equipment" ? active.overId !== null : active.cell !== null;

  return createPortal(
    <div
      ref={ref}
      className={clsx(
        "material-thick pointer-events-none fixed top-0 left-0 z-50 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs whitespace-nowrap text-ink shadow-[var(--shadow-popover)]",
        hovering && "ring-2 ring-accent-ring",
      )}
      style={{
        width: GHOST_W,
        transform: `translate3d(${pointer.x - GHOST_W / 2}px, ${pointer.y - GHOST_H / 2}px, 0) scale(1.04)`,
        willChange: "transform",
      }}
    >
      {Icon ? <Icon size={14} /> : <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tint }} aria-hidden />}
      <span className="truncate">{labelFor(active, shelf)}</span>
      {suffix ? <span className="text-ink-3">{suffix}</span> : null}
    </div>,
    document.body,
  );
}
