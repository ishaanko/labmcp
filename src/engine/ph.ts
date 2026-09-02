/**
 * pH via charge-balance bisection at 25 °C. Fixed-charge spectator ions (Na+, K+, Cl-, NO3-, Ag+,
 * Ca2+, Ba2+, Cu2+, SO4^2-) contribute a constant charge at every trial pH; the acetic, ammonium,
 * and carbonate families re-speciate virtually from their stored *totals* (whatever the reducer's
 * proton-transfer rules already split them into does not matter, only the sum), using
 * Henderson-Hasselbalch fractions at the trial pH. H+ and OH- are never read from the species map
 * directly here: any strong acid/base the reducer left in a container is already fully accounted
 * for by its own counterion (Cl- for HCl, Na+ for NaOH, ...), since every reagent and every
 * reaction conserves charge (`netCharge` stays ~0). Reading both would double the strong-acid
 * signal and cancel it against itself.
 */
import { EPS_ML, KW, PKA1_CARBONIC, PKA2_CARBONIC, PKA_ACETIC, PKA_AMMONIUM } from "./constants";
import type { SpeciesId } from "./ids";
import { getMoles, SP } from "./species";
import type { Container } from "./types";

const PH_MIN = 0;
const PH_MAX = 14;
const PH_TOLERANCE = 1e-4;
const MAX_BISECTIONS = 60;

const KA_ACETIC = Math.pow(10, -PKA_ACETIC);
const KA_AMMONIUM = Math.pow(10, -PKA_AMMONIUM);
const KA1_CARBONIC = Math.pow(10, -PKA1_CARBONIC);
const KA2_CARBONIC = Math.pow(10, -PKA2_CARBONIC);

function clampPh(ph: number): number {
  return Math.min(PH_MAX, Math.max(PH_MIN, ph));
}

interface Totals {
  /** Molar sum of Na+, K+, Ag+, and 2x(Ca2+, Ba2+, Cu2+): always fully dissociated, never re-speciates. */
  readonly fixedCationsM: number;
  /** Molar sum of Cl-, NO3-, and 2x SO4^2-. */
  readonly fixedAnionsM: number;
  /** CH3COOH + CH3COO-, mol/L. */
  readonly aceticM: number;
  /** NH3 + NH4+, mol/L. */
  readonly ammoniumM: number;
  /** CO3^2- + HCO3-, mol/L (virtually re-speciated across H2CO3/HCO3-/CO3^2- by pKa1 and pKa2). */
  readonly carbonateM: number;
}

function totalsOf(container: Container, liters: number): Totals {
  const m = (id: SpeciesId) => getMoles(container.species, id) / liters;
  return {
    fixedCationsM: m(SP.Na) + m(SP.K) + m(SP.Ag) + 2 * (m(SP.Ca) + m(SP.Ba) + m(SP.Cu)),
    fixedAnionsM: m(SP.Cl) + m(SP.NO3) + 2 * m(SP.SO4),
    aceticM: m(SP.AcOH) + m(SP.AcO),
    ammoniumM: m(SP.NH3) + m(SP.NH4),
    carbonateM: m(SP.CO3) + m(SP.HCO3),
  };
}

/** Cations minus anions at a trial pH, mol/L. Strictly decreasing in pH; its root is the solution's pH. */
function chargeResidual(pH: number, totals: Totals): number {
  const h = Math.pow(10, -pH);
  const oh = KW / h;

  const acetate = totals.aceticM * (KA_ACETIC / (KA_ACETIC + h));
  const ammonium = totals.ammoniumM * (h / (h + KA_AMMONIUM));

  const carbonicDenom = h * h + h * KA1_CARBONIC + KA1_CARBONIC * KA2_CARBONIC;
  const bicarbonate = carbonicDenom > 0 ? totals.carbonateM * ((h * KA1_CARBONIC) / carbonicDenom) : 0;
  const carbonate = carbonicDenom > 0 ? totals.carbonateM * ((KA1_CARBONIC * KA2_CARBONIC) / carbonicDenom) : 0;

  const cations = h + ammonium + totals.fixedCationsM;
  const anions = oh + acetate + bicarbonate + 2 * carbonate + totals.fixedAnionsM;
  return cations - anions;
}

/**
 * Solves `chargeResidual(pH) = 0` by bisection over [0, 14]. `chargeResidual` is monotonically
 * decreasing, so a positive residual at the low end and negative at the high end brackets exactly
 * one root; when the whole range has the same sign, the true pH lies outside [0, 14] and clamps.
 */
function solvePh(totals: Totals): number {
  let lo = PH_MIN;
  let hi = PH_MAX;
  const residualLo = chargeResidual(lo, totals);
  if (residualLo <= 0) return lo;
  const residualHi = chargeResidual(hi, totals);
  if (residualHi >= 0) return hi;

  for (let i = 0; i < MAX_BISECTIONS && hi - lo > PH_TOLERANCE; i++) {
    const mid = (lo + hi) / 2;
    if (chargeResidual(mid, totals) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** pH of a container's contents, or null when it holds no liquid. Never rewrites the species map: speciation stays virtual. */
export function derivePh(container: Container): number | null {
  if (container.volumeMl < EPS_ML) return null;
  const liters = container.volumeMl / 1000;
  return clampPh(solvePh(totalsOf(container, liters)));
}
