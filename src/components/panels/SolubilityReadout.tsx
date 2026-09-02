"use client";

import { reagentDef, type PublicScenario } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectContainer } from "@/store/selectors";
import { Readout } from "./Readout";

export interface SolubilityReadoutProps {
  readonly scenario: Extract<PublicScenario, { kind: "solubility" }>;
}

/**
 * Solubility challenge: the beaker's temperature, plus dissolved and undissolved grams of the
 * chosen solute (moles times the solid's own molar mass, e.g. 101.1 g/mol for KNO3).
 */
export function SolubilityReadout({ scenario }: SolubilityReadoutProps) {
  const beaker = useLabStore(selectContainer(scenario.beakerId));
  const solute = reagentDef(scenario.soluteId);

  if (!beaker || !solute || solute.kind !== "solid") return null;

  const deposit = beaker.solids.find((s) => s.kind === "identified" && s.species === solute.solidSpecies);
  const undissolvedG = deposit && deposit.kind === "identified" ? deposit.moles * solute.molarMass : 0;

  const trackedIon = solute.ions[0];
  const dissolvedM = trackedIon && beaker.contents.kind === "visible" ? (beaker.contents.concentrationsM[trackedIon.species] ?? 0) : null;
  const dissolvedG =
    dissolvedM !== null && trackedIon ? ((dissolvedM * beaker.volumeMl) / (1000 * trackedIon.perFormulaUnit)) * solute.molarMass : null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Readout label="Temperature" value={beaker.temperatureC} unit="°C" digits={1} size="lg" />
      <Readout label="Undissolved" value={undissolvedG} unit="g" digits={1} size="lg" />
      <Readout label="Dissolved" value={dissolvedG} unit="g" digits={1} emptyLabel="hidden" />
    </div>
  );
}
