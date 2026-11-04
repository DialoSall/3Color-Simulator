import { parseDateKey } from "./dailyDate.js";

// Formatting only; public availability is checked against today's Daily schedule.
export function getDailyPath(dateKey) {
  parseDateKey(dateKey);
  return `/daily/${dateKey}`;
}

export function getDailyUrl(dateKey) {
  return `https://3color.app${getDailyPath(dateKey)}`;
}
