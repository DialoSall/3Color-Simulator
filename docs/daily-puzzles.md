# Daily puzzle foundation

## Schedule and identity

`src/utils/dailyDate.js` owns the official America/New_York date, date-label
arithmetic and next-midnight calculation. DST days can be 23 or
25 hours. DailyMode also refreshes on wake/focus and remounts the game when the
canonical day changes; it does not carry a timer or colors into the next puzzle.

`src/data/dailyIndex.js` performs synchronous exact metadata lookup without graph
payloads. `src/data/dailyPuzzles.js` provides asynchronous graph lookup, fetching
only the selected content-hashed month and freezing the returned record. The full
source catalog lives in Node-only `scripts/lib/dailyCatalog.js`, which combines
the original/designed banks, historical records/schedule, and overrides for
validation and authoring. A missing date raises `MissingDailyPuzzleError`;
DailyMode displays an unavailable message. There is no
random generation, rolling latest-puzzle fallback, or external dependency for
official Daily selection.

The initial bank covers **2026-11-04 through 2027-11-03**, inclusive: 55
Challenging, 219 Hard, and 91 Expert puzzles (15.1% / 60% / 24.9%). Each has a
stable date-based ID, version, source, difficulty, measured metrics, dimensions,
vertices, and edges. IDs are independent of array position. Optional themes
supply the puzzle's initial palette; players can still select a preset or custom
colors. Original version-1 generated puzzles use the player's existing palette
preference; recognizable designs supply their motif's initial palette.

`daily-001` and `daily-002` (Fox Face) retain all original fields and graph data;
version/source/difficulty metadata is additive. The old repeating schedule from
2026-09-03 through 2026-11-03 is explicitly snapshotted in `history.js`, including
the repeated IDs. It is never extended. These historical exceptions predate the
one-new-ID-per-date generated bank.

The player-facing launch is **November 4, 2026**, with **Fox Face** under the new
handcrafted override ID `daily-2026-11-04-fox-v2` (version 2). Its vertices, edges,
name, description, dimensions, and Fox palette match historical `daily-002`, which
remains unchanged. The owner-authorized exception is pinned in
`scripts/launchFoxOverride.js`; `npm run check:launch-fox` verifies the record and
integrity lock. Normal scheduling still rejects today/past dates. Original
`daily-2026-11-04-v1` remains in the frozen safety bank, and any progress for that
ID stays separate: it cannot mark the launch Fox completed or earn Fox streak credit.

The compact calendar only selects scheduled dates from launch through today's
New York date. `/daily` follows today; `/daily/YYYY-MM-DD` selects an exact public
date. Historical compatibility data before launch stays internal; no puzzle
numbers are exposed. Past puzzles use the same graph lookup, progress hook,
and gameplay.

`dailyRetention.js` derives current/best streaks from `firstCompletedAt`, converted
to America/New_York. Only first completions on the puzzle's own date earn credit;
late solves still mark the calendar completed. Pre-launch, future, mismatched
legacy puzzle IDs, and estimated migration timestamps cannot earn credit. An
incomplete today preserves yesterday's consecutive run. No streak state is stored.
The calendar supports keyboard navigation, Escape/outside dismissal, and focus
restoration. Calendar open, past selection, and return-to-Today events reuse
`trackEvent`.

## Public date URLs

The route parameter is the only selected-date state. Calendar selections navigate
to `/daily/YYYY-MM-DD`, including a selection of today. Back to Today navigates
to `/daily`. Browser back/forward restores the route's graph; an explicit date
stays fixed across New York midnight while `/daily` advances. Streak/history
queries remain anchored to the actual current New York day, independent of the
selected date. Merely viewing a URL does not create an attempt or streak credit.

DailyMode applies `canSelectDailyDate` before metadata lookup or lazy loading.
Malformed, extra-segment, pre-launch, future, and missing dates show a generic
unavailable message with a link to today's Daily. They render no puzzle metadata
and request no graph payload. A valid but offline uncached month retains its
existing reconnect/retry state and working calendar.

