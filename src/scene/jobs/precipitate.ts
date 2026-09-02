import { setTarget, visualFor } from "../visualStore";

/**
 * A precipitate forming (C5 `PRECIPITATE`): amount ramps up quickly, settled ramps down to the
 * floor slowly. A second precipitation of the same species adds to the existing amount and
 * kicks settled back down (freshly formed solid is suspended again); a different species
 * replaces the visual outright.
 */
export function precipitateJob(id: string, colorHex: string, addedAmount: number, reducedMotion: boolean): void {
  const visual = visualFor(id);
  const current = visual.precipitate;
  const sameSpecies = current?.color === colorHex;
  const baseAmount = sameSpecies && current ? current.amount : 0;
  const resetSettled = sameSpecies && current ? Math.min(current.settled, 0.4) : 0;
  const finalAmount = Math.min(1, baseAmount + addedAmount);

  visual.precipitate = { color: colorHex, amount: baseAmount, settled: resetSettled };
  setTarget(id, { precipitate: { color: colorHex, amount: finalAmount, settled: 1 } });

  if (reducedMotion) {
    visual.precipitate = { color: colorHex, amount: finalAmount, settled: 1 };
  }
}
