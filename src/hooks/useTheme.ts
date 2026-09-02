"use client";

import { useEffect } from "react";
import { useLabStore } from "@/store/labStore";

const STORAGE_KEY = "chemlab-theme";

/**
 * Keeps `document.documentElement`'s `.dark` class in sync with `ui.theme` and persists an
 * explicit choice to localStorage. Dark is the default: the inline script in `layout.tsx`
 * already applies `.dark` before hydration unless localStorage says "light", and this hook
 * seeds the store to match on mount so the two never disagree. `globals.css` reads `.dark`
 * for every color token, so this is the only place theme gets applied to the DOM.
 */
export function useTheme(): { theme: "light" | "dark"; toggleTheme: () => void } {
  const theme = useLabStore((s) => s.ui.theme);
  const setTheme = useLabStore((s) => s.setTheme);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once, in-app toggle owns it after
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = (): void => {
    const next = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
  };

  return { theme, toggleTheme };
}
