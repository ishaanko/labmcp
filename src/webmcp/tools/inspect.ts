import { z } from "zod";
import { getMoles, isSpeciesIdShape, publicView, REAGENTS, reactionsIfAdded, ruleById, RULES, speciesKeys, type PublicContainer } from "@/engine";
import { err, errFromLabError, eventStrings, findContainer, ok, unknownObjectError } from "../runtime";
import { ContainerIdSchema } from "../schemas";
import type { AnyToolDef, ToolDef } from "../types";

const SPECIES_ID_PATTERN = /^[A-Za-z0-9()+\-^]+$/;
const SpeciesIdInputSchema = z.string().min(1).max(20).regex(SPECIES_ID_PATTERN).describe('Species formula id, e.g. "H+", "OH-", "AgCl(s)".');

/** The most recent public view of a container, or undefined if it is not on the bench. */
function publicContainer(lab: Parameters<typeof publicView>[0], id: string): PublicContainer | undefined {
  const found = publicView(lab).objects.find((o) => o.kind === "container" && o.id === id);
  return found && found.kind === "container" ? found : undefined;
}

const inspectContents: ToolDef<{ container_id: string }> = {
  name: "inspect_contents",
  title: "Inspect contents",
  description:
    "Reads the exact dissolved species, moles, and molarity in a container, plus any solids and which reactions " +
    "have occurred there. Blocked with PERMISSION_DENIED on a container tainted by an unidentified sample until " +
    "the challenge is revealed (via submit_conclusion); use measure_ph or add a test reagent and watch for a " +
    "precipitate or color change instead. Always allowed on ordinary sandbox containers.",
  input: z.object({ container_id: ContainerIdSchema }).strict(),
  readOnly: true,
  targetId: (i) => i.container_id,
  examples: [{ label: "Inspect c_1", input: { container_id: "c_1" } }],
  handler: async (input, ctx) => {
    const container = findContainer(ctx.getState().lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));

    const dr = await ctx.dispatch({ kind: "MEASURE", containerId: container.id, quantity: "contents" }, "agent");
    if (!dr.ok) return dr.error ? errFromLabError(ctx.getState, dr.error) : err(ctx.getState, "ENGINE_ERROR", "Inspection failed.");

    const pub = publicContainer(ctx.getState().lab, container.id);
    if (!pub || pub.contents.kind === "hidden") {
      return err(ctx.getState, "PERMISSION_DENIED", "Contents are hidden until the challenge is revealed.");
    }

    const contents = pub.contents;
    const species = speciesKeys(contents.species).map((id) => ({
      id,
      moles: contents.species[id] ?? 0,
      molarity: contents.concentrationsM[id] ?? 0,
    }));
    const solids = pub.solids.map((s) => ({ id: s.species, moles: s.moles, color: `rgb(${Math.round(s.color.r)}, ${Math.round(s.color.g)}, ${Math.round(s.color.b)})` }));
    const reactionsOccurred = pub.reactionsOccurred
      .map((id) => ruleById(id))
      .filter((rule) => rule !== undefined)
      .map((rule) => ({ id: rule.id, molecular: rule.equations.molecular, ionic: rule.equations.ionic, netIonic: rule.equations.netIonic }));

    return ok(
      ctx.getState,
      { containerId: container.id, volumeMl: pub.volumeMl, temperatureC: pub.temperatureC, species, solids, indicators: pub.indicators.map((d) => d.indicator), reactionsOccurred },
      dr.observation,
      eventStrings(dr),
    );
  },
};

