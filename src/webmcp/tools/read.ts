import { z } from "zod";
import { constants, INDICATORS, REAGENTS } from "@/engine";

const { CAPACITY_ML } = constants;
import { notebookRows, renderNotebookMarkdown } from "@/lib/notebook";
import { errFromLabError, eventStrings, findBenchInstrument, findContainer, ok, unknownObjectError } from "../runtime";
import { ContainerIdSchema, EmptyInput } from "../schemas";
import type { AnyToolDef, ToolDef } from "../types";

const getLabState: ToolDef<Record<string, never>> = {
  name: "get_lab_state",
  title: "Get lab state",
  description:
    "Returns the full current bench state: every container and instrument, the shelf, indicators, and the last few " +
    "observations. This never reports pH, moles, or the concentration of a container's contents; use measure_ph, " +
    "calculate_moles, or inspect_contents for those. Call this first when planning, and call it again after any " +
    "OBJECT_NOT_FOUND error, because a human may have changed the bench since your last call.",
  input: EmptyInput,
  readOnly: true,
  examples: [{ label: "Read the bench", input: {} }],
  handler: async (_input, ctx) => {
    const envelope = ok(ctx.getState, null, "Read current lab state.", []);
    return { ...envelope, result: envelope.state };
  },
};

const listReagents: ToolDef<Record<string, never>> = {
  name: "list_reagents",
  title: "List reagents",
  description:
    "Lists every reagent stocked on the shelf (id, formula, role, default and max concentration) plus the available " +
    "indicators and their color ranges. Unknown samples from a challenge scenario are never listed here; use " +
    "get_lab_state to see what is on the bench.",
  input: EmptyInput,
  readOnly: true,
  examples: [{ label: "List the shelf", input: {} }],
  handler: async (_input, ctx) => {
    const reagents = REAGENTS.map((r) =>
      r.kind === "water"
        ? { id: r.id, label: r.label, formula: "H2O", role: "solvent", defaultConcentrationM: null, maxConcentrationM: null }
        : {
            id: r.id,
            label: r.label,
            formula: r.formula,
            role: r.role,
            defaultConcentrationM: r.defaultM,
            maxConcentrationM: r.maxM,
          },
    );
    const indicators = INDICATORS.map((i) => ({ id: i.id, label: i.label, ranges: i.ranges }));
    return ok(ctx.getState, { reagents, indicators }, "Listed shelf reagents and indicators.", []);
  },
};

const listEquipment: ToolDef<Record<string, never>> = {
  name: "list_equipment",
  title: "List equipment",
  description:
    "Lists every equipment type ChemLab supports (with capacity and purpose) and every object currently on the " +
    "bench (id, type, and, for instruments, what it's attached to). Use add_container to place more.",
  input: EmptyInput,
  readOnly: true,
  examples: [{ label: "List equipment", input: {} }],
  handler: async (_input, ctx) => {
    const types = [
      { type: "beaker", capacityMl: CAPACITY_ML["beaker"], purpose: "General-purpose mixing and observation vessel." },
      { type: "flask", capacityMl: CAPACITY_ML["flask"], purpose: "Erlenmeyer flask; the titration receiving vessel." },
      { type: "test_tube", capacityMl: CAPACITY_ML["test_tube"], purpose: "Small-volume qualitative tests." },
      { type: "graduated_cylinder", capacityMl: CAPACITY_ML["graduated_cylinder"], purpose: "Precise volume measurement and transfer." },
      { type: "burette", capacityMl: CAPACITY_ML["burette"], purpose: "Controlled, incremental dispensing for titration." },
      { type: "ph_meter", purpose: "Attach to a container to read pH with measure_ph." },
      { type: "thermometer", purpose: "Attach to a container to read temperature with measure_temperature." },
      { type: "hotplate", purpose: "Required on the bench before heat or cool will work." },
    ];
    const onBench = ctx.getState().lab.objects.map((o) => ({
      id: o.id,
      type: o.type,
      attachedTo: o.kind === "instrument" ? o.attachedTo : undefined,
    }));
    return ok(ctx.getState, { types, onBench }, "Listed equipment types and bench contents.", []);
  },
};

