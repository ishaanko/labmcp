import {
  constants,
  describeEvent,
  publicView,
  scenarioObjective,
  type LabEvent,
  type LabState,
  type PublicContainer,
  type PublicLabState,
  type Rgba,
} from "@/engine";
import { round2 } from "./format";

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


function toHex(c: Rgba): string {
  const ch = (x: number) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0");
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
}

function clarityOf(container: PublicContainer): "clear" | "cloudy" | "opaque" {
  if (container.solids.length === 0) return "clear";
  const heavy = container.solids.some((s) => s.scale === "heavy" || s.scale === "moderate");
  return heavy ? "opaque" : "cloudy";
}

function precipitateOf(container: PublicContainer): { color: string; scale: string } | undefined {
  const solid = [...container.solids].sort((a, b) => b.moles - a.moles)[0];
  return solid ? { color: toHex(solid.color), scale: solid.scale } : undefined;
}

function summarizeContainer(container: PublicContainer): ContainerSummary {
  return {
    id: container.id,
    type: container.type,
    label: container.label,
    capacityMl: round2(container.capacityMl),
    volumeMl: round2(container.volumeMl),
    temperatureC: round2(container.temperatureC),
    appearance: {
      color: container.colorName,
      clarity: clarityOf(container),
      precipitate: precipitateOf(container),
      bubbling: container.gasEffects.length > 0,
    },
    indicators: container.indicators.map((d) => d.indicator),
    contentsVisible: container.contents.kind === "visible",
    knownContents: container.contents.kind === "visible" ? Object.keys(container.contents.species) : undefined,
    position: { x: container.position.x, y: container.position.y },
    stirring: container.stir.kind === "stirring",
    thermal: container.thermal.kind,
  };
}

/** True when the event names a container that is currently redacted (hidden contents). */
function eventContainerHidden(pub: PublicLabState, event: LabEvent): boolean {
  const id = eventContainerId(event);
  if (!id) return false;
  const container = pub.objects.find((o) => o.kind === "container" && o.id === id);
  return container !== undefined && container.kind === "container" && container.contents.kind === "hidden";
}

function eventContainerId(event: LabEvent): string | null {
  switch (event.kind) {
    case "LIQUID_ADDED":
    case "INDICATOR_ADDED":
    case "STIR_STARTED":
    case "THERMAL_SET":
    case "MEASUREMENT":
    case "CONTENTS_INSPECTED":
    case "REACTION":
    case "COLOR_SHIFT":
    case "PRECIPITATE_FORMED":
    case "BUBBLES":
    case "TEMPERATURE_CHANGE":
    case "PH_CHANGE":
    case "NO_REACTION":
    case "SOLIDS_SETTLED":
    case "DISPOSED":
    case "OVERFLOW_REJECTED":
      return event.containerId;
    default:
      return null;
  }
}

/** The container a PH_CHANGE/TEMPERATURE_CHANGE event names, or undefined off-bench. */
function findPublicContainer(pub: PublicLabState, containerId: string): PublicContainer | undefined {
  const found = pub.objects.find((o) => o.kind === "container" && o.id === containerId);
  return found && found.kind === "container" ? found : undefined;
}

/**
 * Species, reaction identity, and pH are only permitted evidence once a container's contents are
 * visible (pH is also allowed the moment a pH meter is attached, same as publicView.pH); color,
 * precipitate scale, bubbling, and temperature are always fair game. Hidden containers get a
 * generic line instead of the real one so lastObservations never leaks a challenge answer.
 */
export function safeObservationLine(pub: PublicLabState, event: LabEvent): string | null {
  if (!eventContainerHidden(pub, event)) return describeEvent(event);
  switch (event.kind) {
    case "REACTION":
      return "A reaction occurred.";
    case "PRECIPITATE_FORMED":
      return "A precipitate formed.";
    case "BUBBLES":
      return "Bubbling observed.";
    case "LIQUID_ADDED":
      return "Liquid added.";
    case "INDICATOR_ADDED":
      return "Indicator added.";
    case "STIR_STARTED":
      return "Stirred.";
    case "THERMAL_SET":
      return "Temperature setting changed.";
    case "CONTENTS_INSPECTED":
      return null;
    case "PH_CHANGE": {
      const container = findPublicContainer(pub, event.containerId);
      // Matches publicView.pH: a pH meter attached to a hidden container still reveals its pH.
      return container && container.pH !== null ? describeEvent(event) : null;
    }
    case "TEMPERATURE_CHANGE":
      // The `(reaction)` cause would itself reveal that a reaction fired; the ΔT alone is fine.
      return event.cause === "reaction"
        ? `${event.containerId} temperature changed from ${event.fromC.toFixed(1)} °C to ${event.toC.toFixed(1)} °C.`
        : describeEvent(event);
    default:
      return describeEvent(event);
  }
}

export function summarizeLab(lab: LabState, stateVersion: number): LabSummary {
  const pub = publicView(lab);
  const containers = pub.objects.filter((o): o is PublicContainer => o.kind === "container");
  const instruments = pub.objects.filter((o) => o.kind === "instrument");

  const lastObservations = lab.observations
    .slice(-20)
    .map((o) => safeObservationLine(pub, o.event))
    .filter((line): line is string => line !== null && line.length > 0)
    .slice(-5);

  const titration =
    pub.scenario.kind === "titration"
      ? {
          flaskId: pub.scenario.flaskId,
          buretteId: pub.scenario.buretteId,
          analyteMl: round2(pub.scenario.analyteMl),
          titrantM: round2(pub.scenario.titrantM),
        }
      : undefined;

  return {
    scenario: {
      id: pub.scenario.kind,
      objective: scenarioObjective(pub.scenario.kind),
      revealed: pub.scenario.kind === "sandbox" ? true : pub.scenario.revealed,
      titration,
    },
    clockS: round2(pub.clockS),
    ambientC: round2(pub.ambientC),
    stateVersion,
    containers: containers.map(summarizeContainer),
    instruments: instruments.map((i) => ({ id: i.id, type: i.type, attachedTo: i.attachedTo })),
    shelf: pub.shelf.map((s) => ({ reagentId: s.reagentId, label: s.label, concentrationM: s.concentrationM })),
    indicatorsAvailable: pub.indicatorsAvailable,
    equipmentTypes: [...constants.EQUIPMENT_TYPES],
    lastObservations,
  };
}
