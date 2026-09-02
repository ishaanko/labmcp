/**
 * Command validation against the current state and the A2 rule table, plus the small lookup
 * helpers shared with reducer.ts's applyPhysical (which performs the actual state change once a
 * command has passed validate()).
 */
import { DEFAULT_STIR_S, EPS_ML, MAX_ADD_ML, MAX_DT_S, MAX_INDICATOR_DROPS, MAX_STIR_S, MAX_TEMP_C, MIN_TEMP_C } from "./constants";
import { mintReagentId, type ContainerId, type InstrumentId, type ReagentId } from "./ids";
import { indicatorDef, reagentDef, suggestIndicators, suggestReagents } from "./reagents";
import {
  assertNever,
  err,
  ok,
  type Container,
  type ContainerType,
  type Instrument,
  type InstrumentType,
  type LabCommand,
  type LabError,
  type LabObject,
  type LabState,
  type ReagentDef,
  type Result,
  type ScenarioState,
} from "./types";

// ---------- lookups shared with reducer.ts ----------

export function findObject(state: LabState, id: string): LabObject | undefined {
  return state.objects.find((o) => o.id === id);
}

const ALL_CONTAINER_TYPES: ReadonlyArray<ContainerType> = ["beaker", "flask", "test_tube", "graduated_cylinder", "burette"];
const ALL_INSTRUMENT_TYPES: ReadonlyArray<InstrumentType> = ["ph_meter", "thermometer", "hotplate"];

export function requireContainer(state: LabState, id: ContainerId): Result<Container, LabError> {
  const obj = findObject(state, id);
  if (!obj) return err({ kind: "UNKNOWN_OBJECT", id, hint: "reread_lab_state" });
  if (obj.kind !== "container") return err({ kind: "WRONG_OBJECT_TYPE", id: obj.id, expected: ALL_CONTAINER_TYPES });
  return ok(obj);
}

export function requireInstrument(state: LabState, id: InstrumentId): Result<Instrument, LabError> {
  const obj = findObject(state, id);
  if (!obj) return err({ kind: "UNKNOWN_OBJECT", id, hint: "reread_lab_state" });
  if (obj.kind !== "instrument") return err({ kind: "WRONG_OBJECT_TYPE", id: obj.id, expected: ALL_INSTRUMENT_TYPES });
  return ok(obj);
}

/** For use after validate() has already confirmed the container exists. */
export function findContainerOrThrow(state: LabState, id: ContainerId): Container {
  const obj = findObject(state, id);
  if (!obj || obj.kind !== "container") throw new Error(`unreachable: validated command referenced missing container ${id}`);
  return obj;
}

export function replaceObject<T extends LabObject>(objects: ReadonlyArray<LabObject>, next: T): ReadonlyArray<LabObject> {
  return objects.map((o) => (o.id === next.id ? next : o));
}

export function replaceObjects(objects: ReadonlyArray<LabObject>, updates: ReadonlyArray<LabObject>): ReadonlyArray<LabObject> {
  const byId = new Map(updates.map((u) => [u.id, u]));
  return objects.map((o) => byId.get(o.id) ?? o);
}

export function checkAmount(field: string, value: number, max: number): Result<number, LabError> {
  if (!Number.isFinite(value)) return err({ kind: "INVALID_AMOUNT", field, value, reason: "not_finite" });
  if (value <= 0) return err({ kind: "INVALID_AMOUNT", field, value, reason: "not_positive" });
  if (value > max) return err({ kind: "INVALID_AMOUNT", field, value, reason: "too_large" });
  return ok(value);
}

function maxAddable(container: Container): number {
  return Math.max(0, container.capacityMl - container.volumeMl);
}

export function checkCapacity(container: Container, attemptedMl: number): Result<undefined, LabError> {
  const maxAdd = maxAddable(container);
  if (attemptedMl > maxAdd + EPS_ML) {
    return err({
      kind: "OVER_CAPACITY",
      containerId: container.id,
      capacityMl: container.capacityMl,
      currentMl: container.volumeMl,
      attemptedMl,
      maxAddableMl: maxAdd,
    });
  }
  return ok(undefined);
}

/** True once a titration/unknown_id challenge has been revealed; sandbox has nothing to reveal. */
export function isScenarioRevealed(scenario: ScenarioState): boolean {
  return scenario.kind === "sandbox" ? true : scenario.revealed;
}

const UNKNOWN_ACID_SHELF_ID = mintReagentId("unknown_acid");
const HCL_REAGENT_ID = mintReagentId("hcl");

export interface UnknownStock {
  readonly def: Extract<ReagentDef, { kind: "solution" }>;
  readonly concentrationM: number;
}

/** Resolves a hidden shelf stock ("unknown_acid", "unknown_A"/B/C) to its real reagent and concentration via scenario secrets. */
export function resolveUnknownStock(scenario: ScenarioState, reagentId: ReagentId): UnknownStock | undefined {
  if (scenario.kind === "titration" && reagentId === UNKNOWN_ACID_SHELF_ID) {
    const def = reagentDef(HCL_REAGENT_ID);
    if (!def || def.kind !== "solution") return undefined;
    return { def, concentrationM: scenario.secrets.analyteM };
  }
  if (scenario.kind === "unknown_id") {
    const recipe = scenario.secrets[reagentId];
    if (!recipe) return undefined;
    const def = reagentDef(recipe.reagentId);
    if (!def || def.kind !== "solution") return undefined;
    return { def, concentrationM: recipe.concentrationM };
  }
  return undefined;
}

