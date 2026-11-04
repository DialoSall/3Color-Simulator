import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CUSTOM_THEME,
  DEFAULT_THEME_ID,
  getThemeById,
} from "../data/colorThemes";

const THEME_ID_KEY = "3color-theme-id";
const CUSTOM_THEME_KEY = "3color-custom-theme";

function cloneDefaultCustomTheme() {
  return {
    ...DEFAULT_CUSTOM_THEME,
    colors: {
      ...DEFAULT_CUSTOM_THEME.colors,
    },
  };
}

function getSavedThemeId() {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_ID;
  }

  try { return window.localStorage.getItem(THEME_ID_KEY) ?? DEFAULT_THEME_ID; } catch { return DEFAULT_THEME_ID; }
}

function getSavedCustomTheme() {
  if (typeof window === "undefined") {
    return cloneDefaultCustomTheme();
  }

  try {
    const savedCustomTheme = window.localStorage.getItem(CUSTOM_THEME_KEY);

    if (!savedCustomTheme) {
      return cloneDefaultCustomTheme();
    }

    const parsedTheme = JSON.parse(savedCustomTheme);

    if (
      !parsedTheme?.colors?.red ||
      !parsedTheme?.colors?.blue ||
      !parsedTheme?.colors?.yellow
    ) {
      return cloneDefaultCustomTheme();
    }

    return {
      id: "custom",
      name: "Custom",
      colors: {
        red: parsedTheme.colors.red,
        blue: parsedTheme.colors.blue,
        yellow: parsedTheme.colors.yellow,
      },
    };
  } catch {
    return cloneDefaultCustomTheme();
  }
}

export function useColorTheme() {
  const [selectedThemeId, setSelectedThemeId] = useState(getSavedThemeId);
  const [customTheme, setCustomTheme] = useState(getSavedCustomTheme);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try { window.localStorage.setItem(THEME_ID_KEY, selectedThemeId); } catch { /* Preferences remain usable in memory. */ }
  }, [selectedThemeId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try { window.localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(customTheme)); } catch { /* Preferences remain usable in memory. */ }
  }, [customTheme]);

  const activeTheme = useMemo(() => {
    if (selectedThemeId === "custom") {
      return customTheme;
    }

    return getThemeById(selectedThemeId);
  }, [selectedThemeId, customTheme]);

  return {
    selectedThemeId,
    setSelectedThemeId,
    customTheme,
    setCustomTheme,
    activeTheme,
  };
}
