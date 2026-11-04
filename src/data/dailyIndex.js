import { dailyMetadata, dailyPayloads, legacyDailyMetadata } from "./daily/runtimeIndex.generated.js";
import { parseDateKey } from "../utils/dailyDate.js";

export { dailyPayloads, legacyDailyMetadata };
export const dailyMetadataEntries = Object.freeze(dailyMetadata.map(entry => Object.freeze(entry)));
const byDate = new Map(dailyMetadataEntries.map(entry => [entry.dateKey, entry]));
export const dailySchedule = Object.freeze(Object.fromEntries(dailyMetadataEntries.map(entry => [entry.dateKey, entry.id])));

export class MissingDailyPuzzleError extends Error {
  constructor(dateKey) {
    super(`No Daily puzzle is scheduled for ${dateKey}.`);
    this.name = "MissingDailyPuzzleError";
    this.dateKey = dateKey;
  }
}

export function getDailyMetadataForDate(dateKey) {
  parseDateKey(dateKey);
  const entry = byDate.get(dateKey);
  if (!entry) throw new MissingDailyPuzzleError(dateKey);
  return entry;
}
