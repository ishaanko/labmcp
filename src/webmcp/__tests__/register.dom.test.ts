// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fakeStore } = vi.hoisted(() => ({
  fakeStore: {
    lab: undefined as unknown,
    stateVersion: 1,
    ui: { devConsoleOpen: false, webmcp: { provider: "none", toolCount: 0 } },
    agentBusy: false,
    pushFeed: vi.fn(() => "f_1"),
    patchFeed: vi.fn(),
    setAgentBusy: vi.fn(),
    setWebmcp: vi.fn((v: { provider: string; toolCount: number }) => {
      fakeStore.ui.webmcp = v;
    }),
    dispatch: vi.fn(async () => ({ ok: true, stateVersion: 2, events: [], historyEntry: null, observation: "ok" })),
  },
}));

vi.mock("@/store/labStore", () => ({ useLabStore: { getState: () => fakeStore } }));

type RegisterToolCall = (tool: unknown, options: { signal: AbortSignal }) => Promise<void>;

interface FakeModelContext {
  readonly registerTool: ReturnType<typeof vi.fn<RegisterToolCall>>;
  readonly getTools: ReturnType<typeof vi.fn>;
  readonly addEventListener: ReturnType<typeof vi.fn>;
  readonly removeEventListener: ReturnType<typeof vi.fn>;
}

function installFakeModelContext(): FakeModelContext {
  const fake: FakeModelContext = {
    registerTool: vi.fn<RegisterToolCall>(async () => undefined),
    getTools: vi.fn(async () => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(document, "modelContext", { value: fake, configurable: true, writable: true });
  return fake;
}

// The real @mcp-b/webmcp-polyfill no-ops under happy-dom (it defines Document.prototype's
// modelContext getter keyed by a WeakMap the test document doesn't round-trip through). Fake it
// with the same externally-observable effect: after calling it, document.modelContext exists.
const initializeWebMCPPolyfill = vi.fn(() => {
  installFakeModelContext();
});
vi.mock("@mcp-b/webmcp-polyfill", () => ({ initializeWebMCPPolyfill }));

const { registerLabTools, toolRegistry } = await import("../register");
const { buildTools } = await import("../tools");

function removeModelContext(): void {
  Reflect.deleteProperty(document, "modelContext");
}

describe("registerLabTools", () => {
  const toolCount = buildTools().length;

  beforeEach(() => {
    removeModelContext();
    toolRegistry.clear();
    initializeWebMCPPolyfill.mockClear();
  });

  afterEach(() => {
    removeModelContext();
  });

  it("registers every tool on a single AbortSignal when modelContext is native", () => {
    const fake = installFakeModelContext();

    const unregister = registerLabTools();

    expect(fake.registerTool).toHaveBeenCalledTimes(toolCount);
    const signals = new Set(fake.registerTool.mock.calls.map(([, options]) => options.signal));
    expect(signals.size).toBe(1);
    expect(toolRegistry.size).toBe(toolCount);
    expect(fakeStore.setWebmcp).toHaveBeenCalledWith({ provider: "native", toolCount });

    unregister();
    expect(toolRegistry.size).toBe(0);
    const firstCall = fake.registerTool.mock.calls[0];
    expect(firstCall?.[1].signal.aborted).toBe(true);
  });

  it("polyfills modelContext when the browser has no native support", () => {
    expect("modelContext" in document).toBe(false);

    const unregister = registerLabTools();

    expect(initializeWebMCPPolyfill).toHaveBeenCalledTimes(1);
    expect(document.modelContext).toBeDefined();
    expect(toolRegistry.size).toBe(toolCount);
    expect(fakeStore.setWebmcp).toHaveBeenCalledWith({ provider: "polyfill", toolCount });

    unregister();
  });

  it("is a no-op when document is unavailable (SSR)", () => {
    vi.stubGlobal("document", undefined);
    try {
      const unregister = registerLabTools();
      expect(typeof unregister).toBe("function");
      expect(() => unregister()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
