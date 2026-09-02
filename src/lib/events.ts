import {
  assertNever,
  describeEvent,
  publicView,
  titrationCurve,
  type Actor,
  type LabCommand,
  type LabEvent,
  type LabState,
  type Observation,
  type PublicLabState,
} from "@/engine";
import { labelFor, labelLookup } from "@/lib/labels";
import type { FeedEntry } from "@/store/types";
import { fmtMl } from "./format";
import { mergeObservationLines, safeObservationLine, visibleObservationEvents } from "./summary";

/**
 * Adapter between the engine's Observation/LabEvent shapes and the store, toasts, and feed.
 * If the engine's event names ever change, only this file should need to change.
 */

// ---------- toast sink ----------
// The store has no hard dependency on the toast UI (sonner). components/ui/toasts.ts calls
// setToastSink once on mount; until then every toast is silently dropped.

export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ToastMessage {
  readonly kind: "success" | "error" | "info";
  readonly title: string;
  readonly description?: string;
  readonly action?: ToastAction;
  /** Overrides toasts.ts's per-kind default duration; used for the 6s overshoot warning. */
  readonly durationMs?: number;
}
export type ToastSink = (t: ToastMessage) => void;

let toastSink: ToastSink = () => {};
export function setToastSink(fn: ToastSink): void {
  toastSink = fn;
}
export function emitToast(t: ToastMessage): void {
  toastSink(t);
}

// ---------- animation sink ----------
// Same pattern for the scene: src/scene/animationQueue.ts calls setAnimationSink(enqueue) once
// on mount. The batch carries both states so the scene can diff, or clear and rebuild on
// RESET / LOAD_SCENARIO by checking the event kinds itself.

export interface AnimationBatch {
  readonly prev: LabState;
  readonly next: LabState;
  readonly events: ReadonlyArray<Observation>;
  readonly actor: Actor;
  readonly version: number;
}
export type AnimationSink = (b: AnimationBatch) => void;

let animationSink: AnimationSink = () => {};
export function setAnimationSink(fn: AnimationSink): void {
  animationSink = fn;
}
export function emitAnimation(b: AnimationBatch): void {
  animationSink(b);
}

// ---------- describeCommand ----------

/** Short human line for the activity feed, e.g. "Poured 25 mL Flask A -> Beaker B". */
export function describeCommand(command: LabCommand, lab: LabState): string {
  switch (command.kind) {
    case "PLACE_OBJECT":
      return `Added ${command.objectType.replace(/_/g, " ")} to the bench`;
    case "REMOVE_OBJECT":
      return `Removed ${labelFor(lab, command.objectId)}`;
    case "ATTACH_INSTRUMENT":
      return command.containerId
        ? `Attached ${labelFor(lab, command.instrumentId)} to ${labelFor(lab, command.containerId)}`
        : `Detached ${labelFor(lab, command.instrumentId)}`;
    case "ADD_REAGENT":
      return `Added ${fmtMl(command.volumeMl)} ${lab.shelf.find((s) => s.reagentId === command.reagentId)?.label ?? command.reagentId} to ${labelFor(lab, command.containerId)}`;
    case "TRANSFER_LIQUID":
      return `Poured ${fmtMl(command.volumeMl)} from ${labelFor(lab, command.fromId)} into ${labelFor(lab, command.toId)}`;
    case "DISPENSE":
      return `Dispensed ${fmtMl(command.volumeMl)} into ${labelFor(lab, command.toId)}`;
    case "STIR":
      return `Stirred ${labelFor(lab, command.containerId)}`;
    case "HEAT":
      return `Heated ${labelFor(lab, command.containerId)} to ${command.targetC}°C`;
    case "COOL":
      return `Cooled ${labelFor(lab, command.containerId)}`;
    case "ADD_INDICATOR":
      return `Added ${command.indicator} to ${labelFor(lab, command.containerId)}`;
    case "MEASURE":
      return `Measured ${command.quantity} of ${labelFor(lab, command.containerId)}`;
    case "DISPOSE":
      return `Disposed contents of ${labelFor(lab, command.containerId)}`;
    case "MOVE_OBJECT":
      return `Moved ${labelFor(lab, command.objectId)}`;
    case "TICK":
      return "Time advanced";
    case "UNDO":
      return "Undid last action";
    case "RESET":
      return "Reset experiment";
    case "LOAD_SCENARIO":
      return `Loaded ${command.scenarioId} scenario`;
    case "REVEAL":
      return "Revealed identities";
    default:
      return assertNever(command);
  }
}

/** Container or instrument the command primarily acts on, for the scene's agent-presence ring. */
export function targetOfCommand(command: LabCommand): string | undefined {
  switch (command.kind) {
    case "PLACE_OBJECT":
    case "TICK":
    case "UNDO":
    case "RESET":
    case "LOAD_SCENARIO":
    case "REVEAL":
      return undefined;
    case "REMOVE_OBJECT":
    case "MOVE_OBJECT":
      return command.objectId;
    case "ATTACH_INSTRUMENT":
      return command.containerId ?? command.instrumentId;
    case "ADD_REAGENT":
    case "STIR":
    case "HEAT":
    case "COOL":
    case "ADD_INDICATOR":
    case "MEASURE":
    case "DISPOSE":
      return command.containerId;
    case "TRANSFER_LIQUID":
      return command.toId;
    case "DISPENSE":
      return command.toId;
    default:
      return assertNever(command);
  }
}

// ---------- summarizeEvents ----------

