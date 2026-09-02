import {
  assertNever,
  describeEvent,
  type Actor,
  type LabCommand,
  type LabEvent,
  type LabState,
  type Observation,
  type PublicLabState,
} from "@/engine";
import type { FeedEntry } from "@/store/types";
import { fmtMl } from "./format";
import { safeObservationLine } from "./summary";

/**
 * Adapter between the engine's Observation/LabEvent shapes and the store, toasts, and feed.
 * If the engine's event names ever change, only this file should need to change.
 */

// ---------- toast sink ----------
// The store has no hard dependency on the toast UI (sonner). components/ui/toasts.ts calls
// setToastSink once on mount; until then every toast is silently dropped.

export interface ToastMessage {
  readonly kind: "success" | "error" | "info";
  readonly title: string;
  readonly description?: string;
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

// ---------- labels ----------

function labelFor(lab: LabState, id: string | null | undefined): string {
  if (id === null || id === undefined) return "the bench";
  const obj = lab.objects.find((o) => o.id === id);
  if (!obj) return id;
  return obj.kind === "container" ? obj.label : `${obj.type} ${obj.id}`;
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
      return `Added ${fmtMl(command.volumeMl)} ${command.reagentId} to ${labelFor(lab, command.containerId)}`;
    case "TRANSFER_LIQUID":
      return `Poured ${fmtMl(command.volumeMl)} ${labelFor(lab, command.fromId)} -> ${labelFor(lab, command.toId)}`;
    case "DISPENSE":
      return `Dispensed ${fmtMl(command.volumeMl)} ${labelFor(lab, command.buretteId)} -> ${labelFor(lab, command.toId)}`;
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

/**
 * Joins redacted describeEvent lines into the one-line "observation" attached to feed entries and
 * tool results. Routed through the same safeObservationLine as lastObservations/get_notebook, so a
 * hidden container's pH or reaction chemistry never reaches this string either.
 */
export function summarizeEvents(pub: PublicLabState, events: ReadonlyArray<Observation>): string {
  const lines = events
    .map((o) => safeObservationLine(pub, o.event))
    .filter((line): line is string => line !== null && line.length > 0);
  return lines.length > 0 ? lines.join(" ") : "Nothing changed.";
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

/** Toasts fire only for events worth interrupting the user for; routine reads stay in the feed. */
export function eventsToToasts(events: ReadonlyArray<Observation>, _actor: Actor): ReadonlyArray<ToastMessage> {
  const toasts: ToastMessage[] = [];
  for (const o of events) {
    const event = o.event;
    if (!NOTABLE_KINDS.has(event.kind)) continue;
    if (event.kind === "COLOR_SHIFT" && !event.indicatorTransition) continue;
    toasts.push({ kind: toastKindFor(event), title: describeEvent(event) });
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
