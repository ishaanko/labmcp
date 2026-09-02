import { publicView, type CurvePoint, type Instrument, type LabState, type PublicContainer, type PublicLabState, type Vec2 } from "@/engine";
import { notebookRows, type NotebookRow } from "@/lib/notebook";
import type { FeedEntry, LabStore } from "./types";

export type Selector<T> = (state: LabStore) => T;

/**
 * Caches a derivation on `state.lab` identity. zustand's useSyncExternalStore compares selector
 * results by reference, so a selector that builds a fresh array or object on every call re-renders
 * forever. Every selector below that returns a new value goes through this.
 */
function memoOnLab<T>(compute: (state: LabStore) => T): Selector<T> {
  let lastLab: LabState | null = null;
  let last: T | null = null;
  return (state) => {
    if (state.lab !== lastLab || last === null) {
      lastLab = state.lab;
      last = compute(state);
    }
    return last;
  };
}

// publicView(lab) is pure but not free; every selector below reads through this one.
export const selectPublic: Selector<PublicLabState> = memoOnLab((state) => publicView(state.lab));

const isPublicContainer = (o: PublicContainer | Instrument): o is PublicContainer => o.kind === "container";

export function selectContainer(id: string): Selector<PublicContainer | undefined> {
  return (state) => selectPublic(state).objects.filter(isPublicContainer).find((c) => c.id === id);
}

export const selectSelected: Selector<PublicContainer | Instrument | undefined> = (state) => {
  const id = state.ui.selectedId;
  if (id === null) return undefined;
  return selectPublic(state).objects.find((o) => o.id === id);
};

export const selectContainers: Selector<ReadonlyArray<PublicContainer>> = memoOnLab((state) =>
  selectPublic(state).objects.filter(isPublicContainer),
);

export const selectInstruments: Selector<ReadonlyArray<Instrument>> = memoOnLab((state) =>
  selectPublic(state).objects.filter((o): o is Instrument => o.kind === "instrument"),
);

export interface LegalActions {
  readonly canHeat: boolean;
  readonly canDispenseFrom: boolean;
  readonly canMeasurePh: boolean;
}

export function selectLegalActions(id: string): Selector<LegalActions> {
  return memoOnLab((state) => {
    const pub = selectPublic(state);
    const container = pub.objects.filter(isPublicContainer).find((c) => c.id === id);
    const hasHotplate = pub.objects.some((o) => o.kind === "instrument" && o.type === "hotplate");
    const hasPhMeter = pub.objects.some((o) => o.kind === "instrument" && o.type === "ph_meter");
    return {
      canHeat: container !== undefined && hasHotplate,
      canDispenseFrom: container !== undefined && container.type === "burette" && container.volumeMl > 0,
      canMeasurePh: container !== undefined && hasPhMeter,
    };
  });
}

export const selectNotebook: Selector<ReadonlyArray<NotebookRow>> = memoOnLab((state) => notebookRows(state.lab));

export interface TitrationSelection {
  readonly flaskId: string;
  readonly curve: ReadonlyArray<CurvePoint>;
  readonly cumulativeTitrantMl: number;
  readonly latestPh: number | null;
  readonly endpointHint: { readonly titrantMl: number } | null;
  /** Titrant mL at the endpoint, or null before it's reached. Same value as `endpointHint?.titrantMl`. */
  readonly endpointMl: number | null;
  /**
   * Upper-bound equivalence volume for the curve's x-axis, from `analyteMl` and the titration
   * scenario's fixed 0.12 M upper bound on analyte concentration (never the secret analyteM).
   */
  readonly expectedEquivalenceUpperMl: number;
}

/** Analyte concentrations in the titration scenario are drawn from [0.08, 0.12] M; see scenarios.ts. */
const ANALYTE_M_UPPER_BOUND = 0.12;

