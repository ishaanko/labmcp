"use client";

import { useLabStore } from "@/store/labStore";
import { selectObjective } from "@/store/selectors";
import { SCENARIO_TITLES } from "@/engine";

/**
 * Guided scenarios only: the scenario's short title, plus step progress ("2/4"), plain text in
 * the top bar. Amber is reserved for agent presence and heat, so this reads in ink, not accent.
 */
export function ObjectiveChip() {
  const scenarioId = useLabStore((s) => s.lab.scenario.kind);
  const progress = useLabStore(selectObjective);

  if (!progress) return null;

  const done = progress.steps.filter((step) => step.done).length;

  return (
    <p className="hidden min-w-0 items-center gap-1.5 truncate text-sm text-foreground/80 sm:flex">
      {SCENARIO_TITLES[scenarioId]}
      {progress.steps.length > 0 ? (
        <span className="tabular shrink-0 text-muted-foreground">
          {done}/{progress.steps.length}
        </span>
      ) : null}
    </p>
  );
}
