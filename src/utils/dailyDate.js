export const DAILY_TIME_ZONE = "America/New_York";
export const DAILY_START_DATE = "2026-09-03";
const DAY_MS = 86400000;
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DAILY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function getDailyDateKey(date = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// UTC is used only for arithmetic on date labels, never to choose the Daily day.
export function parseDateKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error(`Invalid Daily date: ${key}`);
  const value = Date.parse(`${key}T00:00:00.000Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== key) throw new Error(`Invalid Daily date: ${key}`);
  return value;
}

export function addDailyDays(key, days) {
  return new Date(parseDateKey(key) + days * DAY_MS).toISOString().slice(0, 10);
}

export function getDailyNumber(key) {
  return Math.round((parseDateKey(key) - parseDateKey(DAILY_START_DATE)) / DAY_MS) + 1;
}

export function millisecondsUntilNextDaily(date = new Date()) {
  const start = date.getTime();
  const key = getDailyDateKey(date);
  let low = start;
  let high = start + 27 * 3600000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (getDailyDateKey(new Date(middle)) === key) low = middle;
    else high = middle;
  }
  return high - start;
}
