"use client";

import type { PublicScenario } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectContainer } from "@/store/selectors";
import { Readout } from "./Readout";

export interface NeutralizeReadoutProps {
  readonly scenario: Extract<PublicScenario, { kind: "neutralize" }>;
}

/**
 * Neutralization challenge: a big pH readout next to the target, "no probe" until one is
 * attached to the beaker (same rule the titration flask follows).
 */
export function NeutralizeReadout({ scenario }: NeutralizeReadoutProps) {
  const beaker = useLabStore(selectContainer(scenario.beakerId));

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Readout label="pH" value={beaker?.pH ?? null} digits={2} size="lg" emptyLabel="no probe" />
        <Readout label="Target" value={scenario.targetPh} digits={1} size="lg" />
      </div>
      <p className="text-xs text-muted-foreground">Tolerance ± {scenario.tolerance}</p>
    </div>
  );
}
