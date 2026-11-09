import { createContext, useEffect, useState } from "react";

export const AppearanceContext = createContext(null);

const STORAGE_KEY = "3color-appearance";
const MODES = ["system", "light", "dark"];

function getSavedAppearance() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return MODES.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export function useAppearance() {
  const [appearance, setAppearance] = useState(getSavedAppearance);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = appearance === "dark" || (appearance === "system" && media.matches);
      document.documentElement.dataset.appearance = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#111318" : "#f5f5f7");
    };
    apply();
    media.addEventListener("change", apply);
    try {
      window.localStorage.setItem(STORAGE_KEY, appearance);
    } catch {
      // The setting still works for this visit when storage is unavailable.
    }
    return () => media.removeEventListener("change", apply);
  }, [appearance]);

  return { appearance, setAppearance };
}