const measurePh: ToolDef<{ container_id: string }> = {
  name: "measure_ph",
  title: "Measure pH",
  description:
    "Measures the pH of a container's contents using a pH meter. If a pH meter is already on the bench but attached " +
    "elsewhere, it is moved to this container automatically. If no pH meter exists on the bench at all, this fails " +
    "with INSTRUMENT_MISSING; call add_container with type 'ph_meter' first. Prefer this over inspect_contents, " +
    "which is blocked on unidentified samples until a challenge is revealed. The reading is logged to the notebook.",
  input: z.object({ container_id: ContainerIdSchema }).strict(),
  readOnly: true,
  targetId: (i) => i.container_id,
  examples: [{ label: "Measure pH of c_1", input: { container_id: "c_1" } }],
  handler: async (input, ctx) => {
    const lab = ctx.getState().lab;
    const container = findContainer(lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));

    const meter = findBenchInstrument(lab, "ph_meter");
    if (!meter) {
      return errFromLabError(ctx.getState, {
        kind: "NO_INSTRUMENT",
        containerId: container.id,
        needed: "ph_meter",
        hint: "add_container({ type: 'ph_meter' }) to place one on the bench.",
      });
    }
    if (meter.attachedTo !== container.id) {
      const attached = await ctx.dispatch({ kind: "ATTACH_INSTRUMENT", instrumentId: meter.id, containerId: container.id }, "agent");
      if (!attached.ok) return errFromLabError(ctx.getState, attached.error);
    }

    const dr = await ctx.dispatch({ kind: "MEASURE", containerId: container.id, quantity: "ph", instrumentId: meter.id }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);

    const updatedMeter = ctx.getState().lab.objects.find((o) => o.kind === "instrument" && o.id === meter.id);
    const ph = updatedMeter && updatedMeter.kind === "instrument" && updatedMeter.lastReading?.kind === "ph" ? updatedMeter.lastReading.value : null;
    return ok(ctx.getState, { containerId: container.id, ph, instrumentId: meter.id }, dr.observation, eventStrings(ctx.getState, dr));
  },
};

const measureTemperature: ToolDef<{ container_id: string }> = {
  name: "measure_temperature",
  title: "Measure temperature",
  description:
    "Measures the temperature (°C) of a container's contents using a thermometer. A thermometer already on the " +
    "bench is moved to this container automatically; if none exists, this fails with INSTRUMENT_MISSING, so call " +
    "add_container with type 'thermometer' first. Also reports whether the container is currently heating, " +
    "cooling, or idle.",
  input: z.object({ container_id: ContainerIdSchema }).strict(),
  readOnly: true,
  targetId: (i) => i.container_id,
  examples: [{ label: "Measure temperature of c_1", input: { container_id: "c_1" } }],
  handler: async (input, ctx) => {
    const lab = ctx.getState().lab;
    const container = findContainer(lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));

    const thermometer = findBenchInstrument(lab, "thermometer");
    if (!thermometer) {
      return errFromLabError(ctx.getState, {
        kind: "NO_INSTRUMENT",
        containerId: container.id,
        needed: "thermometer",
        hint: "add_container({ type: 'thermometer' }) to place one on the bench.",
      });
    }
    if (thermometer.attachedTo !== container.id) {
      const attached = await ctx.dispatch({ kind: "ATTACH_INSTRUMENT", instrumentId: thermometer.id, containerId: container.id }, "agent");
      if (!attached.ok) return errFromLabError(ctx.getState, attached.error);
    }

    const dr = await ctx.dispatch({ kind: "MEASURE", containerId: container.id, quantity: "temperature", instrumentId: thermometer.id }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);
    const updated = findContainer(ctx.getState().lab, input.container_id) ?? container;
    return ok(ctx.getState, { containerId: container.id, temperatureC: updated.temperatureC, thermal: updated.thermal.kind }, dr.observation, eventStrings(ctx.getState, dr));
  },
};