`src/utils/dailyUrl.js` exports `getDailyPath(dateKey)` for client navigation and
`getDailyUrl(dateKey)` for an absolute `https://3color.app/daily/YYYY-MM-DD` URL.
These validate the date label; public availability remains DailyMode's policy.
Daily result sharing uses `getDailyUrl` for the exact puzzle date, including today.

`daily_history_select` fires once per historical route selection, including direct
links and back/forward, rather than also firing in the calendar handler.
`daily_return_today` retains button/calendar intent and adds the destination
`date_key`; `daily_calendar_open` is unchanged. AnalyticsTracker recognizes all
Daily routes as one mode, so moving between Daily dates does not add `game_start`.

The existing Vercel catch-all rewrite serves the shell on direct load/refresh.
Workbox's existing `/index.html` navigation fallback also handles dated URLs;
hashed monthly JSON paths remain excluded and are never precached. Automated
production-browser checks cover direct loads, refresh, back/forward, calendar
URLs, analytics counts, lazy-month reuse, late completion, and offline dated
navigation with the local server stopped. Run `npm run test:daily-routes` and,
after building, `npm run test:daily-routes:browser`. The latter requires Node 22+
and installed Chrome (or `CHROME_PATH`), uses a temporary profile/ephemeral port,
and leaves the normal development server and browser profile untouched. Live
Vercel deployment behavior still requires checking after publication.

## Daily result sharing

`src/utils/dailyResultSharing.js` builds the spoiler-free result from puzzle
metadata and the existing saved-best selection, without changing persistence.
The compact text contains a short date, puzzle name/difficulty, `m:ss` best time,
and recolors. Resets, puzzle numbers, graph data, and colors are omitted.
Only today's share can add `🔥 N-day streak`; DailyMode supplies a positive streak
only after confirming today's on-time credit through its existing history service.
Historical shares never attach the player's current streak.

Native sharing supplies title `3Color Daily`, the result body, and its dated URL
as separate Web Share fields. Clipboard and manual-copy fallback append that same
URL to the same body, once. Native cancellation keeps the previous feedback and
does not copy or track success; other native failures try the clipboard. If both
APIs fail, the completion card displays a multiline result for manual copying.

`daily_result_share` fires through `trackEvent` only after a native-share or
clipboard promise succeeds, with `date_key`, `is_today`, `difficulty`, and
`share_method` (`native` or `clipboard`). Canceled/failed shares do not emit it.
Run `npm run test:daily-sharing` for format/API/analytics tests. The production
browser suite also exercises sharing with API stubs, today's credited streak,
historical omission, and a slower replay that must retain the saved best.

## Recognizable designs and development review

The original year-long bank remains frozen as an offline safety/reference bank.
The original November 4 record remains `daily-2026-11-04-v1`, beneath the launch
Fox override. All 364 later dates use `daily-YYYY-MM-DD-design-v2` identities with
`version: 2`, preserving each future date's difficulty band. With the Expert Fox
replacing the Hard launch puzzle, the effective year has 55 Challenging, 218 Hard,
and 92 Expert puzzles; the original safety bank's calibrated quotas are unchanged.

`scripts/lib/dailyDesigns.js` contains 22 authored motifs: Rocket, Owl, Butterfly,
Sailboat, Pine Tree, Fish, Cat, Turtle, Crab, Robot, Star, Heart, Crown, Kite,
Hourglass, Mountain, Mushroom, Umbrella, Lantern, Coffee Cup, Castle, and Diamond.
Each specifies deliberate point placement, required contour connections, and a
palette. Small seeded scale variations preserve the silhouette. Required contours
are real graph edges; additional seeded constraints produce different puzzles.
The canvas emphasizes contours while keeping all other connections available for
coloring and tracing. There are no fake decorative connections.

The version-2 offline generator finds a random seeded proper coloring of the
required contour graph, fills compatible edges, and applies the same solver bands,
three-color necessity, connectivity, density, and duplicate-topology checks. It
examined 10,200 candidates for 364 designs. Authored motifs allow a minimum
72-unit point spacing (still above node diameters); the 34-unit edge clearance
remains mandatory. Version-1 grid layouts retain their 100-unit spacing rule.

