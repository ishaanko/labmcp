import { spawnDrop, spawnRipple, spawnStream } from "../effectsStore";
import { rgbaToHex } from "../textures";
import { setTarget } from "../visualStore";
import type { Schedule, Vec3, VesselSnapshot } from "../animationQueue";

export interface DrainSource extends VesselSnapshot {
  /** World-space tip of the burette, where drops and streams originate. */
  readonly tip: Vec3;
}

export interface DrainTarget extends VesselSnapshot {
  /** World-space point on the target's liquid surface, where drops land. */
  readonly meniscus: Vec3;
}

const DROP_MS = 120;
const RIPPLE_MS = 160;
/** Sub-steps for the >1 mL linear ramp; kept low enough that one dispense never trips its own
 * queue's backpressure (C5.2 kicks in above 3 pending actions). */
const STREAM_STEPS = 4;

/**
 * Burette dispense (C5 `DRAIN_BURETTE`). <=1 mL reads as a single drop falling `t²` to the
 * meniscus, landing with a ripple and stepping both volumes at once. >1 mL reads as a brief
 * stream with both volumes ramped linearly across it. Consecutive drains onto the same target
 * coalesce for free: the queue's backpressure (`animationQueue.ts`) doubles speed past 3
 * pending actions and flushes straight to canonical past 6, so a burst of fast dispenses never
 * queues an actual backlog of separate animations.
 */
export function drainJob(schedule: Schedule, burette: DrainSource, target: DrainTarget, ml: number, reducedMotion: boolean): void {
  if (reducedMotion) {
    setTarget(burette.id, { displayedVolumeMl: burette.volumeMl, displayedColor: burette.color });
    setTarget(target.id, { displayedVolumeMl: target.volumeMl, displayedColor: target.color });
    return;
  }

  const colorHex = rgbaToHex(target.color);

  if (ml <= 1) {
    spawnDrop(burette.tip, target.meniscus, colorHex, DROP_MS, burette.id);
    schedule(target.id, DROP_MS, () => {
      setTarget(burette.id, { displayedVolumeMl: burette.volumeMl, displayedColor: burette.color });
      setTarget(target.id, { displayedVolumeMl: target.volumeMl, displayedColor: target.color });
      spawnRipple(target.meniscus, colorHex, RIPPLE_MS);
    });
    return;
  }

  const durationMs = Math.min(400, Math.max(160, 120 + ml * 30));
  spawnStream(burette.tip, target.meniscus, colorHex, durationMs, burette.id);

  const targetStart = target.volumeMl - ml;
  const buretteStart = burette.volumeMl + ml;
  for (let i = 1; i <= STREAM_STEPS; i++) {
    const t = i / STREAM_STEPS;
    schedule(target.id, durationMs * t, () => {
      setTarget(target.id, { displayedVolumeMl: targetStart + ml * t, displayedColor: target.color });
      setTarget(burette.id, { displayedVolumeMl: buretteStart - ml * t, displayedColor: burette.color });
    });
  }
}
