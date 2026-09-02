/**
 * Transient liquid effects (C3.7: stream, drop, ripple). Lives outside React for the same
 * reason `visualStore` does: jobs spawn these from inside `animationQueue` scheduler callbacks,
 * never from a render. Unlike `visualStore`'s per-frame damping, effect membership only changes
 * a handful of times per pour or dispense, so `Effects.tsx` subscribes with
 * `useSyncExternalStore` instead of touching React state every frame; `pruneEffects` runs from
 * `useFrame` on this module's plain array and only notifies when something actually expired.
 */

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface EffectBase {
  readonly id: number;
  readonly color: string;
  readonly startedAt: number;
  readonly durationMs: number;
}

export interface StreamEffect extends EffectBase {
  readonly kind: "stream";
  readonly from: Point3;
  readonly to: Point3;
  /** Burette this stream drains from, if any; drives the stopcock lever (C3.5). */
  readonly sourceId?: string;
}

export interface DropEffect extends EffectBase {
  readonly kind: "drop";
  readonly from: Point3;
  readonly to: Point3;
  readonly sourceId?: string;
}

export interface RippleEffect extends EffectBase {
  readonly kind: "ripple";
  readonly at: Point3;
}

export type Effect = StreamEffect | DropEffect | RippleEffect;

let effects: ReadonlyArray<Effect> = [];
let nextId = 1;
const listeners = new Set<() => void>();

/** A clock effects can share between spawn time and each frame's elapsed check. */
export function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeEffects(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listEffects(): ReadonlyArray<Effect> {
  return effects;
}

export function spawnStream(from: Point3, to: Point3, color: string, durationMs: number, sourceId?: string): void {
  effects = [...effects, { id: nextId++, kind: "stream", from, to, color, startedAt: nowMs(), durationMs, sourceId }];
  notify();
}

export function spawnDrop(from: Point3, to: Point3, color: string, durationMs: number, sourceId?: string): void {
  effects = [...effects, { id: nextId++, kind: "drop", from, to, color, startedAt: nowMs(), durationMs, sourceId }];
  notify();
}

export function spawnRipple(at: Point3, color: string, durationMs: number): void {
  effects = [...effects, { id: nextId++, kind: "ripple", at, color, startedAt: nowMs(), durationMs }];
  notify();
}

/** Drops expired effects; called once per frame from `Effects.tsx`. */
export function pruneEffects(t: number): void {
  const live = effects.filter((e) => t - e.startedAt < e.durationMs);
  if (live.length !== effects.length) {
    effects = live;
    notify();
  }
}

/** Whether `sourceId` (a burette) has a live stream or drop, for the stopcock lever (C3.5). */
export function isSourceActive(sourceId: string, t: number): boolean {
  return effects.some((e) => (e.kind === "stream" || e.kind === "drop") && e.sourceId === sourceId && t - e.startedAt < e.durationMs);
}

/** Test-only reset; mirrors `visualStore`'s maps having no shared teardown either. */
export function clearEffects(): void {
  effects = [];
  notify();
}
