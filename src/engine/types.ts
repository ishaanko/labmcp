import type {
  ContainerId,
  IndicatorId,
  InstrumentId,
  ReactionRuleId,
  ReagentId,
  SpeciesId,
} from "./ids";
import type { LabCommand, LabEvent, PrecipitateScale } from "./protocol";

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** 0..1 */
  readonly a: number;
}
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}
export type Actor = "human" | "agent" | "system";

/** Species -> mol. A plain object so state serialises; iterate with speciesKeys(). */
export type SpeciesMoles = Readonly<Partial<Record<SpeciesId, number>>>;

export type ContainerType = "beaker" | "flask" | "test_tube" | "graduated_cylinder" | "burette";
export type InstrumentType = "ph_meter" | "thermometer" | "hotplate";
export type EquipmentType = ContainerType | InstrumentType;

export interface SolidDeposit {
  readonly species: SpeciesId;
  readonly moles: number;
  /** 0 = settled, 1 = fully suspended (just formed or stirring). */
  readonly suspended: number;
}
export interface GasEffect {
  readonly species: SpeciesId;
  readonly molesReleased: number;
  /** 0..1 */
  readonly intensity: number;
  readonly remainingS: number;
}
export interface IndicatorDose {
  readonly indicator: IndicatorId;
  readonly drops: number;
}

export type StirState =
  | { readonly kind: "still" }
  | { readonly kind: "stirring"; readonly remainingS: number; readonly intensity: number };

export type ThermalState =
  | { readonly kind: "idle" }
  | { readonly kind: "heating"; readonly targetC: number }
  | { readonly kind: "cooling"; readonly targetC: number };

export interface Container {
  readonly kind: "container";
  readonly id: ContainerId;
  readonly type: ContainerType;
  readonly label: string;
  readonly capacityMl: number;
  readonly position: Vec2;
  readonly rotationDeg: number;
  readonly volumeMl: number;
  readonly temperatureC: number;
  /** Dissolved ions only. Solids live in `solids`. */
  readonly species: SpeciesMoles;
  readonly solids: ReadonlyArray<SolidDeposit>;
  readonly gasEffects: ReadonlyArray<GasEffect>;
  readonly indicators: ReadonlyArray<IndicatorDose>;
  readonly stir: StirState;
  readonly thermal: ThermalState;
  /** Challenge taint: true once any unknown sample touched this container. Propagates on transfer. */
  readonly containsUnknown: boolean;
}

export type InstrumentReading =
  | { readonly kind: "ph"; readonly value: number }
  | { readonly kind: "temperature"; readonly valueC: number }
  | { readonly kind: "volume"; readonly valueMl: number };

export interface Instrument {
  readonly kind: "instrument";
  readonly id: InstrumentId;
  readonly type: InstrumentType;
  readonly position: Vec2;
  readonly attachedTo: ContainerId | null;
  readonly lastReading: InstrumentReading | null;
}
export type LabObject = Container | Instrument;

export interface ShelfStock {
  readonly reagentId: ReagentId;
  readonly label: string;
  /** null = hidden (unknown sample) or not applicable (water). */
  readonly concentrationM: number | null;
  /** null = unlimited. */
  readonly remainingMl: number | null;
}

export interface Observation {
  readonly seq: number;
  readonly clockS: number;
  readonly actor: Actor;
  readonly event: LabEvent;
}

export interface ReactionRecord {
  readonly seq: number;
  readonly clockS: number;
  readonly containerId: ContainerId;
  readonly ruleId: ReactionRuleId;
  readonly extentMol: number;
  readonly limiting: SpeciesId;
  readonly consumed: ReadonlyArray<{ readonly species: SpeciesId; readonly moles: number }>;
  readonly produced: ReadonlyArray<{ readonly species: SpeciesId; readonly moles: number }>;
  readonly deltaTempC: number;
}

export interface HistoryEntry {
  readonly seq: number;
  readonly actor: Actor;
  readonly command: LabCommand;
  readonly events: ReadonlyArray<Observation>;
  /** Exact state before the command. Structurally shared, so cheap. UNDO restores it. */
  readonly snapshot: LabState;
}

