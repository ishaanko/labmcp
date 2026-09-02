/**
 * The public (redacted) view of lab state: what the UI and the WebMCP tools may see. Built by
 * scenarioView.ts's `publicView`; split out of types.ts to keep that file under the 400-line
 * budget. types.ts re-exports everything here, so `@/engine` and `./types` import paths still work.
 */
import type { ContainerId, IndicatorId, ReactionRuleId, ReagentId, SpeciesId } from "./ids";
import type { PrecipitateScale } from "./protocol";
import type {
  ContainerType,
  CurvePoint,
  GasEffect,
  IndicatorDose,
  Instrument,
  Rgba,
  ShelfStock,
  SpeciesMoles,
  StirState,
  StockRecipe,
  ThermalState,
  Vec2,
  VisibilityPolicy,
} from "./types";

export type ContentsView =
  | {
      readonly kind: "visible";
      readonly species: SpeciesMoles;
      readonly concentrationsM: Readonly<Partial<Record<SpeciesId, number>>>;
    }
  | { readonly kind: "hidden"; readonly reason: string };

/**
 * A container's solid deposit, redacted the same way as its `ContentsView`: `identified` once the
 * container's contents are visible, `redacted` (no species, no moles: the answer key for what
 * precipitated) while it stays hidden. Color, scale, and suspension are always fair game, same as
 * `ContentsView`'s color/pH rules.
 */
export type PublicSolidDeposit =
  | { readonly kind: "identified"; readonly species: SpeciesId; readonly moles: number; readonly suspended: number; readonly color: Rgba; readonly scale: PrecipitateScale }
  | { readonly kind: "redacted"; readonly suspended: number; readonly color: Rgba; readonly scale: PrecipitateScale };

export interface PublicContainer {
  readonly kind: "container";
  readonly id: ContainerId;
  readonly type: ContainerType;
  readonly label: string;
  readonly capacityMl: number;
  readonly position: Vec2;
  readonly rotationDeg: number;
  readonly volumeMl: number;
  readonly temperatureC: number;
  readonly solids: ReadonlyArray<PublicSolidDeposit>;
  readonly gasEffects: ReadonlyArray<GasEffect>;
  readonly indicators: ReadonlyArray<IndicatorDose>;
  readonly stir: StirState;
  readonly thermal: ThermalState;
  readonly contents: ContentsView;
  /** Only present when contents are visible or an instrument is attached; otherwise null. */
  readonly pH: number | null;
  readonly color: Rgba;
  readonly colorName: string;
  readonly reactionsOccurred: ReadonlyArray<ReactionRuleId>;
}

export type PublicScenario =
  | { readonly kind: "sandbox"; readonly seed: number; readonly visibility: VisibilityPolicy }
  | {
      readonly kind: "titration";
      readonly seed: number;
      readonly visibility: VisibilityPolicy;
      readonly flaskId: ContainerId;
      readonly buretteId: ContainerId;
      readonly analyteMl: number;
      readonly titrantM: number;
      readonly curve: ReadonlyArray<CurvePoint>;
      readonly revealed: boolean;
      /** Only present once revealed. */
      readonly analyteM: number | null;
    }
  | {
      readonly kind: "unknown_id";
      readonly seed: number;
      readonly visibility: VisibilityPolicy;
      readonly samples: ReadonlyArray<{ readonly shelfId: ReagentId; readonly label: string; readonly containerId: ContainerId }>;
      readonly revealed: boolean;
      /** Only present once revealed. */
      readonly identities: Readonly<Record<string, StockRecipe>> | null;
    }
  | { readonly kind: "precipitation"; readonly seed: number; readonly visibility: VisibilityPolicy; readonly beakerId: ContainerId; readonly revealed: boolean }
  | {
      readonly kind: "neutralize";
      readonly seed: number;
      readonly visibility: VisibilityPolicy;
      readonly beakerId: ContainerId;
      readonly targetPh: number;
      readonly tolerance: number;
      readonly revealed: boolean;
      /** Only present once revealed. */
      readonly start: { readonly startReagent: ReagentId; readonly startM: number } | null;
    }
  | {
      readonly kind: "dilution";
      readonly seed: number;
      readonly visibility: VisibilityPolicy;
      readonly reagentId: ReagentId;
      readonly stockM: number;
      readonly targetMl: number;
      readonly targetM: number;
      readonly toleranceMl: number;
      readonly toleranceM: number;
      readonly revealed: boolean;
      /** The container progress is graded on: the sodium holder closest to targetMl, or null before any stock is poured. */
      readonly candidateId: ContainerId | null;
    }
  | { readonly kind: "solubility"; readonly seed: number; readonly visibility: VisibilityPolicy; readonly beakerId: ContainerId; readonly soluteId: ReagentId; readonly revealed: boolean };

export interface PublicLabState {
  readonly clockS: number;
  readonly ambientC: number;
  readonly objects: ReadonlyArray<PublicContainer | Instrument>;
  readonly shelf: ReadonlyArray<ShelfStock>;
  readonly indicatorsAvailable: ReadonlyArray<IndicatorId>;
  readonly scenario: PublicScenario;
  readonly nextSeq: number;
}

