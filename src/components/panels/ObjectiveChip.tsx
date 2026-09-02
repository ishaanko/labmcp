"use client";

import { Target } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import { selectObjectiveSteps } from "@/store/selectors";
import { scenarioObjective } from "@/engine";
import { Chip } from "@/components/ui/Chip";

/** Guided scenarios only: goal sentence + step progress ("Find [HCl] · 2/4"). */
export function ObjectiveChip() {
  const scenarioId = useLabStore((s) => s.lab.scenario.kind);
  const steps = useLabStore(selectObjectiveSteps);

  if (scenarioId !== "titration") return null;

  const done = steps.filter((step) => step.done).length;

  return (
    <Chip tone="accent" className="hidden sm:inline-flex">
      <Target size={12} />
      {scenarioObjective(scenarioId)}
      <span className="tabular text-accent-ink/70">
        {done}/{steps.length}
      </span>
    </Chip>
  );
}