const predictSupportedReactionsTool: ToolDef<{ container_id: string }> = {
  name: "predict_supported_reactions",
  title: "Predict supported reactions",
  description:
    "Predicts which reactions could fire in a container right now (based on which ions are already present) and " +
    "which new reactions would become possible if each shelf reagent were added. On a hidden challenge container " +
    "this returns only the general reaction registry (evaluated: false), since the actual ions can't be read.",
  input: z.object({ container_id: ContainerIdSchema }).strict(),
  readOnly: true,
  targetId: (i) => i.container_id,
  examples: [{ label: "Predict for c_1", input: { container_id: "c_1" } }],
  handler: async (input, ctx) => {
    const lab = ctx.getState().lab;
    const container = findContainer(lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));

    const pub = publicContainer(lab, container.id);
    if (!pub || pub.contents.kind === "hidden") {
      const registry = RULES.map((r) => ({ id: r.id, netIonic: r.equations.netIonic, visual: r.visual.kind }));
      return ok(ctx.getState, { evaluated: false, possibleNow: [], ifAdded: [], registry }, "Contents hidden; returned the general reaction registry only.", []);
    }

    const possibleNow = RULES.filter((rule) => rule.reactants.every((r) => getMoles(container.species, r.species) > 0)).map((r) => ({
      id: r.id,
      netIonic: r.equations.netIonic,
      visual: r.visual.kind,
    }));
    const possibleIds = new Set(possibleNow.map((r) => r.id));
    const ifAdded = REAGENTS.filter((r) => r.kind === "solution").flatMap((reagent) =>
      reactionsIfAdded(container, reagent)
        .filter((rule) => !possibleIds.has(rule.id))
        .map((rule) => ({ reagentId: reagent.id, reactionId: rule.id, visual: rule.visual.kind })),
    );
    return ok(ctx.getState, { evaluated: true, possibleNow, ifAdded }, `Evaluated ${RULES.length} reaction rule(s) for ${container.id}.`, []);
  },
};

const TITRANT_EXCEPTION_SPECIES: ReadonlySet<string> = new Set(["OH-", "Na+"]);

const calculateMoles: ToolDef<{ container_id: string; species_id: string }> = {
  name: "calculate_moles",
  title: "Calculate moles",
  description:
    "Computes moles, millimoles, and molarity of one species in a container. Blocked with PERMISSION_DENIED on a " +
    "hidden challenge container, except in the titration scenario where the titrant species OH- and Na+ remain " +
    "computable (needed to work the titration by material balance). Use get_titration_data plus this tool instead " +
    "of guessing.",
  input: z.object({ container_id: ContainerIdSchema, species_id: SpeciesIdInputSchema }).strict(),
  readOnly: true,
  targetId: (i) => i.container_id,
  examples: [{ label: "Moles of OH- in the flask", input: { container_id: "c_1", species_id: "OH-" } }],
  handler: async (input, ctx) => {
    const lab = ctx.getState().lab;
    const container = findContainer(lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));

    const pub = publicContainer(lab, container.id);
    const isTitrantException = lab.scenario.kind === "titration" && TITRANT_EXCEPTION_SPECIES.has(input.species_id);
    if (!pub || (pub.contents.kind === "hidden" && !isTitrantException)) {
      return err(ctx.getState, "PERMISSION_DENIED", "Contents are hidden until the challenge is revealed.", [
        "For the titration scenario, calculate_moles(flaskId, 'OH-') and (buretteId or flaskId, 'Na+') remain allowed.",
      ]);
    }

    if (!isSpeciesIdShape(input.species_id)) {
      return err(ctx.getState, "INVALID_INPUT", `"${input.species_id}" is not a valid species id shape (expected a formula like "H+" or "AgCl(s)").`);
    }
    const moles = getMoles(container.species, input.species_id);
    const molarity = container.volumeMl > 0 ? moles / (container.volumeMl / 1000) : 0;
    return ok(
      ctx.getState,
      { containerId: container.id, speciesId: input.species_id, moles, millimoles: moles * 1000, molarity, volumeMl: container.volumeMl },
      `Calculated ${(moles * 1000).toFixed(3)} mmol of ${input.species_id} in ${container.id}.`,
      [],
    );
  },
};

export const inspectTools: ReadonlyArray<AnyToolDef> = [inspectContents, predictSupportedReactionsTool, calculateMoles];
