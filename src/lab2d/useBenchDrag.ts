"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PublicContainer } from "@/engine";
import { emitToast } from "@/lib/events";
import { useLabStore } from "@/store/labStore";
import { containerInFrontOf, selectPublic } from "@/store/selectors";
import { objectIdsAtPoint } from "./objectDom";
import { cellToPx, dockedInstrumentPx, nearestFreeCell, pxToCell, type GridOccupant, type XY } from "./grid";

const DRAG_THRESHOLD_PX = 6;
const HOLD_DELAY_MS = 350;
const HOLD_INTERVAL_MS = 120;
/** Long enough for the drop spring (visualDuration 0.35s) to finish before the live pin releases control. */
const SETTLE_MS = 420;
const BENCH_WORKSPACE_SELECTOR = "[data-bench-workspace]";

type Phase = { readonly kind: "idle" } | { readonly kind: "pending"; readonly pointerId: number; readonly start: XY } | { readonly kind: "dragging"; readonly pointerId: number };

interface HoldState {
  readonly pointerId: number;
  timeout: ReturnType<typeof setTimeout> | null;
  interval: ReturnType<typeof setInterval> | null;
  /** True once the hold delay elapsed and dispensing started; a move after that no longer starts a drag. */
  fired: boolean;
}

function workspacePointFromClient(el: Element, clientX: number, clientY: number): XY {
  const workspace = el.closest(BENCH_WORKSPACE_SELECTOR);
  const rect = workspace?.getBoundingClientRect();
  return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY };
}

function gridOccupants(): ReadonlyArray<GridOccupant> {
  return selectPublic(useLabStore.getState()).objects.map((o) => ({ id: o.id, kind: o.kind, type: o.type, position: o.position }));
}

/** The first container id in the pointer's hit stack, skipping `excludeId` and any instrument. */
function containerUnderPoint(clientX: number, clientY: number, excludeId: string): PublicContainer | null {
  const objects = selectPublic(useLabStore.getState()).objects;
  for (const id of objectIdsAtPoint(clientX, clientY, excludeId)) {
    const object = objects.find((o) => o.id === id);
    if (object && object.kind === "container") return object;
  }
  return null;
}

export interface BenchDragRender {
  readonly dragging: boolean;
  /** Live pixel position (workspace-local) while dragging or settling; null once at rest. */
  readonly livePx: XY | null;
  /** True for one settle beat after release, so the position spring gets bounce instead of a flat ease. */
  readonly justReleased: boolean;
  readonly onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
}

export interface BenchDragOptions {
  readonly isBurette: boolean;
  /** The object's current rest pixel position (its own cell, or the dock corner if attached). */
  readonly restPx: XY;
}

/**
 * Pointer-driven bench interactions (click select, drag move, burette click-and-hold dispense).
 * One instance per `BenchObject`; `setPointerCapture` on the object's own root keeps the
 * gesture alive past the element's bounds, so no window-level listeners are needed. A burette
 * press arms both a drag and a hold: crossing the drag threshold first moves the burette, the
 * hold delay elapsing first locks it into dispensing.
 */
