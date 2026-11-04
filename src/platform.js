// Selected by Vite at build time. Optional access also permits pure Node tests.
export const IS_CRAZYGAMES = import.meta.env?.MODE === "crazygames";

export function assetPath(path) {
  return `${import.meta.env?.BASE_URL ?? "/"}${path.replace(/^\/+/, "")}`;
}
