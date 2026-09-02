import { setTarget } from "../visualStore";
import type { Schedule } from "../animationQueue";

/** Gas evolving (C5 `BUBBLES`): rises to `intensity`, holds for the event's duration, decays. */
export function bubblesJob(schedule: Schedule, id: string, intensity: number, durationS: number, reducedMotion: boolean): void {
  // Reduced motion keeps bubbling static rather than animated (C5), at a muted intensity, but
  // still schedules the terminator so the vessel doesn't bubble forever.
  setTarget(id, { bubbleIntensity: reducedMotion ? intensity * 0.4 : intensity });
  schedule(id, Math.max(0, durationS * 1000), () => setTarget(id, { bubbleIntensity: 0 }));
}
