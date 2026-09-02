/**
 * Bench-construction helpers shared by every load* function in scenarios.ts: turning a reagent
 * slug into a shelf row, and building the plain Container/Instrument objects that make up a
 * scenario's initial bench. Split out to keep scenarios.ts under the file-length budget.
 */
import { AMBIENT_C } from "./constants";
import type { ContainerId, InstrumentId, ReagentId } from "./ids";
import { reagentDef } from "./reagents";
import type { Container, Instrument, InstrumentType, ShelfStock, SpeciesMoles, Vec2 } from "./types";

/** Rounds to 4 decimal places, matching the precision loadScenario draws hidden quantities at. */
export const round4 = (x: number): number => Math.round(x * 10000) / 10000;

export function containerAt(
  id: ContainerId,
  type: Container["type"],
  label: string,
  capacityMl: number,
  position: Vec2,
  volumeMl: number,
  species: SpeciesMoles,
  containsUnknown: boolean,
): Container {
  return {
    kind: "container",
    id,
    type,
    label,
    capacityMl,
    position,
    rotationDeg: 0,
    volumeMl,
    temperatureC: AMBIENT_C,
    species,
    solids: [],
    gasEffects: [],
    indicators: [],
    stir: { kind: "still" },
    thermal: { kind: "idle" },
    containsUnknown,
  };
}

export function instrumentAt(id: InstrumentId, type: InstrumentType, position: Vec2): Instrument {
  return { kind: "instrument", id, type, position, attachedTo: null, lastReading: null };
}

/**
 * A shelf row for a registered reagent id. `concentrationM` defaults to the reagent's own
 * defaultM (or null for water/solids); pass it explicitly to advertise a different stock
 * strength, e.g. dilution's 1.0 M sodium chloride.
 */
export function shelfEntry(id: ReagentId, concentrationM?: number | null): ShelfStock {
  const def = reagentDef(id);
  const label = def ? def.label : id;
  const resolvedM = concentrationM !== undefined ? concentrationM : def && def.kind === "solution" ? def.defaultM : null;
  return { reagentId: id, label, concentrationM: resolvedM, remainingMl: null };
}
