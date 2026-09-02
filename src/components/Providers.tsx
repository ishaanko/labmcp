"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { setToastSink } from "@/lib/events";
import { attachEffectsSink } from "@/lab2d/effectsStore";
import { dismissAll, observe } from "@/components/ui/toasts";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useLabStore } from "@/store/labStore";
import { startTicker } from "@/store/ticker";

/**
 * Client-only wiring: theme, reduced-motion, the toast and animation sinks the store dispatches
 * through, and the two global libraries (motion, sonner) that every chrome component depends on.
 * Kept separate from `layout.tsx` so the root layout can stay a server component.
 */
export function Providers({ children }: { children: ReactNode }) {
  useTheme();
  useReducedMotion();

  useEffect(() => {
    setToastSink(observe, dismissAll);
    attachEffectsSink();
  }, []);

  useEffect(() => startTicker(useLabStore), []);

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster position="top-center" offset={56} visibleToasts={3} theme="dark" />
    </MotionConfig>
  );
}
