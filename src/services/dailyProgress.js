import { handcraftedPuzzles } from "../data/daily/handcrafted.js";
import { parseDateKey } from "../utils/dailyDate.js";

export const DAILY_PROGRESS_KEY = "3color-daily-progress-v1";
export const LEGACY_DAILY_KEY = "3color-daily-completions";
export const DAILY_PROGRESS_VERSION = 1;

export function isBetterDailyResult(next, previous) {
  if (!previous) return true;
  if (next.timeMilliseconds !== previous.timeMilliseconds) return next.timeMilliseconds < previous.timeMilliseconds;
  if (next.recolors !== previous.recolors) return next.recolors < previous.recolors;
  return next.resets < previous.resets;
}

function validResult(result) {
  return result && Number.isFinite(result.timeMilliseconds) && result.timeMilliseconds >= 0 &&
    Number.isInteger(result.recolors) && result.recolors >= 0 && Number.isInteger(result.resets) && result.resets >= 0 &&
    Number.isFinite(Date.parse(result.completedAt));
}
function timestamp(value, fallback) {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}
function earliest(...values) { return values.filter(Boolean).sort()[0] ?? null; }
function latest(...values) { return values.filter(Boolean).sort().at(-1) ?? null; }
function emptyProgress(puzzle) {
  return { puzzleId: puzzle.id, puzzleVersion: puzzle.version, dateKey: puzzle.dateKey,
    completed: false, firstCompletedAt: null, best: null, attempts: [], lastPlayedAt: null };
}