/** mulberry32 state. */
export interface RngState {
  readonly seed: number;
  readonly s: number;
}

export interface LabState {
  readonly clockS: number;
  readonly ambientC: number;
  readonly objects: ReadonlyArray<LabObject>;
  readonly shelf: ReadonlyArray<ShelfStock>;
  readonly indicatorsAvailable: ReadonlyArray<IndicatorId>;
  readonly reactions: ReadonlyArray<ReactionRecord>;
  /** Append-only notebook. UNDO never rewinds it. */
  readonly observations: ReadonlyArray<Observation>;
  readonly history: ReadonlyArray<HistoryEntry>;
  readonly scenario: ScenarioState;
  readonly rng: RngState;
  /** Single counter for ids, events, and records. */
  readonly nextSeq: number;
}

// ---------- registries ----------

export interface Tint {
  readonly rgb: Rgba;
  /** Concentration at which the tint reaches alphaMax. */
  readonly refM: number;
  readonly alphaMax: number;
}

export type SpeciesDef =
  | {
      readonly kind: "aqueous";
      readonly id: SpeciesId;
      readonly name: string;
      readonly charge: number;
      readonly molarMass: number;
      readonly tint: Tint | null;
    }
  | { readonly kind: "solid"; readonly id: SpeciesId; readonly name: string; readonly molarMass: number; readonly color: Rgba }
  | { readonly kind: "gas"; readonly id: SpeciesId; readonly name: string; readonly molarMass: number };

export interface IonYield {
  readonly species: SpeciesId;
  readonly perFormulaUnit: number;
}

export type ReagentDef =
  | { readonly kind: "water"; readonly id: ReagentId; readonly label: string }
  | {
      readonly kind: "solution";
      readonly id: ReagentId;
      readonly label: string;
      readonly formula: string;
      readonly role: ReagentRole;
      readonly ions: ReadonlyArray<IonYield>;
      readonly defaultM: number;
      readonly maxM: number;
    }
  | {
      /** A dry solid added by mass. Dissolves up to its solubility at the container temperature. */
      readonly kind: "solid";
      readonly id: ReagentId;
      readonly label: string;
      readonly formula: string;
      readonly role: ReagentRole;
      readonly ions: ReadonlyArray<IonYield>;
      readonly molarMass: number;
      /** The undissolved form, a species of kind "solid". */
      readonly solidSpecies: SpeciesId;
      /** Solubility curve as [temperature °C, grams per 100 mL water], ascending in temperature. */
      readonly solubilityG100ml: ReadonlyArray<readonly [number, number]>;
    };

export type ReagentRole = "acid" | "base" | "salt" | "carbonate" | "weak_acid" | "weak_base";

/** Which color-response curve an indicator follows; color.ts switches on this instead of the id. */
export type IndicatorKind = "phenolphthalein" | "universal" | "litmus";

export interface IndicatorDef {
  readonly id: IndicatorId;
  readonly kind: IndicatorKind;
  readonly label: string;
  readonly defaultDrops: number;
  /** Human-readable color ranges, used in tool descriptions. */
  readonly ranges: string;
}

export type VisualEffect =
  | { readonly kind: "none" }
  | { readonly kind: "precipitate"; readonly species: SpeciesId }
  | { readonly kind: "bubbles"; readonly species: SpeciesId };

export interface Stoich {
  readonly species: SpeciesId;
  readonly coef: number;
}

export interface ReactionRule {
  readonly id: ReactionRuleId;
  readonly kind: "neutralization" | "proton_transfer" | "gas" | "precipitation";
  /** Lower runs first. */
  readonly priority: number;
  readonly reactants: ReadonlyArray<Stoich>;
  /** Solids and gases are routed by species kind. */
  readonly products: ReadonlyArray<Stoich>;
  readonly minExtentMol: number;
  /** Negative = exothermic. 0 when not modelled. */
  readonly enthalpyKjPerMol: number;
  readonly equations: { readonly molecular: string; readonly ionic: string; readonly netIonic: string };
  readonly visual: VisualEffect;
  readonly notes: ReadonlyArray<string>;
}

