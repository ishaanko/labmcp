/**
 * Applies a validated command's direct state change (applyPhysical), then runs reaction
 * resolution and observation derivation for whichever containers it touched, and commits the
 * result with seq/clock/actor stamping (A2.1). UNDO, RESET, LOAD_SCENARIO, REVEAL and TICK are
 * short-circuited before the generic pipeline since none of them run through applyPhysical.
 */
import { AMBIENT_C, HEAT_RATE_C_PER_S, PASSIVE_RATE_C_PER_S, SETTLE_S } from "./constants";
import type { ContainerId } from "./ids";
import { derivePh } from "./ph";
import { deriveObservations, eventsForFired } from "./observations";
import { resolveReactions } from "./reactions";
import { loadScenario, SCENARIO_IDS } from "./scenarios";
import {
  assertNever,
  err,
  ok,
  type Actor,
  type Applied,
  type Container,
  type HistoryEntry,
  type LabCommand,
  type LabError,
  type LabEvent,
  type LabState,
  type Observation,
  type ReactionRecord,
  type Result,
  type ScenarioId,
  type ScenarioState,
  type StirState,
} from "./types";
import { isScenarioRevealed, replaceObject, validate } from "./commands";
import { applyPhysical } from "./physical";

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const UNDOABLE_KINDS: ReadonlySet<LabCommand["kind"]> = new Set([
  "PLACE_OBJECT",
  "REMOVE_OBJECT",
  "ATTACH_INSTRUMENT",
  "ADD_REAGENT",
  "TRANSFER_LIQUID",
  "DISPENSE",
  "STIR",
  "HEAT",
  "COOL",
  "ADD_INDICATOR",
  "DISPOSE",
  "MOVE_OBJECT",
]);

// ---------- commit: reactions, observations, seq/history stamping ----------

function commitTouched(
  physicalState: LabState,
  command: LabCommand,
  actor: Actor,
  originalState: LabState,
  touched: ReadonlyArray<ContainerId>,
  physicalEvents: ReadonlyArray<LabEvent>,
): { state: LabState; events: ReadonlyArray<Observation> } {
  let seq = physicalState.nextSeq;
  const clockS = physicalState.clockS;
  const observations: Observation[] = [];
  const pushEvent = (event: LabEvent) => {
    observations.push({ seq, clockS, actor, event });
    seq += 1;
  };
  for (const event of physicalEvents) pushEvent(event);

  let objects = physicalState.objects;
  let reactions = physicalState.reactions;
  for (const id of touched) {
    const before = originalState.objects.find((o): o is Container => o.kind === "container" && o.id === id);
    const afterPhysical = objects.find((o): o is Container => o.kind === "container" && o.id === id);
    if (!before || !afterPhysical) continue;

    const { container: afterReacted, fired } = resolveReactions(afterPhysical);
    objects = replaceObject(objects, afterReacted);

    for (const f of fired) {
      const record: ReactionRecord = {
        seq,
        clockS,
        containerId: id,
        ruleId: f.rule.id,
        extentMol: f.extentMol,
        limiting: f.limiting,
        consumed: f.consumed,
        produced: f.produced,
        deltaTempC: f.deltaTempC,
      };
      reactions = [...reactions, record];
      seq += 1;
    }
    for (const event of eventsForFired(afterReacted, fired)) pushEvent(event);
    for (const event of deriveObservations(before, afterReacted, command, fired)) pushEvent(event);
  }

  const nextState: LabState = { ...physicalState, objects, reactions, observations: [...physicalState.observations, ...observations], nextSeq: seq };
  return { state: nextState, events: observations };
}

