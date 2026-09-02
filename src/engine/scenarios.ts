/**
 * Scenario construction (A4.2): loadScenario for every ScenarioId, deterministic per seed.
 * `secrets` never leaves this module except through the answer-checking helpers in
 * scenarioProgress.ts. Construction helpers (containerAt, instrumentAt, shelfEntry) live in
 * scenarioLayouts.ts; the redaction-safe public view lives in scenarioView.ts.
 */
import { AMBIENT_C, CAPACITY_ML } from "./constants";
import { mintContainerId, mintIndicatorId, mintInstrumentId, mintReagentId, type ContainerId, type ReagentId } from "./ids";
import { INDICATOR_IDS, REAGENTS, reagentDef, stockToMoles } from "./reagents";
import { nextFloat, seedRng, shuffle } from "./rng";
import { containerAt, instrumentAt, round4, shelfEntry } from "./scenarioLayouts";
import { assertNever, type LabObject, type LabState, type ScenarioId, type ShelfStock, type StockRecipe, type Vec2 } from "./types";

export { publicView } from "./scenarioView";
export { checkTitrationAnswer, checkUnknownAnswers, estimateEquivalenceMl, titrationCurve, titrationSolution } from "./scenarioAnswers";

export const SCENARIO_IDS: ReadonlyArray<ScenarioId> = ["titration", "precipitation", "neutralize", "dilution", "solubility", "unknown_id", "sandbox"];

/** Short menu labels, in the same order as SCENARIO_IDS. */
export const SCENARIO_TITLES: Readonly<Record<ScenarioId, string>> = {
  titration: "Titration",
  precipitation: "Precipitation",
  neutralize: "Neutralize to pH 7",
  dilution: "Dilution",
  solubility: "Solubility",
  unknown_id: "Reaction mystery",
  sandbox: "Sandbox",
};

export function scenarioObjective(id: ScenarioId): string {
  switch (id) {
    case "sandbox":
      return "Explore freely: mix reagents, add indicators, and watch what reacts.";
    case "titration":
      return "Titrate the acid in the flask with the burette's sodium hydroxide to find its exact concentration.";
    case "unknown_id":
      return "Find which pairs react: gas, precipitate, or color. Then name each unknown.";
    case "precipitation":
      return "Mix two solutions and make a solid appear.";
    case "neutralize":
      return "Bring the beaker to pH 7.0 ± 0.1. Strong acid and base overshoot in tiny doses; acetic acid and ammonia settle near 7.";
    case "dilution":
      return "Prepare 100 mL of 0.10 M sodium chloride from the 1.0 M stock.";
    case "solubility":
      return "Dissolve potassium nitrate, then heat and cool to see solubility change.";
    default:
      return assertNever(id);
  }
}

function fullShelf(): ReadonlyArray<ShelfStock> {
  return REAGENTS.map((r) => ({
    reagentId: r.id,
    label: r.label,
    concentrationM: r.kind === "solution" ? r.defaultM : null,
    remainingMl: null,
  }));
}