// ---------- events, errors, commands: see protocol.ts ----------

export type { PrecipitateScale, LabEvent, LabError, Measurable, LabCommand } from "./protocol";

// ---------- scenarios ----------

export type ScenarioId = "sandbox" | "titration" | "unknown_id" | "precipitation" | "neutralize" | "dilution" | "solubility";

export interface VisibilityPolicy {
  readonly inspectContents: "full" | "non_unknown_only" | "none";
  readonly revealShelfConcentrations: boolean;
  /** MEASURE ph/temperature needs an attached instrument; HEAT needs a hotplate. */
  readonly instrumentsRequired: boolean;
}
export interface StockRecipe {
  readonly reagentId: ReagentId;
  readonly concentrationM: number;
}
export interface CurvePoint {
  readonly titrantMl: number;
  /** null when no pH meter was attached to the flask at the time. */
  readonly pH: number | null;
  readonly clockS: number;
}

export type ScenarioState =
  | { readonly kind: "sandbox"; readonly seed: number; readonly visibility: VisibilityPolicy }
  | {
      readonly kind: "titration";
      readonly seed: number;
      readonly visibility: VisibilityPolicy;
      readonly flaskId: ContainerId;
      readonly buretteId: ContainerId;
      readonly analyteMl: number;
      readonly titrantM: number;
      readonly secrets: { readonly analyteM: number };
      readonly curve: ReadonlyArray<CurvePoint>;
      readonly toleranceRel: number;
      readonly revealed: boolean;
    }
  | {
      readonly kind: "unknown_id";
      readonly seed: number;
      readonly visibility: VisibilityPolicy;
      readonly samples: ReadonlyArray<{ readonly shelfId: ReagentId; readonly label: string; readonly containerId: ContainerId }>;
      /** Keyed by shelfId. Stripped by publicView. */
      readonly secrets: Readonly<Record<string, StockRecipe>>;
      readonly revealed: boolean;
    }
  | {
      /** Mix two soluble salts and watch a solid form. */
      readonly kind: "precipitation";
      readonly seed: number;
      readonly visibility: VisibilityPolicy;
      readonly beakerId: ContainerId;
      readonly revealed: boolean;
    }
  | {
      /** Bring the beaker to targetPh within tolerance, measured with the pH meter. */
      readonly kind: "neutralize";
      readonly seed: number;
      readonly visibility: VisibilityPolicy;
      readonly beakerId: ContainerId;
      readonly targetPh: number;
      readonly tolerance: number;
      readonly secrets: { readonly startReagent: ReagentId; readonly startM: number };
      readonly revealed: boolean;
    }
  | {
      /** Prepare targetMl of targetM solute from the stockM shelf stock and water, in any container. */
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
    }
  | {
      /** Dissolve a solid, then heat and cool to see solubility change. */
      readonly kind: "solubility";
      readonly seed: number;
      readonly visibility: VisibilityPolicy;
      readonly beakerId: ContainerId;
      readonly soluteId: ReagentId;
      readonly revealed: boolean;
    };

/** One line per objective step, derived from state by scenarios.ts; the UI checklist and the check_objective tool read it. */
export interface ScenarioProgress {
  readonly scenarioId: ScenarioId;
  readonly objective: string;
  readonly steps: ReadonlyArray<{ readonly label: string; readonly done: boolean }>;
  readonly complete: boolean;
  /** A short status line, e.g. "pH 6.4, target 7.0 ± 0.1" or "0.104 M, target 0.100 ± 0.005". */
  readonly detail: string;
}

// ---------- public view (what UI and tools may see) ----------

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

export interface Applied {
  readonly state: LabState;
  readonly events: ReadonlyArray<Observation>;
  /** null for commands that do not enter history (TICK, MEASURE, UNDO, RESET, LOAD_SCENARIO, REVEAL). */
  readonly historyEntry: HistoryEntry | null;
}

/** Compile-time exhaustiveness helper for discriminated switches. */
export function assertNever(x: never): never {
  throw new Error(`unexpected variant: ${JSON.stringify(x)}`);
}
