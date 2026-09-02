"use client";

import { useLabStore } from "@/store/labStore";
import { selectContainer, selectTitration } from "@/store/selectors";
import { Readout } from "@/components/ui/Readout";

/**
 * Always-visible titration readouts row (C7): titrant delivered, pH, flask volume. Wraps instead
 * of a fixed 3-column grid: three `--text-readout` values do not fit the 268px panel width, so
 * the flask volume drops to a second line rather than clipping under the panel edge.
 */
export function TitrationReadouts() {
  const titration = useLabStore(selectTitration);
  const flask = useLabStore(selectContainer(titration?.flaskId ?? ""));

  if (!titration) return null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <Readout label="Titrant delivered" value={titration.cumulativeTitrantMl} unit="mL" digits={2} size="lg" />
      <Readout label="pH" value={titration.latestPh} digits={2} size="lg" />
      <Readout label="Flask volume" value={flask?.volumeMl ?? null} unit="mL" digits={2} size="lg" />
    </div>
  );
}
