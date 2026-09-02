/**
 * Solid-reagent solubility: dissolves a solid deposit into its ions up to the temperature-scaled
 * limit for the water currently in the container, and crystallizes the excess back out the moment
 * that limit drops (cooling, or losing water on a transfer out). Called after any command that
 * changes a container's mass, volume, or temperature; see physical.ts's ADD_REAGENT and
 * TRANSFER_LIQUID/DISPENSE hooks, and reducer.ts's TICK-driven thermal step.
 */
import { EPS_MOL, SOLUBILITY_EVENT_G } from "./constants";
import { SOLID_REAGENTS } from "./reagents";
import { addMoles, getMoles } from "./species";
import type { Container, LabEvent } from "./types";

/** Grams per 100 mL water at `tempC`, linearly interpolated between curve points and clamped past the ends. */
function interpSolubility(curve: ReadonlyArray<readonly [number, number]>, tempC: number): number {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) return 0;
  if (tempC <= first[0]) return first[1];
  if (tempC >= last[0]) return last[1];
  for (let i = 0; i < curve.length - 1; i++) {
    const lo = curve[i];
    const hi = curve[i + 1];
    if (!lo || !hi || tempC < lo[0] || tempC > hi[0]) continue;
    const frac = (tempC - lo[0]) / (hi[0] - lo[0]);
    return lo[1] + (hi[1] - lo[1]) * frac;
  }
  return last[1];
}

export interface SolubilityResult {
  readonly container: Container;
  readonly events: ReadonlyArray<LabEvent>;
}

/**
 * Re-equilibrates every known solid reagent's dissolved/undissolved split for one container. A
 * solid's total substance (dissolved ions + undissolved deposit) never changes here; only the
 * split does, moving toward `solubility(tempC) * (waterMl / 100)` grams dissolved. An empty
 * container (volumeMl 0) has a zero limit, so a solid added with no water stays entirely solid.
 */
export function equilibrateSolubility(container: Container): SolubilityResult {
  let species = container.species;
  let solids = container.solids;
  const events: LabEvent[] = [];

  for (const reagent of SOLID_REAGENTS) {
    const firstIon = reagent.ions[0];
    if (!firstIon) continue;

    const dissolvedMol = reagent.ions.reduce((min, ion) => Math.min(min, getMoles(species, ion.species) / ion.perFormulaUnit), Infinity);
    const safeDissolvedMol = Number.isFinite(dissolvedMol) ? Math.max(0, dissolvedMol) : 0;
    const deposit = solids.find((s) => s.species === reagent.solidSpecies);
    const undissolvedMol = deposit?.moles ?? 0;
    const totalMol = safeDissolvedMol + undissolvedMol;
    if (totalMol < EPS_MOL) continue;

    const limitG = interpSolubility(reagent.solubilityG100ml, container.temperatureC) * (container.volumeMl / 100);
    const limitMol = reagent.molarMass > 0 ? Math.max(0, limitG / reagent.molarMass) : 0;
    const newDissolvedMol = Math.min(totalMol, limitMol);
    const newUndissolvedMol = totalMol - newDissolvedMol;
    const deltaDissolvedMol = newDissolvedMol - safeDissolvedMol;

    if (Math.abs(deltaDissolvedMol) > EPS_MOL) {
      for (const ion of reagent.ions) species = addMoles(species, ion.species, deltaDissolvedMol * ion.perFormulaUnit);
    }

    if (deposit) {
      solids = solids.map((s) => (s.species === reagent.solidSpecies ? { ...s, moles: newUndissolvedMol, suspended: deltaDissolvedMol < 0 ? 1 : s.suspended } : s));
    } else if (newUndissolvedMol > EPS_MOL) {
      solids = [...solids, { species: reagent.solidSpecies, moles: newUndissolvedMol, suspended: 1 }];
    }
    solids = solids.filter((s) => s.species !== reagent.solidSpecies || s.moles > EPS_MOL);

    const deltaDissolvedG = deltaDissolvedMol * reagent.molarMass;
    if (Math.abs(deltaDissolvedG) > SOLUBILITY_EVENT_G) {
      events.push({
        kind: "SOLUBILITY_CHANGE",
        containerId: container.id,
        species: reagent.solidSpecies,
        dissolvedG: newDissolvedMol * reagent.molarMass,
        undissolvedG: newUndissolvedMol * reagent.molarMass,
        temperatureC: container.temperatureC,
      });
    }
  }

  return { container: { ...container, species, solids }, events };
}