/** Appends a titration curve point when a DISPENSE moves titrant from the scenario burette into the scenario flask. */
function applyTitrationCurveHook(state: LabState, command: LabCommand): LabState {
  const scenario = state.scenario;
  if (command.kind !== "DISPENSE" || scenario.kind !== "titration") return state;
  if (command.buretteId !== scenario.buretteId || command.toId !== scenario.flaskId) return state;
  const flask = state.objects.find((o): o is Container => o.kind === "container" && o.id === scenario.flaskId);
  const burette = state.objects.find((o): o is Container => o.kind === "container" && o.id === scenario.buretteId);
  if (!flask || !burette) return state;
  const hasPhMeter = state.objects.some((o) => o.kind === "instrument" && o.type === "ph_meter" && o.attachedTo === flask.id);
  const point = { titrantMl: burette.capacityMl - burette.volumeMl, pH: hasPhMeter ? derivePh(flask) : null, clockS: state.clockS };
  return { ...state, scenario: { ...scenario, curve: [...scenario.curve, point] } };
}

function applyGeneric(state: LabState, command: LabCommand, actor: Actor): Result<Applied, LabError> {
  const validated = validate(state, command);
  if (!validated.ok) return err(validated.error);
  const { state: physicalState, touched, events: physicalEvents } = applyPhysical(state, validated.value);
  const { state: committed, events } = commitTouched(physicalState, command, actor, state, touched, physicalEvents);

  const withCurve = applyTitrationCurveHook(committed, command);
  const undoable = UNDOABLE_KINDS.has(command.kind);
  if (!undoable) return ok({ state: withCurve, events, historyEntry: null });

  const historyEntry: HistoryEntry = { seq: state.nextSeq, actor, command, events, snapshot: state };
  return ok({ state: { ...withCurve, history: [...withCurve.history, historyEntry] }, events, historyEntry });
}

function applyUndo(state: LabState, actor: Actor): Result<Applied, LabError> {
  const entry = state.history[state.history.length - 1];
  if (!entry) return err({ kind: "NOTHING_TO_UNDO" });
  const seq = state.nextSeq;
  const observation: Observation = {
    seq,
    clockS: state.clockS,
    actor,
    event: { kind: "UNDONE", undoneCommand: entry.command, undoneSeq: entry.seq, undoneActor: entry.actor },
  };
  // REVEAL isn't a history entry (A2), so restoring an older snapshot must not silently re-hide a
  // challenge that was revealed after that snapshot was taken.
  const scenario = withRevealed(entry.snapshot.scenario, isScenarioRevealed(state.scenario));
  const next: LabState = { ...entry.snapshot, scenario, observations: [...state.observations, observation], nextSeq: seq + 1 };
  return ok({ state: next, events: [observation], historyEntry: null });
}

function applyLoadScenario(state: LabState, scenarioId: ScenarioId, seed: number, actor: Actor): Result<Applied, LabError> {
  if (!SCENARIO_IDS.includes(scenarioId)) return err({ kind: "UNKNOWN_SCENARIO", requested: scenarioId, available: SCENARIO_IDS });
  const fresh = loadScenario(scenarioId, seed);
  const observation: Observation = { seq: fresh.nextSeq, clockS: fresh.clockS, actor, event: { kind: "SCENARIO_LOADED", scenarioId, seed } };
  const next: LabState = { ...fresh, observations: [...fresh.observations, observation], nextSeq: fresh.nextSeq + 1 };
  return ok({ state: next, events: [observation], historyEntry: null });
}

function withRevealed(scenario: ScenarioState, revealed: boolean): ScenarioState {
  switch (scenario.kind) {
    case "sandbox":
      return scenario;
    case "titration":
    case "unknown_id":
      return { ...scenario, revealed };
    default:
      return assertNever(scenario);
  }
}

function applyReveal(state: LabState, actor: Actor): Result<Applied, LabError> {
  const scenario = withRevealed(state.scenario, true);
  const seq = state.nextSeq;
  const observation: Observation = { seq, clockS: state.clockS, actor, event: { kind: "SCENARIO_REVEALED", scenarioId: state.scenario.kind } };
  const next: LabState = { ...state, scenario, observations: [...state.observations, observation], nextSeq: seq + 1 };
  return ok({ state: next, events: [observation], historyEntry: null });
}

