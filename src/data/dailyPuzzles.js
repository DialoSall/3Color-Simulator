import { levels } from "./levels";

const DAILY_START_DATE_UTC = Date.UTC(2026, 8, 3); // September 3, 2026
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getDailyDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getDailyPuzzle(date = new Date()) {
  const todayUTC = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );

  const daysSinceStart = Math.max(
    0,
    Math.floor((todayUTC - DAILY_START_DATE_UTC) / MILLISECONDS_PER_DAY)
  );

  const sourceLevel = levels[daysSinceStart % levels.length];

  return {
    ...sourceLevel,
    dateKey: getDailyDateKey(date),
    dailyNumber: daysSinceStart + 1,
    name: `Daily Puzzle #${daysSinceStart + 1}`,
    description: `Today's graph-coloring challenge. Color every circle so connected circles never share the same color.`,
  };
}