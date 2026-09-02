import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
import { z } from "zod";
import { useLabStore } from "@/store/labStore";
import { runTool } from "./runtime";
import { buildTools } from "./tools";
import type { AnyToolDef } from "./types";

/** Every registered tool, keyed by name. Read by the DevConsole for the local fallback path. */
export const toolRegistry = new Map<string, AnyToolDef>();

/**
 * Registers the ChemLab tool catalog with `document.modelContext`, polyfilling it first when the
 * browser has no native support. Returns an unregister function; call it on unmount (StrictMode's
 * double-mount just aborts the first registration and re-registers cleanly).
 */
export function registerLabTools(): () => void {
  if (typeof document === "undefined") return () => {};

  const native = "modelContext" in document && document.modelContext !== undefined;
  if (!native) initializeWebMCPPolyfill();
  if (!document.modelContext) return () => {};

  const ac = new AbortController();
  const modelContext = document.modelContext;
  for (const def of buildTools()) {
    toolRegistry.set(def.name, def);
    // registerTool settles with an AbortError once the signal aborts (unmount, StrictMode
    // double-mount); that is the expected unregister path, not a failure.
    modelContext
      .registerTool(
        {
          name: def.name,
          title: def.title,
          description: def.description,
          inputSchema: z.toJSONSchema(def.input),
          annotations: { readOnlyHint: def.readOnly },
          execute: runTool(def),
        },
        { signal: ac.signal },
      )
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
      });
  }

  useLabStore.getState().setWebmcp({ provider: native ? "native" : "polyfill", toolCount: toolRegistry.size });

  return () => {
    ac.abort();
    toolRegistry.clear();
  };
}
