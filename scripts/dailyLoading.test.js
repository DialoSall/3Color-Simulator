import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dailyMetadataEntries, dailyPayloads, dailySchedule, getDailyMetadataForDate, MissingDailyPuzzleError } from "../src/data/dailyIndex.js";
import { createDailyPuzzleLoader, readDailyPayload, DAILY_DATA_CACHE, DailyPuzzleUnavailableError } from "../src/services/dailyPuzzleLoader.js";
import { getDailyPuzzleForDate as sourcePuzzle, dailySchedule as sourceSchedule } from "./lib/dailyCatalog.js";
import { createDailyProgressService, LEGACY_DAILY_KEY } from "../src/services/dailyProgress.js";
import { canSelectDailyDate, getDailyStreaks, getPublicDailyHistory } from "../src/utils/dailyRetention.js";

function loader(readPayload) {
  return createDailyPuzzleLoader({ payloads: dailyPayloads, getMetadata: getDailyMetadataForDate, readPayload });
}
const filePayload = async url => JSON.parse(await readFile(new URL(`../public${url}`, import.meta.url), "utf8"));

test("metadata is graph-free, preserves every date/identity, and needs no payload requests", () => {
  assert.deepEqual(dailySchedule, sourceSchedule);
  assert.equal(dailyMetadataEntries.length, 427);
  for (const entry of dailyMetadataEntries) {
    for (const key of ["vertices", "edges", "metrics", "generation", "theme", "design"]) assert.equal(Object.hasOwn(entry, key), false);
    assert.ok(Object.isFrozen(entry));
    assert.equal(entry.id, sourcePuzzle(entry.dateKey).id);
  }
  assert.equal(getDailyMetadataForDate("2026-11-04").name, "Fox Face");
  assert.throws(() => getDailyMetadataForDate("2027-11-04"), MissingDailyPuzzleError);
});

test("today's Fox override and historical dates load exactly the existing effective objects", async () => {
  const load = loader(filePayload);
  for (const date of ["2026-11-04", "2026-11-05", "2026-09-22", "2026-11-03", "2027-07-15"]) {
    const puzzle = await load(date);
    assert.deepEqual(puzzle, sourcePuzzle(date));
    assert.ok(Object.isFrozen(puzzle));
    assert.ok(Object.isFrozen(puzzle.vertices[0]));
  }
  assert.equal((await load("2026-11-04")).id, "daily-2026-11-04-fox-v2");
});

test("concurrent/repeated dates share a month request and a stable cached puzzle", async () => {
  const calls = [];
  const load = loader(async url => { calls.push(url); return filePayload(url); });
  assert.equal(load.peek("2026-11-04"), null);
  const [first, repeated] = await Promise.all([load("2026-11-04"), load("2026-11-04"), load("2026-11-05")]);
  assert.equal(first, repeated);
  assert.equal(load.peek("2026-11-04"), first);
  assert.equal(await load("2026-11-04"), first);
  assert.equal(calls.length, 1);
  await load("2026-12-01");
  assert.equal(calls.length, 2);
});

test("all scheduled runtime objects match source truth, with only effective IDs in monthly files", async () => {
  const loaded = [];
  const load = loader(async url => { const payload = await filePayload(url); loaded.push(payload); return payload; });
  for (const date of Object.keys(dailySchedule)) assert.deepEqual(await load(date), sourcePuzzle(date));
  assert.equal(loaded.length, 15);
  const effectiveIds = new Set(Object.values(dailySchedule));
  for (const payload of loaded) for (const puzzle of payload.puzzles) assert.ok(effectiveIds.has(puzzle.id));
  assert.equal(loaded.some(payload => payload.puzzles.some(puzzle => puzzle.id === "daily-2026-11-04-v1")), false);
});

test("missing dates/references/payloads and corrupt content reject without fallback, and failures can retry", async () => {
  let calls = 0;
  const load = loader(async url => { if (++calls === 1) throw new Error("offline"); return filePayload(url); });
  await assert.rejects(load("2027-11-04"), MissingDailyPuzzleError);
  assert.equal(calls, 0);
  await assert.rejects(load("2026-11-04"), DailyPuzzleUnavailableError);
  assert.deepEqual(await load("2026-11-04"), sourcePuzzle("2026-11-04"));
  const missingReference = createDailyPuzzleLoader({ payloads: {}, getMetadata: getDailyMetadataForDate });
  await assert.rejects(missingReference("2026-11-04"), DailyPuzzleUnavailableError);
  await assert.rejects(loader(async () => ({ schemaVersion: 1, month: "2026-11", puzzles: [] }))("2026-11-04"), DailyPuzzleUnavailableError);
});

function persistentCache() {
  const responses = new Map();
  return { responses, async open(name) {
    assert.equal(name, DAILY_DATA_CACHE);
    return { async match(url) { return responses.get(typeof url === "string" ? url : new URL(url.url).pathname)?.clone(); }, async put(url, response) { responses.set(url, response.clone()); }, async delete(url) { return responses.delete(url); }, async keys() { return [...responses.keys()].map(path => new Request(`https://3color.app${path}`)); } };
  } };
}

