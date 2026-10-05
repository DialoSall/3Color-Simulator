import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "../utils/analytics";

function getGameMode(pathname) {
  if (/^\/levels\/\d+$/.test(pathname)) {
    return "campaign";
  }

  if (pathname === "/daily") {
    return "daily";
  }

  if (pathname === "/custom") {
    return "custom";
  }

  return null;
}

function AnalyticsTracker() {
  const location = useLocation();
  const previousPathRef = useRef(null);

  useEffect(() => {
    const currentMode = getGameMode(location.pathname);

    const previousMode = previousPathRef.current
      ? getGameMode(previousPathRef.current)
      : null;

    if (currentMode && currentMode !== previousMode) {
      trackEvent("game_start", {
        game_mode: currentMode,
        entry_path: location.pathname,
      });
    }

    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  return null;
}

export default AnalyticsTracker;