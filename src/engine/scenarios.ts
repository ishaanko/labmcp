/**
 * Scenario construction (A4.2) and the public, redaction-safe view of state (A4.4). `secrets`
 * never leaves this module except through the deliberately narrow answer-checking helpers.
 */
import { isScenarioRevealed } from "./commands";
import { AMBIENT_C, CAPACITY_ML } from "./constants";
import { deriveColor, describeColor } from "./color";
import { mintContainerId, mintIndicatorId, mintInstrumentId, mintReagentId, type ContainerId, type ReactionRuleId, type ReagentId } from "./ids";
import { derivePh } from "./ph";
import { precipitateScale } from "./reactions";
import { INDICATOR_IDS, REAGENTS, reagentDef, stockToMoles } from "./reagents";
import { nextFloat, seedRng, shuffle } from "./rng";
import { getMoles, speciesDef, speciesKeys } from "./species";
import {
  assertNever,
  type Container,
  type ContentsView,
  type CurvePoint,
  type Instrument,
  type LabObject,
  type LabState,
  type PublicContainer,
  type PublicLabState,
  type PublicScenario,
  type ScenarioId,
  type ScenarioState,
  type ShelfStock,
  type SpeciesMoles,
  type StockRecipe,
} from "./types";

export const SCENARIO_IDS: ReadonlyArray<ScenarioId> = ["sandbox", "titration", "unknown_id"];

export function scenarioObjective(id: ScenarioId): string {
  switch (id) {
    case "sandbox":
      return "Explore freely: mix reagents, add indicators, and watch what reacts.";
    case "titration":
      return "Titrate the acid in the flask with the burette's sodium hydroxide to find its exact concentration.";
    case "unknown_id":
      return "Identify each unknown sample by testing it against the known reagents on the shelf.";
    default:
      return assertNever(id);
  }
}

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

