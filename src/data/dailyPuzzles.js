import { dailyPayloads, getDailyMetadataForDate } from "./dailyIndex.js";
import { createDailyPuzzleLoader } from "../services/dailyPuzzleLoader.js";
import { getDailyDateKey } from "../utils/dailyDate.js";

export { dailySchedule, getDailyMetadataForDate, MissingDailyPuzzleError } from "./dailyIndex.js";
export { getDailyDateKey } from "../utils/dailyDate.js";

// One shared promise per immutable month, and one frozen result per date.
export const getDailyPuzzleForDate = createDailyPuzzleLoader({
  payloads: dailyPayloads,
  getMetadata: getDailyMetadataForDate,
});
export function getDailyPuzzle(date = new Date()) {
  return getDailyPuzzleForDate(getDailyDateKey(date));
}
