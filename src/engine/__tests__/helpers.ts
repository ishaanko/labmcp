import { mintContainerId, mintReagentId, type ContainerId } from "../ids";
import { reagentDef, stockToMoles } from "../reagents";
import { applyCommand } from "../reducer";
import { loadScenario } from "../scenarios";
import type { Actor, Container, LabCommand, LabState, SpeciesMoles } from "../types";

let seq = 0;

/** A minimal, valid Container for unit tests. Every field can be overridden. */
export function makeContainer(overrides: Partial<Container> = {}): Container {
  seq += 1;
  const base: Container = {
    kind: "container",
    id: mintContainerId(seq),
    type: "beaker",
    label: `Test beaker ${seq}`,
    capacityMl: 250,
    position: { x: 0, y: 0 },
    rotationDeg: 0,
    volumeMl: 0,
    temperatureC: 22,
    species: {},
    solids: [],
    gasEffects: [],
    indicators: [],
    stir: { kind: "still" },
    thermal: { kind: "idle" },
    containsUnknown: false,
  };
  return { ...base, ...overrides };
}

/** A container pre-filled as if `volumeMl` of `reagentId` stock at `M` had just been poured in. */
export function containerWith(
  reagentId: string,
  volumeMl: number,
  concentrationM: number,
  overrides: Partial<Container> = {},
): Container {
  const def = reagentDef(mintReagentId(reagentId));
  if (!def) throw new Error(`unknown test reagent: ${reagentId}`);
  const species: SpeciesMoles = stockToMoles(def, volumeMl, concentrationM);
  return makeContainer({ volumeMl, species, ...overrides });
}

export function approx(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) <= tol;
}

/** A freshly loaded sandbox: full shelf, no bench objects. */
export function sandboxState(seed = 1): LabState {
  return loadScenario("sandbox", seed);
}

/** Dispatches a command and returns the resulting state, or throws with the LabError on rejection. */
export function applyOk(state: LabState, command: LabCommand, actor: Actor = "human"): LabState {
  const res = applyCommand(state, command, actor);
  if (!res.ok) throw new Error(`applyOk: ${command.kind} rejected: ${JSON.stringify(res.error)}`);
  return res.value.state;
}

/** Places `count` empty beakers on the bench via PLACE_OBJECT and returns their minted ids in order. */
export function placeBeakers(state: LabState, count: number): { state: LabState; ids: ReadonlyArray<ContainerId> } {
  let next = state;
  const ids: ContainerId[] = [];
  for (let i = 0; i < count; i++) {
    next = applyOk(next, { kind: "PLACE_OBJECT", objectType: "beaker" });
    const placed = next.objects[next.objects.length - 1];
    if (!placed || placed.kind !== "container") throw new Error("unreachable: PLACE_OBJECT beaker did not add a container");
    ids.push(placed.id);
  }
  return { state: next, ids };
}
