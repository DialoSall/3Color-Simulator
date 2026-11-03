import { Link, NavLink } from "react-router-dom";
import { useAppearance } from "../hooks/useAppearance";

function AppHeader() {
  const { appearance, setAppearance } = useAppearance();
  return (
    <header className="siteHeader">
      <Link to="/" className="brand" aria-label="3Color home">
        <span className="brandDots" aria-hidden="true"><i /><i /><i /></span>
        3Color
      </Link>
      <nav className="modeNavigation" aria-label="Game modes">
        <NavLink to="/levels">Campaign</NavLink>
        <NavLink to="/daily">Daily</NavLink>
        <NavLink to="/custom">Random</NavLink>
      </nav>
      <label className="appearanceControl">
        <span>Appearance</span>
        <select value={appearance} onChange={(event) => setAppearance(event.target.value)}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </header>
  );
}

export default AppHeader;
