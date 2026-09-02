import { z } from "zod";
import { checkTitrationAnswer, checkUnknownAnswers, isReagentId, scenarioObjective, type ReagentId } from "@/engine";
import { err, errFromLabError, eventStrings, ok } from "../runtime";
import { ContainerIdSchema, ScenarioIdSchema } from "../schemas";
import type { AnyToolDef, ToolDef } from "../types";

const undoLastAction: ToolDef<Record<string, never>> = {
  name: "undo_last_action",
  title: "Undo last action",
  description:
    "Reverts the single most recent action in the history (yours or the human's) and restores the lab to its exact " +
    "prior state. There is no redo, so use this only when you are sure. Fails with NOTHING_TO_UNDO if history is " +
    "empty.",
  input: z.object({}).strict(),
  readOnly: false,
  examples: [{ label: "Undo", input: {} }],
  handler: async (_input, ctx) => {
    const lastEntry = ctx.getState().lab.history.at(-1);
    const dr = await ctx.dispatch({ kind: "UNDO" }, "agent");
    if (!dr.ok) return dr.error ? errFromLabError(ctx.getState, dr.error) : err(ctx.getState, "ENGINE_ERROR", "Undo failed.");
    return ok(
      ctx.getState,
      { undone: lastEntry ? { seq: lastEntry.seq, label: lastEntry.command.kind.toLowerCase().replace(/_/g, " "), actor: lastEntry.actor } : null },
      dr.observation,
      eventStrings(dr),
    );
  },
};

const resetExperiment: ToolDef<{ confirm: true }> = {
  name: "reset_experiment",
  title: "Reset experiment",
  description: "Reloads the current scenario with its original seed, discarding every change. Destructive: requires confirm: true.",
  input: z.object({ confirm: z.literal(true).describe("Must be exactly true to acknowledge this discards all changes.") }).strict(),
  readOnly: false,
  examples: [{ label: "Reset", input: { confirm: true } }],
  handler: async (_input, ctx) => {
    const dr = await ctx.dispatch({ kind: "RESET" }, "agent");
    if (!dr.ok) return dr.error ? errFromLabError(ctx.getState, dr.error) : err(ctx.getState, "ENGINE_ERROR", "Reset failed.");
    return ok(ctx.getState, { scenarioId: ctx.getState().lab.scenario.kind }, dr.observation, eventStrings(dr));
  },
};

const loadScenarioTool: ToolDef<{ scenario_id: "sandbox" | "titration" | "unknown_id"; seed?: number }> = {
  name: "load_scenario",
  title: "Load scenario",
  description:
    "Loads a scenario onto a fresh bench: 'sandbox' (free experimentation), 'titration' (a burette/flask acid-base " +
    "setup with a hidden analyte concentration), or 'unknown_id' (unlabeled samples to identify). Uses the fixed " +
    "demo seed 42 unless a different seed is given.",
  input: z
    .object({
      scenario_id: ScenarioIdSchema.describe("Which scenario to load: 'sandbox', 'titration', or 'unknown_id'."),
      seed: z.int().min(0).optional().describe("RNG seed. Defaults to the fixed demo seed 42."),
    })
    .strict(),
  readOnly: false,
  examples: [{ label: "Load the titration scenario", input: { scenario_id: "titration" } }],
  handler: async (input, ctx) => {
    const dr = await ctx.dispatch({ kind: "LOAD_SCENARIO", scenarioId: input.scenario_id, seed: input.seed ?? 42 }, "agent");
    if (!dr.ok) return dr.error ? errFromLabError(ctx.getState, dr.error) : err(ctx.getState, "ENGINE_ERROR", "Could not load the scenario.");
    return ok(ctx.getState, { scenarioId: input.scenario_id, objective: scenarioObjective(input.scenario_id) }, dr.observation, eventStrings(dr));
  },
};

const AnswerSchema = z
  .object({
    container_id: ContainerIdSchema,
    claim: z.string().min(1).max(40).describe('Reagent id guess for unknown_id (e.g. "agno3"), or ignored for titration.'),
    concentration_m: z.number().gt(0).max(5).optional().describe("Claimed molarity, used for the titration scenario's analyte."),
  })
  .strict();

const submitConclusion: ToolDef<{ answers: ReadonlyArray<{ container_id: string; claim: string; concentration_m?: number }> }> = {
  name: "submit_conclusion",
  title: "Submit conclusion",
  description:
    "Ends the active challenge and grades your answer: for 'unknown_id', one { container_id, claim } per sample, " +
    "claim being a reagent id guess; for 'titration', one { container_id, concentration_m } with the claimed " +
    "analyte molarity. This is the only path that reveals hidden identities, and it ends the challenge, so call it " +
    "once you're confident. Fails with PERMISSION_DENIED outside an active challenge scenario.",
  input: z.object({ answers: z.array(AnswerSchema).min(1).max(10).describe("One answer per unknown sample, or a single answer for the titration analyte.") }).strict(),
  readOnly: false,
  examples: [{ label: "Answer the titration", input: { answers: [{ container_id: "c_1", claim: "", concentration_m: 0.12 }] } }],
  handler: async (input, ctx) => {
    const lab = ctx.getState().lab;
    if (lab.scenario.kind === "sandbox") {
      return err(ctx.getState, "PERMISSION_DENIED", "There is no active challenge to conclude in the sandbox scenario.");
    }

    if (lab.scenario.kind === "titration") {
      const claimedM = input.answers[0]?.concentration_m;
      if (claimedM === undefined) return err(ctx.getState, "INVALID_INPUT", "Provide concentration_m for the titration analyte.");
      const check = checkTitrationAnswer(lab, claimedM);
      const dr = await ctx.dispatch({ kind: "REVEAL" }, "agent");
      if (!dr.ok) return dr.error ? errFromLabError(ctx.getState, dr.error) : err(ctx.getState, "ENGINE_ERROR", "Could not reveal the answer.");
      return ok(ctx.getState, { correct: check?.correct ?? false, expected: check ? { analyteM: check.analyteM } : null }, dr.observation, eventStrings(dr));
    }

    const guesses: Record<string, ReagentId> = {};
    for (const sample of lab.scenario.samples) {
      const answer = input.answers.find((a) => a.container_id === sample.containerId);
      if (answer && isReagentId(answer.claim)) guesses[sample.shelfId] = answer.claim;
    }
    const check = checkUnknownAnswers(lab, guesses);
    const dr = await ctx.dispatch({ kind: "REVEAL" }, "agent");
    if (!dr.ok) return dr.error ? errFromLabError(ctx.getState, dr.error) : err(ctx.getState, "ENGINE_ERROR", "Could not reveal the answers.");
    const revealedScenario = ctx.getState().lab.scenario;
    const identities = revealedScenario.kind === "unknown_id" ? revealedScenario.secrets : null;
    return ok(
      ctx.getState,
      { correct: check ? check.correct === check.total : false, expected: identities },
      dr.observation,
      eventStrings(dr),
    );
  },
};

export const metaTools: ReadonlyArray<AnyToolDef> = [undoLastAction, resetExperiment, loadScenarioTool, submitConclusion];
