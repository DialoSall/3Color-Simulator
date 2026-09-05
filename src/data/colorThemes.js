export const DEFAULT_THEME_ID = "classic";

export const DEFAULT_CUSTOM_THEME = {
  id: "custom",
  name: "Custom",
  colors: {
    red: "#ff3b30",
    blue: "#007aff",
    yellow: "#ffcc00",
  },
};

export const colorThemes = [
  {
    id: "classic",
    name: "Classic",
    colors: {
      red: "#ff3b30",
      blue: "#007aff",
      yellow: "#ffcc00",
    },
  },
  {
    id: "neon",
    name: "Neon",
    colors: {
      red: "#ff2d95",
      blue: "#00d4ff",
      yellow: "#b8ff00",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: {
      red: "#ff6b6b",
      blue: "#6c63ff",
      yellow: "#ffd166",
    },
  },
  {
    id: "forest",
    name: "Forest",
    colors: {
      red: "#2f6f3e",
      blue: "#8b5e34",
      yellow: "#f2c94c",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    colors: {
      red: "#00a6a6",
      blue: "#005f99",
      yellow: "#f4d35e",
    },
  },
];

export function getThemeById(themeId) {
  if (themeId === "custom") {
    return DEFAULT_CUSTOM_THEME;
  }

  return (
    colorThemes.find((theme) => theme.id === themeId) ??
    colorThemes.find((theme) => theme.id === DEFAULT_THEME_ID)
  );
}