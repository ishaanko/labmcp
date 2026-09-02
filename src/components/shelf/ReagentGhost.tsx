"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate } from "motion/react";
import { clsx } from "clsx";
import { constants, indicatorDef, isIndicatorIdShape, isReagentId, reagentDef, type EquipmentType } from "@/engine";
import { useLabStore } from "@/store/labStore";
import type { DragState, XY } from "@/store/types";
import { EQUIPMENT_COLOR, EQUIPMENT_FACE, EQUIPMENT_ICON } from "./EquipmentButton";
import { ROLE_HEX, indicatorRole, reagentRole } from "./roleColor";
import { BottleIcon, DropletIcon, DropperIcon } from "./TileIcon";
import { TileGlyph, type TileFace } from "./Tile";
import { takeDragOutcome } from "./useShelfDrag";

type GhostDrag = Extract<DragState, { kind: "reagent" | "indicator" | "equipment" }>;

function isGhostDrag(drag: DragState | null): drag is GhostDrag {
  return drag !== null && (drag.kind === "reagent" || drag.kind === "indicator" || drag.kind === "equipment");
}

function isEquipmentType(v: string): v is EquipmentType {
  return constants.EQUIPMENT_TYPES.some((t) => t === v);
}

function colorFor(drag: GhostDrag): string {
  if (drag.kind === "equipment") return EQUIPMENT_COLOR;
  if (drag.kind === "indicator") {
    const kind = isIndicatorIdShape(drag.indicatorId) ? indicatorDef(drag.indicatorId)?.kind : undefined;
    return ROLE_HEX[indicatorRole(kind ?? "phenolphthalein")];
  }
  return isReagentId(drag.reagentId) ? ROLE_HEX[reagentRole(drag.reagentId)] : ROLE_HEX.water;
}

function iconFor(drag: GhostDrag) {
  if (drag.kind === "equipment") {
    const Icon = isEquipmentType(drag.equipmentType) ? EQUIPMENT_ICON[drag.equipmentType] : null;
    return Icon ? <Icon size={28} strokeWidth={2} /> : null;
  }
  if (drag.kind === "indicator") return <DropperIcon />;
  return isReagentId(drag.reagentId) && reagentDef(drag.reagentId)?.kind === "water" ? <DropletIcon /> : <BottleIcon />;
}

/** Equipment announces a free cell; a reagent over a vessel needs nothing here, the vessel lifts and its caption turns white. */
function targetSuffix(drag: GhostDrag): string | null {
  return drag.kind === "equipment" && drag.cell ? "Drop to place" : null;
}

/** How a ghost leaves: fading in place where it landed, or springing back to its shelf tile. */
type GhostExitMotion = { readonly kind: "fade" } | { readonly kind: "spring"; readonly to: XY; readonly flicked: boolean };

interface GhostExit {
  readonly ghost: GhostDrag;
  readonly at: XY;
  readonly motion: GhostExitMotion;
}

/** The ghost is the 56px `TileGlyph` alone, centered on the pointer, so the drop target stays readable under it. */
const GHOST = 56;

/**
 * The icon square that follows the pointer during a shelf drag: position is a raw
 * `translate3d()` transform string every render (never `motion`'s `x`/`y` props), since
 * `ui.drag.pointer` already arrives rAF-throttled from `useShelfDrag`. A landed drop fades the
 * ghost out in place over 120ms; an unsuccessful release springs it back to its dock tile. Both
 * snap instantly under `ui.reducedMotion`.
 */
export function ReagentGhost() {
  const drag = useLabStore((s) => s.ui.drag);
  const ref = useRef<HTMLDivElement>(null);
  const prevDrag = useRef<GhostDrag | null>(null);
  const returnControls = useRef<ReturnType<typeof animate> | null>(null);
  const [returning, setReturning] = useState<GhostExit | null>(null);

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

  useEffect(() => {
    const el = ref.current;
    if (!returning || !el) return;
    const reducedMotion = useLabStore.getState().ui.reducedMotion;
    const controls =
      returning.motion.kind === "fade"
        ? animate(el, { opacity: 0 }, reducedMotion ? { duration: 0 } : { duration: 0.12, ease: [0.23, 1, 0.32, 1] })
        : animate(
            el,
            { transform: `translate3d(${returning.motion.to.x - GHOST / 2}px, ${returning.motion.to.y - GHOST / 2}px, 0) scale(1)` },
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
  const suffix = targetSuffix(active);
  const hovering = active.kind !== "equipment" ? active.overId !== null : active.cell !== null;
  const face: TileFace = active.kind === "equipment" ? EQUIPMENT_FACE : {};

  return createPortal(
    <div
      ref={ref}
      className="pointer-events-none fixed top-0 left-0 z-50 flex flex-col items-center"
      style={{
        width: GHOST,
        transform: `translate3d(${pointer.x - GHOST / 2}px, ${pointer.y - GHOST / 2}px, 0) scale(1.06)`,
        willChange: "transform",
      }}
    >
      <TileGlyph color={colorFor(active)} {...face} className={clsx("shadow-lg", hovering && "ring-2 ring-primary")}>
        {iconFor(active)}
      </TileGlyph>
      {suffix ? (
        <span className="mt-1 rounded-full bg-card px-2 py-0.5 text-2xs whitespace-nowrap text-foreground shadow-lg">{suffix}</span>
      ) : null}
    </div>,
    document.body,
  );
}
