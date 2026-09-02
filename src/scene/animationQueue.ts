import {
  assertNever,
  deriveColor,
  speciesDef,
  type Container,
  type LabEvent,
  type LabState,
  type PrecipitateScale,
  type SolidDeposit,
} from "@/engine";
import { setAnimationSink, type AnimationBatch } from "@/lib/events";
import { useLabStore } from "@/store/labStore";
import { gridToWorld } from "@/components/bench/Bench";
import { buretteTipWorld } from "@/components/glassware/Burette";
import { heightForVolume, profileForContainerType } from "./profiles";
import { colorTweens, defaultVisual, dropVisual, setTarget, targets, visualFor, visuals, type PrecipitateVisual, type Rgba01 } from "./visualStore";
import { rgbaToHex, rgbaToRgba01 } from "./textures";
import { bubblesJob } from "./jobs/bubbles";
import { colorShiftJob } from "./jobs/colorShift";
import { drainJob } from "./jobs/drain";
import { pourJob } from "./jobs/pour";
import { precipitateJob } from "./jobs/precipitate";
import { indicatorJob, reagentJob } from "./jobs/reagent";
import { stirJob } from "./jobs/stir";

/**
 * The animation queue (Appendix C5): turns committed engine events (plus a fallback diff for
 * undo/reset) into `visualStore` targets. One scheduling queue per vessel id; jobs only ever
 * call `setTarget`, so cancelling or coalescing is free: the next call just moves the target
 * again and the driver's damp carries the visual from wherever it currently is.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface VesselSnapshot {
  readonly id: string;
  readonly volumeMl: number;
  readonly color: Rgba01;
}

export type Schedule = (id: string, delayMs: number, run: () => void) => void;

interface ScheduledAction {
  readonly atMs: number;
  readonly run: () => void;
}

const queues = new Map<string, ScheduledAction[]>();
const ringPulses = new Map<string, { fallAtMs: number }>();
let elapsedMs = 0;

function queueFor(id: string): ScheduledAction[] {
  let q = queues.get(id);
  if (!q) {
    q = [];
    queues.set(id, q);
  }
  return q;
}

/**
 * Backpressure (C5): >3 pending actions doubles new ones' speed, >6 flushes straight to final.
 * Flushing runs every pending action instead of dropping it: jobs only ever call `setTarget`, so
 * running them is cheap and idempotent, and it's the only way the queue's own terminators
 * (`stirring: 0`, `bubbleIntensity: 0`, `dropVisual`) are guaranteed to still land.
 */
const schedule: Schedule = (id, delayMs, run) => {
  const q = queueFor(id);
  if (q.length > 6) {
    const pending = q.splice(0, q.length).sort((a, b) => a.atMs - b.atMs);
    for (const action of pending) action.run();
    run();
    return;
  }
  const speed = q.length > 3 ? 2 : 1;
  q.push({ atMs: elapsedMs + delayMs / speed, run });
  q.sort((a, b) => a.atMs - b.atMs);
};

export function tick(dt: number): void {
  elapsedMs += dt * 1000;
  for (const q of queues.values()) {
    while (q.length > 0) {
      const head = q[0];
      if (!head || head.atMs > elapsedMs) break;
      q.shift();
      head.run();
    }
  }
  for (const [id, pulse] of ringPulses) {
    if (elapsedMs >= pulse.fallAtMs) {
      setTarget(id, { agentRing: 0 });
      ringPulses.delete(id);
    }
  }
}

/**
 * Called by the drag lane when a human grabs an object (C5: "human drag cancels any job
 * holding that object"). Clears `objectId`'s pending scheduled actions (pour stages, drain
 * ramps, terminators) and returns its pose target to null so the vessel's rest position takes
 * over immediately; the drag lane then drives position/rotation itself.
 */
export function cancelPoseJobs(objectId: string): void {
  queues.delete(objectId);
  setTarget(objectId, { pose: null });
}

/** How long the ring holds at peak before decaying; long enough to register in a screen recording. */
const RING_HOLD_MS = 1600;

function pulseAgentRing(id: string | undefined): void {
  if (!id) return;
  ringPulses.set(id, { fallAtMs: elapsedMs + RING_HOLD_MS });
  setTarget(id, { agentRing: 0.9 });
}

function findContainer(state: LabState, id: string): Container | undefined {
  const obj = state.objects.find((o) => o.id === id);
  return obj && obj.kind === "container" ? obj : undefined;
}

function snapshotOf(container: Container): VesselSnapshot {
  return { id: container.id, volumeMl: container.volumeMl, color: rgbaToRgba01(deriveColor(container)) };
}

/** World-space point on a container's current liquid surface, for drop/stream landing points (C3.7). */
function meniscusWorld(container: Container, displayedVolumeMl: number): Vec3 {
  const [x, y, z] = gridToWorld(container.position);
  const profile = profileForContainerType(container.type);
  return { x, y: y + heightForVolume(profile, displayedVolumeMl), z };
}

