import { setTarget } from "../visualStore";
import type { Schedule, VesselSnapshot } from "../animationQueue";

/**
 * Adding a reagent or pouring from the shelf (C5 `ADD_REAGENT`): the stream takes a beat to
 * reach the liquid, so the volume/color target lands a little after the command commits.
 */
export function reagentJob(schedule: Schedule, container: VesselSnapshot, ml: number, reducedMotion: boolean): void {
  const apply = (): void => setTarget(container.id, { displayedVolumeMl: container.volumeMl, displayedColor: container.color });
  if (reducedMotion) {
    apply();
    return;
  }
  const delayMs = Math.min(400, Math.max(200, 160 + ml * 4));
  schedule(container.id, delayMs, apply);
}
