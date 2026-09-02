import { setTarget, visualFor } from "../visualStore";
import type { Schedule } from "../animationQueue";

/**
 * Stirring (C5 `STIR`): swirl ramps up and holds for the duration, then settles back down.
 * Any suspended solid is pulled back up toward suspension while stirring is active.
 */
export function stirJob(schedule: Schedule, id: string, durationS: number, reducedMotion: boolean): void {
  const precipitate = visualFor(id).precipitate;
  if (precipitate) setTarget(id, { precipitate: { ...precipitate, settled: 0.25 } });

  setTarget(id, { stirring: 1 });
  const holdMs = reducedMotion ? durationS * 1000 : Math.max(0, durationS * 1000 - 500);
  schedule(id, holdMs, () => setTarget(id, { stirring: 0 }));
}
