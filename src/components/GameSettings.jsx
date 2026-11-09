import ColorThemePicker from "./ColorThemePicker";
import AppearanceControl from "./AppearanceControl";

function GameSettings({ soundControl, inline = false, ...themeProps }) {
  const content = <div className="settingsContent">
    {soundControl && <div className="settingsSound">{soundControl}</div>}
    {inline && <AppearanceControl />}
    <ColorThemePicker {...themeProps} />
  </div>;
  if (inline) return <section className="gameSettings menuSettings">{content}</section>;
  return (
    <details className="gameSettings">
      <summary>
        <span>{soundControl ? "Colors & sound" : "Puzzle colors"}</span>
        <svg className="settingsChevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      {content}
    </details>
  );
}

export default GameSettings;
