import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/engine", () => ({
  publicView: (lab: { pub: unknown }) => lab.pub,
  describeEvent: (e: { kind: string }) => `desc:${e.kind}`,
}));

import {
  selectContainer,
  selectContainers,
  selectNotebook,
  selectObjectiveSteps,
  selectPublic,
  selectTitration,
} from "../selectors";
import type { LabStore } from "../types";

function container(id: string, extra: Record<string, unknown> = {}) {
  return {
    kind: "container",
    id,
    type: "flask",
    label: id,
    volumeMl: 100,
    indicators: [],
    stir: { kind: "still" },
    contents: { kind: "visible", species: {} },
    ...extra,
  };
}

function instrument(id: string, extra: Record<string, unknown> = {}) {
  return { kind: "instrument", id, type: "ph_meter", attachedTo: null, ...extra };
}

function makeState(over: Partial<{ pub: unknown; observations: unknown[]; selectedId: string | null }> = {}): LabStore {
  const pub = over.pub ?? { objects: [container("c_1"), instrument("i_1")], scenario: { kind: "sandbox" } };
  return {
    lab: { pub, observations: over.observations ?? [] },
    ui: { selectedId: over.selectedId ?? null },
  } as unknown as LabStore;
}

describe("selectPublic", () => {
  it("memoizes on lab identity", () => {
    const state = makeState();
    expect(selectPublic(state)).toBe(selectPublic(state));
  });
});

describe("selectContainer / selectContainers", () => {
  it("finds a container by id and filters out instruments", () => {
    const state = makeState();
    expect(selectContainer("c_1")(state)?.id).toBe("c_1");
    expect(selectContainer("i_1")(state)).toBeUndefined();
    expect(selectContainers(state)).toHaveLength(1);
  });
});

describe("selectNotebook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("derives one row per observation, in order", () => {
    const state = makeState({
      observations: [
        { seq: 1, clockS: 0, actor: "human", event: { kind: "LIQUID_ADDED" } },
        { seq: 2, clockS: 1, actor: "agent", event: { kind: "MEASUREMENT" } },
      ],
    });
    const rows = selectNotebook(state);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ actor: "human", kind: "observation", text: "desc:LIQUID_ADDED" });
    expect(rows[1]).toMatchObject({ actor: "agent", kind: "measurement", text: "desc:MEASUREMENT" });
  });
});

describe("selectTitration", () => {
  it("returns null outside the titration scenario", () => {
    expect(selectTitration(makeState())).toBeNull();
  });

  it("reads the curve, cumulative volume, latest pH, and endpoint hint", () => {
    const flask = container("c_flask");
    const pub = {
      objects: [flask],
      scenario: {
        kind: "titration",
        flaskId: "c_flask",
        curve: [
          { titrantMl: 1, pH: 4, clockS: 1 },
          { titrantMl: 2, pH: null, clockS: 2 },
          { titrantMl: 3, pH: 8, clockS: 3 },
        ],
      },
    };
    const state = makeState({
      pub,
      observations: [{ seq: 1, clockS: 2.5, actor: "system", event: { kind: "COLOR_SHIFT", containerId: "c_flask", indicatorTransition: true } }],
    });
    const result = selectTitration(state);
    expect(result?.cumulativeTitrantMl).toBe(3);
    expect(result?.latestPh).toBe(8);
    expect(result?.endpointHint).toEqual({ titrantMl: 2 });
  });
});

describe("selectObjectiveSteps", () => {
  it("is empty outside the titration scenario", () => {
    expect(selectObjectiveSteps(makeState())).toEqual([]);
  });

  it("marks steps done as the checklist is satisfied", () => {
    const flask = container("c_flask", { indicators: [{ indicator: "phenolphthalein", drops: 2 }] });
    const probe = instrument("i_ph", { attachedTo: "c_flask" });
    const pub = {
      objects: [flask, probe],
      scenario: { kind: "titration", flaskId: "c_flask", revealed: false, curve: [] },
    };
    const steps = selectObjectiveSteps(makeState({ pub }));
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s.done]));
    expect(byKey.probe).toBe(true);
    expect(byKey.indicator).toBe(true);
    expect(byKey.endpoint).toBe(false);
    expect(byKey.reveal).toBe(false);
  });
});
