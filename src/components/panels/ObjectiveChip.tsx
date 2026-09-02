"use client";

import { useLabStore } from "@/store/labStore";
import { selectObjectiveSteps } from "@/store/selectors";
import { scenarioObjective, type ScenarioId } from "@/engine";

/**
 * Top-bar goal text for titration: a short phrase, not the full sentence (that lives in
 * `ObjectiveCard`, the right panel's titration guide). Every other guided scenario falls back to
 * its full sentence, since it has nowhere else to show it.
 */
const SHORT_OBJECTIVE: Partial<Record<ScenarioId, string>> = {
  titration: "Find the acid's concentration",
};

/**
 * Guided scenarios only: short goal phrase, plus step progress ("2/4") where the scenario has
 * steps, plain text in the top bar. Amber is reserved for agent presence and heat, so this reads
 * in ink, not accent.
 */
export function ObjectiveChip() {
  const scenarioId = useLabStore((s) => s.lab.scenario.kind);
  const steps = useLabStore(selectObjectiveSteps);

  if (scenarioId === "sandbox") return null;
  const short = SHORT_OBJECTIVE[scenarioId] ?? scenarioObjective(scenarioId);

  const done = steps.filter((step) => step.done).length;

  return (
    <p className="hidden min-w-0 items-center gap-1.5 truncate text-sm text-foreground/80 sm:flex">
      {short}
      {steps.length > 0 ? (
        <span className="tabular shrink-0 text-muted-foreground">
          {done}/{steps.length}
        </span>
      ) : null}
    </p>
  );
}
