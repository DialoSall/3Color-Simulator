export function trackEvent(eventName, parameters = {}) {
  if (typeof window === "undefined") {
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