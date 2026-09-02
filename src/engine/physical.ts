/**
 * applyPhysical: the direct, chemistry-free state change for each validated command
 * (id minting, volume/species bookkeeping, instrument state). reducer.ts runs reaction
 * resolution and observation derivation on the containers this reports as `touched`.
 */
import { CAPACITY_ML, DEFAULT_STIR_S, EPS_ML } from "./constants";
import { mintContainerId, mintInstrumentId, type ContainerId, type InstrumentId } from "./ids";
import { derivePh } from "./ph";
import { indicatorDef, reagentDef, stockToMoles } from "./reagents";
import { addMoles, getMoles, removeMoles, speciesKeys } from "./species";
import {
  assertNever,
  type Container,
  type ContainerType,
  type EquipmentType,
  type Instrument,
  type InstrumentReading,
  type InstrumentType,
  type LabCommand,
  type LabEvent,
  type LabObject,
  type LabState,
  type Vec2,
} from "./types";
import { findAttachedInstrument, findContainerOrThrow, replaceObject, replaceObjects, resolveUnknownStock } from "./commands";

// ---------- applyPhysical ----------

export interface PhysicalResult {
  readonly state: LabState;
  readonly touched: ReadonlyArray<ContainerId>;
  readonly events: ReadonlyArray<LabEvent>;
}

const GRID_XS: ReadonlyArray<number> = [-4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5];
const GRID_YS: ReadonlyArray<number> = [-1.5, -0.5, 0.5, 1.5];