export const selectTitration: Selector<TitrationSelection | null> = memoOnLab((state) => {
  const pub = selectPublic(state);
  if (pub.scenario.kind !== "titration") return null;
  const { curve, flaskId, analyteMl, titrantM } = pub.scenario;
  const last = curve[curve.length - 1];
  const cumulativeTitrantMl = last?.titrantMl ?? 0;
  // The curve only carries pH for dispenses made while a probe was attached; between those
  // points the readout falls back to the attached probe's live reading (what the tag shows).
  const flask = pub.objects.filter(isPublicContainer).find((c) => c.id === flaskId);
  const latestPh = [...curve].reverse().find((p) => p.pH !== null)?.pH ?? flask?.pH ?? null;

  const endpointEvent = state.lab.observations.find(
    (o) => o.event.kind === "COLOR_SHIFT" && o.event.containerId === flaskId && o.event.indicatorTransition,
  );
  const endpointHint =
    endpointEvent === undefined
      ? null
      : (() => {
          const point = [...curve].reverse().find((p) => p.clockS <= endpointEvent.clockS) ?? curve[0];
          return point ? { titrantMl: point.titrantMl } : null;
        })();

  const expectedEquivalenceUpperMl = titrantM > 0 ? (analyteMl * ANALYTE_M_UPPER_BOUND) / titrantM : 0;

  return {
    flaskId,
    curve,
    cumulativeTitrantMl,
    latestPh,
    endpointHint,
    endpointMl: endpointHint?.titrantMl ?? null,
    expectedEquivalenceUpperMl,
  };
});

export interface ObjectiveStep {
  readonly key: string;
  readonly label: string;
  readonly done: boolean;
}

/** Titration checklist shown in the objective chip and bench summary; empty outside that scenario. */
export const selectObjectiveSteps: Selector<ReadonlyArray<ObjectiveStep>> = memoOnLab((state) => {
  const pub = selectPublic(state);
  if (pub.scenario.kind !== "titration") return [];
  const { flaskId, revealed } = pub.scenario;
  const flask = pub.objects.filter(isPublicContainer).find((c) => c.id === flaskId);
  const probeAttached = pub.objects.some((o) => o.kind === "instrument" && o.type === "ph_meter" && o.attachedTo === flaskId);
  const indicatorAdded = flask !== undefined && flask.indicators.length > 0;
  const endpointReached = selectTitration(state)?.endpointHint != null;

  return [
    { key: "probe", label: "Attach pH probe", done: probeAttached },
    { key: "indicator", label: "Add indicator", done: indicatorAdded },
    { key: "endpoint", label: "Reach endpoint", done: endpointReached },
    { key: "reveal", label: "Reveal result", done: revealed },
  ];
});

export interface AgentTarget {
  readonly targetId: string;
  /** e.g. "dispense 2.0 mL", built from the tool name and its most salient numeric argument. */
  readonly label: string;
  readonly ts: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Tool inputs use the snake_case keys from `webmcp/schemas.ts` (`volume_ml`, `target_c`, `drops`). */
function numericArgSummary(input: unknown): string | null {
  if (!isRecord(input)) return null;
  const volumeMl = input.volume_ml;
  if (typeof volumeMl === "number") return `${volumeMl.toFixed(1)} mL`;
  const targetC = input.target_c;
  if (typeof targetC === "number") return `${targetC}°C`;
  const drops = input.drops;
  if (typeof drops === "number") return `${drops} drops`;
  return null;
}

// Cached on the found entry's identity (feed entries are immutable once pushed), so AgentMarker
// gets a stable reference between renders instead of a fresh object on every store change.
let lastAgentEntry: FeedEntry | null = null;
let lastAgentTarget: AgentTarget | null = null;

/** The vessel/instrument the newest agent tool call acted on, for the bench marker (C6). */
export const selectLastAgentTarget: Selector<AgentTarget | null> = (state) => {
  let found: Extract<FeedEntry, { kind: "tool_call" }> | null = null;
  for (const entry of state.feed) {
    if (entry.kind === "tool_call" && entry.targetId !== undefined) {
      found = entry;
      break;
    }
  }
  if (found === lastAgentEntry) return lastAgentTarget;
  lastAgentEntry = found;
  if (!found || found.targetId === undefined) {
    lastAgentTarget = null;
    return null;
  }
  const verb = found.tool.split("_")[0] ?? found.tool;
  const arg = numericArgSummary(found.input);
  lastAgentTarget = { targetId: found.targetId, label: arg ? `${verb} ${arg}` : verb, ts: found.ts };
  return lastAgentTarget;
};

interface Placed {
  readonly id: string;
  readonly kind: "container" | "instrument";
  readonly position: Vec2;
}

/**
 * The container one row in front of a burette (same x, grid y + 1): the cell its tip drips into
 * (C3.2 titration layout). Shared by the burette card, the D key, and the burette click-and-hold.
 */
export function containerInFrontOf<T extends Placed>(burette: Placed, objects: ReadonlyArray<T>): (T & { kind: "container" }) | undefined {
  return objects.find(
    (o): o is T & { kind: "container" } =>
      o.kind === "container" &&
      o.id !== burette.id &&
      Math.abs(o.position.x - burette.position.x) < 0.01 &&
      Math.abs(o.position.y - (burette.position.y + 1)) < 0.01,
  );
}
