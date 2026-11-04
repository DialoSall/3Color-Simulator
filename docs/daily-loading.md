# Daily loading and offline delivery

## Runtime and source data

The former import chain was App → HomeScreen/DailyMode/useDailyHistory →
dailyPuzzles → both full graph banks, historical graphs, and overrides. Progress
migration also imported historical graph data. All 732 source records were
evaluated eagerly, although only 367 unique identities serve the effective
427-date schedule.

The runtime now has two layers:

- `src/data/dailyIndex.js` exposes synchronous metadata lookup and the unchanged
  date → ID schedule. Entries contain date, stable ID, name, difficulty, source,
  version, month reference, and a development-preview design flag. No coordinates,
  edges, solver metrics, themes, or solutions are in this index. Two tiny legacy
  ID/date records preserve progress migration without importing historical graphs.
- `src/data/dailyPuzzles.js` asynchronously loads the selected month's static JSON
  through `src/services/dailyPuzzleLoader.js`. Shared in-flight promises and
  immutable puzzle results avoid repeated requests within a session. Payloads
  retain every original effective puzzle field, including themes and development
  review metrics. Historical repeated IDs still receive the selected date label.

`scripts/lib/dailyCatalog.js` keeps the old synchronous full-source API for Node
validation, reproduction, and authoring. The 365 original safety records are no
longer in the browser dependency graph or runtime assets. Designed records and
handcrafted/historical graphs enter runtime JSON only when effectively scheduled.
The original banks, historical snapshot, override, IDs, and integrity ledger are
unchanged. Calendar, history, streaks, and progress use only the lightweight layer.

## Derived files and authoring

`npm run generate:daily-runtime` deterministically derives:

- `src/data/daily/runtimeIndex.generated.js`
- `public/daily/YYYY-MM.<16-character-SHA256>.json`

There are currently 15 monthly files: two small pre-launch compatibility months,
the launch month, eleven subsequent months, and the final partial November.
Historical identities are deduplicated within each month. Only effective scheduled
IDs are emitted; superseded generated graphs remain source-only.

After any supported source/schedule change, regenerate and commit these derived
files alongside the authoring changes. `check:daily-runtime` compares every output
byte, rejects extra/stale payloads, and runs before every build. Existing
reproduction, quality, ledger, and scheduling safeguards remain in force.

The runtime `getDailyPuzzleForDate` and `getDailyPuzzle` APIs now return Promises;
callers needing only an identity should use synchronous `getDailyMetadataForDate`.
Node tools import the synchronous catalog instead. No persistence schema or
account-ready progress-service method changed.

## UI and failures

`useDailyPuzzle` ignores responses for dates no longer selected, provides explicit
retry, and immediately reuses a loaded date on warm navigation. Homepage metadata,
completion, streak, and CTA work before graph delivery. The preview reserves the
same space while loading or unavailable. DailyMode mounts its existing game only
after the graph arrives, so loading cannot start attempts, timers, or sounds.
Calendar navigation itself loads no graphs; selecting a date loads its month.
An uncached/unavailable month leaves the date/calendar and navigation usable and
shows a reconnect/retry message. There is no substitute puzzle or random fallback.

## Offline/PWA

Successful, validated JSON responses enter the persistent named CacheStorage cache
`3color-daily-data-v1`, even before a service worker controls the first visit.
This cache is separate from Workbox's app-shell precache and survives app-shell
updates. Cache reads precede network requests. Failed, malformed, or mismatched
responses are not cached; failed in-memory requests are evicted so retry works.

Workbox explicitly excludes `daily/**`; installation never downloads the year.
`check:daily-production` verifies hashed assets and rejects any Daily file in the
built precache or bank seed data in initial JS. Navigation fallback uses the actual
precached `/index.html` (the former `/` target did not match that cache entry).
JSON paths are excluded from navigation fallback.

