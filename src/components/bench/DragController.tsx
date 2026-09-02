"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Container, Instrument } from "@/engine";
import { emitToast } from "@/lib/events";
import { useLabStore } from "@/store/labStore";
import { containerInFrontOf } from "@/store/selectors";
import type { DragState, XY } from "@/store/types";
import { cancelPoseJobs } from "@/scene/animationQueue";
import { bumpFrame, groundPointAt, pickObjectAt } from "@/scene/sceneRefs";
import { setTarget, visualFor } from "@/scene/visualStore";
import { cellKey, nearestFreeCell, rubberbandClamp, type GridCell } from "@/scene/picking";
import { GRID_BOUNDS, gridToWorld, worldToGrid } from "./Bench";

const DRAG_THRESHOLD_PX = 6;
const LIFT_Y = 0.22;
const HOLD_DELAY_MS = 350;
const HOLD_INTERVAL_MS = 120;
const RUBBERBAND_DIM = 1.0;
const RUBBERBAND_COEFF = 0.55;
const VELOCITY_SAMPLES = 8;
const RELEASE_SETTLE_MS = 260;
const NOTHING_UNDER_TIP = "Nothing under the burette. Drag a flask to the cell beneath it.";

type Candidate = { readonly kind: "container"; readonly object: Container } | { readonly kind: "instrument"; readonly object: Instrument };

interface Sample {
  readonly t: number;
  readonly x: number;
  readonly z: number;
}

type DragPhase =
  | { readonly kind: "idle" }
  | { readonly kind: "pending"; readonly pointerId: number; readonly startX: number; readonly startY: number; readonly candidate: Candidate }
  | {
      readonly kind: "dragging";
      readonly pointerId: number;
      readonly candidate: Candidate;
      readonly grabOffsetX: number;
      readonly grabOffsetZ: number;
      readonly samples: Sample[];
      hoverId: string | null;
    };

interface HoldState {
  readonly pointerId: number;
  readonly buretteId: Container["id"];
  readonly toId: Container["id"];
  timeout: ReturnType<typeof setTimeout> | null;
  interval: ReturnType<typeof setInterval> | null;
}

function objectAt(id: string | null): Container | Instrument | undefined {
  if (!id) return undefined;
  return useLabStore.getState().lab.objects.find((o) => o.id === id);
}

function candidateFor(id: string | null): Candidate | null {
  const obj = objectAt(id);
  if (!obj) return null;
  return obj.kind === "container" ? { kind: "container", object: obj } : { kind: "instrument", object: obj };
}

function containerUnder(id: string | null): Container | undefined {
  const obj = objectAt(id);
  return obj && obj.kind === "container" ? obj : undefined;
}

function frontOfBurette(burette: Container): Container | undefined {
  return containerInFrontOf(burette, useLabStore.getState().lab.objects);
}

/** Occupied grid cells (containers only; a hotplate or instrument holder does not block a drop). */
function occupancyExcluding(excludeId: string): ReadonlySet<string> {
  const set = new Set<string>();
  for (const o of useLabStore.getState().lab.objects) {
    if (o.kind === "container" && o.id !== excludeId) set.add(cellKey({ x: o.position.x, y: o.position.y }));
  }
  return set;
}

function dragStateFor(candidate: Candidate, pointer: XY, overId: string | null): DragState {
  return candidate.kind === "container"
    ? { kind: "container", id: candidate.object.id, pointer, overId }
    : { kind: "instrument", id: candidate.object.id, pointer, overId };
}

/** Decays a short velocity history forward (C4.2 "project with decel 0.99") to a landing point. */
function projectLanding(samples: ReadonlyArray<Sample>): { x: number; z: number } {
  const last = samples[samples.length - 1];
  const first = samples[0];
  if (!last) return { x: 0, z: 0 };
  if (!first || samples.length < 2 || last.t === first.t) return { x: last.x, z: last.z };
  const dtS = (last.t - first.t) / 1000;
  let vx = (last.x - first.x) / dtS;
  let vz = (last.z - first.z) / dtS;
  let x = last.x;
  let z = last.z;
  const step = 1 / 60;
  for (let i = 0; i < 20; i++) {
    x += vx * step;
    z += vz * step;
    vx *= 0.99;
    vz *= 0.99;
  }
  return { x, z };
}

/**
 * Pointer-driven bench interactions (C4.1, C4.2, C4.5, C4.6): click to select, drag a
 * container/instrument, click-and-hold a burette to dispense. Mounted inside the Canvas so it
 * can read `state.pointer`-adjacent raycasts every frame, but the gesture itself runs on native
 * Pointer Events against `gl.domElement` (not R3F's per-mesh handlers) so `setPointerCapture`
 * keeps the drag alive even when the cursor leaves the canvas.
 *
 * Position tracking during a drag never touches zustand: `visualStore.visuals[id].pose` is
 * written directly (bypassing `VisualDriver`'s damp) for x/z so the glass tracks the pointer
 * 1:1, while the target's y stays a plain `setTarget` so the lift still eases in via the shared
 * damp. `ui.drag` (for `HoverRing`/chrome) only updates when the hovered target actually
 * changes, and every store write happens from the native pointer handlers, never from
 * `useFrame`.
 */
