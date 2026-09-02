import { publicView, type CurvePoint, type Instrument, type LabState, type PublicContainer, type PublicLabState } from "@/engine";
import { notebookRows, type NotebookRow } from "@/lib/notebook";
import type { LabStore } from "./types";

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
  readonly curve: ReadonlyArray<CurvePoint>;
  readonly cumulativeTitrantMl: number;
  readonly latestPh: number | null;
  readonly endpointHint: { readonly titrantMl: number } | null;
}

export const selectTitration: Selector<TitrationSelection | null> = memoOnLab((state) => {
  const pub = selectPublic(state);
  if (pub.scenario.kind !== "titration") return null;
  const { curve, flaskId } = pub.scenario;
  const last = curve[curve.length - 1];
  const cumulativeTitrantMl = last?.titrantMl ?? 0;
  const latestPh = [...curve].reverse().find((p) => p.pH !== null)?.pH ?? null;

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

  return { curve, cumulativeTitrantMl, latestPh, endpointHint };
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
