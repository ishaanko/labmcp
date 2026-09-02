/**
 * The engine's message types: commands in, events and errors out.
 * Split from types.ts to keep both files under the 400-line budget; types.ts re-exports these
 * so every module keeps importing from "./types".
 */
import type { ContainerId, IndicatorId, InstrumentId, ObjectId, ReactionRuleId, ReagentId, SpeciesId } from "./ids";
import type { Actor, EquipmentType, InstrumentReading, InstrumentType, Rgba, ScenarioId, SpeciesMoles, ThermalState, Vec2 } from "./types";

// ---------- events ----------

export type PrecipitateScale = "trace" | "small" | "moderate" | "heavy";

export type LabEvent =
  | { readonly kind: "OBJECT_PLACED"; readonly objectId: ObjectId; readonly objectType: EquipmentType }
  | { readonly kind: "OBJECT_REMOVED"; readonly objectId: ObjectId }
  | { readonly kind: "OBJECT_MOVED"; readonly objectId: ObjectId; readonly position: Vec2 }
  | { readonly kind: "INSTRUMENT_ATTACHED"; readonly instrumentId: InstrumentId; readonly containerId: ContainerId | null }
  | {
      readonly kind: "LIQUID_ADDED";
      readonly containerId: ContainerId;
      readonly reagentId: ReagentId;
      readonly volumeMl: number;
      readonly newVolumeMl: number;
    }
  | { readonly kind: "LIQUID_TRANSFERRED"; readonly fromId: ContainerId; readonly toId: ContainerId; readonly volumeMl: number }
  | { readonly kind: "INDICATOR_ADDED"; readonly containerId: ContainerId; readonly indicator: IndicatorId; readonly drops: number }
  | { readonly kind: "STIR_STARTED"; readonly containerId: ContainerId; readonly durationS: number }
  | { readonly kind: "THERMAL_SET"; readonly containerId: ContainerId; readonly thermal: ThermalState }
  | { readonly kind: "MEASUREMENT"; readonly containerId: ContainerId; readonly reading: InstrumentReading }
  | { readonly kind: "CONTENTS_INSPECTED"; readonly containerId: ContainerId; readonly species: SpeciesMoles; readonly volumeMl: number }
  | {
      readonly kind: "REACTION";
      readonly containerId: ContainerId;
      readonly ruleId: ReactionRuleId;
      readonly extentMol: number;
      readonly limiting: SpeciesId;
      readonly netIonic: string;
    }
  | {
      readonly kind: "COLOR_SHIFT";
      readonly containerId: ContainerId;
      readonly from: Rgba;
      readonly to: Rgba;
      /** e.g. "colorless -> faint pink" */
      readonly description: string;
      /** True when an indicator crossed its band; the scene gives this a longer beat. */
      readonly indicatorTransition: boolean;
    }
  | {
      readonly kind: "PRECIPITATE_FORMED";
      readonly containerId: ContainerId;
      readonly species: SpeciesId;
      readonly moles: number;
      readonly massG: number;
      readonly color: Rgba;
      readonly scale: PrecipitateScale;
      readonly description: string;
    }
  | {
      readonly kind: "BUBBLES";
      readonly containerId: ContainerId;
      readonly species: SpeciesId;
      readonly moles: number;
      readonly intensity: number;
      readonly durationS: number;
    }
  | {
      readonly kind: "TEMPERATURE_CHANGE";
      readonly containerId: ContainerId;
      readonly fromC: number;
      readonly toC: number;
      readonly cause: "reaction" | "thermal" | "mixing";
    }
  | { readonly kind: "PH_CHANGE"; readonly containerId: ContainerId; readonly from: number; readonly to: number }
  | { readonly kind: "NO_REACTION"; readonly containerId: ContainerId; readonly description: string }
  | { readonly kind: "SOLIDS_SETTLED"; readonly containerId: ContainerId }
  | { readonly kind: "DISPOSED"; readonly containerId: ContainerId; readonly volumeMl: number }
  | {
      readonly kind: "UNDONE";
      readonly undoneCommand: LabCommand;
      /** seq/actor of the history entry that was undone, so a caller can report it without racing a re-read of history. */
      readonly undoneSeq: number;
      readonly undoneActor: Actor;
    }
  | { readonly kind: "RESET" }
  | { readonly kind: "SCENARIO_LOADED"; readonly scenarioId: ScenarioId; readonly seed: number }
  | { readonly kind: "SCENARIO_REVEALED"; readonly scenarioId: ScenarioId }
  | { readonly kind: "OVERFLOW_REJECTED"; readonly containerId: ContainerId; readonly attemptedMl: number; readonly maxAddableMl: number }
  | { readonly kind: "COMMAND_REJECTED"; readonly error: LabError };

