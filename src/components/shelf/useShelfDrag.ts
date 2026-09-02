"use client";

import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { constants, isIndicatorIdShape, isReagentId, type EquipmentType, type Vec2 } from "@/engine";
import { nearestFreeCell, pxToCell, type GridOccupant } from "@/lab2d/grid";
import { hitTestObject } from "@/lab2d/objectDom";
import { useLabStore } from "@/store/labStore";
import type { XY } from "@/store/types";

const THRESHOLD_PX = 6;
/** Above this release speed (px/s) the ghost's return trip gets a small overshoot bounce. */
const FLICK_PX_PER_S = 900;

/** id on the bench's own scroll/clip viewport, set by `LabShell`: the drop zone for equipment tiles. */
export const BENCH_VIEWPORT_ID = "lab2d-viewport";
/** The dock's root (`Shelf`); a release over it, though inside the viewport box, is a miss. */
const SHELF_SELECTOR = "[data-shelf]";
const BENCH_WORKSPACE_SELECTOR = "[data-bench-workspace]";

function gridOccupants(): ReadonlyArray<GridOccupant> {
  return useLabStore.getState().lab.objects.map((o) => ({ id: o.id, kind: o.kind, type: o.type, position: o.position }));
}

/**
 * Fractional grid cell under a client point, from the scrolled workspace's own rect (the same
 * mapping `useBenchDrag` uses), or `null` off the viewport or over the dock. Snapping and
 * occupancy are `nearestFreeCell`'s job.
 */
function cellUnderPointer(x: number, y: number): Vec2 | null {
  const viewport = document.getElementById(BENCH_VIEWPORT_ID)?.getBoundingClientRect();
  if (!viewport || x < viewport.left || x > viewport.right || y < viewport.top || y > viewport.bottom) return null;
  if (document.elementsFromPoint(x, y).some((el) => el.closest(SHELF_SELECTOR))) return null;
  const workspace = document.querySelector(BENCH_WORKSPACE_SELECTOR)?.getBoundingClientRect();
  return workspace ? pxToCell({ x: x - workspace.left, y: y - workspace.top }) : null;
}

function isContainerType(type: EquipmentType): boolean {
  return constants.CONTAINER_TYPES.some((t) => t === type);
}

type Candidate =
  | { kind: "reagent"; reagentId: string }
  | { kind: "indicator"; indicatorId: string }
  | { kind: "equipment"; equipmentType: EquipmentType };

export interface DragOutcome {
  readonly origin: XY;
  readonly landed: boolean;
  readonly flicked: boolean;
}

/**
 * Bridge between this module's imperative pointer tracking and `ReagentGhost`, which is a
 * plain React component reacting to `ui.drag` going back to `null`. Zustand has no room for a
 * one-shot "how did the last drag end" value, so it lives here instead.
 */
let lastOutcome: DragOutcome | null = null;
export function takeDragOutcome(): DragOutcome | null {
  const v = lastOutcome;
  lastOutcome = null;
  return v;
}

function containerHasLiquid(id: string): boolean {
  const obj = useLabStore.getState().lab.objects.find((o) => o.id === id);
  return obj !== undefined && obj.kind === "container" && obj.volumeMl > 0;
}

function isContainer(id: string): boolean {
  const obj = useLabStore.getState().lab.objects.find((o) => o.id === id);
  return obj !== undefined && obj.kind === "container";
}

/** `min(stock remaining ?? Infinity, capacity - volume)` (C4.3/C4.4). */
function maxMlFor(containerId: string, reagentId: string): number {
  const state = useLabStore.getState();
  const container = state.lab.objects.find((o) => o.id === containerId);
  if (!container || container.kind !== "container") return 0;
  const stock = state.lab.shelf.find((s) => s.reagentId === reagentId);
  const stockRemaining = stock?.remainingMl ?? Infinity;
  const free = container.capacityMl - container.volumeMl;
  return Math.max(0, Math.min(stockRemaining, free));
}

