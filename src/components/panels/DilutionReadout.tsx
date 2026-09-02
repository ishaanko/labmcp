"use client";

import { isSpeciesIdShape, type PublicScenario, type SpeciesId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectContainer, selectLastSelectedContainer } from "@/store/selectors";
import { Readout } from "./Readout";

function speciesIdOrNull(formula: string): SpeciesId | null {
  return isSpeciesIdShape(formula) ? formula : null;
}

const NA_PLUS = speciesIdOrNull("Na+");

export interface DilutionReadoutProps {
  readonly scenario: Extract<PublicScenario, { kind: "dilution" }>;
}

/**
 * Dilution challenge: the container progress is graded on (the sodium holder nearest 100 mL,
 * whoever filled it), falling back to the last container the human selected before any stock
 * is poured. Volume and Na+ molarity; the step labels already carry the targets.
 */
export function DilutionReadout({ scenario }: DilutionReadoutProps) {
  const candidate = useLabStore(selectContainer(scenario.candidateId ?? ""));
  const lastSelected = useLabStore(selectLastSelectedContainer);
  const container = candidate ?? lastSelected;
  const naM = container && container.contents.kind === "visible" && NA_PLUS ? (container.contents.concentrationsM[NA_PLUS] ?? 0) : null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Readout label={container ? `${container.label} volume` : "Volume"} value={container?.volumeMl ?? null} unit="mL" digits={1} size="lg" emptyLabel="no stock yet" />
      <Readout label="Na+ molarity" value={naM} unit="M" digits={3} size="lg" emptyLabel={container ? "hidden" : "–"} />
    </div>
  );
}
