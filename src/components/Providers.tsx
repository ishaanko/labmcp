"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { setToastSink } from "@/lib/events";
import { observe } from "@/components/ui/toasts";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Client-only wiring: theme, reduced-motion, the toast sink the store dispatches through,
 * and the two global libraries (motion, sonner) that every chrome component depends on.
 * Kept separate from `layout.tsx` so the root layout can stay a server component.
 */
export function Providers({ children }: { children: ReactNode }) {
  useTheme();
  useReducedMotion();

  useEffect(() => {
    setToastSink(observe);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster position="top-center" offset={56} visibleToasts={3} duration={3500} />
    </MotionConfig>
  );
}
