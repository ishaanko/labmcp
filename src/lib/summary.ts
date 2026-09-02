import {
  constants,
  describeEvent,
  publicView,
  scenarioObjective,
  type LabEvent,
  type LabState,
  type Observation,
  type PublicContainer,
  type PublicLabState,
  type Rgba,
} from "@/engine";
import { round2 } from "./format";

/**
 * Plain "Flask A" / "Flask A (c_1)" text for a bench object id. Duplicates `lib/events.ts`'s
 * `labelFor`/`labelLookup` on purpose: that file already imports from this one for
 * `safeObservationLine`, so importing back would cycle.
 */
function plainLabel(pub: PublicLabState, id: string): string {
  const obj = pub.objects.find((o) => o.id === id);
  if (!obj) return id;
  return obj.kind === "container" ? obj.label : obj.type.replace(/_/g, " ");
}

/** "Flask A (c_1)": the default lookup, id included once for the agent's own follow-up tool calls. */
function idLabels(pub: PublicLabState): (id: string) => string {
  return (id) => `${plainLabel(pub, id)} (${id})`;
}

/** "Flask A": no id, for the notebook (deliverable 5 of the copy rules bans ids there outright). */
export function plainLabels(pub: PublicLabState): (id: string) => string {
  return (id) => plainLabel(pub, id);
}

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
export function eventContainerHidden(pub: PublicLabState, event: LabEvent): boolean {
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
 * A pour's verb depends on whether the source is a burette, which the event itself can't say
 * (LIQUID_TRANSFERRED is the physical effect of both `transfer` and `dispense`); resolved here from
 * `pub` instead of threading the command through the whole observation pipeline. Never secret, so it
 * runs before the hidden-container check below.
 */
function describePour(pub: PublicLabState, event: Extract<LabEvent, { kind: "LIQUID_TRANSFERRED" }>, labels: (id: string) => string): string {
  const source = pub.objects.find((o) => o.id === event.fromId);
  const fromBurette = source?.kind === "container" && source.type === "burette";
  return fromBurette
    ? `Dispensed ${event.volumeMl.toFixed(1)} mL into ${labels(event.toId)}.`
    : `Poured ${event.volumeMl.toFixed(1)} mL from ${labels(event.fromId)} into ${labels(event.toId)}.`;
}

/**
 * Species, reaction identity, and pH are only permitted evidence once a container's contents are
 * visible (pH is also allowed the moment a pH meter is attached, same as publicView.pH); color,
 * precipitate scale, bubbling, and temperature are always fair game. Hidden containers still name
 * themselves and report volumes normally (point 3 of the copy rules): only chemistry is redacted.
 */
export function safeObservationLine(pub: PublicLabState, event: LabEvent, labels: (id: string) => string = idLabels(pub)): string | null {
  if (event.kind === "LIQUID_TRANSFERRED") return describePour(pub, event, labels);
  if (!eventContainerHidden(pub, event)) return describeEvent(event, labels);
  switch (event.kind) {
    case "REACTION":
      return "A reaction occurred.";
    case "PRECIPITATE_FORMED":
      return "A precipitate formed.";
    case "BUBBLES":
      return "Bubbling observed.";
    case "CONTENTS_INSPECTED":
      return null;
    case "PH_CHANGE": {
      const container = findPublicContainer(pub, event.containerId);
      // Matches publicView.pH: a pH meter attached to a hidden container still reveals its pH.
      return container && container.pH !== null ? describeEvent(event, labels) : null;
    }
    case "TEMPERATURE_CHANGE":
      // describeEvent already keeps "reaction"/"mixing" causes out of the text; built explicitly
      // here too so a hidden container's ΔT never depends on that staying true.
      return event.fromC.toFixed(1) === event.toC.toFixed(1)
        ? ""
        : `${event.toC > event.fromC ? "Warmed" : "Cooled"} to ${event.toC.toFixed(1)} °C.`;
    default:
      return describeEvent(event, labels);
  }
}

/** LIQUID_ADDED/LIQUID_TRANSFERRED always lead a command's own batch of events; never a trailing clause. */
const MIX_KINDS: ReadonlySet<LabEvent["kind"]> = new Set(["LIQUID_ADDED", "LIQUID_TRANSFERRED"]);

/**
 * Turns one command's worth of events into a single copy line, e.g. "Dispensed 0.5 mL into
 * Flask A (c_1). pH 7.00 to 10.99." Routed through `safeObservationLine`, so a hidden container's
 * pH, moles, or reaction chemistry never reaches this string.
 *
 * Two rules keep it from reading as a diff dump: a generic REACTION clause is dropped once a
 * PRECIPITATE_FORMED or BUBBLES clause already says a reaction happened (neutralization has no
 * such visual, so it always keeps its own "Neutralized … H+." clause); and NO_REACTION only
 * survives when it is the *only* thing the command changed besides volume, so a titrant landing
 * past the endpoint into a salt solution no longer reports "no reaction" over its own pH/color move.
 */
export function mergeObservationLines(
  pub: PublicLabState,
  events: ReadonlyArray<LabEvent>,
  labels: (id: string) => string = idLabels(pub),
): string {
  const hasVisualReaction = events.some((e) => e.kind === "PRECIPITATE_FORMED" || e.kind === "BUBBLES");
  // A redacted "A reaction occurred." adds nothing next to the pH or color move it caused.
  const hasReadout = events.some((e) => e.kind === "PH_CHANGE" || e.kind === "COLOR_SHIFT");

  const lines: string[] = [];
  let changedBesidesVolume = false;
  for (const event of events) {
    if (event.kind === "NO_REACTION") continue;
    if (event.kind === "REACTION" && hasVisualReaction && event.ruleId !== "neutralization") continue;
    if (event.kind === "REACTION" && hasReadout && eventContainerHidden(pub, event)) continue;
    const line = safeObservationLine(pub, event, labels);
    if (!line) continue;
    lines.push(line);
    if (!MIX_KINDS.has(event.kind)) changedBesidesVolume = true;
  }

  if (!changedBesidesVolume) {
    const noReaction = events.find((e) => e.kind === "NO_REACTION");
    if (noReaction) {
      const line = safeObservationLine(pub, noReaction, labels);
      if (line) lines.push(line);
    }
  }

  return lines.length > 0 ? lines.join(" ") : "Nothing changed.";
}

/**
 * PH_CHANGE, COLOR_SHIFT, REACTION, PRECIPITATE_FORMED, BUBBLES, NO_REACTION and a reaction/mixing
 * TEMPERATURE_CHANGE only ever derive from the command whose event immediately precedes them in
 * `LabState.observations` (see engine/reducer.ts's `commitTouched`); nothing mints one on its own.
 * A `TICK`'s ambient TEMPERATURE_CHANGE/SOLIDS_SETTLED are the exception and always start a new group.
 */
function isDerivedEvent(event: LabEvent): boolean {
  switch (event.kind) {
    case "PH_CHANGE":
    case "COLOR_SHIFT":
    case "REACTION":
    case "PRECIPITATE_FORMED":
    case "BUBBLES":
    case "NO_REACTION":
      return true;
    case "TEMPERATURE_CHANGE":
      return event.cause !== "thermal";
    default:
      return false;
  }
}

/** Splits a flat observation log into one group per command, for a one-row-per-action notebook. */
export function groupCommandBatches(observations: ReadonlyArray<Observation>): ReadonlyArray<ReadonlyArray<Observation>> {
  const groups: Observation[][] = [];
  for (const o of observations) {
    const current = groups[groups.length - 1];
    if (isDerivedEvent(o.event) && current) current.push(o);
    else groups.push([o]);
  }
  return groups;
}

export function summarizeLab(lab: LabState, stateVersion: number): LabSummary {
  const pub = publicView(lab);
  const containers = pub.objects.filter((o): o is PublicContainer => o.kind === "container");
  const instruments = pub.objects.filter((o) => o.kind === "instrument");

  const lastObservations = groupCommandBatches(lab.observations)
    .slice(-5)
    .map((group) => mergeObservationLines(pub, group.map((o) => o.event)))
    .filter((line) => line.length > 0 && line !== "Nothing changed.");

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
