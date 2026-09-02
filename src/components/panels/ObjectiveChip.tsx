"use client";

import { useLabStore } from "@/store/labStore";
import { selectObjectiveSteps } from "@/store/selectors";
import { scenarioObjective } from "@/engine";

/**
 * Guided scenarios only: goal sentence, plus step progress ("2/4") where the scenario has steps,
 * plain text in the top bar. Amber is reserved for agent presence and heat, so this reads in
 * ink, not accent.
 */
export function ObjectiveChip() {
  const scenarioId = useLabStore((s) => s.lab.scenario.kind);
  const steps = useLabStore(selectObjectiveSteps);

  if (scenarioId === "sandbox") return null;

  const done = steps.filter((step) => step.done).length;

  return (
    <p className="hidden min-w-0 items-center gap-1.5 truncate text-sm text-foreground/80 sm:flex">
      {scenarioObjective(scenarioId)}
      {steps.length > 0 ? (
        <span className="tabular shrink-0 text-muted-foreground">
          {done}/{steps.length}
        </span>
      ) : null}
    </p>
  );
}