Hashed filenames get `public, max-age=31536000, immutable` headers through
`vercel.json`, using Vercel's [header configuration](https://vercel.com/docs/project-configuration/vercel-json)
and [cache-control support](https://vercel.com/docs/caching/cache-control-headers).
New source bytes generate a new URL. If an app update changes a month hash and the
new file is unavailable, a cached earlier revision can serve the requested puzzle
only when its stable ID, version, source, name, and difficulty match the current
index. It cannot substitute an old override identity, and old bytes are never
stored under a new hash URL.

Offline use requires an initial online shell load and a loaded month. Browser
storage denial, quota eviction, private-mode policies, or clearing site data can
remove offline availability; online play still works if cache writes fail. Cached
months are retained without an arbitrary short expiration; the finite current
bank totals about 709 kB uncompressed. A full month downloads when any of its dates
is selected, including its unpublished graphs, as the original eager bundle did.
Public calendar/date restrictions remain unchanged. This is delivery optimization,
not protection of future puzzle data.

## Measurements

November 4, 2026; baseline merged main `71c6ab0`, Vite 8.0.16. Decimal kB,
using Vite's normal minified/gzip report for the initial bundle:

| Initial JS | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Minified | 1,433.55 kB | 387.29 kB | 73.0% |
| Gzip | 285.47 kB | 107.70 kB | 62.3% |

One main application JS chunk remains; no route splitting or dependencies were
added. Build output contains 15 on-demand JSON files and 31 total files. Workbox
precaches 14 shell/assets entries (about 911.84 KiB), with zero Daily JSON files.

Monthly sizes below use Node's `gzipSync` on each emitted JSON file (not JS chunks):

| Month | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| 2026-09 | 2,040 | 773 |
| 2026-10 | 1,464 | 611 |
| 2026-11 | 53,054 | 8,747 |
| 2026-12 | 59,778 | 9,801 |
| 2027-01 | 60,094 | 9,784 |
| 2027-02 | 54,068 | 8,815 |
| 2027-03 | 59,640 | 9,805 |
| 2027-04 | 58,129 | 9,545 |
| 2027-05 | 59,902 | 9,830 |
| 2027-06 | 58,059 | 9,505 |
| 2027-07 | 60,036 | 9,847 |
| 2027-08 | 59,537 | 9,761 |
| 2027-09 | 58,335 | 9,530 |
| 2027-10 | 59,515 | 9,688 |
| 2027-11 | 5,628 | 1,467 |
| Total | 709,279 | 117,509 |

The launch homepage fetches November's 53.05 kB raw / 8.75 kB gzip file after shell
startup, rather than importing the year. Gzip sizes are estimates, not a measured
production CDN transfer; deployed headers/compression require deployment checking.
Frameworks, Campaign data, and all mode components remain in the initial JS.

## Verification

All 52 automated tests pass: Daily foundation 13, retention 12, homepage 2,
tutorial 4, sharing 7, developer preview 1, gameplay 4, and Daily loading 9.
The new loading tests compare all 427 effective objects with the source catalog,
cover graph-free metadata/progress/calendar behavior, cache reuse/concurrency,
missing/corrupt payloads, offline persistence, retry, storage denial, and cached
month compatibility after an override changes the month hash.

Lint, build, all 30 level validations, Daily quality/integrity validation, runtime
byte reproduction, original/designed bank reproduction, launch Fox verification,
and production preview/precache guards pass.

Isolated Chrome checks exercised delayed loading, stable homepage geometry,
calendar access before graph delivery, no loading-time attempts/timers/audio,
Fox palette/completion/streak with old generic progress preserved, same-month
reuse, and out-of-order responses. With the local production server stopped,
offline reload restored the shell and cached graph; uncached history remained
usable with a retry message, then recovered after reconnecting. The precache had
zero Daily files. Campaign/tutorial and Custom worked offline. Development
preview loaded a future graph, enabled full JSON export, reused its month on
Next, and retained all Campaign unlocks, accessibility labels, light/dark mode,
and mobile layout. No browser runtime exceptions occurred in the passing checks.

Live Vercel headers/compression, a physical phone installation, and physical audio
output were not verified; these checks used an isolated desktop Chrome profile
and a mobile viewport.

## Files changed

- Runtime: `src/data/dailyIndex.js`, `src/data/dailyPuzzles.js`,
  `src/data/daily/runtimeIndex.generated.js`, `src/services/dailyPuzzleLoader.js`,
  `src/hooks/useDailyPuzzle.js`.
- Consumers: `src/components/HomeScreen.jsx`, `src/components/DailyMode.jsx`,
  `src/dev/DevPreview.jsx`, `src/hooks/useDailyHistory.js`,
  `src/services/dailyProgress.js`, `src/App.css`.
- Build/delivery: `scripts/lib/dailyCatalog.js`, `scripts/generateDailyRuntime.js`,
  `scripts/checkDailyProduction.js`, `package.json`, `vite.config.js`, `vercel.json`,
  and the 15 generated `public/daily/*.json` assets listed by month above.
- Tests/authoring: `scripts/dailyLoading.test.js`,
  `scripts/dailyFoundation.test.js`, `scripts/dailyRetention.test.js`,
  `scripts/homepage.test.js`, `scripts/scheduleDaily.js`, `scripts/validateDaily.js`.
- Documentation: `README.md`, `docs/daily-puzzles.md`,
  `docs/technical-debt-audit.md`, and this file.
