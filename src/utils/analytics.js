import { IS_CRAZYGAMES } from "../platform.js";

export function trackEvent(eventName, parameters = {}) {
  if (IS_CRAZYGAMES || typeof window === "undefined") {
    return;
  }

  if (import.meta.env.DEV) {
    console.log("[Analytics]", eventName, parameters);
    return;
  }

  if (typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, parameters);
}