/** World-space point 0.6 above a container's rim, where a poured-in stream/drops originate (C3.7). */
function rimWorld(container: Container): Vec3 {
  const [x, y, z] = gridToWorld(container.position);
  const profile = profileForContainerType(container.type);
  return { x, y: y + profile.capacityHeight + 0.6, z };
}

const PRECIPITATE_AMOUNT: Readonly<Record<PrecipitateScale, number>> = {
  trace: 0.15,
  small: 0.4,
  moderate: 0.7,
  heavy: 1,
};

/** Approximates a container's solids as one visual for the undo/reset diff fallback. */
function solidsToVisual(solids: ReadonlyArray<SolidDeposit>): PrecipitateVisual | null {
  const first = solids[0];
  if (!first) return null;
  const def = speciesDef(first.species);
  const color = def && def.kind === "solid" ? rgbaToHex(def.color) : "#ebe7dd";
  const amount = Math.min(1, 0.3 + first.moles * 50);
  return { color, amount, settled: 1 - first.suspended };
}

/** The container/instrument an event is "about", used to place the agent-presence ring. */
function eventTargetId(event: LabEvent): string | undefined {
  switch (event.kind) {
    case "OBJECT_PLACED":
    case "OBJECT_REMOVED":
    case "OBJECT_MOVED":
      return event.objectId;
    case "INSTRUMENT_ATTACHED":
      return event.instrumentId;
    case "LIQUID_ADDED":
    case "LIQUID_TRANSFERRED":
    case "INDICATOR_ADDED":
    case "STIR_STARTED":
    case "THERMAL_SET":
    case "MEASUREMENT":
    case "CONTENTS_INSPECTED":
    case "REACTION":
    case "COLOR_SHIFT":
    case "PRECIPITATE_FORMED":
    case "BUBBLES":
    case "TEMPERATURE_CHANGE":
    case "PH_CHANGE":
    case "NO_REACTION":
    case "SOLIDS_SETTLED":
    case "DISPOSED":
    case "OVERFLOW_REJECTED":
      return "containerId" in event ? event.containerId : undefined;
    case "UNDONE":
    case "RESET":
    case "SCENARIO_LOADED":
    case "SCENARIO_REVEALED":
    case "COMMAND_REJECTED":
      return undefined;
    default:
      return assertNever(event);
  }
}

/** Snaps every container to its canonical visual instantly; used for reset/scenario load. */
export function clear(lab: LabState): void {
  queues.clear();
  ringPulses.clear();
  visuals.clear();
  targets.clear();
  colorTweens.clear();
  for (const obj of lab.objects) {
    if (obj.kind !== "container") continue;
    const v = defaultVisual();
    v.displayedVolumeMl = obj.volumeMl;
    v.displayedColor = rgbaToRgba01(deriveColor(obj));
    v.temperatureC = obj.temperatureC;
    v.precipitate = solidsToVisual(obj.solids);
    visuals.set(obj.id, v);
    // `v` (a fresh `defaultVisual()`) already carries every `VisualTarget` field; copy rather
    // than alias it so the driver's damp never mutates the target it is chasing.
    targets.set(obj.id, { ...v });
  }
}

function handlePlaced(objectId: string): void {
  const visual = visualFor(objectId);
  visual.opacity = 0.45;
  setTarget(objectId, { opacity: 1 });
}

function handleRemoved(objectId: string): void {
  setTarget(objectId, { opacity: 0 });
  schedule(objectId, 300, () => dropVisual(objectId));
}

function handleLiquidTransferred(prev: LabState, next: LabState, fromId: string, toId: string, volumeMl: number, reducedMotion: boolean): void {
  const prevFrom = findContainer(prev, fromId);
  const nextFrom = findContainer(next, fromId);
  const nextTo = findContainer(next, toId);
  if (!prevFrom || !nextFrom || !nextTo) return;

  if (prevFrom.type === "burette") {
    const [tx, ty, tz] = buretteTipWorld(gridToWorld(prevFrom.position));
    drainJob(
      schedule,
      { ...snapshotOf(nextFrom), tip: { x: tx, y: ty, z: tz } },
      { ...snapshotOf(nextTo), meniscus: meniscusWorld(nextTo, visualFor(toId).displayedVolumeMl) },
      volumeMl,
      reducedMotion,
    );
    return;
  }
  const restPose = gridToWorld(prevFrom.position);
  const toPos = gridToWorld(nextTo.position);
  pourJob(
    schedule,
    { ...snapshotOf(nextFrom), restPose: { x: restPose[0], y: restPose[1], z: restPose[2] } },
    { ...snapshotOf(nextTo), pos: { x: toPos[0], y: toPos[1], z: toPos[2] }, meniscus: meniscusWorld(nextTo, visualFor(toId).displayedVolumeMl) },
    volumeMl,
    reducedMotion,
  );
}

