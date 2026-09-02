import { setTarget } from "../visualStore";
import type { Schedule, VesselSnapshot } from "../animationQueue";

/**
 * Burette dispense (C5 `DRAIN_BURETTE`). Both containers just get their canonical volume/color
 * as the new target; the driver's damp does the motion, so repeated fast dispenses onto the
 * same target coalesce for free (the target simply moves again before the damp arrives).
 * Small dispenses (<=1 mL) delay the level change to read as a drop falling and landing;
 * larger ones delay it to read as a brief stream.
 */
export function drainJob(
  schedule: Schedule,
  burette: VesselSnapshot,
  target: VesselSnapshot,
  ml: number,
  reducedMotion: boolean,
): void {
  const apply = (): void => {
    setTarget(burette.id, { displayedVolumeMl: burette.volumeMl, displayedColor: burette.color });
    setTarget(target.id, { displayedVolumeMl: target.volumeMl, displayedColor: target.color });
  };
  if (reducedMotion) {
    apply();
    return;
  }
  const delayMs = ml <= 1 ? 120 : Math.min(400, Math.max(160, 120 + ml * 30));
  schedule(target.id, delayMs, apply);
}