/** Adapts a dispatch's `Observation[]` batch (already one command's worth) to `mergeObservationLines`. */
export function summarizeEvents(pub: PublicLabState, events: ReadonlyArray<Observation>): string {
  return mergeObservationLines(
    pub,
    events.map((o) => o.event),
  );
}

// ---------- toasts ----------

const NOTABLE_KINDS: ReadonlySet<LabEvent["kind"]> = new Set([
  "REACTION",
  "PRECIPITATE_FORMED",
  "BUBBLES",
  "NO_REACTION",
  "COLOR_SHIFT",
  "OVERFLOW_REJECTED",
  "COMMAND_REJECTED",
]);

function toastKindFor(event: LabEvent): ToastMessage["kind"] {
  if (event.kind === "OVERFLOW_REJECTED" || event.kind === "COMMAND_REJECTED") return "error";
  if (event.kind === "NO_REACTION") return "info";
  return "success";
}

const OVERSHOOT_PH = 10.5;

/**
 * True when `containerId` already crossed the phenolphthalein endpoint at some point strictly
 * before `beforeSeq` (i.e. in an earlier command's events, not the batch producing the pH we're
 * checking now). Distinguishes "past the endpoint" overshoot from the endpoint moment itself.
 */
function hasPriorEndpoint(lab: LabState, containerId: string, beforeSeq: number): boolean {
  return lab.observations.some(
    (o) => o.seq < beforeSeq && o.event.kind === "COLOR_SHIFT" && o.event.containerId === containerId && o.event.indicatorTransition,
  );
}

/**
 * Toasts fire only for events worth interrupting the user for; routine reads stay in the feed.
 *
 * `next` (the lab state the events batch was derived from) and `undo` (fires the overshoot
 * toast's Undo action) are optional and threaded in by the caller rather than read from the
 * store here, so this stays a pure function with no import cycle back to `store/labStore.ts`.
 * Without them the titration-specific endpoint/overshoot copy below is skipped and those events
 * fall through to the generic `describeEvent` toast instead; `store/labStore.ts`'s `dispatch`
 * should pass both (`next`, and `() => void get().dispatch({ kind: "UNDO" }, "human")`) to get
 * the full C7 behaviour.
 *
 * Which events are worth a toast at all (dropping a redundant `NO_REACTION` or a hidden
 * container's redacted `REACTION`) is `summary.ts`'s `visibleObservationEvents`, the same policy
 * the feed line and the tool response's `events` array use.
 */
export function eventsToToasts(
  events: ReadonlyArray<Observation>,
  _actor: Actor,
  next?: LabState,
  undo?: () => void,
): ReadonlyArray<ToastMessage> {
  const flaskId = next && next.scenario.kind === "titration" ? next.scenario.flaskId : null;
  const batchSeq = events.length > 0 ? Math.min(...events.map((o) => o.seq)) : 0;
  const labels = next ? labelLookup(next) : undefined;
  // Toasts are redacted like the feed: a hidden flask's neutralization moles are its answer key.
  const pub = next ? publicView(next) : null;
  const visible = visibleObservationEvents(pub, events.map((o) => o.event));

  const toasts: ToastMessage[] = [];
  for (const event of visible) {
    if (event.kind === "COLOR_SHIFT" && event.indicatorTransition && next && flaskId !== null && event.containerId === flaskId) {
      const curve = titrationCurve(next);
      const ml = (curve[curve.length - 1]?.titrantMl ?? 0).toFixed(2);
      toasts.push({ kind: "success", title: `Endpoint: faint pink at ${ml} mL` });
      continue;
    }

    if (
      event.kind === "PH_CHANGE" &&
      next &&
      undo &&
      flaskId !== null &&
      event.containerId === flaskId &&
      event.to > OVERSHOOT_PH &&
      hasPriorEndpoint(next, flaskId, batchSeq)
    ) {
      toasts.push({
        kind: "info",
        title: "Past the endpoint. The pink is strong.",
        durationMs: 6000,
        action: { label: "Undo", onClick: undo },
      });
      continue;
    }

    if (!NOTABLE_KINDS.has(event.kind)) continue;
    if (event.kind === "COLOR_SHIFT" && !event.indicatorTransition) continue;
    const title = pub ? safeObservationLine(pub, event, labels) : describeEvent(event, labels);
    if (title) toasts.push({ kind: toastKindFor(event), title });
  }
  return toasts;
}

// ---------- measurements ----------

type MeasurementInput = Omit<Extract<FeedEntry, { kind: "measurement" }>, "id" | "ts">;

/** Feed rows for MEASUREMENT events, e.g. "pH 3.12" tagged to the reading container. */
export function eventsToMeasurements(events: ReadonlyArray<Observation>, actor: Actor): ReadonlyArray<MeasurementInput> {
  const rows: MeasurementInput[] = [];
  for (const o of events) {
    const event = o.event;
    if (event.kind !== "MEASUREMENT") continue;
    const reading = event.reading;
    if (reading.kind === "ph") {
      rows.push({ source: actor, kind: "measurement", containerId: event.containerId, label: "pH", value: reading.value, unit: "" });
    } else if (reading.kind === "temperature") {
      rows.push({
        source: actor,
        kind: "measurement",
        containerId: event.containerId,
        label: "Temperature",
        value: reading.valueC,
        unit: "°C",
      });
    } else {
      rows.push({ source: actor, kind: "measurement", containerId: event.containerId, label: "Volume", value: reading.valueMl, unit: "mL" });
    }
  }
  return rows;
}
