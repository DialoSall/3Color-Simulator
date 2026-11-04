import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { DAILY_LAUNCH_DATE } from "../src/utils/dailyDate.js";
import { canSelectDailyDate, earnsDailyStreakCredit, formatDailyDate, getCalendarMonth, getDailyStreaks, getPublicDailyHistory, shiftCalendarMonth } from "../src/utils/dailyRetention.js";
import { dailySchedule, getDailyPuzzleForDate } from "./lib/dailyCatalog.js";
import { generatedDailyPuzzles } from "../src/data/daily/generated/index.js";
import { DAILY_PROGRESS_KEY, LEGACY_DAILY_KEY, createDailyProgressService } from "../src/services/dailyProgress.js";

const record = (dateKey, firstCompletedAt = `${dateKey}T18:00:00.000Z`, extra = {}) => ({ dateKey, puzzleId: dailySchedule[dateKey], completed: true, firstCompletedAt, ...extra });
const result = completedAt => ({ timeMilliseconds: 1000, recolors: 2, resets: 0, completedAt });
const streaks = (dates, today) => getDailyStreaks(dates.map(date => record(date)), today);

test("launch day has streak 0 then 1, and never inherits pre-launch credit", () => {
  assert.equal(DAILY_LAUNCH_DATE, "2026-11-04");
  assert.deepEqual(getDailyStreaks([], DAILY_LAUNCH_DATE), { current: 0, best: 0 });
  assert.deepEqual(streaks(["2026-11-03"], DAILY_LAUNCH_DATE), { current: 0, best: 0 });
  assert.deepEqual(streaks(["2026-11-03", "2026-11-04"], DAILY_LAUNCH_DATE), { current: 1, best: 1 });
});

test("consecutive on-time days count; incomplete today preserves yesterday's run", () => {
  assert.deepEqual(streaks(["2026-11-04", "2026-11-05", "2026-11-06"], "2026-11-06"), { current: 3, best: 3 });
  assert.deepEqual(streaks(["2026-11-04", "2026-11-05"], "2026-11-06"), { current: 2, best: 2 });
  assert.deepEqual(streaks(["2027-03-13", "2027-03-14", "2027-03-15"], "2027-03-15"), { current: 3, best: 3 });
});

test("a missed yesterday breaks current streak but preserves the best run", () => {
  const dates = ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-08"];
  assert.deepEqual(streaks(dates, "2026-11-08"), { current: 1, best: 3 });
  assert.deepEqual(streaks(dates, "2026-11-10"), { current: 0, best: 3 });
});

test("credit uses first completion in New York, not UTC or later improved bests", () => {
  assert.equal(earnsDailyStreakCredit(record("2026-11-04", "2026-11-05T04:59:59.999Z"), "2026-11-05"), true);
  assert.equal(earnsDailyStreakCredit(record("2026-11-04", "2026-11-05T05:00:00.000Z"), "2026-11-05"), false);
  assert.equal(earnsDailyStreakCredit(record("2026-11-04", "2026-11-04T04:59:59.999Z"), "2026-11-04"), false);
  const improved = record("2026-11-04", "2026-11-04T18:00:00Z", { best: result("2026-11-09T18:00:00Z") });
  assert.equal(earnsDailyStreakCredit(improved, "2026-11-09"), true);
});

test("late completion stays completed without retroactively restoring a streak", () => {
  const late = record("2026-11-05", "2026-11-07T18:00:00Z");
  const records = [record("2026-11-04"), late, record("2026-11-06"), record("2026-11-07")];
  assert.equal(getPublicDailyHistory(records, "2026-11-07", dailySchedule).find(item => item.dateKey === late.dateKey).completed, true);
  assert.deepEqual(getDailyStreaks(records, "2026-11-07"), { current: 2, best: 2 });
});

test("unverified timestamps, incomplete/future records and mismatched migrated IDs do not earn credit", () => {
  const estimated = record("2026-11-04");
  estimated.attempts = [{ completedAt: estimated.firstCompletedAt, timestampEstimated: true }];
  const records = [estimated, record("2026-11-05", "invalid"), record("2026-11-06", undefined, { completed: false }), record("2026-11-07")];
  assert.deepEqual(getDailyStreaks(records, "2026-11-06"), { current: 0, best: 0 });
  assert.deepEqual(getPublicDailyHistory([record("2026-11-03"), record("2026-11-04", undefined, { puzzleId: "daily-002" }), record("2026-11-05")], "2026-11-04", dailySchedule), []);
});

test("public selection rejects pre-launch, future, invalid and unscheduled dates", () => {
  for (const date of ["2026-11-03", "2026-11-06", "2026-02-30", null, "2027-01-01"])
    assert.equal(canSelectDailyDate(date, "2026-11-05", dailySchedule), false);
  assert.equal(canSelectDailyDate("2026-11-04", "2026-11-05", dailySchedule), true);
  assert.equal(canSelectDailyDate("2026-11-05", "2026-11-05", dailySchedule), true);
  assert.equal(canSelectDailyDate("2026-11-04", "2026-11-05", {}), false);
});

