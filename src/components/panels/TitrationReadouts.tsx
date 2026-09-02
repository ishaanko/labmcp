"use client";

import { useLabStore } from "@/store/labStore";
import { selectContainer, selectTitration } from "@/store/selectors";
import { Readout } from "@/components/ui/Readout";

/**
 * Always-visible titration readouts (C7): titrant delivered, pH, flask volume, flask temperature.
 * A 2 x 2 grid: two `--text-readout` values fit the 268px panel width, three do not.
 */
export function TitrationReadouts() {
  const titration = useLabStore(selectTitration);
  const flask = useLabStore(selectContainer(titration?.flaskId ?? ""));

  if (!titration) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Readout label="Titrant delivered" value={titration.cumulativeTitrantMl} unit="mL" digits={2} size="lg" />
      <Readout label="pH" value={titration.latestPh} digits={2} size="lg" emptyLabel="no probe" />
      <Readout label="Flask volume" value={flask?.volumeMl ?? null} unit="mL" digits={2} size="lg" />
      <Readout label="Temperature" value={flask?.temperatureC ?? null} unit="°C" digits={1} size="lg" />
    </div>
  );
}