export function DragController() {
  const { gl } = useThree();
  const phaseRef = useRef<DragPhase>({ kind: "idle" });
  const holdRef = useRef<HoldState | null>(null);
  const lastClientRef = useRef<XY | null>(null);
  const settleTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const el = gl.domElement;
    const pendingSettles = settleTimeouts.current;

    const clearSettle = (id: string): void => {
      const pending = pendingSettles.get(id);
      if (pending !== undefined) {
        clearTimeout(pending);
        pendingSettles.delete(id);
      }
    };

    const settlePoseTo = (id: string, cell: GridCell): void => {
      const [x, , z] = gridToWorld(cell);
      setTarget(id, { pose: { x, y: 0, z, tiltRad: 0 } });
      clearSettle(id);
      pendingSettles.set(
        id,
        setTimeout(() => {
          setTarget(id, { pose: null });
          pendingSettles.delete(id);
        }, RELEASE_SETTLE_MS),
      );
    };

    const dispenseOnce = (buretteId: Container["id"], toId: Container["id"]): void => {
      const ml = useLabStore.getState().ui.dispenseIncrementMl;
      void useLabStore.getState().dispatch({ kind: "DISPENSE", buretteId, toId, volumeMl: ml }, "human");
    };

    const clearHold = (): void => {
      const hold = holdRef.current;
      if (!hold) return;
      if (hold.timeout) clearTimeout(hold.timeout);
      if (hold.interval) clearInterval(hold.interval);
      holdRef.current = null;
    };

    const beginBuretteHold = (burette: Container, pointerId: number): void => {
      const front = frontOfBurette(burette);
      if (!front) {
        emitToast({ kind: "info", title: NOTHING_UNDER_TIP });
        return;
      }
      dispenseOnce(burette.id, front.id);
      const hold: HoldState = { pointerId, buretteId: burette.id, toId: front.id, timeout: null, interval: null };
      hold.timeout = setTimeout(() => {
        hold.interval = setInterval(() => dispenseOnce(hold.buretteId, hold.toId), HOLD_INTERVAL_MS);
      }, HOLD_DELAY_MS);
      holdRef.current = hold;
    };

    const beginDrag = (candidate: Candidate, pointerId: number, clientX: number, clientY: number): void => {
      const id = candidate.object.id;
      clearSettle(id);
      cancelPoseJobs(id);
      const ground = groundPointAt(clientX, clientY);
      const [ox, oy, oz] = gridToWorld(candidate.object.position);
      phaseRef.current = {
        kind: "dragging",
        pointerId,
        candidate,
        grabOffsetX: ground ? ground.x - ox : 0,
        grabOffsetZ: ground ? ground.z - oz : 0,
        samples: [{ t: performance.now(), x: ox, z: oz }],
        hoverId: null,
      };
      setTarget(id, { pose: { x: ox, y: LIFT_Y, z: oz, tiltRad: 0 } });
      const visual = visualFor(id);
      visual.pose = { x: ox, y: visual.pose?.y ?? oy, z: oz, tiltRad: 0 };
      useLabStore.getState().setDrag(dragStateFor(candidate, { x: clientX, y: clientY }, null));
    };

    const finishDrag = (phase: Extract<DragPhase, { kind: "dragging" }>, releaseClient: XY): void => {
      const store = useLabStore.getState();
      const id = phase.candidate.object.id;
      const targetContainer = containerUnder(pickObjectAt(releaseClient.x, releaseClient.y, id));
      store.setDrag(null);

      if (phase.candidate.kind === "instrument") {
        const instrument = phase.candidate.object;
        if (targetContainer) {
          void store.dispatch({ kind: "ATTACH_INSTRUMENT", instrumentId: instrument.id, containerId: targetContainer.id }, "human");
          setTarget(id, { pose: null });
          return;
        }
        const landing = projectLanding(phase.samples);
        const rawGrid = worldToGrid(landing.x, landing.z);
        const freeCell = nearestFreeCell(occupancyExcluding(id), rawGrid, GRID_BOUNDS);
        if (instrument.attachedTo) void store.dispatch({ kind: "ATTACH_INSTRUMENT", instrumentId: instrument.id, containerId: null }, "human");
        void store.dispatch({ kind: "MOVE_OBJECT", objectId: id, position: freeCell }, "human");
        settlePoseTo(id, freeCell);
        return;
      }

      const container = phase.candidate.object;
      if (targetContainer && container.volumeMl > 0) {
        setTarget(id, { pose: null });
        // Open after the `click` that ends this gesture has dispatched: it lands on the canvas,
        // outside the popup, and would otherwise dismiss the popover in the same tick.
        const maxMl = Math.max(0, Math.min(container.volumeMl, targetContainer.capacityMl - targetContainer.volumeMl));
        window.setTimeout(() => store.openDialog({ kind: "transfer", sourceId: id, destinationId: targetContainer.id, maxMl }), 0);
        return;
      }

      const landing = projectLanding(phase.samples);
      const rawGrid = worldToGrid(landing.x, landing.z);
      const freeCell = nearestFreeCell(occupancyExcluding(id), rawGrid, GRID_BOUNDS);
      void store.dispatch({ kind: "MOVE_OBJECT", objectId: id, position: freeCell }, "human");
      settlePoseTo(id, freeCell);
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0 || phaseRef.current.kind !== "idle" || holdRef.current) return;
      const id = pickObjectAt(e.clientX, e.clientY);
      if (!id) {
        useLabStore.getState().select(null);
        return;
      }
      const candidate = candidateFor(id);
      if (!candidate) return;

      el.setPointerCapture(e.pointerId);
      lastClientRef.current = { x: e.clientX, y: e.clientY };

      if (candidate.kind === "container" && candidate.object.type === "burette") {
        useLabStore.getState().select(id);
        beginBuretteHold(candidate.object, e.pointerId);
        return;
      }
      phaseRef.current = { kind: "pending", pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, candidate };
    };

    const onPointerMove = (e: PointerEvent): void => {
      lastClientRef.current = { x: e.clientX, y: e.clientY };
      const phase = phaseRef.current;
      if (phase.kind === "pending" && e.pointerId === phase.pointerId) {
        if (Math.hypot(e.clientX - phase.startX, e.clientY - phase.startY) < DRAG_THRESHOLD_PX) return;
        beginDrag(phase.candidate, phase.pointerId, e.clientX, e.clientY);
        return;
      }
      // Drop-target detection is event-driven (here), not per-frame: it only needs to change
      // when the pointer does, and it writes to `ui.drag`, which must never happen from
      // `useFrame` (the position tracking below stays there since it writes only `visualStore`).
      if (phase.kind === "dragging" && e.pointerId === phase.pointerId) {
        const id = phase.candidate.object.id;
        const hoverTarget = containerUnder(pickObjectAt(e.clientX, e.clientY, id));
        const hoverId = hoverTarget ? hoverTarget.id : null;
        if (hoverId !== phase.hoverId) {
          phase.hoverId = hoverId;
          useLabStore.getState().setDrag(dragStateFor(phase.candidate, { x: e.clientX, y: e.clientY }, hoverId));
        }
      }
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (holdRef.current && holdRef.current.pointerId === e.pointerId) {
        clearHold();
        return;
      }
      const phase = phaseRef.current;
      if (phase.kind === "idle" || e.pointerId !== phase.pointerId) return;
      phaseRef.current = { kind: "idle" };
      if (phase.kind === "pending") {
        useLabStore.getState().select(phase.candidate.object.id);
        return;
      }
      finishDrag(phase, { x: e.clientX, y: e.clientY });
    };

    const onPointerCancel = (e: PointerEvent): void => {
      if (holdRef.current && holdRef.current.pointerId === e.pointerId) {
        clearHold();
        return;
      }
      const phase = phaseRef.current;
      if (phase.kind === "idle" || e.pointerId !== phase.pointerId) return;
      phaseRef.current = { kind: "idle" };
      if (phase.kind === "dragging") finishDrag(phase, { x: e.clientX, y: e.clientY });
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      clearHold();
      for (const timeout of pendingSettles.values()) clearTimeout(timeout);
    };
  }, [gl]);

  useFrame(() => {
    bumpFrame();
    const phase = phaseRef.current;
    if (phase.kind !== "dragging") return;
    const client = lastClientRef.current;
    const ground = client ? groundPointAt(client.x, client.y) : null;
    if (!ground) return;

    const rawGrid = worldToGrid(ground.x - phase.grabOffsetX, ground.z - phase.grabOffsetZ);
    const softGrid: GridCell = {
      x: rubberbandClamp(rawGrid.x, GRID_BOUNDS.minX, GRID_BOUNDS.maxX, RUBBERBAND_DIM, RUBBERBAND_COEFF),
      y: rubberbandClamp(rawGrid.y, GRID_BOUNDS.minY, GRID_BOUNDS.maxY, RUBBERBAND_DIM, RUBBERBAND_COEFF),
    };
    const [wx, , wz] = gridToWorld(softGrid);
    const id = phase.candidate.object.id;

    const visual = visualFor(id);
    if (visual.pose) {
      visual.pose.x = wx;
      visual.pose.z = wz;
    }
    setTarget(id, { pose: { x: wx, y: LIFT_Y, z: wz, tiltRad: 0 } });

    const now = performance.now();
    phase.samples.push({ t: now, x: wx, z: wz });
    if (phase.samples.length > VELOCITY_SAMPLES) phase.samples.shift();
  });

  return null;
}