```bash
npm run generate:daily-designs
npm run check:daily-designs
npm run test:preview
```

By default existing design output is immutable. During authoring, the explicit
`--refresh-unpublished` flag permits revised future designs/metadata; it rejects
any changed record dated today or earlier, and always preserves through
2026-11-04. Once a motif version has published dates, changing that version's
past output is rejected; use a new version or a future handcrafted override.
The integrity ledger records both banks and the selected official IDs. A missing
designed date fails validation rather than silently switching back to the grid.

For review, run `npm run dev` and open `/dev/preview`. The tool selects any exact
Daily date or any of the 30 campaign levels without requiring unlocks. Daily
preview uses a separate in-memory progress service. Campaign preview explicitly
skips real progress loading/writes and allows all levels; normal campaign routes
retain their locks. Preview results disappear when leaving/reloading the tool,
or when Reset test progress is selected. Shared appearance/palette/mute preferences
continue to work. Copy puzzle JSON supports review/export, not publication.

The route/link is guarded with `import.meta.env.DEV`, and its module/styles are
lazily imported only in development. Production builds run
`check:preview-production` after building to reject leaked preview code/styles.
Development preview parameters cannot unlock campaign levels or bypass public
Daily date restrictions in production. No puzzle editor was added.

## Offline generation and calibration

```bash
npm run generate:daily          # create/reproduce frozen files; refuses changed existing output
npm run check:daily-generation  # regenerate in memory, compare every output byte, write nothing
npm run validate:daily         # also runs automatically before npm run build
npm run test:daily
```

`generateDaily.js` uses seeded PRNGs, no Math.random or wall-clock inputs. Each
candidate seed incorporates the bank version, date, and candidate number. The
first accepted candidate matching that date's deterministically shuffled quota
is frozen. Generation examined 10,886 candidates; it fails instead of relaxing
quality thresholds if a date cannot be filled. All output is prepared and checked
before any bank file is written. Existing generated files cannot be overwritten
with different data, even if a solver/generator implementation changes.

The evaluator measures first-solution search using the existing campaign
validator's degree-ordered backtracking approach, with eight deterministic tie
orders to reduce vertex-ID sensitivity. It records recursive nodes, backtracks,
branch decisions, forced-move fraction, edge density, and cycle rank. The score is
`meanNodes + 4 × meanBacktracks + 2 × meanDecisions`.

| Campaign level | Mean nodes | Mean backtracks | Mean decisions | Score |
| --- | ---: | ---: | ---: | ---: |
| 25 — Lockstep | 65 | 48 | 18.875 | 294.750 |
| 26 — Chain Reaction | 40.375 | 25.375 | 6.625 | 155.125 |
| 27 — Signal Tower | 16 | 0 | 5.125 | 26.250 |
| 28 — Circuit Breaker | 21.5 | 4.5 | 1.625 | 42.750 |
| 29 — Core Pressure | 27.875 | 9.875 | 7.25 | 81.875 |
| 30 — Endgame Relay | 88.125 | 69.125 | 17.75 | 400.125 |

Sorted campaign scores set bands: Challenging `[26.25, 81.875)`, Hard
`[81.875, 294.75)`, Expert `[294.75, 400.125]`. Actual generated score ranges are
26.5–77.875, 82–290, and 295.75–396. These are reproducible solver proxies, not a
claim of measured human solving time; human playtesting is still needed.

Original version-1 candidates plant a balanced three-coloring, but an independent DSATUR-ordered
search verifies it. Connectedness and a non-bipartite check prove that exactly
three colors are required. Quality gates also enforce valid endpoints, unique
edges/vertices, minimum degree two, density 0.26–0.40, at least 100 units between
vertices, and 34 units of clearance between every edge and unrelated vertex.
Placement uses a seeded, jittered grid on an 1100×800 canvas; unsuitable edges
are excluded before selection. Observed minima are 113.952 and 34.002 units.

