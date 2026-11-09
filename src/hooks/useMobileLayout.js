import { createContext, useContext, useSyncExternalStore } from "react";

export const MobileLayoutContext = createContext(false);
let query;
const media = () => query ??= window.matchMedia("(max-width: 600px)");
const subscribe = callback => {
  const match = media();
  match.addEventListener("change", callback);
  return () => match.removeEventListener("change", callback);
};
export function useMobileViewport() {
  return useSyncExternalStore(subscribe, () => media().matches, () => false);
}
export function useMobileLayout() { return useContext(MobileLayoutContext); }
