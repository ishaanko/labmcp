"use client";

import { useLabStore } from "@/store/labStore";
import { selectObjectiveSteps } from "@/store/selectors";
import { scenarioObjective } from "@/engine";

/**
 * Guided scenarios only: goal sentence + step progress ("Find [HCl] · 2/4"), plain text in
 * the top bar. Amber is reserved for agent presence and heat, so this reads in ink, not accent.
 */
export function ObjectiveChip() {
  const scenarioId = useLabStore((s) => s.lab.scenario.kind);
  const steps = useLabStore(selectObjectiveSteps);

  if (scenarioId !== "titration") return null;

  const done = steps.filter((step) => step.done).length;

  return (
    <p className="hidden min-w-0 items-center gap-1.5 truncate text-sm text-ink-2 sm:flex">
      {scenarioObjective(scenarioId)}
      <span className="tabular shrink-0 text-ink-3">
        {done}/{steps.length}
      </span>
    </p>
  );
}
