"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { PublicScenario } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectObjective, selectPublic } from "@/store/selectors";
import { Button } from "@/components/ui/button";
import { DilutionReadout } from "./DilutionReadout";
import { NeutralizeReadout } from "./NeutralizeReadout";
import { ObjectiveReveal } from "./ObjectiveReveal";
import { SolubilityReadout } from "./SolubilityReadout";
import { TitrationCurve } from "./TitrationCurve";
import { TitrationReadouts } from "./TitrationReadouts";

const CHECK_PATH_LENGTH = 20;

type Revealable = Extract<PublicScenario, { kind: "titration" | "unknown_id" | "neutralize" }>;

/** Only these three scenarios hide an answer key behind REVEAL; the rest complete from state alone. */
function isRevealable(scenario: PublicScenario): scenario is Revealable {
  return scenario.kind === "titration" || scenario.kind === "unknown_id" || scenario.kind === "neutralize";
}

/**
 * Right-panel objective guide, shown for every scenario except sandbox: the objective sentence,
 * a checklist from the engine's `scenarioProgress`, a detail line, scenario-specific live
 * readouts, and the reveal moment where the scenario has a secret to uncover.
 */
export function ObjectiveCard() {
  const progress = useLabStore(selectObjective);
  const pub = useLabStore(selectPublic);
  const dispatch = useLabStore((s) => s.dispatch);
  const [revealing, setRevealing] = useState(false);

  const scenario = pub.scenario;
  if (!progress || scenario.kind === "sandbox") return null;

  const reveal = (): void => {
    setRevealing(true);
    void dispatch({ kind: "REVEAL" }, "human").finally(() => setRevealing(false));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <p className={clsx("text-sm", progress.complete ? "text-mint" : "text-foreground")}>{progress.objective}</p>
        {progress.complete ? <span className="shrink-0 text-xs font-medium text-mint">Complete</span> : null}
      </div>

      <ul className="flex flex-col gap-2">
        {progress.steps.map((step, i) => (
          <StepRow key={`${i}-${step.label}`} label={step.label} done={step.done} />
        ))}
      </ul>

      {progress.detail ? <p className="text-sm text-muted-foreground">{progress.detail}</p> : null}

      {scenario.kind === "titration" ? (
        <>
          <TitrationReadouts />
          <TitrationCurve />
        </>
      ) : null}
      {scenario.kind === "neutralize" ? <NeutralizeReadout scenario={scenario} /> : null}
      {scenario.kind === "dilution" ? <DilutionReadout scenario={scenario} /> : null}
      {scenario.kind === "solubility" ? <SolubilityReadout scenario={scenario} /> : null}

      {isRevealable(scenario) ? (
        scenario.revealed ? (
          <ObjectiveReveal scenario={scenario} />
        ) : (
          <Button variant={progress.complete ? "default" : "ghost"} size="sm" disabled={revealing} onClick={reveal} className="w-fit">
            {progress.complete ? "Reveal result" : "Reveal anyway"}
          </Button>
        )
      ) : null}
    </div>
  );
}

function StepRow({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <svg viewBox="0 0 16 16" width={16} height={16} className="shrink-0" aria-hidden="true">
        <circle cx={8} cy={8} r={7} fill="none" strokeWidth={1.5} className={done ? "stroke-mint" : "stroke-border"} />
        <path
          d="M4.5 8.3 L7 10.8 L11.5 5.5"
          fill="none"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-mint"
          style={{
            strokeDasharray: CHECK_PATH_LENGTH,
            strokeDashoffset: done ? 0 : CHECK_PATH_LENGTH,
            transition: "stroke-dashoffset 200ms var(--ease-out)",
          }}
        />
      </svg>
      <span className={done ? "text-muted-foreground" : "text-foreground"}>{label}</span>
    </li>
  );
}
