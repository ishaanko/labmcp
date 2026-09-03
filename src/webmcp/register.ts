import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
import { z } from "zod";
import { useLabStore } from "@/store/labStore";
import { runTool } from "./runtime";
import { buildTools } from "./tools";
import type { AnyToolDef } from "./types";

/** Every registered tool, keyed by name. Read by the DevConsole for the local fallback path. */
export const toolRegistry = new Map<string, AnyToolDef>();

/** Set once this module installs the polyfill on Document.prototype; a StrictMode remount would otherwise read it as native. */
let polyfillInstalled = false;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function";
}

function isPolyfill(modelContext: unknown): boolean {
  return typeof modelContext === "object" && modelContext !== null && "__isWebMCPPolyfill" in modelContext && modelContext.__isWebMCPPolyfill === true;
}

/**
 * Registers the LabMCP tool catalog with `document.modelContext`, polyfilling it first when the
 * browser has no native support. Returns an unregister function; call it on unmount (StrictMode's
 * double-mount just aborts the first registration and re-registers cleanly).
 */
export function registerLabTools(): () => void {
  if (typeof document === "undefined") return () => {};

  const present = "modelContext" in document && document.modelContext !== undefined;
  if (!present) {
    initializeWebMCPPolyfill();
    polyfillInstalled = true;
  }
  if (!document.modelContext) return () => {};
  const native = present && !polyfillInstalled && !isPolyfill(document.modelContext);

  const ac = new AbortController();
  const modelContext = document.modelContext;
  for (const def of buildTools()) {
    toolRegistry.set(def.name, def);
    // Chrome's registerTool returns a promise that settles with an AbortError once the signal
    // aborts (unmount, StrictMode double-mount). ChatGPT's returns nothing and ignores the
    // signal, so the result is treated as optional and unregistration falls back to
    // unregisterTool when that exists.
    let result: unknown;
    try {
      result = modelContext.registerTool(
        {
          name: def.name,
          title: def.title,
          description: def.description,
          inputSchema: z.toJSONSchema(def.input),
          annotations: { readOnlyHint: def.readOnly },
          execute: runTool(def),
        },
        { signal: ac.signal },
      );
    } catch (error: unknown) {
      console.error(`registerLabTools: registerTool("${def.name}") threw:`, error);
      continue;
    }
    if (isPromiseLike(result)) {
      result.then(undefined, (error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error(`registerLabTools: registerTool("${def.name}") failed:`, error);
      });
    }
  }

  useLabStore.getState().setWebmcp({ provider: native ? "native" : "polyfill", toolCount: toolRegistry.size });

  return () => {
    ac.abort();
    const unregister: unknown = Reflect.get(modelContext, "unregisterTool");
    if (typeof unregister === "function") {
      for (const name of toolRegistry.keys()) {
        try {
          unregister.call(modelContext, name);
        } catch {
          // Best effort: the signal abort already covers Chrome, and the page is unmounting.
        }
      }
    }
    toolRegistry.clear();
  };
}
