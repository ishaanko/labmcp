import { z } from "zod";
import { constants, mintIndicatorId, mintReagentId, parseObjectId, publicView, REAGENT_IDS, reagentDef, type LabEvent, type PublicContainer } from "@/engine";
import { err, errFromLabError, eventStrings, findContainer, ok, unknownObjectError } from "../runtime";
import { ContainerIdSchema, EquipmentTypeSchema, INDICATOR_IDS, ObjectIdSchema, SlotSchema, TemperatureCSchema, VolumeMlSchema } from "../schemas";
import type { AnyToolDef, ToolDef } from "../types";

/** The most recent public view of a container, or undefined if it is not on the bench. */
function publicContainer(lab: Parameters<typeof publicView>[0], id: string): PublicContainer | undefined {
  const found = publicView(lab).objects.find((o) => o.kind === "container" && o.id === id);
  return found && found.kind === "container" ? found : undefined;
}

/**
 * Reports that a reaction fired without naming it unless the container it fired in is currently
 * visible; the rule id and net ionic equation are exactly what a hidden challenge sample hides.
 */
function reactionResult(events: ReadonlyArray<LabEvent>, container: PublicContainer | undefined): { readonly occurred: true; readonly id?: string; readonly netIonic?: string } | undefined {
  const fired = events.find((e) => e.kind === "REACTION");
  if (!fired || fired.kind !== "REACTION") return undefined;
  return container?.contents.kind === "visible" ? { occurred: true, id: fired.ruleId, netIonic: fired.netIonic } : { occurred: true };
}

/**
 * `SlotSchema` speaks in whole columns/rows (0..8, 0..3) for the agent; the engine's grid cells
 * are the half-integer centers in `GRID_BOUNDS` (-4.5..3.5, -1.5..1.5). Without this shift every
 * explicit position clamped to the grid edge instead of landing where it was asked for.
 */
function slotToGrid(slot: { readonly col: number; readonly row: number }): { x: number; y: number } {
  return { x: slot.col - 4.5, y: slot.row - 1.5 };
}

const AddContainerInput = z
  .object({
    type: EquipmentTypeSchema,
    position: SlotSchema.optional(),
    label: z.string().max(24).optional().describe("Optional custom label, shown instead of the default type name."),
  })
  .strict();

const addContainer: ToolDef<z.infer<typeof AddContainerInput>> = {
  name: "add_container",
  title: "Add container",
  description:
    "Places a new piece of equipment on the bench: glassware (beaker, flask, test_tube, graduated_cylinder, " +
    "burette) or an instrument (ph_meter, thermometer, hotplate). Uses the next free bench slot when position is " +
    "omitted. Fails with OUT_OF_RANGE if the bench is full or the slot is occupied.",
  input: AddContainerInput,
  readOnly: false,
  examples: [{ label: "Add a beaker", input: { type: "beaker" } }],
  handler: async (input, ctx) => {
    const dr = await ctx.dispatch(
      {
        kind: "PLACE_OBJECT",
        objectType: input.type,
        position: input.position ? slotToGrid(input.position) : undefined,
        label: input.label,
      },
      "agent",
    );
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);
    const placedEvent = dr.events.map((o) => o.event).find((e) => e.kind === "OBJECT_PLACED");
    if (!placedEvent || placedEvent.kind !== "OBJECT_PLACED") return err(ctx.getState, "ENGINE_ERROR", "Object placed but its id was not reported.");
    const placed = ctx.getState().lab.objects.find((o) => o.id === placedEvent.objectId);
    return ok(
      ctx.getState,
      { id: placedEvent.objectId, type: placedEvent.objectType, position: placed?.position ?? null },
      dr.observation,
      eventStrings(ctx.getState, dr),
    );
  },
};

const AddReagentInput = z
  .object({
    container_id: ContainerIdSchema,
    reagent_id: z.enum(REAGENT_IDS).describe('Shelf reagent id, e.g. "hcl", "naoh", "water". See list_reagents.'),
    volume_ml: VolumeMlSchema,
    concentration_m: z.number().gt(0).max(2).optional().describe("Concentration in mol/L (0 < x ≤ 2). Omit to use the reagent's default concentration."),
  })
  .strict();