test("an app update keeps unchanged puzzles available offline without substituting an old override identity", async () => {
  const cache = persistentCache();
  const oldUrl = dailyPayloads["2026-11"];
  cache.responses.set(oldUrl, new Response(JSON.stringify(await filePayload(oldUrl))));
  const newUrl = "/daily/2026-11.0123456789abcdef.json";
  const changed = { ...getDailyMetadataForDate("2026-11-05"), id: "new-authorized-future-override" };
  const load = createDailyPuzzleLoader({
    payloads: { ...dailyPayloads, "2026-11": newUrl },
    getMetadata: date => date === changed.dateKey ? changed : getDailyMetadataForDate(date),
    readPayload: (url, validate) => readDailyPayload(url, validate, { cacheStorage: cache, fetcher: async () => { throw new Error("offline"); } }),
  });
  assert.deepEqual(await load("2026-11-04"), sourcePuzzle("2026-11-04"));
  await assert.rejects(load(changed.dateKey), DailyPuzzleUnavailableError);
  assert.equal(cache.responses.has(newUrl), false);
  assert.equal(cache.responses.size, 1);
});

test("a loaded month persists offline across new loader instances, even without a controlling worker", async () => {
  const cache = persistentCache();
  let requests = 0;
  const fetcher = async url => { requests++; return new Response(JSON.stringify(await filePayload(url)), { headers: { "Content-Type": "application/json" } }); };
  const load = loader((url, validate) => readDailyPayload(url, validate, { cacheStorage: cache, fetcher }));
  await load("2026-11-04");
  assert.equal(requests, 1);
  const offline = loader((url, validate) => readDailyPayload(url, validate, { cacheStorage: cache, fetcher: async () => { throw new Error("offline"); } }));
  assert.deepEqual(await offline("2026-11-05"), sourcePuzzle("2026-11-05"));
  await assert.rejects(offline("2026-12-01"), DailyPuzzleUnavailableError);
  assert.equal(cache.responses.size, 1);
});

test("invalid cached data is replaced; invalid online responses are not cached; storage denial is nonfatal online", async () => {
  const cache = persistentCache();
  const url = dailyPayloads["2026-11"];
  cache.responses.set(url, new Response("<html>offline fallback</html>"));
  const load = loader((url, validate) => readDailyPayload(url, validate, { cacheStorage: cache, fetcher: async url => new Response(JSON.stringify(await filePayload(url))) }));
  assert.equal((await load("2026-11-04")).name, "Fox Face");
  const denied = loader((url, validate) => readDailyPayload(url, validate, { cacheStorage: { async open() { throw new Error("denied"); } }, fetcher: async url => new Response(JSON.stringify(await filePayload(url))) }));
  assert.equal((await denied("2026-11-04")).name, "Fox Face");
  const empty = persistentCache();
  const invalid = loader((url, validate) => readDailyPayload(url, validate, { cacheStorage: empty, fetcher: async () => new Response("<html>not JSON</html>") }));
  await assert.rejects(invalid("2026-11-04"), DailyPuzzleUnavailableError);
  assert.equal(empty.responses.size, 0);
});

test("progress, migration, calendar selection and streaks operate on metadata with zero graph reads", async () => {
  const values = new Map([[LEGACY_DAILY_KEY, JSON.stringify({ "2026-11-03": { sourceLevelId: "daily-002", timeMilliseconds: 1000, recolors: 0, resets: 0 } })]]);
  const service = createDailyProgressService({ storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
  const metadata = getDailyMetadataForDate("2026-11-04");
  assert.equal((await service.getProgress(metadata)).completed, false);
  await service.completeAttempt(metadata, "metadata-attempt", { timeMilliseconds: 1000, recolors: 0, resets: 0, completedAt: "2026-11-04T17:00:00Z" });
  const history = getPublicDailyHistory(await service.getHistory({ startDate: "2026-11-04", endDate: "2026-11-04" }), "2026-11-04", dailySchedule);
  assert.deepEqual(getDailyStreaks(history, "2026-11-04"), { current: 1, best: 1 });
  assert.equal(canSelectDailyDate("2026-11-05", "2026-11-04", dailySchedule), false);
  assert.equal((await service.getHistory({ startDate: "2026-11-03", endDate: "2026-11-03" }))[0].puzzleId, "daily-002");
});

test("nested-host cached month revisions stay scoped to their upload directory", async () => {
  const payload = await filePayload(dailyPayloads["2026-11"]);
  const responses = new Map([
    ["https://portal.test/uploads/other/daily/2026-11.old.json", new Response(JSON.stringify(payload))],
    ["https://portal.test/uploads/3color/daily/2026-11.old.json", new Response(JSON.stringify(payload))],
  ]);
  const matched = [];
  const cacheStorage = { async open() { return {
    async match(key) { const url = typeof key === "string" ? key : key.url; matched.push(url); return responses.get(url)?.clone(); },
    async keys() { return [...responses.keys()].map(url => new Request(url)); },
  }; } };
  const readPayload = (url, validate) => readDailyPayload(url, validate, { cacheStorage, fetcher: async () => { throw new Error("offline"); } });
  const load = createDailyPuzzleLoader({ payloads: { "2026-11": "https://portal.test/uploads/3color/daily/2026-11.new.json" }, getMetadata: getDailyMetadataForDate, readPayload });
  assert.deepEqual(await load("2026-11-04"), sourcePuzzle("2026-11-04"));
  assert.equal(matched.some(url => url.includes("/uploads/other/")), false);
  assert.ok(matched.some(url => url.endsWith("/uploads/3color/daily/2026-11.old.json")));
});