const measureVolume: ToolDef<{ container_id: string }> = {
  name: "measure_volume",
  title: "Measure volume",
  description: "Reads the current liquid volume (mL) in a container, its capacity, and the fraction of capacity filled (0 to 1).",
  input: z.object({ container_id: ContainerIdSchema }).strict(),
  readOnly: true,
  targetId: (i) => i.container_id,
  examples: [{ label: "Measure volume of c_1", input: { container_id: "c_1" } }],
  handler: async (input, ctx) => {
    const container = findContainer(ctx.getState().lab, input.container_id);
    if (!container) return errFromLabError(ctx.getState, unknownObjectError(input.container_id));
    const dr = await ctx.dispatch({ kind: "MEASURE", containerId: container.id, quantity: "volume" }, "agent");
    if (!dr.ok) return errFromLabError(ctx.getState, dr.error);
    return ok(
      ctx.getState,
      { containerId: container.id, volumeMl: container.volumeMl, capacityMl: container.capacityMl, fillFraction: container.volumeMl / container.capacityMl },
      dr.observation,
      eventStrings(ctx.getState, dr),
    );
  },
};

const getTitrationData: ToolDef<Record<string, never>> = {
  name: "get_titration_data",
  title: "Get titration data",
  description:
    "Returns the recorded titration curve: burette and flask ids, the titrant, the analyte's initial volume, and " +
    "every dispensed point (titrant mL, pH if a meter was attached at the time, clock time). Empty outside the " +
    "titration scenario. pH points are null until a pH meter has been attached to the flask via measure_ph.",
  input: EmptyInput,
  readOnly: true,
  examples: [{ label: "Read the titration curve", input: {} }],
  handler: async (_input, ctx) => {
    const lab = ctx.getState().lab;
    if (lab.scenario.kind !== "titration") {
      return ok(ctx.getState, { buretteId: null, flaskId: null, titrant: null, analyteInitialMl: null, points: [] }, "Not in the titration scenario.", []);
    }
    const s = lab.scenario;
    return ok(
      ctx.getState,
      { buretteId: s.buretteId, flaskId: s.flaskId, titrant: { reagentId: "naoh", concentrationM: s.titrantM }, analyteInitialMl: s.analyteMl, points: s.curve },
      `Read ${s.curve.length} titration point(s).`,
      [],
    );
  },
};

const getNotebook: ToolDef<{ last_n?: number }> = {
  name: "get_notebook",
  title: "Get notebook",
  description:
    "Returns the lab notebook: an append-only, timestamped log with one entry per action, each tagged with the " +
    "actor (human or agent) that caused it, containers named by label rather than id. Undo does not remove " +
    "entries, it adds one. Optionally limit to the last N entries (1 to 200, default all).",
  input: z.object({ last_n: z.int().min(1).max(200).optional().describe("Only return the most recent N entries.") }).strict(),
  readOnly: true,
  examples: [
    { label: "Full notebook", input: {} },
    { label: "Last 20 entries", input: { last_n: 20 } },
  ],
  handler: async (input, ctx) => {
    // Same rows the Notebook panel shows: one per command, labels only, redacted by publicView.
    const all = notebookRows(ctx.getState().lab);
    const entries = input.last_n ? all.slice(-input.last_n) : all;
    const markdown = renderNotebookMarkdown(entries);
    return ok(ctx.getState, { entries, markdown }, `Read ${entries.length} notebook entr${entries.length === 1 ? "y" : "ies"}.`, []);
  },
};

export const readTools: ReadonlyArray<AnyToolDef> = [
  getLabState,
  listReagents,
  listEquipment,
  measurePh,
  measureTemperature,
  measureVolume,
  getTitrationData,
  getNotebook,
];
