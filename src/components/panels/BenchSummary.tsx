"use client";

import { useLabStore } from "@/store/labStore";
import { selectContainers, selectInstruments, selectPublic } from "@/store/selectors";
import { scenarioObjective } from "@/engine";

/** Shown in the right panel when nothing is selected outside titration: bench tally, plus the unknown-sample objective and names. */
export function BenchSummary() {
  const containers = useLabStore(selectContainers);
  const instruments = useLabStore(selectInstruments);
  const shelf = useLabStore((s) => s.lab.shelf);
  const public_ = useLabStore(selectPublic);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-md font-semibold text-ink">Bench</h2>
        <p className="text-2xs text-ink-3">Nothing selected</p>
      </div>

      {public_.scenario.kind === "unknown_id" ? (
        <div className="rounded-md border border-hairline bg-surface-thin p-3">
          <p className="text-sm text-ink">{scenarioObjective("unknown_id")}</p>
          <p className="mt-2 text-sm text-ink-2">{public_.scenario.samples.map((s) => s.label).join(" · ")}</p>
        </div>
      ) : null}

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
