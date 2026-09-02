"use client";

import { isSpeciesIdShape, type PublicScenario, type SpeciesId } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectLastSelectedContainer } from "@/store/selectors";
import { Readout } from "./Readout";

function speciesIdOrNull(formula: string): SpeciesId | null {
  return isSpeciesIdShape(formula) ? formula : null;
}

const NA_PLUS = speciesIdOrNull("Na+");

export interface DilutionReadoutProps {
  readonly scenario: Extract<PublicScenario, { kind: "dilution" }>;
}

/**
 * Dilution challenge: the last container the human selected (there is no fixed target vessel,
 * unlike titration's flask), its volume, and its Na+ molarity once contents are visible.
 */
export function DilutionReadout({ scenario }: DilutionReadoutProps) {
  const container = useLabStore(selectLastSelectedContainer);
  const naM = container && container.contents.kind === "visible" && NA_PLUS ? (container.contents.concentrationsM[NA_PLUS] ?? 0) : null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Readout label="Container volume" value={container?.volumeMl ?? null} unit="mL" digits={1} emptyLabel="select a container" />
      <Readout label="Na+ molarity" value={naM} unit="M" digits={3} emptyLabel={container ? "hidden" : "–"} />
      <Readout label="Target volume" value={scenario.targetMl} unit="mL" digits={0} />
      <Readout label="Target molarity" value={scenario.targetM} unit="M" digits={3} />
    </div>
  );
}
