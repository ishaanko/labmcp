import type { ContainerType, InstrumentType, PrecipitateScale } from "@/engine";

/** A settled or suspended solid deposit at the bottom of a vessel. */
export interface VesselPrecipitate {
  /** CSS color for the deposit specks. */
  readonly color: string;
  readonly scale: PrecipitateScale;
  /** 0 = settled at the bottom, 1 = fully suspended by stirring. */
  readonly suspended: number;
}

/**
 * Everything a flat 2D vessel needs to render. No store or engine access: the caller (bench
 * layer) reads `PublicContainer` and maps it to this shape.
 */
export interface VesselProps {
  readonly type: ContainerType;
  readonly capacityMl: number;
  readonly volumeMl: number;
  /** CSS rgba string, the engine's derived liquid color. */
  readonly color: string;
  readonly precipitate: VesselPrecipitate | null;
  /** 0..1 gas evolution rate. 0 renders no bubbles at all. */
  readonly bubbleIntensity: number;
  readonly stirring: boolean;
  readonly heating: boolean;
  readonly label: string;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly agentActive: boolean;
  /** Rendered width in px; height follows the vessel's own aspect ratio. Default 120. */
  readonly size?: number;
}

/** Everything a flat 2D instrument needs to render. No store or engine access. */
export interface InstrumentProps {
  readonly type: InstrumentType;
  /** Formatted readout, e.g. "pH 7.20" or "23.4 C". Null when there is nothing to show yet. */
  readonly reading: string | null;
  readonly attached: boolean;
  /** 0..1 */
  readonly heatLevel: number;
  /** Rendered width in px; height follows the instrument's own aspect ratio. Default 120. */
  readonly size?: number;
}
