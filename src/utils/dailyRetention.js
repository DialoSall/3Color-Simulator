import { DAILY_LAUNCH_DATE, addDailyDays, getDailyDateKey, parseDateKey } from "./dailyDate.js";

export function isPublicDailyDate(dateKey, today) {
  try { parseDateKey(dateKey); parseDateKey(today); } catch { return false; }
  return dateKey >= DAILY_LAUNCH_DATE && dateKey <= today;
}

export function canSelectDailyDate(dateKey, today, schedule) {
  return isPublicDailyDate(dateKey, today) && Object.hasOwn(schedule, dateKey);
}

export function formatDailyDate(dateKey, options = { month: "long", day: "numeric", year: "numeric" }) {
  // Format date labels in UTC so the device's timezone cannot shift the day.
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(parseDateKey(dateKey)));
}

export function getPublicDailyHistory(records, today, schedule) {
  // Old migrated puzzle IDs may share a date with a different official puzzle.
  return records.filter(record => isPublicDailyDate(record.dateKey, today) && schedule[record.dateKey] === record.puzzleId);
}

export function earnsDailyStreakCredit(record, today) {
  if (!record.completed || !isPublicDailyDate(record.dateKey, today) || !Number.isFinite(Date.parse(record.firstCompletedAt))) return false;
  // Migration sometimes had to estimate a timestamp. An estimate cannot prove
  // an on-time solve; preserve its calendar completion without awarding credit.
  if (record.attempts?.some(attempt => attempt.timestampEstimated && attempt.completedAt === record.firstCompletedAt)) return false;
  return getDailyDateKey(new Date(record.firstCompletedAt)) === record.dateKey;
}

export function getDailyStreaks(records, today) {
  parseDateKey(today);
  const credited = new Set(records.filter(record => earnsDailyStreakCredit(record, today)).map(record => record.dateKey));
  const dates = [...credited].sort();
  let best = 0, run = 0, previous;
  for (const date of dates) {
    run = previous && addDailyDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  let current = 0;
  let end = credited.has(today) ? today : addDailyDays(today, -1);
  while (credited.has(end)) { current++; end = addDailyDays(end, -1); }
  return { current, best };
}

export function getCalendarMonth(monthKey) {
  const first = `${monthKey}-01`;
  const date = new Date(parseDateKey(first));
  const count = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array(date.getUTCDay()).fill(null);
  for (let day = 0; day < count; day++) cells.push(addDailyDays(first, day));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function shiftCalendarMonth(monthKey, offset) {
  const date = new Date(parseDateKey(`${monthKey}-01`));
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
