import { spawnDrop, spawnStream } from "../effectsStore";
import { rgbaToHex } from "../textures";
import { setTarget } from "../visualStore";
import type { Schedule, Vec3, VesselSnapshot } from "../animationQueue";

const DROP_COUNT = 3;
const DROP_INTERVAL_MS = 80;
const DROP_MS = 120;

export interface ReagentTarget extends VesselSnapshot {
  /** World-space point 0.6 above the rim, where the stream/drops originate. */
  readonly rim: Vec3;
  /** World-space point on the liquid surface, where the stream/drops land. */
  readonly meniscus: Vec3;
}

/**
 * Adding a reagent or pouring from the shelf (C5 `ADD_REAGENT`): the stream takes a beat to
 * reach the liquid, so the volume/color target lands a little after the command commits.
 */
export function reagentJob(schedule: Schedule, target: ReagentTarget, ml: number, reducedMotion: boolean): void {
  const apply = (): void => setTarget(target.id, { displayedVolumeMl: target.volumeMl, displayedColor: target.color });
  if (reducedMotion) {
    apply();
    return;
  }
  const delayMs = Math.min(400, Math.max(200, 160 + ml * 4));
  spawnStream(target.rim, target.meniscus, rgbaToHex(target.color), delayMs);
  schedule(target.id, delayMs, apply);
}

/** Adding an indicator (C5 `ADD_REAGENT`, indicator variant): 3 drops at 80ms, no volume change. */
export function indicatorJob(
  schedule: Schedule,
  target: { readonly id: string; readonly rim: Vec3; readonly meniscus: Vec3; readonly colorHex: string },
  reducedMotion: boolean,
): void {
  if (reducedMotion) return;
  for (let i = 0; i < DROP_COUNT; i++) {
    schedule(target.id, i * DROP_INTERVAL_MS, () => spawnDrop(target.rim, target.meniscus, target.colorHex, DROP_MS));
  }
}
