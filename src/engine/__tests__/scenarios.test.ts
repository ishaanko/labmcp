import { describe, expect, it } from "vitest";
import { mintSpeciesId } from "../ids";
import { applyCommand } from "../reducer";
import { loadScenario, publicView } from "../scenarios";
import type { LabState } from "../types";
import { placeBeakers } from "./helpers";

describe("loadScenario", () => {
  it("is deterministic for a given seed and varies across seeds", () => {
    const a = loadScenario("titration", 7);
    const b = loadScenario("titration", 7);
    expect(a).toEqual(b);

    const c = loadScenario("titration", 8);
    expect(c.scenario.kind === "titration" && a.scenario.kind === "titration" ? c.scenario.secrets.analyteM !== a.scenario.secrets.analyteM : true).toBe(true);
  });

  it("draws analyteM in [0.08, 0.12] rounded to 4 decimals", () => {
    for (let seed = 0; seed < 25; seed++) {
      const state = loadScenario("titration", seed);
      if (state.scenario.kind !== "titration") throw new Error("unreachable");
      const m = state.scenario.secrets.analyteM;
      expect(m).toBeGreaterThanOrEqual(0.08);
      expect(m).toBeLessThanOrEqual(0.12);
      expect(Number(m.toFixed(4))).toBe(m);
    }
  });

  it("picks 4 distinct archetypes for unknown_id", () => {
    const state = loadScenario("unknown_id", 3);
    if (state.scenario.kind !== "unknown_id") throw new Error("unreachable");
    const reagentIds = state.scenario.samples.map((s) => state.scenario.kind === "unknown_id" ? state.scenario.secrets[s.shelfId]?.reagentId : undefined);
    expect(new Set(reagentIds).size).toBe(4);
  });

  it("lays out the titration bench with the burette directly behind the flask, keeping c_1/c_2/i_3", () => {
    const state = loadScenario("titration", 4);
    if (state.scenario.kind !== "titration") throw new Error("unreachable");
    const { flaskId, buretteId } = state.scenario;
    const flask = state.objects.find((o) => o.id === flaskId);
    const burette = state.objects.find((o) => o.id === buretteId);
    const meter = state.objects.find((o) => o.kind === "instrument" && o.type === "ph_meter");
    if (!flask || !burette || !meter) throw new Error("unreachable");

    expect(flask.id).toBe("c_1");
    expect(burette.id).toBe("c_2");
    expect(meter.id).toBe("i_3");
    expect(flask.position).toEqual({ x: -1.5, y: 0.5 });
    expect(burette.position).toEqual({ x: -1.5, y: -0.5 });
    // The burette sits one row directly behind the flask (same x, y - 1): SelectionCard's
    // dispense shortcut and the scene layout both depend on this relationship.
    expect(burette.position.x).toBe(flask.position.x);
    expect(burette.position.y).toBe(flask.position.y - 1);

    const beaker = state.objects.find((o) => o.kind === "container" && o.type === "beaker");
    const hotplate = state.objects.find((o) => o.kind === "instrument" && o.type === "hotplate");
    expect(beaker?.position).toEqual({ x: 0.5, y: 0.5 });
    expect(hotplate?.position).toEqual({ x: 2.5, y: 0.5 });
  });

  it("gives sandbox one empty beaker and a hotplate", () => {
    const state = loadScenario("sandbox", 4);
    const containers = state.objects.filter((o) => o.kind === "container");
    const instruments = state.objects.filter((o) => o.kind === "instrument");
    expect(containers).toHaveLength(1);
    expect(containers[0]?.position).toEqual({ x: -0.5, y: 0.5 });
    expect(containers[0]?.type === "beaker" ? containers[0].volumeMl : null).toBe(0);
    expect(instruments).toHaveLength(1);
    expect(instruments[0]).toMatchObject({ type: "hotplate", position: { x: 1.5, y: 0.5 } });
  });

  it("lays out four unknown_id beakers across the front row with the pH meter behind the second sample", () => {
    const state = loadScenario("unknown_id", 4);
    const beakers = state.objects.filter((o) => o.kind === "container");
    const meter = state.objects.find((o) => o.kind === "instrument" && o.type === "ph_meter");
    expect(beakers.map((b) => b.position)).toEqual([
      { x: -2.5, y: 0.5 },
      { x: -0.5, y: 0.5 },
      { x: 1.5, y: 0.5 },
      { x: 3.5, y: 0.5 },
    ]);
    expect(meter?.position).toEqual({ x: 0.5, y: -0.5 });
  });

  it("lays out precipitation with two empty beakers", () => {
    const state = loadScenario("precipitation", 5);
    const beakers = state.objects.filter((o) => o.kind === "container");
    expect(beakers.map((b) => ({ label: b.label, position: b.position }))).toEqual([
      { label: "Beaker", position: { x: -0.5, y: 0.5 } },
      { label: "Beaker 2", position: { x: 1.5, y: 0.5 } },
    ]);
  });

  it("draws a neutralize start reagent/concentration deterministically and tags the beaker unknown", () => {
    const a = loadScenario("neutralize", 9);
    const b = loadScenario("neutralize", 9);
    expect(a).toEqual(b);
    if (a.scenario.kind !== "neutralize") throw new Error("unreachable");
    expect(["hcl", "naoh"]).toContain(a.scenario.secrets.startReagent);
    expect(a.scenario.secrets.startM).toBeGreaterThanOrEqual(0.02);
    expect(a.scenario.secrets.startM).toBeLessThanOrEqual(0.06);
    const { beakerId } = a.scenario;
    const beaker = a.objects.find((o) => o.id === beakerId);
    expect(beaker?.kind === "container" ? beaker.containsUnknown : null).toBe(true);
  });

  it("lays out dilution with a graduated cylinder and a beaker, and a 1.0 M sodium chloride stock", () => {
    const state = loadScenario("dilution", 6);
    if (state.scenario.kind !== "dilution") throw new Error("unreachable");
    const cylinder = state.objects.find((o) => o.kind === "container" && o.type === "graduated_cylinder");
    const beaker = state.objects.find((o) => o.kind === "container" && o.type === "beaker");
    expect(cylinder?.position).toEqual({ x: -0.5, y: 0.5 });
    expect(beaker?.position).toEqual({ x: 1.5, y: 0.5 });
    const { reagentId } = state.scenario;
    const naclStock = state.shelf.find((s) => s.reagentId === reagentId);
    expect(naclStock?.concentrationM).toBe(1.0);
  });

  it("adds a liquid at the shelf's stocked concentration when the command names none", () => {
    const state = loadScenario("dilution", 6);
    if (state.scenario.kind !== "dilution") throw new Error("unreachable");
    const beaker = state.objects.find((o) => o.kind === "container" && o.type === "beaker");
    if (!beaker || beaker.kind !== "container") throw new Error("unreachable");
    const res = applyCommand(state, { kind: "ADD_REAGENT", containerId: beaker.id, reagentId: state.scenario.reagentId, volumeMl: 10 });
    if (!res.ok) throw new Error("unreachable");
    const after = res.value.state.objects.find((o) => o.id === beaker.id);
    if (!after || after.kind !== "container") throw new Error("unreachable");
    // 10 mL of the 1.0 M stock, not the registry's 0.1 M default.
    expect(after.species[mintSpeciesId("Na+")]).toBeCloseTo(0.01, 6);
  });

  it("lays out solubility with a beaker, hotplate and thermometer, and starts every milestone false", () => {
    const state = loadScenario("solubility", 7);
    if (state.scenario.kind !== "solubility") throw new Error("unreachable");
    const { beakerId } = state.scenario;
    const beaker = state.objects.find((o) => o.id === beakerId);
    const hotplate = state.objects.find((o) => o.kind === "instrument" && o.type === "hotplate");
    const thermometer = state.objects.find((o) => o.kind === "instrument" && o.type === "thermometer");
    expect(beaker?.position).toEqual({ x: -0.5, y: 0.5 });
    expect(beaker?.kind === "container" ? beaker.volumeMl : null).toBe(50);
    expect(hotplate?.position).toEqual({ x: 1.5, y: 0.5 });
    expect(thermometer?.position).toEqual({ x: 1.5, y: -0.5 });
    expect(state.scenario.milestones).toEqual({ addedEnoughSolute: false, hadUndissolved: false, heatedFullyDissolved: false, cooledWithCrystals: false });
  });
});