export function useBenchDrag(id: string, kind: "container" | "instrument", options: BenchDragOptions): BenchDragRender {
  const phaseRef = useRef<Phase>({ kind: "idle" });
  const holdRef = useRef<HoldState | null>(null);
  const grabOffsetRef = useRef<XY>({ x: 0, y: 0 });
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState(false);
  const [livePx, setLivePx] = useState<XY | null>(null);
  const [justReleased, setJustReleased] = useState(false);

  useEffect(
    () => () => {
      if (holdRef.current) {
        if (holdRef.current.timeout) clearTimeout(holdRef.current.timeout);
        if (holdRef.current.interval) clearInterval(holdRef.current.interval);
      }
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    },
    [],
  );

  const clearHold = (): void => {
    const hold = holdRef.current;
    if (!hold) return;
    if (hold.timeout) clearTimeout(hold.timeout);
    if (hold.interval) clearInterval(hold.interval);
    holdRef.current = null;
  };

  const dispenseOnce = (): void => {
    const store = useLabStore.getState();
    const objects = selectPublic(store).objects;
    const burette = objects.find((o) => o.id === id);
    if (!burette || burette.kind !== "container") return;
    const front = containerInFrontOf(burette, objects);
    if (!front) {
      emitToast({ kind: "info", title: "Nothing under the burette. Drag a flask to the cell in front of it." });
      return;
    }
    void store.dispatch({ kind: "DISPENSE", buretteId: burette.id, toId: front.id, volumeMl: store.ui.dispenseIncrementMl }, "human");
  };

  /**
   * Burette press: nothing happens for `HOLD_DELAY_MS`, so a drag can still begin in that window;
   * after it, one dispense fires and then repeats every `HOLD_INTERVAL_MS`. A release before the
   * delay is a click and dispenses once from `onPointerUp`.
   */
  const beginHold = (pointerId: number): void => {
    const hold: HoldState = { pointerId, timeout: null, interval: null, fired: false };
    hold.timeout = setTimeout(() => {
      hold.fired = true;
      dispenseOnce();
      hold.interval = setInterval(dispenseOnce, HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
    holdRef.current = hold;
  };

  /** Pins the visual at `targetPx` through one spring beat, then hands control back to the store. */
  const settle = (targetPx: XY): void => {
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    document.body.classList.remove("is-dragging");
    setDragging(false);
    setLivePx(targetPx);
    setJustReleased(true);
    settleTimeoutRef.current = setTimeout(() => {
      setLivePx(null);
      setJustReleased(false);
    }, SETTLE_MS);
  };

  const finishDrag = (clientX: number, clientY: number, el: Element): void => {
    const store = useLabStore.getState();
    store.setHovered(null);
    store.setDrag(null);
    const self = selectPublic(store).objects.find((o) => o.id === id);
    if (!self) {
      document.body.classList.remove("is-dragging");
      setDragging(false);
      setLivePx(null);
      return;
    }

    const target = containerUnderPoint(clientX, clientY, id);

    if (kind === "instrument" && self.kind === "instrument") {
      if (target) {
        void store.dispatch({ kind: "ATTACH_INSTRUMENT", instrumentId: self.id, containerId: target.id }, "human");
        settle(dockedInstrumentPx(target.position));
        return;
      }
      const pointer = workspacePointFromClient(el, clientX, clientY);
      const raw = pxToCell({ x: pointer.x - grabOffsetRef.current.x, y: pointer.y - grabOffsetRef.current.y });
      const freeCell = nearestFreeCell(gridOccupants(), raw, { id, kind: "instrument", type: self.type });
      if (self.attachedTo !== null) void store.dispatch({ kind: "ATTACH_INSTRUMENT", instrumentId: self.id, containerId: null }, "human");
      void store.dispatch({ kind: "MOVE_OBJECT", objectId: self.id, position: freeCell }, "human");
      settle(cellToPx(freeCell));
      return;
    }

    if (self.kind !== "container") {
      document.body.classList.remove("is-dragging");
      setDragging(false);
      setLivePx(null);
      return;
    }

    if (target) {
      if (self.volumeMl <= 0) {
        emitToast({ kind: "info", title: `Nothing to pour: ${self.label} is empty.` });
        settle(cellToPx(self.position));
        return;
      }
      const maxMl = Math.max(0, Math.min(self.volumeMl, target.capacityMl - target.volumeMl));
      settle(cellToPx(self.position));
      window.setTimeout(() => store.openDialog({ kind: "transfer", sourceId: id, destinationId: target.id, maxMl }), 0);
      return;
    }

    const pointer = workspacePointFromClient(el, clientX, clientY);
    const raw = pxToCell({ x: pointer.x - grabOffsetRef.current.x, y: pointer.y - grabOffsetRef.current.y });
    const freeCell = nearestFreeCell(gridOccupants(), raw, { id, kind: "container", type: self.type });
    void store.dispatch({ kind: "MOVE_OBJECT", objectId: self.id, position: freeCell }, "human");
    settle(cellToPx(freeCell));
  };

  const beginDrag = (pointerId: number, clientX: number, clientY: number, el: Element): void => {
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    const pointer = workspacePointFromClient(el, clientX, clientY);
    grabOffsetRef.current = { x: pointer.x - options.restPx.x, y: pointer.y - options.restPx.y };
    phaseRef.current = { kind: "dragging", pointerId };
    document.body.classList.add("is-dragging");
    setDragging(true);
    setJustReleased(false);
    setLivePx(options.restPx);
    const store = useLabStore.getState();
    store.setDrag(kind === "container" ? { kind: "container", id, pointer: { x: clientX, y: clientY }, overId: null } : { kind: "instrument", id, pointer: { x: clientX, y: clientY }, overId: null });
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>): void => {
    if (e.button !== 0 || phaseRef.current.kind !== "idle") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    useLabStore.getState().select(id);
    phaseRef.current = { kind: "pending", pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY } };
    if (options.isBurette) beginHold(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>): void => {
    const phase = phaseRef.current;
    if (phase.kind === "pending" && e.pointerId === phase.pointerId) {
      if (Math.hypot(e.clientX - phase.start.x, e.clientY - phase.start.y) < DRAG_THRESHOLD_PX) return;
      if (holdRef.current?.fired) return;
      clearHold();
      beginDrag(phase.pointerId, e.clientX, e.clientY, e.currentTarget);
      return;
    }
    if (phase.kind === "dragging" && e.pointerId === phase.pointerId) {
      const pointer = workspacePointFromClient(e.currentTarget, e.clientX, e.clientY);
      setLivePx({ x: pointer.x - grabOffsetRef.current.x, y: pointer.y - grabOffsetRef.current.y });
      const target = containerUnderPoint(e.clientX, e.clientY, id);
      const store = useLabStore.getState();
      if (store.ui.hoveredId !== (target?.id ?? null)) store.setHovered(target?.id ?? null);
      store.setDrag(kind === "container" ? { kind: "container", id, pointer: { x: e.clientX, y: e.clientY }, overId: target?.id ?? null } : { kind: "instrument", id, pointer: { x: e.clientX, y: e.clientY }, overId: target?.id ?? null });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const phase = phaseRef.current;
    if (phase.kind === "idle" || e.pointerId !== phase.pointerId) return;
    const holdFired = holdRef.current?.fired ?? false;
    clearHold();
    phaseRef.current = { kind: "idle" };
    if (phase.kind === "pending") {
      // A click: selection already happened on pointerdown; a burette click also dispenses once.
      if (options.isBurette && !holdFired) dispenseOnce();
      return;
    }
    finishDrag(e.clientX, e.clientY, e.currentTarget);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLElement>): void => {
    const phase = phaseRef.current;
    if (phase.kind === "idle" || e.pointerId !== phase.pointerId) return;
    clearHold();
    phaseRef.current = { kind: "idle" };
    if (phase.kind === "dragging") finishDrag(e.clientX, e.clientY, e.currentTarget);
  };

  return { dragging, livePx, justReleased, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
