import { nowMs } from "../effectsStore";
import { colorTweens, setTarget, type Rgba01 } from "../visualStore";
import type { Schedule } from "../animationQueue";

/** The phenolphthalein endpoint beat (C5 `COLOR_SHIFT`, C7): the only long beat in the app. */
const BEAT_MS = 800;
const REDUCED_MS = 150;

/**
 * An indicator crossing its transition (C5: `indicatorTransition`). Unlike a plain `COLOR_SHIFT`,
 * which just retargets `displayedColor` for the driver's usual exponential damp, this runs a
 * timed ease-in-out tween (`VisualDriver` reads `colorTweens`) and lifts `meniscusBoost` for the
 * same window, scheduled back to 0 once the beat ends.
 */
export function colorShiftJob(schedule: Schedule, id: string, from: Rgba01, to: Rgba01, reducedMotion: boolean): void {
  const durationMs = reducedMotion ? REDUCED_MS : BEAT_MS;
  colorTweens.set(id, { from: { ...from }, to, startMs: nowMs(), durationMs });
  setTarget(id, { displayedColor: to, meniscusBoost: 1 });
  schedule(id, durationMs, () => setTarget(id, { meniscusBoost: 0 }));
}
