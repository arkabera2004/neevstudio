// Theme context and its consumer hook. Split out of theme-provider.tsx so that
// file only exports a component (React Fast Refresh requirement).

import { createContext, useContext } from "react";

export type Theme = "light" | "dark";
export type ThemeCtx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };

export const ThemeContext = createContext<ThemeCtx | null>(null);
export const THEME_STORAGE_KEY = "veritrace-theme";

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
