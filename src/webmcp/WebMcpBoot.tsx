"use client";

import { useEffect } from "react";
import { useLabStore } from "@/store/labStore";
import { registerLabTools, toolRegistry } from "./register";

/**
 * Registers the WebMCP tool catalog once the page mounts. Renders nothing. StrictMode's
 * double-invoke just unregisters the first pass's tools and re-registers cleanly.
 */
export function WebMcpBoot(): null {
  useEffect(() => {
    const unregister = registerLabTools();

    const modelContext = document.modelContext;
    const onToolChange = () => {
      const provider = useLabStore.getState().ui.webmcp.provider;
      useLabStore.getState().setWebmcp({ provider, toolCount: toolRegistry.size });
    };
    modelContext?.addEventListener("toolchange", onToolChange);

    return () => {
      modelContext?.removeEventListener("toolchange", onToolChange);
      unregister();
    };
  }, []);

  return null;
}