describe("publicView", () => {
  it("never serializes secrets or the analyte concentration, and hides tainted contents while a challenge is unrevealed", () => {
    const state = loadScenario("titration", 11);
    const pub = publicView(state);
    const json = JSON.stringify(pub);

    expect(json).not.toContain("secrets");
    if (state.scenario.kind === "titration") {
      expect(json).not.toContain(String(state.scenario.secrets.analyteM));
    }

    const flask = pub.objects.find((o) => o.kind === "container" && pub.scenario.kind === "titration" && o.id === pub.scenario.flaskId);
    expect(flask && flask.kind === "container" ? flask.contents.kind : null).toBe("hidden");
  });

  it("hides the neutralize start reagent/concentration until revealed, and hides the beaker's contents until then too", () => {
    const state = loadScenario("neutralize", 14);
    if (state.scenario.kind !== "neutralize") throw new Error("unreachable");
    const pub = publicView(state);
    if (pub.scenario.kind !== "neutralize") throw new Error("unreachable");

    expect(JSON.stringify(pub)).not.toContain("secrets");
    expect(pub.scenario.start).toBeNull();
    const { beakerId } = pub.scenario;
    const beaker = pub.objects.find((o) => o.id === beakerId);
    expect(beaker && beaker.kind === "container" ? beaker.contents.kind : null).toBe("hidden");

    const revealed = applyCommand(state, { kind: "REVEAL" });
    if (!revealed.ok) throw new Error("unreachable");
    const pubRevealed = publicView(revealed.value.state);
    if (pubRevealed.scenario.kind !== "neutralize") throw new Error("unreachable");
    expect(pubRevealed.scenario.start).toEqual(state.scenario.secrets);
  });

  it("restricts MEASURE contents on a tainted flask in titration, but allows it in sandbox", () => {
    const titration = loadScenario("titration", 12);
    if (titration.scenario.kind !== "titration") throw new Error("unreachable");
    const restricted = applyCommand(titration, { kind: "MEASURE", containerId: titration.scenario.flaskId, quantity: "contents" });
    expect(restricted.ok).toBe(false);
    if (restricted.ok) throw new Error("unreachable");
    expect(restricted.error.kind).toBe("RESTRICTED_BY_CHALLENGE");

    const sandbox = placeBeakers(loadScenario("sandbox", 12), 1);
    const id = sandbox.ids[0];
    if (!id) throw new Error("unreachable");
    const allowed = applyCommand(sandbox.state, { kind: "MEASURE", containerId: id, quantity: "contents" });
    expect(allowed.ok).toBe(true);
  });

  it("redacts a hidden container's solids to color/scale/suspended only, no species or moles", () => {
    const state = loadScenario("titration", 13);
    if (state.scenario.kind !== "titration") throw new Error("unreachable");
    const { flaskId } = state.scenario;
    const flask = state.objects.find((o) => o.id === flaskId);
    if (!flask || flask.kind !== "container") throw new Error("unreachable");

    const withSolid: LabState = {
      ...state,
      objects: state.objects.map((o) => (o.id === flask.id ? { ...flask, solids: [{ species: mintSpeciesId("AgCl(s)"), moles: 0.001, suspended: 1 }] } : o)),
    };

    const pub = publicView(withSolid);
    const pubFlask = pub.objects.find((o) => o.id === flask.id);
    if (!pubFlask || pubFlask.kind !== "container") throw new Error("unreachable");
    expect(pubFlask.solids).toHaveLength(1);
    expect(pubFlask.solids[0]?.kind).toBe("redacted");
    expect(pubFlask.solids[0]).not.toHaveProperty("species");
    expect(pubFlask.solids[0]).not.toHaveProperty("moles");
    expect(pubFlask.solids[0]?.suspended).toBe(1);
  });
});
