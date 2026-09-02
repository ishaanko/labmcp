"use client";

import { useEffect } from "react";
import { useLabStore } from "@/store/labStore";
import { registerLabTools, toolRegistry } from "./register";

/**
 * Registers the WebMCP tool catalog once the page mounts. Renders nothing. StrictMode's
 * double-invoke just unregisters the first pass's tools and re-registers cleanly.
 */
function isEventTarget(value: unknown): value is EventTarget {
  return (
    typeof value === "object" &&
    value !== null &&
    "addEventListener" in value &&
    typeof value.addEventListener === "function" &&
    "removeEventListener" in value &&
    typeof value.removeEventListener === "function"
  );
}

export function WebMcpBoot(): null {
  useEffect(() => {
    const unregister = registerLabTools();

    // ChatGPT's modelContext is not an EventTarget; only Chrome's fires toolchange. Everything
    // beyond registerTool is optional and feature-detected.
    const modelContext: unknown = document.modelContext;
    const onToolChange = () => {
      const provider = useLabStore.getState().ui.webmcp.provider;
      useLabStore.getState().setWebmcp({ provider, toolCount: toolRegistry.size });
    };
    const events = isEventTarget(modelContext) ? modelContext : null;
    events?.addEventListener("toolchange", onToolChange);

    return () => {
      events?.removeEventListener("toolchange", onToolChange);
      unregister();
    };
  }, []);

  return null;
}
