import type { LabState } from "@/engine";

/**
 * The compact, redacted lab snapshot attached to every tool response. Built only from
 * engine.publicView, so it can never contain secrets or hidden species. No pH, no moles,
 * no concentrations of container contents: the agent measures those with instruments.
 */
export interface ContainerSummary {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly capacityMl: number;
  readonly volumeMl: number;
  readonly temperatureC: number;
  readonly appearance: {
    readonly color: string;
    readonly clarity: "clear" | "cloudy" | "opaque";
    readonly precipitate?: { readonly color: string; readonly scale: string };
    readonly bubbling: boolean;
  };
  readonly indicators: ReadonlyArray<string>;
  readonly contentsVisible: boolean;
  /** Species ids only, only when contents are visible. */
  readonly knownContents?: ReadonlyArray<string>;
  readonly position: { readonly x: number; readonly y: number };
  readonly stirring: boolean;
  readonly thermal: string;
}

export interface LabSummary {
  readonly scenario: {
    readonly id: string;
    readonly objective: string;
    readonly revealed: boolean;
    readonly titration?: { readonly flaskId: string; readonly buretteId: string; readonly analyteMl: number; readonly titrantM: number };
  };
  readonly clockS: number;
  readonly ambientC: number;
  readonly stateVersion: number;
  readonly containers: ReadonlyArray<ContainerSummary>;
  readonly instruments: ReadonlyArray<{ readonly id: string; readonly type: string; readonly attachedTo: string | null }>;
  readonly shelf: ReadonlyArray<{ readonly reagentId: string; readonly label: string; readonly concentrationM: number | null }>;
  readonly indicatorsAvailable: ReadonlyArray<string>;
  readonly equipmentTypes: ReadonlyArray<string>;
  readonly lastObservations: ReadonlyArray<string>;
}

// STUB: replaced by the store agent.
export function summarizeLab(_lab: LabState, _stateVersion: number): LabSummary {
  throw new Error("not implemented");
}
