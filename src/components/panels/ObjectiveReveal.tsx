"use client";

import { clsx } from "clsx";
import { checkTitrationAnswer, estimateEquivalenceMl, reagentDef, titrationSolution, type PublicScenario } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectTitration } from "@/store/selectors";

export interface ObjectiveRevealProps {
  readonly scenario: Extract<PublicScenario, { kind: "titration" | "unknown_id" | "neutralize" }>;
}

/** The reveal moment's result panel. Each of the three scenarios with a secret shows a different answer key. */
export function ObjectiveReveal({ scenario }: ObjectiveRevealProps) {
  if (scenario.kind === "titration") return <TitrationReveal scenario={scenario} />;
  if (scenario.kind === "unknown_id") return <UnknownReveal scenario={scenario} />;
  return <NeutralizeReveal scenario={scenario} />;
}

function TitrationReveal({ scenario }: { scenario: Extract<PublicScenario, { kind: "titration" }> }) {
  const titration = useLabStore(selectTitration);
  const lab = useLabStore((s) => s.lab);
  const estimateMl = titration ? estimateEquivalenceMl(titration.curve) : null;
  const solution = titrationSolution(lab);
  const claimedM = estimateMl !== null && scenario.titrantM > 0 ? (scenario.titrantM * estimateMl) / scenario.analyteMl : null;
  const verdict = claimedM !== null ? checkTitrationAnswer(lab, claimedM) : null;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">True concentration</p>
      <p className="tabular text-2xl text-foreground">{solution ? solution.analyteM.toFixed(4) : "–"} M</p>
      {verdict && claimedM !== null ? (
        <p className={clsx("mt-1 text-sm", verdict.correct ? "text-mint" : "text-destructive")}>
          Curve estimate {claimedM.toFixed(4)} M, {(verdict.relError * 100).toFixed(1)}% off.
          {verdict.correct ? " Within tolerance." : " Outside tolerance."}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">No equivalence estimate yet; dispense past the endpoint to get one.</p>
      )}
    </div>
  );
}

function UnknownReveal({ scenario }: { scenario: Extract<PublicScenario, { kind: "unknown_id" }> }) {
  const identities = scenario.identities;
  if (!identities) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">Identities</p>
      <ul className="mt-1 flex flex-col gap-1 text-sm text-foreground">
        {scenario.samples.map((sample) => {
          const recipe = identities[sample.shelfId];
          const label = recipe ? (reagentDef(recipe.reagentId)?.label ?? recipe.reagentId) : "unknown";
          return (
            <li key={sample.containerId}>
              {sample.label}: {label}
              {recipe ? ` at ${recipe.concentrationM} M` : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NeutralizeReveal({ scenario }: { scenario: Extract<PublicScenario, { kind: "neutralize" }> }) {
  const start = scenario.start;
  if (!start) return null;
  const label = reagentDef(start.startReagent)?.label ?? start.startReagent;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">Started as</p>
      <p className="text-sm text-foreground">
        {label} at {start.startM} M
      </p>
    </div>
  );
}