test("calendar date labels and month arithmetic do not depend on the device timezone", () => {
  assert.equal(formatDailyDate("2026-11-04"), "November 4, 2026");
  const cells = getCalendarMonth("2026-11");
  assert.deepEqual(cells.slice(0, 4), ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
  assert.equal(cells.length % 7, 0);
  assert.equal(getCalendarMonth("2028-02").filter(Boolean).length, 29);
  assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01");
  assert.equal(shiftCalendarMonth("2027-01", -1), "2026-12");
});

test("history query is inclusive, preserves migration and returns isolated records", async () => {
  const values = new Map([[LEGACY_DAILY_KEY, JSON.stringify({"2026-11-03": { sourceLevelId: "daily-002", ...result("2026-11-03T18:00:00Z") }})]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const legacy = values.get(LEGACY_DAILY_KEY);
  const service = createDailyProgressService({ storage });
  await service.completeAttempt(getDailyPuzzleForDate("2026-11-04"), "on-time", result("2026-11-04T18:00:00Z"));
  await service.completeAttempt(getDailyPuzzleForDate("2026-11-05"), "late", result("2026-11-08T18:00:00Z"));
  const history = await service.getHistory({ startDate: "2026-11-04", endDate: "2026-11-05" });
  assert.deepEqual(history.map(item => item.dateKey), ["2026-11-04", "2026-11-05"]);
  assert.deepEqual(getDailyStreaks(history, "2026-11-05"), { current: 1, best: 1 });
  history[0].completed = false;
  assert.equal((await service.getProgress(getDailyPuzzleForDate("2026-11-04"))).completed, true);
  assert.equal(values.get(LEGACY_DAILY_KEY), legacy);
  assert.equal((await service.getHistory({ startDate: "2026-11-03", endDate: "2026-11-03" }))[0].puzzleId, "daily-002");
  await assert.rejects(service.getHistory({ startDate: "2026-11-05", endDate: "2026-11-04" }));
  await assert.rejects(service.getHistory({ startDate: "bad", endDate: "2026-11-04" }));
  assert.ok(values.has(DAILY_PROGRESS_KEY));
  await service.recordActivity(getDailyPuzzleForDate("2026-11-06"), "unfinished");
  const unfinished = (await service.getHistory({ startDate: "2026-11-06", endDate: "2026-11-06" }))[0];
  assert.equal(unfinished.completed, false);
  assert.equal(unfinished.firstCompletedAt, null);
});

test("improving a late result preserves its first completion and never repairs a streak", async () => {
  const service = createDailyProgressService({ storage: null });
  const puzzle = getDailyPuzzleForDate("2026-11-04");
  await service.completeAttempt(puzzle, "first", result("2026-11-05T18:00:00Z"));
  await service.completeAttempt(puzzle, "replay", { ...result("2026-11-06T18:00:00Z"), timeMilliseconds: 500 });
  const history = await service.getHistory({ startDate: "2026-11-04", endDate: "2026-11-06" });
  assert.equal(history[0].firstCompletedAt, "2026-11-05T18:00:00.000Z");
  assert.equal(history[0].best.timeMilliseconds, 500);
  assert.deepEqual(getDailyStreaks(history, "2026-11-06"), { current: 0, best: 0 });
});

test("old generated launch progress stays separate from Fox completion and streak credit", async () => {
  const service = createDailyProgressService({ storage: null });
  const original = generatedDailyPuzzles.find(puzzle => puzzle.dateKey === DAILY_LAUNCH_DATE);
  const fox = getDailyPuzzleForDate(DAILY_LAUNCH_DATE);
  await service.completeAttempt(original, "old-generic", result("2026-11-04T17:00:00Z"));
  const oldProgress = await service.getProgress(original);
  const before = await service.getHistory({ startDate: DAILY_LAUNCH_DATE, endDate: DAILY_LAUNCH_DATE });
  assert.equal(before.length, 1);
  assert.equal((await service.getProgress(fox)).completed, false);
  assert.deepEqual(getDailyStreaks(getPublicDailyHistory(before, DAILY_LAUNCH_DATE, dailySchedule), DAILY_LAUNCH_DATE), { current: 0, best: 0 });
  await service.completeAttempt(fox, "new-fox", result("2026-11-04T18:00:00Z"));
  const after = await service.getHistory({ startDate: DAILY_LAUNCH_DATE, endDate: DAILY_LAUNCH_DATE });
  assert.equal(after.length, 2);
  assert.deepEqual(await service.getProgress(original), oldProgress);
  const publicRecords = getPublicDailyHistory(after, DAILY_LAUNCH_DATE, dailySchedule);
  assert.deepEqual(publicRecords.map(item => item.puzzleId), ["daily-2026-11-04-fox-v2"]);
  assert.deepEqual(getDailyStreaks(publicRecords, DAILY_LAUNCH_DATE), { current: 1, best: 1 });
});

test("calendar trigger uses a human-readable date without puzzle numbers", async () => {
  const vite = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom" });
  try {
    const { default: DailyCalendar } = await vite.ssrLoadModule("/src/components/DailyCalendar.jsx");
    // Opening/focus is verified in the browser; SSR verifies public trigger text.
    const html = renderToString(createElement(DailyCalendar, { dateKey: "2026-11-04", today: "2026-11-04", records: [], loading: false, schedule: dailySchedule, onSelect() {}, onOpen() {} }));
    assert.match(html, /November 4, 2026/);
    assert.match(html, /aria-haspopup="dialog"/);
    assert.doesNotMatch(html, /Daily #|2026-09/);
  } finally { await vite.close(); }
});