function handleEvent(event: LabEvent, prev: LabState, next: LabState, reducedMotion: boolean, touched: Set<string>): void {
  switch (event.kind) {
    case "OBJECT_PLACED":
      handlePlaced(event.objectId);
      touched.add(event.objectId);
      return;
    case "OBJECT_REMOVED":
      handleRemoved(event.objectId);
      touched.add(event.objectId);
      return;
    case "OBJECT_MOVED":
      return;
    case "INSTRUMENT_ATTACHED":
      return;
    case "LIQUID_ADDED": {
      const container = findContainer(next, event.containerId);
      if (container) {
        const preVolumeMl = visualFor(event.containerId).displayedVolumeMl;
        reagentJob(
          schedule,
          { ...snapshotOf(container), rim: rimWorld(container), meniscus: meniscusWorld(container, preVolumeMl) },
          event.volumeMl,
          reducedMotion,
        );
      }
      touched.add(event.containerId);
      return;
    }
    case "LIQUID_TRANSFERRED":
      handleLiquidTransferred(prev, next, event.fromId, event.toId, event.volumeMl, reducedMotion);
      touched.add(event.fromId);
      touched.add(event.toId);
      return;
    case "INDICATOR_ADDED": {
      const container = findContainer(next, event.containerId);
      if (container) {
        const colorHex = rgbaToHex(deriveColor(container));
        const preVolumeMl = visualFor(event.containerId).displayedVolumeMl;
        indicatorJob(schedule, { id: event.containerId, rim: rimWorld(container), meniscus: meniscusWorld(container, preVolumeMl), colorHex }, reducedMotion);
      }
      return;
    }
    case "STIR_STARTED":
      stirJob(schedule, event.containerId, event.durationS, reducedMotion);
      return;
    case "THERMAL_SET":
      return;
    case "MEASUREMENT":
    case "CONTENTS_INSPECTED":
    case "REACTION":
      return;
    case "COLOR_SHIFT": {
      const to = rgbaToRgba01(event.to);
      if (event.indicatorTransition) {
        colorShiftJob(schedule, event.containerId, visualFor(event.containerId).displayedColor, to, reducedMotion);
      } else {
        setTarget(event.containerId, { displayedColor: to });
      }
      touched.add(event.containerId);
      return;
    }
    case "PRECIPITATE_FORMED":
      precipitateJob(event.containerId, rgbaToHex(event.color), PRECIPITATE_AMOUNT[event.scale] ?? 0.4, reducedMotion);
      touched.add(event.containerId);
      return;
    case "BUBBLES":
      bubblesJob(schedule, event.containerId, event.intensity, event.durationS, reducedMotion);
      return;
    case "TEMPERATURE_CHANGE":
      setTarget(event.containerId, { temperatureC: event.toC });
      touched.add(event.containerId);
      return;
    case "PH_CHANGE":
    case "NO_REACTION":
      return;
    case "SOLIDS_SETTLED": {
      const current = visualFor(event.containerId).precipitate;
      if (current) setTarget(event.containerId, { precipitate: { ...current, settled: 1 } });
      return;
    }
    case "DISPOSED":
      handleRemoved(event.containerId);
      touched.add(event.containerId);
      return;
    case "UNDONE":
    case "SCENARIO_REVEALED":
    case "OVERFLOW_REJECTED":
    case "COMMAND_REJECTED":
      return;
    case "RESET":
    case "SCENARIO_LOADED":
      // Handled up front in enqueue(); reaching here would double-clear, which is harmless but wasteful.
      return;
    default:
      return assertNever(event);
  }
}

function diffUntouched(prev: LabState, next: LabState, touched: ReadonlySet<string>): void {
  const EPS_VOL = 1e-6;
  const EPS_TEMP = 0.01;
  for (const obj of next.objects) {
    if (obj.kind !== "container" || touched.has(obj.id)) continue;
    const before = findContainer(prev, obj.id);
    if (!before) continue;
    const volumeChanged = Math.abs(before.volumeMl - obj.volumeMl) > EPS_VOL;
    const tempChanged = Math.abs(before.temperatureC - obj.temperatureC) > EPS_TEMP;
    const solidsChanged = JSON.stringify(before.solids) !== JSON.stringify(obj.solids);
    if (!volumeChanged && !tempChanged && !solidsChanged) continue;
    setTarget(obj.id, {
      displayedVolumeMl: obj.volumeMl,
      displayedColor: rgbaToRgba01(deriveColor(obj)),
      temperatureC: obj.temperatureC,
      precipitate: solidsToVisual(obj.solids),
    });
  }
}

export function enqueue(args: AnimationBatch): void {
  const resetting = args.events.some((o) => o.event.kind === "RESET" || o.event.kind === "SCENARIO_LOADED");
  if (resetting) {
    clear(args.next);
    return;
  }

  const reducedMotion = useLabStore.getState().ui.reducedMotion;
  const touched = new Set<string>();
  for (const obs of args.events) {
    handleEvent(obs.event, args.prev, args.next, reducedMotion, touched);
  }
  diffUntouched(args.prev, args.next, touched);

  if (args.actor === "agent") {
    const last = args.events[args.events.length - 1];
    pulseAgentRing(last ? eventTargetId(last.event) : undefined);
  }
}

setAnimationSink(enqueue);
