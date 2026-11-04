// Node-only source catalog for validation, reproduction, and authoring.
import { designedDailyPuzzles } from "../../src/data/daily/designed/index.js";
import { dailyDesignBankConfig } from "../../src/data/daily/designConfig.js";
import { generatedDailyPuzzles } from "../../src/data/daily/generated/index.js";
import { handcraftedPuzzles } from "../../src/data/daily/handcrafted.js";
import { historicalSchedule } from "../../src/data/daily/history.js";
import { dailyOverrides } from "../../src/data/daily/overrides.js";
import { getDailyDateKey, parseDateKey } from "../../src/utils/dailyDate.js";
export { getDailyDateKey } from "../../src/utils/dailyDate.js";

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const dailyPuzzles = freeze([...handcraftedPuzzles, ...generatedDailyPuzzles, ...designedDailyPuzzles, ...dailyOverrides]);
const byId = new Map();
for (const puzzle of dailyPuzzles) {
  if (byId.has(puzzle.id)) throw new Error(`Duplicate Daily id: ${puzzle.id}`);
  byId.set(puzzle.id,puzzle);
}
const schedule = {...historicalSchedule};
for (const puzzle of generatedDailyPuzzles) {
  if (Object.hasOwn(schedule,puzzle.dateKey)) throw new Error(`Duplicate Daily date: ${puzzle.dateKey}`);
  if (puzzle.dateKey <= dailyDesignBankConfig.preserveThrough) schedule[puzzle.dateKey] = puzzle.id;
}
const designedDates = new Set();
for (const puzzle of designedDailyPuzzles) {
  if (designedDates.has(puzzle.dateKey)) throw new Error(`Duplicate designed Daily date: ${puzzle.dateKey}`);
  designedDates.add(puzzle.dateKey);
  schedule[puzzle.dateKey] = puzzle.id;
}
const overriddenDates = new Set();
for (const puzzle of dailyOverrides) {
  if (overriddenDates.has(puzzle.dateKey)) throw new Error(`Duplicate handcrafted override: ${puzzle.dateKey}`);
  overriddenDates.add(puzzle.dateKey);
  schedule[puzzle.dateKey] = puzzle.id;
}
export const dailySchedule = Object.freeze(schedule);
export class MissingDailyPuzzleError extends Error {
  constructor(dateKey) {
    super(`No Daily puzzle is scheduled for ${dateKey}.`);
    this.name = 'MissingDailyPuzzleError';
    this.dateKey = dateKey;
  }
}
const scheduledPuzzles = new Map();
export function getDailyPuzzleForDate(dateKey) {
  parseDateKey(dateKey);
  if (scheduledPuzzles.has(dateKey)) return scheduledPuzzles.get(dateKey);
  const puzzle = byId.get(dailySchedule[dateKey]);
  if (!puzzle) throw new MissingDailyPuzzleError(dateKey);
  // The date override applies only to explicitly snapshotted historical repeats.
  // Original historical records, graph IDs, and graph data remain untouched.
  const scheduled = Object.freeze({...puzzle, dateKey});
  scheduledPuzzles.set(dateKey,scheduled);
  return scheduled;
}
export function getDailyPuzzle(date = new Date()) {
  return getDailyPuzzleForDate(getDailyDateKey(date));
}
