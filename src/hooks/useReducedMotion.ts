"use client";

import { useEffect } from "react";
import { useLabStore } from "@/store/labStore";

/**
 * Mirrors the OS `prefers-reduced-motion` query into `ui.reducedMotion` so every job in
 * the animation queue and every chrome transition reads one flag. An in-app toggle (if
 * added later) can still override this by calling `setReducedMotion` directly; this hook
 * only seeds the initial value and follows the OS if the user never overrides it.
 */
export function useReducedMotion(): boolean {
  const reducedMotion = useLabStore((s) => s.ui.reducedMotion);
  const setReducedMotion = useLabStore((s) => s.setReducedMotion);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent): void => setReducedMotion(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [setReducedMotion]);

  return reducedMotion;
}