/** First free bench cell, scanning front row to back row, left to right within a row. */
function nextFreeCell(objects: ReadonlyArray<LabObject>): Vec2 {
  const occupied = new Set(objects.map((o) => `${o.position.x},${o.position.y}`));
  for (const y of GRID_YS) {
    for (const x of GRID_XS) {
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

function isContainerObjectType(t: EquipmentType): t is ContainerType {
  switch (t) {
    case "beaker":
    case "flask":
    case "test_tube":
    case "graduated_cylinder":
    case "burette":
      return true;
    case "ph_meter":
    case "thermometer":
    case "hotplate":
      return false;
    default:
      return assertNever(t);
  }
}

const capacityFor = (type: ContainerType): number => CAPACITY_ML[type] ?? 250;
const defaultLabel = (type: EquipmentType, seq: number): string =>
  `${type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} ${seq}`;

function mergeIndicatorDoses<T extends { readonly indicator: string; readonly drops: number }>(existing: ReadonlyArray<T>, added: ReadonlyArray<T>): ReadonlyArray<T> {
  let result = existing;
  for (const dose of added) {
    if (dose.drops <= 0) continue;
    const idx = result.findIndex((d) => d.indicator === dose.indicator);
    const found = idx >= 0 ? result[idx] : undefined;
    result = found ? result.map((d, i) => (i === idx ? { ...d, drops: d.drops + dose.drops } : d)) : [...result, dose];
  }
  return result;
}

/** Moves `volumeMl` of liquid from `from` to `to`: species, indicators, and temperature per A3.2. Solids never transfer. */
function transferLiquid(state: LabState, fromId: ContainerId, toId: ContainerId, volumeMl: number): LabState {
  const from = findContainerOrThrow(state, fromId);
  const to = findContainerOrThrow(state, toId);
  const f = from.volumeMl > 0 ? volumeMl / from.volumeMl : 0;

  let fromSpecies = from.species;
  let toSpecies = to.species;
  for (const id of speciesKeys(from.species)) {
    const moved = getMoles(from.species, id) * f;
    fromSpecies = removeMoles(fromSpecies, id, moved);
    toSpecies = addMoles(toSpecies, id, moved);
  }

  const movedIndicators = from.indicators.map((d) => ({ indicator: d.indicator, drops: d.drops * f }));
  const remainingFromIndicators = from.indicators.map((d) => ({ indicator: d.indicator, drops: d.drops * (1 - f) }));
  const toIndicators = mergeIndicatorDoses(to.indicators, movedIndicators);

  const zeroedOut = from.volumeMl - volumeMl < EPS_ML;
  const newFromVolume = zeroedOut ? 0 : from.volumeMl - volumeMl;
  const newToVolume = to.volumeMl + volumeMl;
  const newToTemp = newToVolume > 0 ? (to.volumeMl * to.temperatureC + volumeMl * from.temperatureC) / newToVolume : to.temperatureC;

  const nextFrom: Container = { ...from, volumeMl: newFromVolume, species: zeroedOut ? {} : fromSpecies, indicators: zeroedOut ? [] : remainingFromIndicators };
  const nextTo: Container = {
    ...to,
    volumeMl: newToVolume,
    species: toSpecies,
    temperatureC: newToTemp,
    indicators: toIndicators,
    containsUnknown: to.containsUnknown || from.containsUnknown,
  };
  return { ...state, objects: replaceObjects(state.objects, [nextFrom, nextTo]) };
}

function measureWithInstrument(state: LabState, container: Container, type: InstrumentType, instrumentId: InstrumentId | undefined, reading: InstrumentReading): PhysicalResult {
  const instrument = findAttachedInstrument(state, container.id, type, instrumentId);
  const objects = instrument ? replaceObject(state.objects, { ...instrument, lastReading: reading }) : state.objects;
  return { state: { ...state, objects }, touched: [], events: [{ kind: "MEASUREMENT", containerId: container.id, reading }] };
}

/** Applies a validated command with no chemistry: id minting, volume/species bookkeeping, instrument state. */
export function applyPhysical(state: LabState, command: LabCommand): PhysicalResult {
  switch (command.kind) {
    case "PLACE_OBJECT": {
      const seq = state.nextSeq;
      const position = command.position ?? nextFreeCell(state.objects);
      const events: LabEvent[] = [];
      let objects = state.objects;
      if (isContainerObjectType(command.objectType)) {
        const id = mintContainerId(seq);
        const type = command.objectType;
        const container: Container = {
          kind: "container",
          id,
          type,
          label: command.label ?? defaultLabel(type, seq),
          capacityMl: capacityFor(type),
          position,
          rotationDeg: 0,
          volumeMl: 0,
          temperatureC: state.ambientC,
          species: {},
          solids: [],
          gasEffects: [],
          indicators: [],
          stir: { kind: "still" },
          thermal: { kind: "idle" },
          containsUnknown: false,
        };
        objects = [...objects, container];
        events.push({ kind: "OBJECT_PLACED", objectId: id, objectType: type });
      } else {
        const id = mintInstrumentId(seq);
        const type = command.objectType;
        const attachedTo = command.attachTo ?? null;
        const instrument: Instrument = { kind: "instrument", id, type, position, attachedTo, lastReading: null };
        objects = [...objects, instrument];
        events.push({ kind: "OBJECT_PLACED", objectId: id, objectType: type });
        if (attachedTo !== null) events.push({ kind: "INSTRUMENT_ATTACHED", instrumentId: id, containerId: attachedTo });
      }
      return { state: { ...state, objects, nextSeq: seq + 1 }, touched: [], events };
    }
    case "REMOVE_OBJECT": {
      const objects = state.objects
        .filter((o) => o.id !== command.objectId)
        .map((o) => (o.kind === "instrument" && o.attachedTo === command.objectId ? { ...o, attachedTo: null } : o));
      return { state: { ...state, objects }, touched: [], events: [{ kind: "OBJECT_REMOVED", objectId: command.objectId }] };
    }
    case "ATTACH_INSTRUMENT": {
      const objects = state.objects.map((o) => (o.kind === "instrument" && o.id === command.instrumentId ? { ...o, attachedTo: command.containerId } : o));
      return { state: { ...state, objects }, touched: [], events: [{ kind: "INSTRUMENT_ATTACHED", instrumentId: command.instrumentId, containerId: command.containerId }] };
    }
    case "ADD_REAGENT": {
      const container = findContainerOrThrow(state, command.containerId);
      const stock = state.shelf.find((s) => s.reagentId === command.reagentId);
      const def = reagentDef(command.reagentId);
      const unknown = resolveUnknownStock(state.scenario, command.reagentId);
      const effectiveDef = def ?? unknown?.def;
      if (!stock || !effectiveDef) throw new Error(`unreachable: validated ADD_REAGENT for unresolved reagent ${command.reagentId}`);
      const concentrationM = def && def.kind === "solution" ? command.concentrationM ?? def.defaultM : unknown ? unknown.concentrationM : 0;

      const added = stockToMoles(effectiveDef, command.volumeMl, concentrationM);
      let species = container.species;
      for (const id of speciesKeys(added)) species = addMoles(species, id, getMoles(added, id));

      const newVolumeMl = container.volumeMl + command.volumeMl;
      const temperatureC = (container.volumeMl * container.temperatureC + command.volumeMl * state.ambientC) / newVolumeMl;
      const nextContainer: Container = { ...container, volumeMl: newVolumeMl, species, temperatureC, containsUnknown: container.containsUnknown || unknown !== undefined };
      const objects = replaceObject(state.objects, nextContainer);
      const shelf =
        stock.remainingMl === null
          ? state.shelf
          : state.shelf.map((s) => (s.reagentId === command.reagentId ? { ...s, remainingMl: (s.remainingMl ?? 0) - command.volumeMl } : s));
      return {
        state: { ...state, objects, shelf },
        touched: [container.id],
        events: [{ kind: "LIQUID_ADDED", containerId: container.id, reagentId: command.reagentId, volumeMl: command.volumeMl, newVolumeMl }],
      };
    }
    case "TRANSFER_LIQUID": {
      const next = transferLiquid(state, command.fromId, command.toId, command.volumeMl);
      return { state: next, touched: [command.fromId, command.toId], events: [{ kind: "LIQUID_TRANSFERRED", fromId: command.fromId, toId: command.toId, volumeMl: command.volumeMl }] };
    }
    case "DISPENSE": {
      const next = transferLiquid(state, command.buretteId, command.toId, command.volumeMl);
      return { state: next, touched: [command.buretteId, command.toId], events: [{ kind: "LIQUID_TRANSFERRED", fromId: command.buretteId, toId: command.toId, volumeMl: command.volumeMl }] };
    }
    case "STIR": {
      const container = findContainerOrThrow(state, command.containerId);
      const durationS = command.durationS ?? DEFAULT_STIR_S;
      const intensity = command.intensity ?? 1;
      const nextContainer: Container = { ...container, stir: { kind: "stirring", remainingS: durationS, intensity }, solids: container.solids.map((s) => ({ ...s, suspended: 1 })) };
      const objects = replaceObject(state.objects, nextContainer);
      return { state: { ...state, objects }, touched: [container.id], events: [{ kind: "STIR_STARTED", containerId: container.id, durationS }] };
    }
    case "HEAT": {
      const container = findContainerOrThrow(state, command.containerId);
      const nextContainer: Container = { ...container, thermal: { kind: "heating", targetC: command.targetC } };
      const objects = replaceObject(state.objects, nextContainer);
      return { state: { ...state, objects }, touched: [], events: [{ kind: "THERMAL_SET", containerId: container.id, thermal: nextContainer.thermal }] };
    }
    case "COOL": {
      const container = findContainerOrThrow(state, command.containerId);
      const targetC = command.targetC ?? state.ambientC;
      const nextContainer: Container = { ...container, thermal: { kind: "cooling", targetC } };
      const objects = replaceObject(state.objects, nextContainer);
      return { state: { ...state, objects }, touched: [], events: [{ kind: "THERMAL_SET", containerId: container.id, thermal: nextContainer.thermal }] };
    }
    case "ADD_INDICATOR": {
      const container = findContainerOrThrow(state, command.containerId);
      const def = indicatorDef(command.indicator);
      const drops = command.drops ?? def?.defaultDrops ?? 2;
      const nextContainer: Container = { ...container, indicators: mergeIndicatorDoses(container.indicators, [{ indicator: command.indicator, drops }]) };
      const objects = replaceObject(state.objects, nextContainer);
      return { state: { ...state, objects }, touched: [container.id], events: [{ kind: "INDICATOR_ADDED", containerId: container.id, indicator: command.indicator, drops }] };
    }
    case "MEASURE": {
      const container = findContainerOrThrow(state, command.containerId);
      switch (command.quantity) {
        case "ph": {
          const value = derivePh(container);
          if (value === null) throw new Error("unreachable: validated MEASURE ph on empty container");
          return measureWithInstrument(state, container, "ph_meter", command.instrumentId, { kind: "ph", value });
        }
        case "temperature":
          return measureWithInstrument(state, container, "thermometer", command.instrumentId, { kind: "temperature", valueC: container.temperatureC });
        case "volume":
          return { state, touched: [], events: [{ kind: "MEASUREMENT", containerId: container.id, reading: { kind: "volume", valueMl: container.volumeMl } }] };
        case "contents":
          return { state, touched: [], events: [{ kind: "CONTENTS_INSPECTED", containerId: container.id, species: container.species, volumeMl: container.volumeMl }] };
        default:
          return assertNever(command.quantity);
      }
    }
    case "DISPOSE": {
      const container = findContainerOrThrow(state, command.containerId);
      const volumeMl = container.volumeMl;
      const nextContainer: Container = { ...container, volumeMl: 0, species: {}, solids: [], gasEffects: [], indicators: [], stir: { kind: "still" }, containsUnknown: false };
      const objects = replaceObject(state.objects, nextContainer);
      return { state: { ...state, objects }, touched: [container.id], events: [{ kind: "DISPOSED", containerId: container.id, volumeMl }] };
    }
    case "MOVE_OBJECT": {
      const objects = state.objects.map((o) => (o.id === command.objectId ? { ...o, position: command.position } : o));
      return { state: { ...state, objects }, touched: [], events: [{ kind: "OBJECT_MOVED", objectId: command.objectId, position: command.position }] };
    }
    case "TICK":
    case "UNDO":
    case "RESET":
    case "LOAD_SCENARIO":
    case "REVEAL":
      // Routed by applyCommand before reaching here; kept exhaustive for type safety.
      return { state, touched: [], events: [] };
    default:
      return assertNever(command);
  }
}