Isomorphism-invariant Weisfeiler–Leman signatures reject matching topologies,
including vertex relabelings. This conservatively rejects possible duplicates;
it cannot accept an isomorphic duplicate. Solver limits reject expensive cases.
Both frozen source banks remain checked in for validation/reproduction. Only
effective scheduled records are emitted as monthly runtime JSON; they are outside
the initial JS and PWA precache. See [Daily loading](daily-loading.md) for caching,
offline behavior, API compatibility, and production measurements.

## Integrity and future handcrafted puzzles

`integrity.json` locks both puzzle content (SHA-256) and date-to-ID assignments.
Validation checks every record and date, the complete 365-day range, uniqueness,
metadata, themes, graph/coloring/layout quality, stored metrics, calibration,
quotas, and today's coverage. Build fails on missing/changed data. Historical
graphs are exempt from the new generated-layout/difficulty thresholds.

Author a full JSON record with a new ID, dateKey, positive version, name,
description, difficulty, source, dimensions, uncolored vertices, and edges; theme
is optional. IDs begin with a letter/digit and use up to 128 letters, digits,
periods, underscores, colons, or hyphens. Then run:

```bash
npm run schedule:daily -- path/to/handcrafted-puzzle.json
npm run validate:daily
npm run generate:daily-runtime
npm run build
```

The command validates the graph and requires a **strictly future** date in the
bank. It updates only `overrides.js` and the integrity ledger, retaining the
underlying generated safety-net record. Today/past dates and reused IDs are
rejected. Refresh the derived runtime index/payloads, then review and publish
them with the override and ledger. Build checks reject stale derived files. Do not hand-edit the
ledger, historical snapshot, or generated data. IDs and published graph content
must never be recycled. The checks protect normal authoring workflows; trusted
repository owners can still deliberately edit both the data and its locks.

Before 2027-11-04, append a new versioned bank/range and extend validation;
do not regenerate or modify the existing year's published puzzles.

## Progress storage and migration

`src/services/dailyProgress.js` supplies Promise-based getProgress,
recordActivity, completeAttempt, and inclusive `getHistory({ startDate, endDate })`
methods. The history query returns records without exposing the storage schema;
`useDailyHistory` filters them against the public schedule and refreshes on saved
completion, calendar open, focus/visibility, and storage events. `useDailyProgress` serializes
operations and keeps persistence concerns out of DailyMode. A future authenticated
adapter can implement the same methods; `mergeDailyProgress` unions attempts by
client ID and applies the same best-result comparison. No accounts/backend exist.

The `3color-daily-progress-v1` JSON schema has `schemaVersion: 1` and a
`byPuzzleId[puzzleId][dateKey]` record containing:

- puzzleId, puzzleVersion, dateKey, completed, firstCompletedAt
- best: timeMilliseconds, recolors, resets, completedAt
- attempts: client IDs, startedAt, lastPlayedAt, and completion/result when known
- lastPlayedAt

An attempt starts on the first color move. Reset keeps the same attempt and
existing timer/reset semantics. Replay starts a fresh attempt on its next move.
Views, theme changes, and repeated completion effects do not add attempts. Best
ordering remains lowest time, then lowest recolors, then lowest resets; exact ties
retain the saved result. Writes occur on interaction/completion, not timer ticks.

The first service read migrates `3color-daily-completions` without deleting or
modifying that original key. Source IDs and original UTC date labels are retained;
legacy repeated IDs use separate date buckets. A legacy completion for Fox Face
cannot mark a different new puzzle on the same date complete. Missing source IDs
are resolved using the old selector only during migration. Unrecognized records
are retained under unmappedLegacy as well as in the original key.

Old storage only kept the best result. Migration can therefore preserve one known
completed attempt and its timestamp, not reconstruct all attempts or the true
first completion. If no valid timestamp exists, it uses noon UTC on the original
date as an explicit estimate. Migrated attempts carry `migrated`,
`startedAtEstimated`, and `timestampEstimated` flags. New attempts track these fields directly. Migration
is idempotent. If migration cannot be written, legacy bests stay readable and
migration is retried on the next load. Malformed/newer schemas or failures saving
new progress preserve the original data and produce a nonfatal message. When browser storage is
unavailable, the service can use session memory; it cannot sync or persist across
visits. Cross-tab simultaneous-write conflict resolution is not implemented yet.
