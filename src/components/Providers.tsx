"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { setToastSink } from "@/lib/events";
import { observe } from "@/components/ui-legacy/toasts";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useLabStore } from "@/store/labStore";
import { startTicker } from "@/store/ticker";

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

  useEffect(() => startTicker(useLabStore), []);

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster
        position="top-center"
        offset={56}
        visibleToasts={3}
        duration={3500}
        theme="dark"
        icons={{ success: <></>, info: <></>, warning: <></>, error: <></> }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "material-thick pointer-events-auto flex w-full items-start gap-2 border-l-2 border-l-hairline-strong p-3 text-sm text-ink",
            success: "!border-l-ok",
            error: "!border-l-danger",
            title: "text-ink font-medium",
            description: "mt-0.5 truncate text-ink-3",
            actionButton: "pressable ml-2 shrink-0 rounded-sm bg-amber px-2.5 py-1 text-xs font-medium text-white",
            closeButton: "!border-hairline !bg-surface-solid !text-ink-3",
          },
        }}
      />
    </MotionConfig>
  );
}