const addReagent: ToolDef<z.infer<typeof AddReagentInput>> = {
  name: "add_reagent",
  title: "Add reagent",
  description:
    "Adds a stock reagent (or water) to a container. Water dilutes without changing species. Overflow fails with " +
    "nothing added; check capacity with measure_volume first if unsure. Mixing may trigger a supported reaction, " +
    "reported in the observation and in `reaction`. Use add_indicator for indicators and transfer to move existing " +
    "liquid between containers instead of re-adding stock.",
  input: AddReagentInput,
  readOnly: false,
  targetId: (i) => i.container_id,
  examples: [{ label: "25 mL 0.1 M HCl into c_1", input: { container_id: "c_1", reagent_id: mintReagentId("hcl"), volume_ml: 25 } }],
  handler: async (input, ctx) => {
    const container = findContainer(ctx.getState().lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));
    const def = reagentDef(input.reagent_id);

    const dr = await ctx.dispatch(
      { kind: "ADD_REAGENT", containerId: container.id, reagentId: input.reagent_id, volumeMl: input.volume_ml, concentrationM: input.concentration_m },
      "agent",
    );
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);

    const updatedLab = ctx.getState().lab;
    const reaction = reactionResult(dr.events.map((o) => o.event), publicContainer(updatedLab, container.id));
    const updated = findContainer(updatedLab, input.container_id);
    const concentrationM = input.concentration_m ?? (def && def.kind === "solution" ? def.defaultM : null);
    return ok(
      ctx.getState,
      { containerId: container.id, addedMl: input.volume_ml, reagentId: input.reagent_id, concentrationM, newVolumeMl: updated?.volumeMl ?? container.volumeMl, reaction },
      dr.observation,
      eventStrings(ctx.getState, dr),
    );
  },
};

const transfer: ToolDef<{ source_id: string; destination_id: string; volume_ml: number }> = {
  name: "transfer",
  title: "Transfer liquid",
  description:
    "Pours liquid from one container to another, moving species proportionally to the fraction of the source's " +
    "volume moved. Solids stay behind in the source. Use dispense instead when the source is a burette (for " +
    "controlled, incremental titration additions).",
  input: z.object({ source_id: ContainerIdSchema, destination_id: ContainerIdSchema, volume_ml: VolumeMlSchema }).strict(),
  readOnly: false,
  targetId: (i) => i.destination_id,
  examples: [{ label: "Pour 10 mL c_1 into c_2", input: { source_id: "c_1", destination_id: "c_2", volume_ml: 10 } }],
  handler: async (input, ctx) => {
    const lab = ctx.getState().lab;
    const source = findContainer(lab, input.source_id);
    if (!source) return errFromLabError(ctx.getState, unknownObjectError(input.source_id));
    const destination = findContainer(lab, input.destination_id);
    if (!destination) return errFromLabError(ctx.getState, unknownObjectError(input.destination_id));

    const dr = await ctx.dispatch({ kind: "TRANSFER_LIQUID", fromId: source.id, toId: destination.id, volumeMl: input.volume_ml }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);

    const updatedLab = ctx.getState().lab;
    const reaction = reactionResult(dr.events.map((o) => o.event), publicContainer(updatedLab, destination.id));
    const updatedSource = findContainer(updatedLab, input.source_id) ?? source;
    const updatedDestination = findContainer(updatedLab, input.destination_id) ?? destination;
    return ok(
      ctx.getState,
      { sourceId: source.id, destinationId: destination.id, movedMl: input.volume_ml, source: { volumeMl: updatedSource.volumeMl }, destination: { volumeMl: updatedDestination.volumeMl }, reaction },
      dr.observation,
      eventStrings(ctx.getState, dr),
    );
  },
};

