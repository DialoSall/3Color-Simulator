import ColorThemePicker from "./ColorThemePicker";

function GameSettings({ soundControl, ...themeProps }) {
  return (
    <details className="gameSettings">
      <summary>
        <span>{soundControl ? "Colors & sound" : "Puzzle colors"}</span>
        <svg className="settingsChevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="settingsContent">
        {soundControl && <div className="settingsSound">{soundControl}</div>}
        <ColorThemePicker {...themeProps} />
      </div>
    </details>
  );
}

export default GameSettings;
