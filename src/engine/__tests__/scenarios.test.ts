import { describe, expect, it } from "vitest";
import { applyCommand } from "../reducer";
import { loadScenario, publicView } from "../scenarios";
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

  it("picks 3 distinct archetypes for unknown_id", () => {
    const state = loadScenario("unknown_id", 3);
    if (state.scenario.kind !== "unknown_id") throw new Error("unreachable");
    const reagentIds = state.scenario.samples.map((s) => state.scenario.kind === "unknown_id" ? state.scenario.secrets[s.shelfId]?.reagentId : undefined);
    expect(new Set(reagentIds).size).toBe(3);
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
});