// ---------- errors ----------

export type LabError =
  | { readonly kind: "UNKNOWN_OBJECT"; readonly id: string; readonly hint: "reread_lab_state" }
  | { readonly kind: "WRONG_OBJECT_TYPE"; readonly id: ObjectId; readonly expected: ReadonlyArray<EquipmentType> }
  | {
      readonly kind: "OVER_CAPACITY";
      readonly containerId: ContainerId;
      readonly capacityMl: number;
      readonly currentMl: number;
      readonly attemptedMl: number;
      readonly maxAddableMl: number;
    }
  | { readonly kind: "INSUFFICIENT_VOLUME"; readonly containerId: ContainerId; readonly availableMl: number; readonly requestedMl: number }
  | { readonly kind: "INVALID_AMOUNT"; readonly field: string; readonly value: number; readonly reason: "not_finite" | "not_positive" | "too_large" }
  | { readonly kind: "SAME_CONTAINER"; readonly containerId: ContainerId }
  | { readonly kind: "UNSUPPORTED_REAGENT"; readonly requested: string; readonly suggestions: ReadonlyArray<ReagentId> }
  | { readonly kind: "UNSUPPORTED_CONCENTRATION"; readonly reagentId: ReagentId; readonly requestedM: number; readonly maxM: number }
  | { readonly kind: "UNSUPPORTED_INDICATOR"; readonly requested: string; readonly suggestions: ReadonlyArray<IndicatorId> }
  | { readonly kind: "STOCK_DEPLETED"; readonly reagentId: ReagentId; readonly remainingMl: number }
  | { readonly kind: "NO_INSTRUMENT"; readonly containerId: ContainerId; readonly needed: InstrumentType; readonly hint: string }
  | { readonly kind: "INVALID_TEMPERATURE"; readonly requestedC: number; readonly minC: number; readonly maxC: number }
  | { readonly kind: "RESTRICTED_BY_CHALLENGE"; readonly action: string; readonly reason: string }
  | { readonly kind: "NOTHING_TO_UNDO" }
  | { readonly kind: "UNKNOWN_SCENARIO"; readonly requested: string; readonly available: ReadonlyArray<ScenarioId> }
  | { readonly kind: "SLOT_UNAVAILABLE"; readonly position: Vec2; readonly reason: "occupied" | "out_of_bounds" | "bench_full" };

// ---------- commands ----------

export type Measurable = "ph" | "temperature" | "volume" | "contents";

export type LabCommand =
  | {
      readonly kind: "PLACE_OBJECT";
      readonly objectType: EquipmentType;
      readonly position?: Vec2;
      readonly label?: string;
      readonly attachTo?: ContainerId;
    }
  | { readonly kind: "REMOVE_OBJECT"; readonly objectId: ObjectId }
  | { readonly kind: "ATTACH_INSTRUMENT"; readonly instrumentId: InstrumentId; readonly containerId: ContainerId | null }
  | {
      readonly kind: "ADD_REAGENT";
      readonly containerId: ContainerId;
      readonly reagentId: ReagentId;
      readonly volumeMl: number;
      readonly concentrationM?: number;
    }
  | { readonly kind: "TRANSFER_LIQUID"; readonly fromId: ContainerId; readonly toId: ContainerId; readonly volumeMl: number }
  | { readonly kind: "DISPENSE"; readonly buretteId: ContainerId; readonly toId: ContainerId; readonly volumeMl: number }
  | { readonly kind: "STIR"; readonly containerId: ContainerId; readonly durationS?: number; readonly intensity?: number }
  | { readonly kind: "HEAT"; readonly containerId: ContainerId; readonly targetC: number }
  | { readonly kind: "COOL"; readonly containerId: ContainerId; readonly targetC?: number }
  | { readonly kind: "ADD_INDICATOR"; readonly containerId: ContainerId; readonly indicator: IndicatorId; readonly drops?: number }
  | { readonly kind: "MEASURE"; readonly containerId: ContainerId; readonly quantity: Measurable; readonly instrumentId?: InstrumentId }
  | { readonly kind: "DISPOSE"; readonly containerId: ContainerId }
  /** Human drag release. Undoable, triggers no reactions. */
  | { readonly kind: "MOVE_OBJECT"; readonly objectId: ObjectId; readonly position: Vec2 }
  | { readonly kind: "TICK"; readonly dtS: number }
  | { readonly kind: "UNDO" }
  /** Reload the current scenario with the same seed. */
  | { readonly kind: "RESET" }
  | { readonly kind: "LOAD_SCENARIO"; readonly scenarioId: ScenarioId; readonly seed: number }
  /** Ends a challenge: unlocks inspect/calculate on tainted containers. Not undoable. */
  | { readonly kind: "REVEAL" };