export function findAttachedInstrument(
  state: LabState,
  containerId: ContainerId,
  type: InstrumentType,
  instrumentId: InstrumentId | undefined,
): Instrument | undefined {
  return state.objects.find(
    (o): o is Instrument =>
      o.kind === "instrument" && o.type === type && o.attachedTo === containerId && (instrumentId === undefined || o.id === instrumentId),
  );
}

// ---------- validate ----------

/** Checks a command against `state` per the A2 table. Never mutates; returns the command unchanged on success. */
export function validate(state: LabState, command: LabCommand): Result<LabCommand, LabError> {
  switch (command.kind) {
    case "PLACE_OBJECT": {
      if (command.attachTo !== undefined) {
        const res = requireContainer(state, command.attachTo);
        if (!res.ok) return res;
      }
      return ok(command);
    }
    case "REMOVE_OBJECT": {
      if (!findObject(state, command.objectId)) return err({ kind: "UNKNOWN_OBJECT", id: command.objectId, hint: "reread_lab_state" });
      return ok(command);
    }
    case "ATTACH_INSTRUMENT": {
      const instRes = requireInstrument(state, command.instrumentId);
      if (!instRes.ok) return instRes;
      if (command.containerId !== null) {
        const contRes = requireContainer(state, command.containerId);
        if (!contRes.ok) return contRes;
      }
      return ok(command);
    }
    case "ADD_REAGENT": {
      const containerRes = requireContainer(state, command.containerId);
      if (!containerRes.ok) return containerRes;

      const volRes = checkAmount("volumeMl", command.volumeMl, MAX_ADD_ML);
      if (!volRes.ok) return volRes;
      const volumeMl = volRes.value;

      const stock = state.shelf.find((s) => s.reagentId === command.reagentId);
      if (!stock) {
        return err({
          kind: "UNSUPPORTED_REAGENT",
          requested: command.reagentId,
          suggestions: suggestReagents(command.reagentId, state.shelf.map((s) => s.reagentId)),
        });
      }

      const def = reagentDef(command.reagentId);
      if (def && def.kind === "solution") {
        const concentrationM = command.concentrationM ?? def.defaultM;
        if (!(concentrationM > 0) || concentrationM > def.maxM) {
          return err({ kind: "UNSUPPORTED_CONCENTRATION", reagentId: command.reagentId, requestedM: concentrationM, maxM: def.maxM });
        }
      } else if (!def) {
        if (command.concentrationM !== undefined) {
          return err({
            kind: "RESTRICTED_BY_CHALLENGE",
            action: "set a concentration for an unknown sample",
            reason: "the concentration of an unknown sample is exactly what you are trying to determine",
          });
        }
        if (!resolveUnknownStock(state.scenario, command.reagentId)) {
          return err({ kind: "UNSUPPORTED_REAGENT", requested: command.reagentId, suggestions: [] });
        }
      }

      if (stock.remainingMl !== null && stock.remainingMl < volumeMl) {
        return err({ kind: "STOCK_DEPLETED", reagentId: command.reagentId, remainingMl: stock.remainingMl });
      }

      const capRes = checkCapacity(containerRes.value, volumeMl);
      return capRes.ok ? ok(command) : capRes;
    }
    case "TRANSFER_LIQUID": {
      const fromRes = requireContainer(state, command.fromId);
      if (!fromRes.ok) return fromRes;
      const toRes = requireContainer(state, command.toId);
      if (!toRes.ok) return toRes;
      if (command.fromId === command.toId) return err({ kind: "SAME_CONTAINER", containerId: command.fromId });
      const volRes = checkAmount("volumeMl", command.volumeMl, MAX_ADD_ML);
      if (!volRes.ok) return volRes;
      const from = fromRes.value;
      if (from.volumeMl < command.volumeMl - EPS_ML) {
        return err({ kind: "INSUFFICIENT_VOLUME", containerId: from.id, availableMl: from.volumeMl, requestedMl: command.volumeMl });
      }
      const capRes = checkCapacity(toRes.value, command.volumeMl);
      return capRes.ok ? ok(command) : capRes;
    }
    case "DISPENSE": {
      const fromRes = requireContainer(state, command.buretteId);
      if (!fromRes.ok) return fromRes;
      const toRes = requireContainer(state, command.toId);
      if (!toRes.ok) return toRes;
      const from = fromRes.value;
      if (from.type !== "burette") return err({ kind: "WRONG_OBJECT_TYPE", id: from.id, expected: ["burette"] });
      if (command.buretteId === command.toId) return err({ kind: "SAME_CONTAINER", containerId: command.buretteId });
      const volRes = checkAmount("volumeMl", command.volumeMl, MAX_ADD_ML);
      if (!volRes.ok) return volRes;
      if (from.volumeMl < command.volumeMl - EPS_ML) {
        return err({ kind: "INSUFFICIENT_VOLUME", containerId: from.id, availableMl: from.volumeMl, requestedMl: command.volumeMl });
      }
      const capRes = checkCapacity(toRes.value, command.volumeMl);
      return capRes.ok ? ok(command) : capRes;
    }
    case "STIR": {
      const containerRes = requireContainer(state, command.containerId);
      if (!containerRes.ok) return containerRes;
      const durRes = checkAmount("durationS", command.durationS ?? DEFAULT_STIR_S, MAX_STIR_S);
      if (!durRes.ok) return durRes;
      const intRes = checkAmount("intensity", command.intensity ?? 1, 1);
      if (!intRes.ok) return intRes;
      return ok(command);
    }
    case "HEAT": {
      const containerRes = requireContainer(state, command.containerId);
      if (!containerRes.ok) return containerRes;
      if (!(command.targetC >= MIN_TEMP_C && command.targetC <= MAX_TEMP_C)) {
        return err({ kind: "INVALID_TEMPERATURE", requestedC: command.targetC, minC: MIN_TEMP_C, maxC: MAX_TEMP_C });
      }
      if (state.scenario.visibility.instrumentsRequired) {
        const hasHotplate = state.objects.some((o) => o.kind === "instrument" && o.type === "hotplate");
        if (!hasHotplate) {
          return err({ kind: "NO_INSTRUMENT", containerId: command.containerId, needed: "hotplate", hint: "Place a hotplate on the bench first." });
        }
      }
      return ok(command);
    }
    case "COOL": {
      const containerRes = requireContainer(state, command.containerId);
      if (!containerRes.ok) return containerRes;
      const targetC = command.targetC ?? state.ambientC;
      if (!(targetC >= MIN_TEMP_C && targetC <= MAX_TEMP_C)) {
        return err({ kind: "INVALID_TEMPERATURE", requestedC: targetC, minC: MIN_TEMP_C, maxC: MAX_TEMP_C });
      }
      return ok(command);
    }
    case "ADD_INDICATOR": {
      const containerRes = requireContainer(state, command.containerId);
      if (!containerRes.ok) return containerRes;
      if (!state.indicatorsAvailable.includes(command.indicator)) {
        return err({ kind: "UNSUPPORTED_INDICATOR", requested: command.indicator, suggestions: suggestIndicators(command.indicator) });
      }
      const def = indicatorDef(command.indicator);
      const dropsRes = checkAmount("drops", command.drops ?? def?.defaultDrops ?? 2, MAX_INDICATOR_DROPS);
      if (!dropsRes.ok) return dropsRes;
      return ok(command);
    }
    case "MEASURE": {
      const containerRes = requireContainer(state, command.containerId);
      if (!containerRes.ok) return containerRes;
      const container = containerRes.value;
      const required = state.scenario.visibility.instrumentsRequired;
      switch (command.quantity) {
        case "ph": {
          if (container.volumeMl <= EPS_ML) {
            return err({ kind: "INSUFFICIENT_VOLUME", containerId: container.id, availableMl: container.volumeMl, requestedMl: EPS_ML });
          }
          if (required && !findAttachedInstrument(state, container.id, "ph_meter", command.instrumentId)) {
            return err({ kind: "NO_INSTRUMENT", containerId: container.id, needed: "ph_meter", hint: "Attach a ph_meter to this container first." });
          }
          return ok(command);
        }
        case "temperature": {
          if (required && !findAttachedInstrument(state, container.id, "thermometer", command.instrumentId)) {
            return err({ kind: "NO_INSTRUMENT", containerId: container.id, needed: "thermometer", hint: "Attach a thermometer to this container first." });
          }
          return ok(command);
        }
        case "volume":
          return ok(command);
        case "contents": {
          const policy = state.scenario.visibility.inspectContents;
          if (policy === "none") {
            return err({ kind: "RESTRICTED_BY_CHALLENGE", action: "inspect contents", reason: "contents inspection is disabled in this challenge" });
          }
          if (policy === "non_unknown_only" && container.containsUnknown && !isScenarioRevealed(state.scenario)) {
            return err({
              kind: "RESTRICTED_BY_CHALLENGE",
              action: "inspect contents",
              reason: "this sample is unidentified; determine it through observation instead",
            });
          }
          return ok(command);
        }
        default:
          return assertNever(command.quantity);
      }
    }
    case "DISPOSE": {
      const containerRes = requireContainer(state, command.containerId);
      return containerRes.ok ? ok(command) : containerRes;
    }
    case "MOVE_OBJECT": {
      if (!findObject(state, command.objectId)) return err({ kind: "UNKNOWN_OBJECT", id: command.objectId, hint: "reread_lab_state" });
      return ok(command);
    }
    case "TICK": {
      const res = checkAmount("dtS", command.dtS, MAX_DT_S);
      return res.ok ? ok(command) : res;
    }
    case "UNDO":
    case "RESET":
    case "LOAD_SCENARIO":
    case "REVEAL":
      return ok(command);
    default:
      return assertNever(command);
  }
}