const dispense: ToolDef<{ burette_id: string; destination_id: string; volume_ml: number }> = {
  name: "dispense",
  title: "Dispense from burette",
  description:
    "Dispenses liquid from a burette into a destination container; the titration action. Use coarse increments " +
    "(1 to 5 mL) far from the endpoint and fine increments (0.1 to 0.5 mL) once color or pH starts moving quickly. " +
    "pH is recorded on the titration curve only when a pH meter is attached to the destination; call measure_ph on " +
    "it first if you need pH tracked.",
  input: z
    .object({ burette_id: ContainerIdSchema, destination_id: ContainerIdSchema, volume_ml: z.number().gt(0).max(50).describe("Volume to dispense in mL, greater than 0, up to 50.") })
    .strict(),
  readOnly: false,
  targetId: (i) => i.destination_id,
  examples: [{ label: "Dispense 1 mL", input: { burette_id: "c_1", destination_id: "c_2", volume_ml: 1 } }],
  handler: async (input, ctx) => {
    const lab = ctx.getState().lab;
    const burette = findContainer(lab, input.burette_id);
    if (!burette) return errFromLabError(ctx.getState, unknownObjectError(input.burette_id));
    const destination = findContainer(lab, input.destination_id);
    if (!destination) return errFromLabError(ctx.getState, unknownObjectError(input.destination_id));

    const dr = await ctx.dispatch({ kind: "DISPENSE", buretteId: burette.id, toId: destination.id, volumeMl: input.volume_ml }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);

    const updatedLab = ctx.getState().lab;
    const updatedBurette = findContainer(updatedLab, input.burette_id) ?? burette;
    const updatedDestination = findContainer(updatedLab, input.destination_id) ?? destination;
    const pub = publicContainer(updatedLab, input.destination_id);
    // `capacityMl - volumeMl` only equals cumulative titrant delivered if the burette started full;
    // the titration curve is the only place that's actually tracked, so report null elsewhere.
    const cumulativeDispensedMl = updatedLab.scenario.kind === "titration" ? (updatedLab.scenario.curve.at(-1)?.titrantMl ?? null) : null;
    return ok(
      ctx.getState,
      {
        buretteId: burette.id,
        destinationId: destination.id,
        dispensedMl: input.volume_ml,
        buretteRemainingMl: updatedBurette.volumeMl,
        cumulativeDispensedMl,
        destination: { volumeMl: updatedDestination.volumeMl, appearance: pub ? { color: pub.colorName, clarity: pub.solids.length > 0 ? "cloudy" : "clear" } : null },
        ph: pub?.pH ?? null,
      },
      dr.observation,
      eventStrings(ctx.getState, dr),
    );
  },
};

const stir: ToolDef<{ container_id: string; duration_s?: number }> = {
  name: "stir",
  title: "Stir",
  description: "Stirs a container for the given duration (0.5 to 30 s, default 3 s), keeping any solids suspended while stirring and speeding settling once it stops.",
  input: z.object({ container_id: ContainerIdSchema, duration_s: z.number().min(0.5).max(30).default(3).describe("Stir duration in seconds, 0.5 to 30.") }).strict(),
  readOnly: false,
  targetId: (i) => i.container_id,
  examples: [{ label: "Stir c_1 for 3 s", input: { container_id: "c_1", duration_s: 3 } }],
  handler: async (input, ctx) => {
    const container = findContainer(ctx.getState().lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));
    const dr = await ctx.dispatch({ kind: "STIR", containerId: container.id, durationS: input.duration_s }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);
    return ok(ctx.getState, { containerId: container.id, durationS: input.duration_s }, dr.observation, eventStrings(ctx.getState, dr));
  },
};

const heat: ToolDef<{ container_id: string; target_c: number }> = {
  name: "heat",
  title: "Heat",
  description: "Sets a container heating toward a target temperature (0 to 100 °C). Requires a hotplate on the bench; fails with INSTRUMENT_MISSING otherwise.",
  input: z.object({ container_id: ContainerIdSchema, target_c: TemperatureCSchema }).strict(),
  readOnly: false,
  targetId: (i) => i.container_id,
  examples: [{ label: "Heat c_1 to 60 °C", input: { container_id: "c_1", target_c: 60 } }],
  handler: async (input, ctx) => {
    const container = findContainer(ctx.getState().lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));
    const currentC = container.temperatureC;
    const dr = await ctx.dispatch({ kind: "HEAT", containerId: container.id, targetC: input.target_c }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);
    const estimatedSeconds = Math.abs(input.target_c - currentC) / constants.HEAT_RATE_C_PER_S;
    return ok(ctx.getState, { containerId: container.id, currentC, targetC: input.target_c, estimatedSeconds }, dr.observation, eventStrings(ctx.getState, dr));
  },
};

