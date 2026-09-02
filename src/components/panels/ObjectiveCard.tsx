"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { checkTitrationAnswer, estimateEquivalenceMl, titrationSolution } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectObjectiveSteps, selectPublic, selectTitration, type ObjectiveStep } from "@/store/selectors";
import { Button } from "@/components/ui/button";

const CHECK_PATH_LENGTH = 20;

/**
 * Right-panel titration guide: 4-step checklist and the reveal moment. Shown when nothing is
 * selected in the titration scenario; the goal sentence itself lives in `ObjectiveChip`.
 */
export function ObjectiveCard() {
  const steps = useLabStore(selectObjectiveSteps);
  const titration = useLabStore(selectTitration);
  const pub = useLabStore(selectPublic);
  const lab = useLabStore((s) => s.lab);
  const dispatch = useLabStore((s) => s.dispatch);
  const [revealing, setRevealing] = useState(false);

  if (pub.scenario.kind !== "titration") return null;
  const endpointDone = steps.find((s) => s.key === "endpoint")?.done ?? false;
  const revealed = pub.scenario.revealed;

  const reveal = (): void => {
    setRevealing(true);
    void dispatch({ kind: "REVEAL" }, "human").finally(() => setRevealing(false));
  };

  const estimateMl = titration ? estimateEquivalenceMl(titration.curve) : null;
  const solution = revealed ? titrationSolution(lab) : null;
  const claimedM = estimateMl !== null && pub.scenario.titrantM > 0 ? (pub.scenario.titrantM * estimateMl) / pub.scenario.analyteMl : null;
  const verdict = revealed && claimedM !== null ? checkTitrationAnswer(lab, claimedM) : null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">Objective</h2>

      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </ul>

      {!revealed ? (
        <Button variant={endpointDone ? "default" : "ghost"} size="sm" disabled={revealing} onClick={reveal} className="w-fit">
          {endpointDone ? "Reveal result" : "Reveal anyway"}
        </Button>
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">True concentration</p>
          <p className="tabular text-2xl text-foreground">{solution ? solution.analyteM.toFixed(4) : "–"} M</p>
          {verdict && claimedM !== null ? (
            <p className={clsx("mt-1 text-sm", verdict.correct ? "text-emerald-400" : "text-destructive")}>
              Curve estimate {claimedM.toFixed(4)} M, {(verdict.relError * 100).toFixed(1)}% off.
              {verdict.correct ? " Within tolerance." : " Outside tolerance."}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No equivalence estimate yet; dispense past the endpoint to get one.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StepRow({ step }: { step: ObjectiveStep }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <svg viewBox="0 0 16 16" width={16} height={16} className="shrink-0" aria-hidden="true">
        <circle cx={8} cy={8} r={7} fill="none" strokeWidth={1.5} className={step.done ? "stroke-emerald-400" : "stroke-border"} />
        <path
          d="M4.5 8.3 L7 10.8 L11.5 5.5"
          fill="none"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-emerald-400"
          style={{
            strokeDasharray: CHECK_PATH_LENGTH,
            strokeDashoffset: step.done ? 0 : CHECK_PATH_LENGTH,
            transition: "stroke-dashoffset 200ms var(--ease-out)",
          }}
        />
      </svg>
      <span className={step.done ? "text-muted-foreground line-through" : "text-foreground"}>{step.label}</span>
    </li>
  );
}