// The same merge boundary can be used for a later authenticated/cloud adapter.
// Attempts are keyed by client IDs, and repeating a completion is idempotent.
export function mergeDailyProgress(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (left.puzzleId !== right.puzzleId || left.dateKey !== right.dateKey) throw new Error('Cannot merge different Daily identities.');
  const attempts = new Map();
  for (const attempt of [...left.attempts, ...right.attempts]) {
    const previous = attempts.get(attempt.id);
    if (!previous) { attempts.set(attempt.id, {...attempt}); continue; }
    attempts.set(attempt.id, {...previous, ...attempt,
      startedAt: earliest(previous.startedAt, attempt.startedAt),
      lastPlayedAt: latest(previous.lastPlayedAt, attempt.lastPlayedAt),
      completedAt: earliest(previous.completedAt, attempt.completedAt),
      result: attempt.result && isBetterDailyResult(attempt.result, previous.result) ? attempt.result : previous.result,
    });
  }
  return {...left, completed: left.completed || right.completed,
    firstCompletedAt: earliest(left.firstCompletedAt, right.firstCompletedAt),
    best: right.best && isBetterDailyResult(right.best, left.best) ? right.best : left.best,
    attempts: [...attempts.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    lastPlayedAt: latest(left.lastPlayedAt, right.lastPlayedAt),
  };
}

function legacyPuzzleId(dateKey, result) {
  if (typeof result.sourceLevelId === 'string' && /^[a-z\d][a-z\d:._-]*$/i.test(result.sourceLevelId)) return result.sourceLevelId;
  // This reproduces the OLD UTC selector only for migration. Official schedule
  // lookup never falls back. Keep the old date labels; do not shift saved results.
  return [...handcraftedPuzzles].reverse().find(puzzle=>puzzle.dateKey<=dateKey)?.id ?? `legacy-${dateKey}`;
}

function getRecord(schema, puzzle) {
  const bucket = Object.hasOwn(schema.byPuzzleId, puzzle.id) ? schema.byPuzzleId[puzzle.id] : null;
  return bucket?.[puzzle.dateKey] ?? emptyProgress(puzzle);
}
function putRecord(schema, record) {
  if (!Object.hasOwn(schema.byPuzzleId, record.puzzleId)) schema.byPuzzleId[record.puzzleId] = {};
  schema.byPuzzleId[record.puzzleId][record.dateKey] = record;
}

export function migrateDailyCompletions(schema, legacy) {
  const next = structuredClone(schema);
  next.unmappedLegacy ??= {};
  for (const [key, result] of Object.entries(legacy ?? {})) {
    try {
      const dateKey = result?.dateKey ?? key;
      parseDateKey(dateKey);
      const completedAt = timestamp(result?.completedAt, `${dateKey}T12:00:00.000Z`);
      const best = {timeMilliseconds: result?.timeMilliseconds, recolors: result?.recolors, resets: result?.resets, completedAt};
      if (!validResult(best)) throw new Error('Malformed legacy result');
      const puzzle = {id: legacyPuzzleId(dateKey, result), version: 1, dateKey};
      const record = {...emptyProgress(puzzle), completed: true, firstCompletedAt: completedAt, best,
        attempts: [{id: `legacy:${puzzle.id}:${dateKey}`, startedAt: completedAt, lastPlayedAt: completedAt, completedAt, result: best, migrated: true, startedAtEstimated: true, timestampEstimated: !Number.isFinite(Date.parse(result?.completedAt))}], lastPlayedAt: completedAt};
      putRecord(next, mergeDailyProgress(getRecord(next,puzzle),record));
    } catch {
      // Preserve even unrecognized entries, in addition to retaining the old key.
      next.unmappedLegacy = {...next.unmappedLegacy, [key]: result};
    }
  }
  next.legacyMigrationComplete = true;
  return next;
}

export function newDailyAttemptId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function browserStorage() {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

// Promise-based methods deliberately match a future remote service. The UI does
// not depend on localStorage, its key names, or the migration implementation.
export function createDailyProgressService({storage = browserStorage(), now = () => new Date().toISOString()} = {}) {
  const memory = new Map();
  const read = key => storage ? storage.getItem(key) : memory.get(key) ?? null;
  const write = schema => {
    const serialized = JSON.stringify(schema);
    if (storage) storage.setItem(DAILY_PROGRESS_KEY, serialized);
    else memory.set(DAILY_PROGRESS_KEY, serialized);
  };
  function load() {
    const raw = read(DAILY_PROGRESS_KEY);
    let schema = raw ? JSON.parse(raw) : {schemaVersion: DAILY_PROGRESS_VERSION, byPuzzleId: {}, unmappedLegacy: {}, legacyMigrationComplete: false};
    if (!schema || schema.schemaVersion !== DAILY_PROGRESS_VERSION || !schema.byPuzzleId || typeof schema.byPuzzleId !== 'object' || Array.isArray(schema.byPuzzleId)) throw new Error('Unsupported Daily progress schema; stored data was preserved.');
    if (!schema.legacyMigrationComplete) {
      let legacy;
      try { legacy = JSON.parse(read(LEGACY_DAILY_KEY) ?? '{}'); } catch { legacy = {}; }
      schema = migrateDailyCompletions(schema, legacy);
      try {
        write(schema);
      } catch {
        // Keep legacy bests readable if migration hits a quota/storage failure.
        // A later read retries migration; new writes still reject and reach the UI.
      }
    }
    return schema;
  }
  function update(puzzle, transform) {
    const schema = load();
    const record = transform(getRecord(schema,puzzle));
    putRecord(schema,record);
    write(schema);
    return record;
  }
  return {
    async getProgress(puzzle) { return getRecord(load(),puzzle); },
    async getHistory({ startDate, endDate }) {
      parseDateKey(startDate);
      parseDateKey(endDate);
      if (startDate > endDate) throw new Error('Invalid Daily history range.');
      const schema = load();
      return Object.values(schema.byPuzzleId).flatMap(bucket => Object.values(bucket))
        .filter(record => record.dateKey >= startDate && record.dateKey <= endDate)
        .sort((a,b) => a.dateKey.localeCompare(b.dateKey) || a.puzzleId.localeCompare(b.puzzleId));
    },
    async recordActivity(puzzle, attemptId) {
      return update(puzzle, previous => {
        const playedAt = now();
        const found = previous.attempts.find(attempt=>attempt.id===attemptId);
        const attempt = {...(found ?? {id: attemptId, startedAt: playedAt}), lastPlayedAt: playedAt};
        return {...previous, lastPlayedAt: playedAt, attempts: [...previous.attempts.filter(item=>item.id!==attemptId),attempt]};
      });
    },
    async completeAttempt(puzzle, attemptId, result) {
      if (!validResult(result)) throw new Error('Invalid Daily result.');
      return update(puzzle, previous => {
        const completedAt = timestamp(result.completedAt);
        const best = {...result, completedAt};
        const priorAttempt = previous.attempts.find(attempt=>attempt.id===attemptId);
        const incoming = {...emptyProgress(puzzle), completed: true, firstCompletedAt: completedAt, best, lastPlayedAt: completedAt,
          attempts: [{id: attemptId, startedAt: priorAttempt?.startedAt ?? completedAt, lastPlayedAt: completedAt, completedAt, result: best}],
        };
        return mergeDailyProgress(previous,incoming);
      });
    },
  };
}

export const dailyProgressService = createDailyProgressService();
