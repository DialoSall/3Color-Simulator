import { Link, NavLink, useLocation } from "react-router-dom";
import AppearanceControl from "./AppearanceControl";
import { useMobileLayout } from "../hooks/useMobileLayout";

function AppHeader() {
  const { pathname } = useLocation();
  const mobile = useMobileLayout();
  if (mobile && (/^\/(levels|daily|custom)(\/|$)/.test(pathname) || (import.meta.env.DEV && pathname === "/dev/preview"))) return null;
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
        {import.meta.env.DEV && <NavLink to="/dev/preview" title="Development preview">Preview</NavLink>}
      </nav>
      <AppearanceControl />
    </header>
  );
}

export default AppHeader;
