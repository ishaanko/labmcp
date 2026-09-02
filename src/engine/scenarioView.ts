/**
 * The public, redaction-safe view of state (A4.4): strips secrets and hides a tainted
 * container's contents until its scenario allows inspection. UI and tools read the lab
 * exclusively through publicView(); split out of scenarios.ts to keep both files under the
 * file-length budget.
 */
import { isScenarioRevealed } from "./commands";
import { deriveColor, describeColor } from "./color";
import type { ContainerId, ReactionRuleId } from "./ids";
import { derivePh } from "./ph";
import { precipitateScale } from "./reactions";
import { getMoles, speciesDef, speciesKeys } from "./species";
import { assertNever, type Container, type ContentsView, type LabState, type PublicContainer, type PublicLabState, type PublicScenario, type ScenarioState } from "./types";

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
    case "precipitation":
      return { kind: "precipitation", seed: scenario.seed, visibility: scenario.visibility, beakerId: scenario.beakerId, revealed: scenario.revealed };
    case "neutralize":
      return {
        kind: "neutralize",
        seed: scenario.seed,
        visibility: scenario.visibility,
        beakerId: scenario.beakerId,
        targetPh: scenario.targetPh,
        tolerance: scenario.tolerance,
        revealed: scenario.revealed,
        start: scenario.revealed ? scenario.secrets : null,
      };
    case "dilution":
      return {
        kind: "dilution",
        seed: scenario.seed,
        visibility: scenario.visibility,
        reagentId: scenario.reagentId,
        stockM: scenario.stockM,
        targetMl: scenario.targetMl,
        targetM: scenario.targetM,
        toleranceMl: scenario.toleranceMl,
        toleranceM: scenario.toleranceM,
        revealed: scenario.revealed,
      };
    case "solubility":
      return { kind: "solubility", seed: scenario.seed, visibility: scenario.visibility, beakerId: scenario.beakerId, soluteId: scenario.soluteId, revealed: scenario.revealed };
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
