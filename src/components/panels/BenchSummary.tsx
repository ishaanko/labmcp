"use client";

import { Check } from "lucide-react";
import { clsx } from "clsx";
import { useLabStore } from "@/store/labStore";
import { selectContainers, selectInstruments, selectObjectiveSteps, selectPublic } from "@/store/selectors";
import { scenarioObjective } from "@/engine";

/** Shown in the right panel when nothing is selected: bench tally, plus the titration checklist. */
export function BenchSummary() {
  const containers = useLabStore(selectContainers);
  const instruments = useLabStore(selectInstruments);
  const shelf = useLabStore((s) => s.lab.shelf);
  const scenarioKind = useLabStore((s) => s.lab.scenario.kind);
  const public_ = useLabStore(selectPublic);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-md font-semibold text-ink">Bench</h2>
        <p className="text-2xs text-ink-3">Nothing selected</p>
      </div>

      {scenarioKind === "titration" ? <TitrationObjective /> : null}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <SummaryStat label="Glassware" value={containers.length} />
        <SummaryStat label="Instruments" value={instruments.length} />
        <SummaryStat label="Reagents" value={shelf.length} />
        <SummaryStat label="Indicators" value={public_.indicatorsAvailable.length} />
      </dl>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs text-ink-3">{label}</dt>
      <dd className="tabular text-md text-ink">{value}</dd>
    </div>
  );
}

function TitrationObjective() {
  const steps = useLabStore(selectObjectiveSteps);

  return (
    <div className="rounded-md border border-hairline bg-surface-thin p-3">
      <p className="text-sm text-ink">{scenarioObjective("titration")}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-sm">
            <span
              className={clsx(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                step.done ? "border-ok bg-ok text-white" : "border-hairline-strong text-transparent",
              )}
            >
              <Check size={11} strokeWidth={3} />
            </span>
            <span className={step.done ? "text-ink-3 line-through" : "text-ink"}>{step.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