export function applyCommand(state: LabState, command: LabCommand, actor: Actor = "human"): Result<Applied, LabError> {
  switch (command.kind) {
    case "TICK": {
      const validated = validate(state, command);
      if (!validated.ok) return err(validated.error);
      return ok(advanceTime(state, command.dtS));
    }
    case "UNDO":
      return applyUndo(state, actor);
    case "RESET":
      return applyLoadScenario(state, state.scenario.kind, state.scenario.seed, actor);
    case "LOAD_SCENARIO":
      return applyLoadScenario(state, command.scenarioId, command.seed, actor);
    case "REVEAL":
      return applyReveal(state, actor);
    default:
      return applyGeneric(state, command, actor);
  }
}

// ---------- time ----------

const THERMAL_EVENT_EPS = 1e-3;

function tickContainer(container: Container, dtS: number, ambientC: number): { container: Container; events: LabEvent[] } {
  const events: LabEvent[] = [];

  const target: number = container.thermal.kind === "idle" ? ambientC : container.thermal.targetC;
  const rate = container.thermal.kind === "idle" ? PASSIVE_RATE_C_PER_S : HEAT_RATE_C_PER_S;
  const maxStep = rate * dtS;
  const applied = clamp(target - container.temperatureC, -maxStep, maxStep);
  let temperatureC = container.temperatureC + applied;
  if (Math.abs(temperatureC - target) < 0.01) temperatureC = target;
  if (Math.abs(temperatureC - container.temperatureC) > THERMAL_EVENT_EPS) {
    events.push({ kind: "TEMPERATURE_CHANGE", containerId: container.id, fromC: container.temperatureC, toC: temperatureC, cause: "thermal" });
  }

  let stir: StirState = container.stir;
  let solids = container.solids;
  if (stir.kind === "stirring") {
    const remainingS = stir.remainingS - dtS;
    stir = remainingS > 0 ? { kind: "stirring", remainingS, intensity: stir.intensity } : { kind: "still" };
    solids = solids.map((s) => ({ ...s, suspended: 1 }));
  } else if (solids.some((s) => s.suspended > 0)) {
    let settled = false;
    solids = solids.map((s) => {
      if (s.suspended <= 0) return s;
      const suspended = Math.max(0, s.suspended - dtS / SETTLE_S);
      if (suspended <= 0) settled = true;
      return { ...s, suspended };
    });
    if (settled) events.push({ kind: "SOLIDS_SETTLED", containerId: container.id });
  }

  const gasEffects = container.gasEffects.map((g) => ({ ...g, remainingS: g.remainingS - dtS })).filter((g) => g.remainingS > 0);

  return { container: { ...container, temperatureC, stir, solids, gasEffects }, events };
}

/** Advances the clock by dtS: thermal relaxation, stir countdown/settling, gas expiry. Never triggers reactions (A3.5). */
export function advanceTime(state: LabState, dtS: number): Applied {
  let seq = state.nextSeq;
  const clockS = state.clockS + dtS;
  const observations: Observation[] = [];
  const objects = state.objects.map((o) => {
    if (o.kind !== "container") return o;
    const { container: next, events } = tickContainer(o, dtS, state.ambientC);
    for (const event of events) {
      observations.push({ seq, clockS, actor: "system", event });
      seq += 1;
    }
    return next;
  });
  const nextState: LabState = { ...state, clockS, objects, observations: [...state.observations, ...observations], nextSeq: seq };
  return { state: nextState, events: observations, historyEntry: null };
}

// ---------- empty state ----------

/** Minimal bare state: empty bench, no shelf, sandbox scenario. Used as a fallback before a real scenario loads. */
export function createEmptyState(seed: number): LabState {
  return {
    clockS: 0,
    ambientC: AMBIENT_C,
    objects: [],
    shelf: [],
    indicatorsAvailable: [],
    reactions: [],
    observations: [],
    history: [],
    scenario: { kind: "sandbox", seed, visibility: { inspectContents: "full", revealShelfConcentrations: true, instrumentsRequired: false } },
    rng: { seed, s: seed >>> 0 },
    nextSeq: 1,
  };
}
