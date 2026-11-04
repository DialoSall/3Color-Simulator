import { createHash } from "node:crypto";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function createLedger(puzzles, schedule) {
  return { version: 1, puzzles: Object.fromEntries(puzzles.map(puzzle => [puzzle.id, fingerprint(puzzle)])), schedule };
}