function loadSandbox(seed: number): LabState {
  // A hotplate and an empty beaker give sandbox the same heating/mixing setup as the challenge
  // scenarios without dictating what the beaker holds.
  const beaker = containerAt(mintContainerId(1), "beaker", "Beaker", CAPACITY_ML.beaker, { x: -0.5, y: 0.5 }, 0, {}, false);
  const hotplate = instrumentAt(mintInstrumentId(2), "hotplate", { x: 1.5, y: 0.5 });
  return {
    clockS: 0,
    ambientC: AMBIENT_C,
    objects: [beaker, hotplate],
    shelf: fullShelf(),
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
  const phMeter = instrumentAt(mintInstrumentId(3), "ph_meter", { x: 0.5, y: -0.5 });
  const beaker = containerAt(mintContainerId(4), "beaker", "Beaker", CAPACITY_ML.beaker, { x: 0.5, y: 0.5 }, 0, {}, false);
  const hotplate = instrumentAt(mintInstrumentId(5), "hotplate", { x: 2.5, y: 0.5 });

  // No naoh entry here: the only titrant path is the burette (via dispense), so every base
  // addition is recorded on the titration curve. TRANSFER_LIQUID out of the burette is also
  // blocked in commands.ts for the same reason.
  const shelf: ReadonlyArray<ShelfStock> = [shelfEntry(mintReagentId("water")), { reagentId: mintReagentId("unknown_acid"), label: "Unknown acid", concentrationM: null, remainingMl: null }];

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

const UNKNOWN_LABELS: ReadonlyArray<string> = ["A", "B", "C", "D"];
/** Shelf ids of the four mystery samples ("unknown_a" .. "unknown_d"); the add_reagent tool enum includes them. */
export const UNKNOWN_SAMPLE_SHELF_IDS: ReadonlyArray<ReagentId> = UNKNOWN_LABELS.map((label) => mintReagentId(`unknown_${label.toLowerCase()}`));
// Four adjacent front-row cells so every sample fits a 730px bench viewport; the pH meter sits behind the third.
const UNKNOWN_POSITIONS: ReadonlyArray<Vec2> = [
  { x: -1.5, y: 0.5 },
  { x: -0.5, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 1.5, y: 0.5 },
];
// Every draw holds the acid and the carbonate, so "observe a gas" is always reachable; two of the rest fill the other samples.
const UNKNOWN_REQUIRED: ReadonlyArray<string> = ["hcl", "na2co3"];
const UNKNOWN_OPTIONAL: ReadonlyArray<string> = ["agno3", "nacl", "cuso4", "bacl2", "na2so4"];
const UNKNOWN_SHOWN_REAGENTS: ReadonlyArray<string> = ["hcl", "naoh", "agno3", "nacl", "bacl2", "na2so4", "water"];

function loadUnknownId(seed: number): LabState {
  const optional = shuffle(seedRng(seed), UNKNOWN_OPTIONAL.map((s) => mintReagentId(s)));
  const draw = shuffle(optional.rng, [...UNKNOWN_REQUIRED.map((s) => mintReagentId(s)), ...optional.value.slice(0, 2)]);
  const chosen = draw.value;

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

  objects.push(instrumentAt(mintInstrumentId(5), "ph_meter", { x: 0.5, y: -0.5 }));

  const shelf: ReadonlyArray<ShelfStock> = [...UNKNOWN_SHOWN_REAGENTS.map((slug) => shelfEntry(mintReagentId(slug))), ...samples.map((s) => ({ reagentId: s.shelfId, label: s.label, concentrationM: null, remainingMl: null }))];

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
    nextSeq: 6,
  };
}

function loadPrecipitation(seed: number): LabState {
  const beakerId = mintContainerId(1);
  const beaker = containerAt(beakerId, "beaker", "Beaker", CAPACITY_ML.beaker, { x: -0.5, y: 0.5 }, 0, {}, false);
  const beaker2 = containerAt(mintContainerId(2), "beaker", "Beaker 2", CAPACITY_ML.beaker, { x: 1.5, y: 0.5 }, 0, {}, false);
  const shelf: ReadonlyArray<ShelfStock> = ["agno3", "nacl", "bacl2", "na2so4", "cuso4", "naoh", "water"].map((slug) => shelfEntry(mintReagentId(slug)));

  return {
    clockS: 0,
    ambientC: AMBIENT_C,
    objects: [beaker, beaker2],
    shelf,
    indicatorsAvailable: [...INDICATOR_IDS],
    reactions: [],
    observations: [],
    history: [],
    scenario: {
      kind: "precipitation",
      seed,
      visibility: { inspectContents: "full", revealShelfConcentrations: true, instrumentsRequired: false },
      beakerId,
      revealed: false,
    },
    rng: seedRng(seed),
    nextSeq: 3,
  };
}

function loadNeutralize(seed: number): LabState {
  const pickReagent = nextFloat(seedRng(seed));
  const startReagentId = mintReagentId(pickReagent.value < 0.5 ? "hcl" : "naoh");
  const pickM = nextFloat(pickReagent.rng);
  const startM = round4(0.02 + 0.04 * pickM.value);

  const startDef = reagentDef(startReagentId);
  if (!startDef || startDef.kind !== "solution") throw new Error("unreachable: hcl/naoh missing from registry");

  const beakerId = mintContainerId(1);
  const beaker = containerAt(beakerId, "beaker", "Beaker", CAPACITY_ML.beaker, { x: 0.5, y: 0.5 }, 50, stockToMoles(startDef, 50, startM), true);
  const phMeter = instrumentAt(mintInstrumentId(2), "ph_meter", { x: 0.5, y: -0.5 });

  const shelf: ReadonlyArray<ShelfStock> = [
    shelfEntry(mintReagentId("hcl"), 0.1),
    shelfEntry(mintReagentId("naoh"), 0.1),
    shelfEntry(mintReagentId("acetic_acid")),
    shelfEntry(mintReagentId("ammonia")),
    shelfEntry(mintReagentId("water")),
  ];

  return {
    clockS: 0,
    ambientC: AMBIENT_C,
    objects: [beaker, phMeter],
    shelf,
    indicatorsAvailable: [...INDICATOR_IDS],
    reactions: [],
    observations: [],
    history: [],
    scenario: {
      kind: "neutralize",
      seed,
      visibility: { inspectContents: "non_unknown_only", revealShelfConcentrations: true, instrumentsRequired: true },
      beakerId,
      targetPh: 7.0,
      tolerance: 0.1,
      secrets: { startReagent: startReagentId, startM },
      revealed: false,
    },
    rng: pickM.rng,
    nextSeq: 3,
  };
}

function loadDilution(seed: number): LabState {
  const naclId = mintReagentId("nacl");
  const cylinder = containerAt(mintContainerId(1), "graduated_cylinder", "Graduated cylinder", CAPACITY_ML.graduated_cylinder, { x: -0.5, y: 0.5 }, 0, {}, false);
  const beaker = containerAt(mintContainerId(2), "beaker", "Beaker", CAPACITY_ML.beaker, { x: 1.5, y: 0.5 }, 0, {}, false);
  const shelf: ReadonlyArray<ShelfStock> = [shelfEntry(naclId, 1.0), shelfEntry(mintReagentId("water"))];

  return {
    clockS: 0,
    ambientC: AMBIENT_C,
    objects: [cylinder, beaker],
    shelf,
    indicatorsAvailable: [...INDICATOR_IDS],
    reactions: [],
    observations: [],
    history: [],
    scenario: {
      kind: "dilution",
      seed,
      visibility: { inspectContents: "full", revealShelfConcentrations: true, instrumentsRequired: false },
      reagentId: naclId,
      stockM: 1.0,
      targetMl: 100,
      targetM: 0.1,
      toleranceMl: 2,
      toleranceM: 0.005,
      revealed: false,
    },
    rng: seedRng(seed),
    nextSeq: 3,
  };
}

function loadSolubility(seed: number): LabState {
  const beakerId = mintContainerId(1);
  const beaker = containerAt(beakerId, "beaker", "Beaker", CAPACITY_ML.beaker, { x: -0.5, y: 0.5 }, 50, {}, false);
  const hotplate = instrumentAt(mintInstrumentId(2), "hotplate", { x: 1.5, y: 0.5 });
  const thermometer = instrumentAt(mintInstrumentId(3), "thermometer", { x: 1.5, y: -0.5 });
  const kno3Id = mintReagentId("kno3");
  const shelf: ReadonlyArray<ShelfStock> = [shelfEntry(kno3Id), shelfEntry(mintReagentId("water"))];

  return {
    clockS: 0,
    ambientC: AMBIENT_C,
    objects: [beaker, hotplate, thermometer],
    shelf,
    indicatorsAvailable: [...INDICATOR_IDS],
    reactions: [],
    observations: [],
    history: [],
    scenario: {
      kind: "solubility",
      seed,
      visibility: { inspectContents: "full", revealShelfConcentrations: true, instrumentsRequired: true },
      beakerId,
      soluteId: kno3Id,
      revealed: false,
      milestones: { addedEnoughSolute: false, hadUndissolved: false, heatedFullyDissolved: false, cooledWithCrystals: false },
    },
    rng: seedRng(seed),
    nextSeq: 4,
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
    case "precipitation":
      return loadPrecipitation(seed);
    case "neutralize":
      return loadNeutralize(seed);
    case "dilution":
      return loadDilution(seed);
    case "solubility":
      return loadSolubility(seed);
    default:
      return assertNever(id);
  }
}
