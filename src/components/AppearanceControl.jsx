import { useContext } from "react";
import { AppearanceContext } from "../hooks/useAppearance";

function AppearanceControl() {
  const preferences = useContext(AppearanceContext);
  if (!preferences) return null;
  const { appearance, setAppearance } = preferences;
  return (
    <label className="appearanceControl">
      <span>Appearance</span>
      <select value={appearance} onChange={event => setAppearance(event.target.value)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

export default AppearanceControl;
