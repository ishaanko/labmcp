/** Unit conventions: amount in mol, volume in mL, temperature in °C, concentration in mol/L. */

export const EPS_MOL = 1e-12;
export const EPS_ML = 1e-9;
export const MIN_EXTENT_MOL = 1e-9;

export const PH_EVENT_THRESHOLD = 0.05;
export const COLOR_EVENT_THRESHOLD = 0.04;
export const MIXING_TEMP_EVENT_C = 0.5;

/** Water autoionisation constant at 25 °C. */
export const KW = 1e-14;
/** Second dissociation pKa of carbonic acid (HCO3- / CO3^2-). */
export const PKA2_CARBONIC = 10.33;
/** Kb of carbonate, used for the carbonate-only pH fallback. */
export const KB_CARBONATE = 2.1e-4;
/** pH of a pure bicarbonate solution, (pKa1 + pKa2) / 2. */
export const PH_BICARBONATE = 8.34;

export const DROP_ML = 0.05;

export const HEAT_RATE_C_PER_S = 1.5;
export const PASSIVE_RATE_C_PER_S = 0.05;
export const SETTLE_S = 6;
export const STIR_SUSPEND = 1;

export const NEUTRALIZATION_KJ_PER_MOL = 57.3;
export const WATER_J_PER_ML_C = 4.184;
export const MAX_REACTION_DT_C = 10;

export const MAX_DT_S = 60;
export const MIN_TEMP_C = 0;
export const MAX_TEMP_C = 100;
export const AMBIENT_C = 22;

export const MAX_ADD_ML = 10_000;
export const MAX_STIR_S = 60;
export const MAX_INDICATOR_DROPS = 20;
export const DEFAULT_STIR_S = 5;

/** Solid concentration (mol/L) at which a precipitate reads fully opaque. */
export const PRECIPITATE_OPAQUE_M = 0.05;
/** Gas amount (mol/L) at which bubbling reads at full intensity. */
export const GAS_FULL_M = 0.02;

export const CAPACITY_ML: Readonly<Record<string, number>> = {
  beaker: 250,
  flask: 250,
  test_tube: 20,
  graduated_cylinder: 100,
  burette: 50,
};