const cool: ToolDef<{ container_id: string; target_c?: number }> = {
  name: "cool",
  title: "Cool",
  description: "Sets a container cooling toward a target temperature (0 to 100 °C), or toward ambient if omitted. Requires a hotplate on the bench.",
  input: z.object({ container_id: ContainerIdSchema, target_c: TemperatureCSchema.optional() }).strict(),
  readOnly: false,
  targetId: (i) => i.container_id,
  examples: [{ label: "Cool c_1 to ambient", input: { container_id: "c_1" } }],
  handler: async (input, ctx) => {
    const lab = ctx.getState().lab;
    const container = findContainer(lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));
    const currentC = container.temperatureC;
    const targetC = input.target_c ?? lab.ambientC;
    const dr = await ctx.dispatch({ kind: "COOL", containerId: container.id, targetC: input.target_c }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);
    const estimatedSeconds = Math.abs(targetC - currentC) / constants.HEAT_RATE_C_PER_S;
    return ok(ctx.getState, { containerId: container.id, currentC, targetC, estimatedSeconds }, dr.observation, eventStrings(ctx.getState, dr));
  },
};

const addIndicator: ToolDef<{ container_id: string; indicator_id: string; drops?: number }> = {
  name: "add_indicator",
  title: "Add indicator",
  description:
    "Adds drops of a color indicator to a container. phenolphthalein: colorless below pH ~8.2, pink above. " +
    "universal: red/orange/yellow/green/blue/purple across pH 1 to 14. litmus: red below pH 7, blue at or above. " +
    "1 to 10 drops, default 2.",
  input: z
    .object({
      container_id: ContainerIdSchema,
      indicator_id: z.enum(INDICATOR_IDS).describe("Which indicator to add."),
      drops: z.int().min(1).max(10).default(2).describe("Number of drops, 1 to 10."),
    })
    .strict(),
  readOnly: false,
  targetId: (i) => i.container_id,
  examples: [{ label: "2 drops of phenolphthalein into c_1", input: { container_id: "c_1", indicator_id: "phenolphthalein", drops: 2 } }],
  handler: async (input, ctx) => {
    const lab = ctx.getState().lab;
    const container = findContainer(lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));
    const indicatorId = mintIndicatorId(input.indicator_id);
    const dr = await ctx.dispatch({ kind: "ADD_INDICATOR", containerId: container.id, indicator: indicatorId, drops: input.drops }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);
    const pub = publicContainer(ctx.getState().lab, input.container_id);
    return ok(ctx.getState, { containerId: container.id, indicatorId, color: pub?.colorName ?? null }, dr.observation, eventStrings(ctx.getState, dr));
  },
};

const removeContainer: ToolDef<{ object_id: string }> = {
  name: "remove_container",
  title: "Remove object",
  description: "Removes a container or instrument from the bench entirely, disposing of any liquid it held. This cannot be undone.",
  input: z.object({ object_id: ObjectIdSchema }).strict(),
  readOnly: false,
  targetId: (i) => i.object_id,
  examples: [{ label: "Remove c_1", input: { object_id: "c_1" } }],
  handler: async (input, ctx) => {
    const objectId = parseObjectId(input.object_id);
    if (!objectId) return errFromLabError(ctx.getState, unknownObjectError(input.object_id));
    const dr = await ctx.dispatch({ kind: "REMOVE_OBJECT", objectId }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);
    return ok(ctx.getState, { removedId: objectId }, dr.observation, eventStrings(ctx.getState, dr));
  },
};

export const mutateTools: ReadonlyArray<AnyToolDef> = [addContainer, addReagent, transfer, dispense, stir, heat, cool, addIndicator, removeContainer];