function containerAt(
  id: ContainerId,
  type: Container["type"],
  label: string,
  capacityMl: number,
  position: { readonly x: number; readonly y: number },
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

function loadSandbox(seed: number): LabState {
  const shelf: ReadonlyArray<ShelfStock> = REAGENTS.map((r) => ({
    reagentId: r.id,
    label: r.label,
    concentrationM: r.kind === "water" ? null : r.defaultM,
    remainingMl: null,
  }));
  // A hotplate and an empty beaker give sandbox the same heating/mixing setup as the challenge
  // scenarios without dictating what the beaker holds.
  const beaker = containerAt(mintContainerId(1), "beaker", "Beaker", CAPACITY_ML.beaker, { x: -0.5, y: 0.5 }, 0, {}, false);
  const hotplate: Instrument = { kind: "instrument", id: mintInstrumentId(2), type: "hotplate", position: { x: 1.5, y: 0.5 }, attachedTo: null, lastReading: null };
  return {
    clockS: 0,
    ambientC: AMBIENT_C,
    objects: [beaker, hotplate],
    shelf,
    indicatorsAvailable: [...INDICATOR_IDS],
    reactions: [],
    observations: [],
    history: [],
    scenario: { kind: "sandbox", seed, visibility: { inspectContents: "full", revealShelfConcentrations: true, instrumentsRequired: false } },
    rng: seedRng(seed),
    nextSeq: 3,
  };
}

function loadTitration(seed: number): LabState {
  const draw = nextFloat(seedRng(seed));
  const analyteM = round4(0.08 + 0.04 * draw.value);

  const hcl = reagentDef(mintReagentId("hcl"));
  const naoh = reagentDef(mintReagentId("naoh"));
  if (!hcl || hcl.kind !== "solution" || !naoh || naoh.kind !== "solution") throw new Error("unreachable: hcl/naoh missing from registry");

  const flaskId = mintContainerId(1);
  const buretteId = mintContainerId(2);
  // Bench cells follow the C3.2 titration layout: burette stand directly behind the flask (same x,
  // one row back), probe holder beside them, a spare beaker and a hotplate to the right. Column
  // -1.5 keeps the cluster centered in `CameraRig.BASE_LOOKAT`'s frame rather than pinned to the
  // grid's far-left edge.
  const flask = containerAt(flaskId, "flask", "Flask", CAPACITY_ML.flask, { x: -1.5, y: 0.5 }, 25, stockToMoles(hcl, 25, analyteM), true);
  const burette = containerAt(buretteId, "burette", "Burette", CAPACITY_ML.burette, { x: -1.5, y: -0.5 }, 50, stockToMoles(naoh, 50, 0.1), false);
  const phMeter: Instrument = { kind: "instrument", id: mintInstrumentId(3), type: "ph_meter", position: { x: 0.5, y: -0.5 }, attachedTo: null, lastReading: null };
  const beaker = containerAt(mintContainerId(4), "beaker", "Beaker", CAPACITY_ML.beaker, { x: 0.5, y: 0.5 }, 0, {}, false);
  const hotplate: Instrument = { kind: "instrument", id: mintInstrumentId(5), type: "hotplate", position: { x: 2.5, y: 0.5 }, attachedTo: null, lastReading: null };

  // No naoh entry here: the only titrant path is the burette (via dispense), so every base
  // addition is recorded on the titration curve. TRANSFER_LIQUID out of the burette is also
  // blocked in commands.ts for the same reason.
  const shelf: ReadonlyArray<ShelfStock> = [
    { reagentId: mintReagentId("water"), label: "Water", concentrationM: null, remainingMl: null },
    { reagentId: mintReagentId("unknown_acid"), label: "Unknown acid", concentrationM: null, remainingMl: null },
  ];

  return {
    clockS: 0,
    ambientC: AMBIENT_C,
    objects: [flask, burette, phMeter, beaker, hotplate],
    shelf,
    indicatorsAvailable: [mintIndicatorId("phenolphthalein"), mintIndicatorId("universal")],
    reactions: [],
    observations: [],
    history: [],
    scenario: {
      kind: "titration",
      seed,
      visibility: { inspectContents: "non_unknown_only", revealShelfConcentrations: true, instrumentsRequired: true },
      flaskId,
      buretteId,
      analyteMl: 25,
      titrantM: 0.1,
      secrets: { analyteM },
      curve: [],
      toleranceRel: 0.02,
      revealed: false,
    },
    rng: draw.rng,
    nextSeq: 6,
  };
}

const UNKNOWN_LABELS: ReadonlyArray<string> = ["A", "B", "C"];
// Front row, spanning the bench; the pH meter sits behind the middle sample.
const UNKNOWN_POSITIONS: ReadonlyArray<{ readonly x: number; readonly y: number }> = [
  { x: -1.5, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 2.5, y: 0.5 },
];
const UNKNOWN_ARCHETYPES: ReadonlyArray<string> = ["hcl", "naoh", "nacl", "na2co3", "cacl2"];
const UNKNOWN_SHOWN_REAGENTS: ReadonlyArray<string> = ["water", "hcl", "naoh", "nacl", "agno3", "cacl2", "na2co3"];

function loadUnknownId(seed: number): LabState {
  const draw = shuffle(seedRng(seed), UNKNOWN_ARCHETYPES.map((s) => mintReagentId(s)));
  const chosen = draw.value.slice(0, 3);

  const objects: LabObject[] = [];
  const secrets: Record<string, StockRecipe> = {};
  const samples: Array<{ readonly shelfId: ReagentId; readonly label: string; readonly containerId: ContainerId }> = [];

  chosen.forEach((reagentId, i) => {
    const def = reagentDef(reagentId);
    if (!def || def.kind !== "solution") throw new Error(`unreachable: archetype ${reagentId} missing from registry`);
    const label = UNKNOWN_LABELS[i] ?? `${i}`;
    const position = UNKNOWN_POSITIONS[i] ?? { x: 0, y: 0.5 };
    const containerId = mintContainerId(i + 1);
    const shelfId = mintReagentId(`unknown_${label.toLowerCase()}`);
    objects.push(containerAt(containerId, "beaker", `Unknown ${label}`, 50, position, 20, stockToMoles(def, 20, 0.1), true));
    secrets[shelfId] = { reagentId, concentrationM: 0.1 };
    samples.push({ shelfId, label: `Unknown ${label}`, containerId });
  });

  objects.push({ kind: "instrument", id: mintInstrumentId(4), type: "ph_meter", position: { x: 0.5, y: -0.5 }, attachedTo: null, lastReading: null });

  const shelf: ReadonlyArray<ShelfStock> = [
    ...UNKNOWN_SHOWN_REAGENTS.map((slug) => {
      const id = mintReagentId(slug);
      const def = reagentDef(id);
      return { reagentId: id, label: def?.kind === "solution" ? def.label : def?.kind === "water" ? def.label : slug, concentrationM: def?.kind === "solution" ? def.defaultM : null, remainingMl: null };
    }),
    ...samples.map((s) => ({ reagentId: s.shelfId, label: s.label, concentrationM: null, remainingMl: null })),
  ];

  return {
    clockS: 0,
    ambientC: AMBIENT_C,
    objects,
    shelf,
    indicatorsAvailable: [...INDICATOR_IDS],
    reactions: [],
    observations: [],
    history: [],
    scenario: {
      kind: "unknown_id",
      seed,
      visibility: { inspectContents: "non_unknown_only", revealShelfConcentrations: true, instrumentsRequired: true },
      samples,
      secrets,
      revealed: false,
    },
    rng: draw.rng,
    nextSeq: 5,
  };
}

export function loadScenario(id: ScenarioId, seed: number): LabState {
  switch (id) {
    case "sandbox":
      return loadSandbox(seed);
    case "titration":
      return loadTitration(seed);
    case "unknown_id":
      return loadUnknownId(seed);
    default:
      return assertNever(id);
  }
}

// ---------- public view ----------

function isContentsVisible(scenario: ScenarioState, container: Container): boolean {
  if (!container.containsUnknown) return true;
  return scenario.visibility.inspectContents === "full" || isScenarioRevealed(scenario);
}

function concentrationsOf(container: Container): Readonly<Partial<Record<string, number>>> {
  const liters = container.volumeMl / 1000;
  const out: Record<string, number> = {};
  if (liters <= 0) return out;
  for (const id of speciesKeys(container.species)) out[id] = getMoles(container.species, id) / liters;
  return out;
}

function reactionsOccurredIn(state: LabState, containerId: ContainerId): ReadonlyArray<ReactionRuleId> {
  const seen = new Set<ReactionRuleId>();
  const out: ReactionRuleId[] = [];
  for (const r of state.reactions) {
    if (r.containerId !== containerId || seen.has(r.ruleId)) continue;
    seen.add(r.ruleId);
    out.push(r.ruleId);
  }
  return out;
}

/** `visible` matches the container's own `ContentsView`: a hidden container's solids carry no species or moles. */
function publicSolids(solids: Container["solids"], visible: boolean): PublicContainer["solids"] {
  return solids.map((s) => {
    const def = speciesDef(s.species);
    const color = def.kind === "solid" ? def.color : { r: 200, g: 200, b: 200, a: 1 };
    const molarMass = def.kind === "solid" ? def.molarMass : 0;
    const scale = precipitateScale(s.moles * molarMass);
    return visible ? { kind: "identified" as const, species: s.species, moles: s.moles, suspended: s.suspended, color, scale } : { kind: "redacted" as const, suspended: s.suspended, color, scale };
  });
}

function toPublicContainer(state: LabState, container: Container): PublicContainer {
  const visible = isContentsVisible(state.scenario, container);
  const hasPhMeter = state.objects.some((o) => o.kind === "instrument" && o.type === "ph_meter" && o.attachedTo === container.id);
  const contents: ContentsView = visible
    ? { kind: "visible", species: container.species, concentrationsM: concentrationsOf(container) }
    : { kind: "hidden", reason: "Unidentified sample; determine its identity through observation." };
  const color = deriveColor(container);
  return {
    kind: "container",
    id: container.id,
    type: container.type,
    label: container.label,
    capacityMl: container.capacityMl,
    position: container.position,
    rotationDeg: container.rotationDeg,
    volumeMl: container.volumeMl,
    temperatureC: container.temperatureC,
    solids: publicSolids(container.solids, visible),
    gasEffects: container.gasEffects,
    indicators: container.indicators,
    stir: container.stir,
    thermal: container.thermal,
    contents,
    pH: visible || hasPhMeter ? derivePh(container) : null,
    color,
    colorName: describeColor(color),
    reactionsOccurred: reactionsOccurredIn(state, container.id),
  };
}

function toPublicScenario(scenario: ScenarioState): PublicScenario {
  switch (scenario.kind) {
    case "sandbox":
      return scenario;
    case "titration":
      return {
        kind: "titration",
        seed: scenario.seed,
        visibility: scenario.visibility,
        flaskId: scenario.flaskId,
        buretteId: scenario.buretteId,
        analyteMl: scenario.analyteMl,
        titrantM: scenario.titrantM,
        curve: scenario.curve,
        revealed: scenario.revealed,
        analyteM: scenario.revealed ? scenario.secrets.analyteM : null,
      };
    case "unknown_id":
      return {
        kind: "unknown_id",
        seed: scenario.seed,
        visibility: scenario.visibility,
        samples: scenario.samples,
        revealed: scenario.revealed,
        identities: scenario.revealed ? scenario.secrets : null,
      };
    default:
      return assertNever(scenario);
  }
}

/** Redacts secrets and taints per A4.4. UI and tools read the lab exclusively through this. */
export function publicView(state: LabState): PublicLabState {
  return {
    clockS: state.clockS,
    ambientC: state.ambientC,
    objects: state.objects.map((o) => (o.kind === "container" ? toPublicContainer(state, o) : o)),
    shelf: state.shelf,
    indicatorsAvailable: state.indicatorsAvailable,
    scenario: toPublicScenario(state.scenario),
    nextSeq: state.nextSeq,
  };
}

// ---------- titration helpers ----------

export function titrationCurve(state: LabState): ReadonlyArray<CurvePoint> {
  return state.scenario.kind === "titration" ? state.scenario.curve : [];
}

/** Midpoint of the steepest ΔpH/ΔmL interval; null when fewer than two readings have a pH value. */
export function estimateEquivalenceMl(curve: ReadonlyArray<CurvePoint>): number | null {
  const valid = curve.filter((p): p is CurvePoint & { pH: number } => p.pH !== null).slice().sort((a, b) => a.titrantMl - b.titrantMl);
  if (valid.length < 2) return null;
  let bestSlope = -Infinity;
  let bestMid: number | null = null;
  for (let i = 0; i < valid.length - 1; i++) {
    const a = valid[i];
    const b = valid[i + 1];
    if (!a || !b) continue;
    const dv = b.titrantMl - a.titrantMl;
    if (dv <= 0) continue;
    const slope = Math.abs(b.pH - a.pH) / dv;
    if (slope > bestSlope) {
      bestSlope = slope;
      bestMid = (a.titrantMl + b.titrantMl) / 2;
    }
  }
  return bestMid;
}

export function titrationSolution(state: LabState): { readonly analyteM: number; readonly equivalenceMl: number } | null {
  if (state.scenario.kind !== "titration") return null;
  const { analyteMl, titrantM, secrets } = state.scenario;
  return { analyteM: secrets.analyteM, equivalenceMl: (analyteMl * secrets.analyteM) / titrantM };
}

export function checkTitrationAnswer(state: LabState, claimedM: number): { readonly correct: boolean; readonly relError: number; readonly analyteM: number } | null {
  if (state.scenario.kind !== "titration") return null;
  const analyteM = state.scenario.secrets.analyteM;
  const relError = Math.abs(claimedM - analyteM) / analyteM;
  return { correct: relError <= state.scenario.toleranceRel, relError, analyteM };
}

export function checkUnknownAnswers(state: LabState, guesses: Readonly<Record<string, ReagentId>>): { readonly correct: number; readonly total: number } | null {
  if (state.scenario.kind !== "unknown_id") return null;
  let correct = 0;
  for (const sample of state.scenario.samples) {
    const recipe = state.scenario.secrets[sample.shelfId];
    if (recipe && guesses[sample.shelfId] === recipe.reagentId) correct += 1;
  }
  return { correct, total: state.scenario.samples.length };
}
