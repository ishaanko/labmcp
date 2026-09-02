"use client";

import { useEffect } from "react";
import { useLabStore } from "@/store/labStore";

/**
 * Keeps `document.documentElement`'s `.dark` class in sync with `ui.theme` and seeds the
 * initial theme from the OS preference on first mount. `globals.css` reads `.dark` for
 * every color token, so this is the only place theme gets applied to the DOM.
 */
export function useTheme(): { theme: "light" | "dark"; toggleTheme: () => void } {
  const theme = useLabStore((s) => s.ui.theme);
  const setTheme = useLabStore((s) => s.setTheme);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(query.matches ? "dark" : "light");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once, in-app toggle owns it after
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = (): void => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, toggleTheme };
}
