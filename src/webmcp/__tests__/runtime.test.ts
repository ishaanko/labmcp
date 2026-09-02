import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LabState, PublicLabState } from "@/engine";
import type { ToolDef } from "../types";

// scenarios.ts (publicView, scenarioObjective) is still an engine stub; fake it so summarizeLab,
// which every tool response goes through, doesn't throw. Everything else in @/engine is real.
vi.mock("@/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/engine")>();
  return {
    ...actual,
    scenarioObjective: () => "test objective",
    publicView: (state: LabState): PublicLabState => ({
      clockS: state.clockS,
      ambientC: state.ambientC,
      objects: state.objects.map((o) =>
        o.kind === "instrument"
          ? o
          : {
              ...o,
              solids: o.solids.map((s) => ({ ...s, color: { r: 200, g: 200, b: 200, a: 1 }, scale: "small" as const })),
              contents: { kind: "visible" as const, species: o.species, concentrationsM: {} },
              pH: null,
              color: { r: 200, g: 220, b: 240, a: 0.2 },
              colorName: "colorless",
              reactionsOccurred: [],
            },
      ),
      shelf: state.shelf,
      indicatorsAvailable: state.indicatorsAvailable,
      // These tests only ever run against a sandbox scenario; other kinds aren't exercised here.
      scenario: { kind: "sandbox", seed: state.scenario.seed, visibility: state.scenario.visibility },
      nextSeq: state.nextSeq,
    }),
  };
});

function emptyLab(): LabState {
  return {
    clockS: 0,
    ambientC: 22,
    objects: [],
    shelf: [],
    indicatorsAvailable: [],
    reactions: [],
    observations: [],
    history: [],
    scenario: { kind: "sandbox", seed: 42, visibility: { inspectContents: "full", revealShelfConcentrations: true, instrumentsRequired: false } },
    rng: { seed: 42, s: 42 },
    nextSeq: 1,
  };
}

const { fakeStore, feedEntries } = vi.hoisted(() => {
  const feedEntries: Array<Record<string, unknown>> = [];
  const fakeStore = {
    lab: undefined as unknown,
    stateVersion: 1,
    ui: { devConsoleOpen: false },
    agentBusy: false,
    pushFeed: vi.fn((entry: Record<string, unknown>) => {
      feedEntries.push(entry);
      return entry.id as string;
    }),
    patchFeed: vi.fn((id: string, patch: Record<string, unknown>) => {
      const entry = feedEntries.find((e) => e.id === id);
      if (entry) Object.assign(entry, patch);
    }),
    setAgentBusy: vi.fn((v: boolean) => {
      fakeStore.agentBusy = v;
    }),
    dispatch: vi.fn(),
  };
  return { fakeStore, feedEntries };
});

vi.mock("@/store/labStore", () => ({ useLabStore: { getState: () => fakeStore } }));

// Imported after the mock is declared; vitest hoists vi.mock above this regardless of order.
const { ok, runTool } = await import("../runtime");

describe("runTool", () => {
  it("writes a running feed entry then patches it to done on success", async () => {
    fakeStore.lab = emptyLab();
    feedEntries.length = 0;

    const def: ToolDef<{ x: number }> = {
      name: "double",
      description: "doubles x",
      input: z.object({ x: z.number() }).strict(),
      readOnly: true,
      handler: async (input, ctx) => ok(ctx.getState, { y: input.x * 2 }, "doubled", []),
    };

    const execute = runTool(def);
    const response = await execute({ x: 3 }, { signal: new AbortController().signal });

    expect(response).toMatchObject({ ok: true });
    expect(feedEntries).toHaveLength(1);
    expect(feedEntries[0]).toMatchObject({ status: "done", ok: true, tool: "double" });
    expect(typeof feedEntries[0]?.durationMs).toBe("number");
  });

  it("turns a thrown handler into an ENGINE_ERROR envelope with state attached", async () => {
    fakeStore.lab = emptyLab();
    feedEntries.length = 0;

    const def: ToolDef<Record<string, never>> = {
      name: "boom",
      description: "always throws",
      input: z.object({}).strict(),
      readOnly: false,
      handler: async () => {
        throw new Error("kaboom");
      },
    };

    const execute = runTool(def);
    const response = await execute({}, { signal: new AbortController().signal });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("ENGINE_ERROR");
      expect(response.state).toBeDefined();
    }
    expect(feedEntries[0]).toMatchObject({ status: "done", ok: false, errorCode: "ENGINE_ERROR" });
  });

  it("returns INVALID_INPUT without calling the handler on bad input", async () => {
    fakeStore.lab = emptyLab();
    feedEntries.length = 0;
    const handler = vi.fn();

    const def: ToolDef<{ x: number }> = {
      name: "typed",
      description: "requires a number",
      input: z.object({ x: z.number() }).strict(),
      readOnly: true,
      handler,
    };

    const execute = runTool(def);
    const response = await execute({ x: "not a number" }, { signal: new AbortController().signal });

    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe("INVALID_INPUT");
    expect(handler).not.toHaveBeenCalled();
  });

  it("produces a JSON-serializable response", async () => {
    fakeStore.lab = emptyLab();
    const def: ToolDef<Record<string, never>> = {
      name: "simple",
      description: "returns a plain result",
      input: z.object({}).strict(),
      readOnly: true,
      handler: async (_input, ctx) => ok(ctx.getState, { a: 1 }, "ok", []),
    };
    const response = await runTool(def)({}, { signal: new AbortController().signal });
    expect(() => JSON.stringify(response)).not.toThrow();
  });

  it("runs with no options argument, matching how the WebMCP polyfill calls execute", async () => {
    fakeStore.lab = emptyLab();
    feedEntries.length = 0;

    const def: ToolDef<{ x: number }> = {
      name: "double",
      description: "doubles x",
      input: z.object({ x: z.number() }).strict(),
      readOnly: true,
      handler: async (input, ctx) => ok(ctx.getState, { y: input.x * 2 }, "doubled", []),
    };

    const response = await runTool(def)({ x: 3 });

    expect(response).toMatchObject({ ok: true });
    expect(feedEntries[0]).toMatchObject({ status: "done", ok: true, tool: "double" });
  });
});
