import { colorThemes } from "../data/colorThemes";

const COLOR_SLOTS = [
  { key: "red", label: "Color 1" },
  { key: "blue", label: "Color 2" },
  { key: "yellow", label: "Color 3" },
];

function ColorThemePicker({
  selectedThemeId,
  onThemeChange,
  activeTheme,
  customTheme,
  onCustomThemeChange,
}) {
  function handlePresetClick(themeId) {
    onThemeChange(themeId);
  }

  function handleCustomColorChange(colorSlot, colorValue) {
    const baseColors =
      selectedThemeId === "custom" ? customTheme.colors : activeTheme.colors;

    onCustomThemeChange({
      id: "custom",
      name: "Custom",
      colors: {
        ...baseColors,
        [colorSlot]: colorValue,
      },
    });

    onThemeChange("custom");
  }

  return (
    <section className="themePicker">
      <div className="themePickerHeader">
        <p className="eyebrow">Colors</p>
        <h3>{selectedThemeId === "custom" ? "Custom Theme" : activeTheme.name}</h3>
      </div>

      <div className="themeColorDots" aria-label="Current color theme colors">
        {COLOR_SLOTS.map((slot) => (
          <label
            key={slot.key}
            className="themeColorDotButton"
            aria-label={`Change ${slot.label}`}
          >
            <span
              className="themeColorDot"
              style={{ backgroundColor: activeTheme.colors[slot.key] }}
            />

            <input
              className="themeColorInput"
              type="color"
              value={activeTheme.colors[slot.key]}
              onChange={(event) =>
                handleCustomColorChange(slot.key, event.target.value)
              }
              aria-label={`Choose ${slot.label}`}
            />
          </label>
        ))}
      </div>

      <div className="themePresetGrid">
        {colorThemes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`themePresetButton ${
              selectedThemeId === theme.id ? "selected" : ""
            }`}
            onClick={() => handlePresetClick(theme.id)}
          >
            <span>{theme.name}</span>

            <span className="themePresetDots">
              {COLOR_SLOTS.map((slot) => (
                <span
                  key={slot.key}
                  style={{ backgroundColor: theme.colors[slot.key] }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>

      {selectedThemeId === "custom" && (
        <p className="themeHint">Custom colors are saved on this device.</p>
      )}
    </section>
  );
}

export default ColorThemePicker;