import { EPS_ML, KB_CARBONATE, KW, PH_BICARBONATE, PKA2_CARBONIC } from "./constants";
import { getMoles, SP } from "./species";
import type { Container } from "./types";

function clampPh(ph: number): number {
  return Math.min(14, Math.max(0, ph));
}

/**
 * pH from the strong acid/base charge balance, with carbonate-system fallbacks when the
 * strong-acid/base contribution is negligible. Returns null for an empty container.
 */
export function derivePh(container: Container): number | null {
  if (container.volumeMl < EPS_ML) return null;

  const liters = container.volumeMl / 1000;
  const nH = getMoles(container.species, SP.H);
  const nOH = getMoles(container.species, SP.OH);
  const c = (nH - nOH) / liters;

  if (Math.abs(c) < 1e-9) {
    const nCO3 = getMoles(container.species, SP.CO3);
    const nHCO3 = getMoles(container.species, SP.HCO3);
    if (nCO3 > 0 && nHCO3 > 0) {
      return clampPh(PKA2_CARBONIC + Math.log10(nCO3 / nHCO3));
    }
    if (nCO3 > 0) {
      const co3M = nCO3 / liters;
      const ohM = Math.sqrt(KB_CARBONATE * co3M);
      return clampPh(14 + Math.log10(ohM));
    }
    if (nHCO3 > 0) {
      return PH_BICARBONATE;
    }
    return 7.0;
  }

  const hPlus = (c + Math.sqrt(c * c + 4 * KW)) / 2;
  return clampPh(-Math.log10(hPlus));
}
