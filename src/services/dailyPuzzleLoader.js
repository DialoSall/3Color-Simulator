export const DAILY_DATA_CACHE = "3color-daily-data-v1";

export class DailyPuzzleUnavailableError extends Error {
  constructor(dateKey, cause) {
    super("This puzzle could not be loaded. Reconnect and try again.", { cause });
    this.name = "DailyPuzzleUnavailableError";
    this.dateKey = dateKey;
  }
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Explicit caching also covers the first visit, before a service worker controls
// the page. Only validated responses are cached; unavailable CacheStorage is
// nonfatal online. This named cache survives app-shell service-worker upgrades.
export async function readDailyPayload(url, validate, { fetcher = globalThis.fetch, cacheStorage = globalThis.caches } = {}) {
  let cache;
  try { cache = await cacheStorage?.open(DAILY_DATA_CACHE); } catch { /* Online loading still works. */ }
  if (cache) {
    try {
      const cached = await cache.match(url);
      if (cached) return validate(await cached.json());
    } catch {
      await cache.delete(url).catch(() => {});
    }
  }
  try {
    const response = await fetcher(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Daily data request failed (${response.status}).`);
    const payload = validate(await response.clone().json());
    try { await cache?.put(url, response); } catch { /* Storage denial/quota must not block play. */ }
    return payload;
  } catch (error) {
    // A future override can change a month's hash after an app-shell update.
    // Retain offline access to unchanged identities in an older cached month.
    // Never store those older bytes under the new immutable URL.
    try {
      const month = url.match(/^\/daily\/(\d{4}-\d{2})\./)?.[1];
      for (const request of month && cache ? await cache.keys() : []) {
        if (!new URL(request.url).pathname.startsWith(`/daily/${month}.`)) continue;
        try { return validate(await (await cache.match(request)).json()); } catch { /* Try another cached revision. */ }
      }
    } catch { /* CacheStorage may be unavailable. */ }
    throw error;
  }
}

export function createDailyPuzzleLoader({ payloads, getMetadata, readPayload = readDailyPayload }) {
  const months = new Map();
  const puzzles = new Map();
  function validateMonth(payload, entry) {
    if (payload?.schemaVersion !== 1 || payload.month !== entry.payload || !Array.isArray(payload.puzzles)) throw new Error("Invalid Daily payload.");
    const byId = new Map(payload.puzzles.map(puzzle => [puzzle?.id, puzzle]));
    if (byId.size !== payload.puzzles.length) throw new Error("Duplicate Daily payload identity.");
    const puzzle = byId.get(entry.id);
    if (!puzzle || ["id", "version", "name", "difficulty", "source"].some(key => puzzle[key] !== entry[key]) || !Array.isArray(puzzle.vertices) || !Array.isArray(puzzle.edges)) throw new Error("Daily payload does not match its index.");
    return freeze(payload);
  }
  const loadDailyPuzzle = async function (dateKey) {
    const entry = getMetadata(dateKey); // Missing dates stay distinct from network failures.
    if (puzzles.has(dateKey)) return puzzles.get(dateKey);
    try {
      const url = payloads[entry.payload];
      if (!url) throw new Error("Missing Daily payload reference.");
      if (months.has(url)) {
        const pending = months.get(url);
        const cached = await pending;
        try { validateMonth(cached, entry); } catch {
          // An older offline revision can cover one date but lack a newer
          // override. Re-read for this identity instead of reusing that month.
          if (months.get(url) === pending) months.delete(url);
        }
      }
      if (!months.has(url)) {
        const pending = Promise.resolve().then(() => readPayload(url, payload => validateMonth(payload, entry)))
          .then(payload => validateMonth(payload, entry)).catch(error => { months.delete(url); throw error; });
        months.set(url, pending);
      }
      const payload = validateMonth(await months.get(url), entry);
      // Historical repeated IDs keep the selected date label, just as before.
      if (!puzzles.has(dateKey)) puzzles.set(dateKey, freeze({ ...payload.puzzles.find(puzzle => puzzle.id === entry.id), dateKey }));
      return puzzles.get(dateKey);
    } catch (cause) { throw new DailyPuzzleUnavailableError(dateKey, cause); }
  };
  loadDailyPuzzle.peek = dateKey => puzzles.get(dateKey) ?? null;
  return loadDailyPuzzle;
}
