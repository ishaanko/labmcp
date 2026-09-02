"use client";

import { useLabStore } from "@/store/labStore";
import { selectObjective } from "@/store/selectors";

/**
 * Guided scenarios only: step progress ("2/4") in plain text beside the scenario menu, which
 * already names the scenario. Amber is reserved for agent presence and heat, so this reads in ink.
 */
export function ObjectiveChip() {
  const progress = useLabStore(selectObjective);

  if (!progress || progress.steps.length === 0) return null;

  const done = progress.steps.filter((step) => step.done).length;

  return (
    <p className="tabular hidden shrink-0 text-sm text-muted-foreground sm:block">
      {done}/{progress.steps.length}
    </p>
  );
}
