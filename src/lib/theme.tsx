import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "mv-theme";
const LEGACY_STORAGE_KEY = "lpa-theme";

/** Inline script that applies the saved theme before first paint (no flash). */
export const themeBootScript = `try{var t=localStorage.getItem("${STORAGE_KEY}")||localStorage.getItem("${LEGACY_STORAGE_KEY}");if(t!=="dark"){document.documentElement.classList.add("theme-light")}}catch(e){document.documentElement.classList.add("theme-light")}`;

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  return saved === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(readTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.classList.toggle("theme-light", next === "light");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(readTheme() === "light" ? "dark" : "light");
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}