export interface ShelfDragHandlers {
  onReagentPointerDown: (reagentId: string) => (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onIndicatorPointerDown: (indicatorId: string) => (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onEquipmentPointerDown: (equipmentType: EquipmentType) => (e: ReactPointerEvent<HTMLButtonElement>) => void;
}

/**
 * Owns the full shelf-drag gesture (C4.3): pointerdown on a chip/button arms a 6px-threshold
 * watcher; crossing it starts the real drag in `ui.drag` (which mounts `ReagentGhost`);
 * pointermove after that is rAF-throttled and hit-tests the scene; pointerup opens the amount
 * dialog, dispatches `PLACE_OBJECT`, or leaves `ui.drag` to fall back to the origin chip.
 * Pointer capture stays on the source element for the whole gesture, so release always reaches
 * this handler even when the pointer ends up over the canvas.
 */
export function useShelfDrag(): ShelfDragHandlers {
  const setDrag = useLabStore((s) => s.setDrag);
  const openDialog = useLabStore((s) => s.openDialog);
  const armed = useRef(false);

  const beginDrag = useCallback(
    (candidate: Candidate, e: ReactPointerEvent<HTMLButtonElement>) => {
      // Ignore a second pointer while one drag is already in flight.
      if (armed.current) return;
      armed.current = true;

      const originX = e.clientX;
      const originY = e.clientY;
      const el = e.currentTarget;
      const pointerId = e.pointerId;
      let started = false;
      let raf = 0;
      let pendingMove: PointerEvent | null = null;
      let lastSample = { x: originX, y: originY, t: performance.now() };
      let speedPxPerS = 0;

      const startDrag = (x: number, y: number): void => {
        started = true;
        const pointer: XY = { x, y };
        if (candidate.kind === "equipment") setDrag({ kind: "equipment", equipmentType: candidate.equipmentType, pointer, cell: null });
        else if (candidate.kind === "reagent") setDrag({ kind: "reagent", reagentId: candidate.reagentId, pointer, overId: null });
        else setDrag({ kind: "indicator", indicatorId: candidate.indicatorId, pointer, overId: null });
      };

      const applyMove = (x: number, y: number): void => {
        const pointer: XY = { x, y };
        if (candidate.kind === "equipment") {
          const under = cellUnderPointer(x, y);
          const type = candidate.equipmentType;
          const cell = under ? nearestFreeCell(gridOccupants(), under, { id: "", kind: isContainerType(type) ? "container" : "instrument", type }) : null;
          setDrag({ kind: "equipment", equipmentType: candidate.equipmentType, pointer, cell });
          return;
        }
        const hitId = hitTestObject(x, y);
        const valid = hitId !== null && isContainer(hitId) && (candidate.kind === "reagent" || containerHasLiquid(hitId));
        if (candidate.kind === "reagent") setDrag({ kind: "reagent", reagentId: candidate.reagentId, pointer, overId: valid ? hitId : null });
        else setDrag({ kind: "indicator", indicatorId: candidate.indicatorId, pointer, overId: valid ? hitId : null });
      };

      const processMove = (): void => {
        raf = 0;
        const ev = pendingMove;
        pendingMove = null;
        if (!ev) return;
        const now = performance.now();
        const dt = Math.max(1, now - lastSample.t);
        speedPxPerS = (Math.hypot(ev.clientX - lastSample.x, ev.clientY - lastSample.y) / dt) * 1000;
        lastSample = { x: ev.clientX, y: ev.clientY, t: now };

        if (!started) {
          if (Math.hypot(ev.clientX - originX, ev.clientY - originY) < THRESHOLD_PX) return;
          startDrag(ev.clientX, ev.clientY);
          return;
        }
        applyMove(ev.clientX, ev.clientY);
      };

      const onMove = (ev: PointerEvent): void => {
        pendingMove = ev;
        if (!raf) raf = requestAnimationFrame(processMove);
      };

      const cleanup = (): void => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
        if (raf) cancelAnimationFrame(raf);
        armed.current = false;
      };

      const onUp = (): void => {
        cleanup();
        if (!started) return;
        const current = useLabStore.getState().ui.drag;
        const origin: XY = { x: originX, y: originY };
        const flicked = speedPxPerS > FLICK_PX_PER_S;

        if (candidate.kind === "equipment") {
          const cell = current && current.kind === "equipment" ? current.cell : null;
          lastOutcome = { origin, landed: cell !== null, flicked };
          setDrag(null);
          if (cell) void useLabStore.getState().dispatch({ kind: "PLACE_OBJECT", objectType: candidate.equipmentType, position: cell }, "human");
          return;
        }

        const overId = current && (current.kind === "reagent" || current.kind === "indicator") ? current.overId : null;
        lastOutcome = { origin, landed: overId !== null, flicked };
        setDrag(null);
        if (!overId) return;

        // The popover must open after the `click` that ends this gesture has dispatched: it lands
        // on the source chip, outside the popup, and would otherwise dismiss it in the same tick.
        if (candidate.kind === "reagent" && isReagentId(candidate.reagentId)) {
          const maxMl = maxMlFor(overId, candidate.reagentId);
          const reagentId = candidate.reagentId;
          window.setTimeout(() => openDialog({ kind: "add_reagent", containerId: overId, reagentId, defaultMl: Math.min(10, maxMl), maxMl }), 0);
        } else if (candidate.kind === "indicator" && isIndicatorIdShape(candidate.indicatorId)) {
          const indicatorId = candidate.indicatorId;
          window.setTimeout(() => openDialog({ kind: "add_indicator", containerId: overId, indicatorId }), 0);
        }
      };

      el.setPointerCapture(pointerId);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    },
    [setDrag, openDialog],
  );

  return {
    onReagentPointerDown: (reagentId) => (e) => beginDrag({ kind: "reagent", reagentId }, e),
    onIndicatorPointerDown: (indicatorId) => (e) => beginDrag({ kind: "indicator", indicatorId }, e),
    onEquipmentPointerDown: (equipmentType) => (e) => beginDrag({ kind: "equipment", equipmentType }, e),
  };
}
