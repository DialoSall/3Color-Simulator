# Gameplay cleanup and bundle audit

Measured November 4, 2026, starting from `main` at `c6498e8`, using installed
Vite 8.0.16. This change removes dead styles and extracts small pure utilities;
it does not change routes, gameplay orchestration, dependencies, or bank loading.

## Verified dead styles

Removed 26 complete rule blocks and four dead branches from mixed selector lists
(30 selector branches total), covering these 12 classes:

`hero`, `heroText`, `homeHero`, `homeGrid`, `modeCard`, `backButton`,
`levelMapHeader`, `quickInstructions`, `instructionIcon`, `dimmedVertex`,
`vertexLabel`, and `rules`.

Also removed the unused `--vertex-label` declaration from both appearances.
The SVG text rendering that consumed it was removed in an earlier change.

Verification covered all `src` JavaScript/JSX, development preview code,
`index.html`, and public HTML, then manual inspection of conditional class lists,
template strings, and DOM operations. These classes have no runtime producers.
NavLink's framework-generated `.active` state was explicitly retained despite
having no literal class assignment. Used selectors and their cascade remain intact;
no attempt was made to consolidate older declarations that still affect rendering.

Isolated Chrome checks found zero matches for the removed selectors across the
homepage, tutorial steps, campaign map/completion, Daily calendar/completion,
Custom settings/solved state, developer preview, fullscreen, and mobile tracing.
Sampled computed styles were identical when the original stylesheet was injected
for comparison, with animations disabled for stable measurements.

## Small utility extraction

`src/utils/gameplay.js` now owns:

- `COLOR_CYCLE` and `cycleVertexColor(vertex, vertexId)`: the same null → red →
  blue → yellow → null cycle; other vertices retain their references.
- `cloneGraph(graph)`: the identical Campaign/Daily clone of the graph object,
  vertex objects, and edge pairs. Existing colors are retained, and metadata
  references remain shallow. Resets still clone each mode's pristine source.
- `formatGameTime(milliseconds)`: the identical Campaign/Daily millisecond display
  below one minute and minutes/seconds display afterward, including long games.

Intentionally left in each mode:

- Timer effects, completion guards, sounds, tutorial gating, analytics, and storage.
- Recolor/visited-vertex bookkeeping and the increase-only conflict-sound decision.
  These small stateful sequences are clear in context; combining them would couple
  mode-specific transitions and make their ordering harder to review.
- Campaign's snapshot update and Daily/Custom's functional state updates. Their
  existing update semantics were preserved rather than normalized.
- Custom's local `resetGraphColors`, which clears current vertex colors while
  retaining edges. This differs from cloning Campaign/Daily's source graph, so it
  was not forced into the clone helper.

Relevant source line counts (including blank lines/comments):

| File | Before | After |
| --- | ---: | ---: |
| App.css | 1,347 | 1,184 |
| LevelMode.jsx | 632 | 595 |
| DailyMode.jsx | 455 | 419 |
| CustomMode.jsx | 364 | 349 |
| New gameplay.js | 0 | 28 |
| Total above | 2,798 | 2,575 |

## Production output

Rounded decimal kB from the normal Vite build, including Vite's gzip estimates:

| Asset | Before | After | Before gzip | After gzip |
| --- | ---: | ---: | ---: | ---: |
| Main JS | 1,434.02 | 1,433.55 | 285.53 | 285.47 |
| Main CSS | 31.87 | 29.62 | 7.21 | 6.81 |

There is still one main production JS chunk. The >500 kB warning remains. The
cleanup is primarily a maintainability improvement, not a substantial loading
optimization. The PWA still precaches 14 entries (about 1,932.95 KiB after cleanup).

A temporary instrumented build recorded Vite's per-module `renderedLength` without
changing repository configuration. Largest groups in that baseline audit:

| Group | Rendered characters before chunk minification, approximately |
| --- | ---: |
| Designed Daily bank, 364 records | 1,123,500 |
| Original generated safety bank, 365 records | 893,800 |
| React DOM | 458,700 |
| React Router | 94,400 |
| Campaign level data | 33,100 |
| React and scheduler | 25,500 |
| Vercel Analytics | 4,100 |

These are intermediate module sizes, not separately downloadable or gzipped
assets. They establish the largest contributors; they must not be added to the
minified chunk size or treated as precise network savings.

### Eager Daily data

`dailyPuzzles.js` eagerly imports both complete banks, the historical records,
and overrides: 732 puzzle records, although only one graph is needed on entry.
Solver metrics and generation metadata also ship inside the records. The module
deep-freezes the catalog and builds lookup maps during evaluation. That adds
startup work, though CPU/memory cost was not profiled in this audit.

App imports all modes eagerly. In addition, HomeScreen and useDailyHistory import
the Daily catalog directly. Thus all React app routes currently pay the bank cost,
including Campaign and Custom. Lazy route components alone could defer mode-only
UI, random generation, sounds, and campaign data, but would leave the dominant
bank payload on the homepage's critical path.

Recommended next performance task: separate lightweight schedule/identity/history
metadata from graph payloads, then load the selected effective graph or month on
demand. Keep the original safety bank in the repository for validation and exact
reproduction; preserve retired IDs/progress, historical compatibility, and the
official effective schedule. Decide offline/PWA caching requirements as part of
that work, since merely splitting files while precaching all chunks would still
download them in the background. Profile cold-start behavior on a slower phone,
then evaluate route-level splitting as a complementary change.

No Daily lazy loading, route splitting, runtime metadata stripping, cache changes,
or public API changes were implemented here.

### Dependencies

All four declared production dependencies are used: React, React DOM,
react-router-dom, and @vercel/analytics (mounted in main.jsx). No unused declared
production dependency was found. The local installation reports extraneous
node_modules entries, including duplicated directory names ending in ` 2`; they
are not imported in the production module graph. This audit did not prune or
modify the local installation or dependency versions/lockfile.

## Validation

All requested commands passed, without disabling rules or weakening checks:

```text
npm run lint
npm run build
npm run validate:levels
npm run validate:daily
npm run test:daily
npm run test:retention
npm run test:homepage
npm run test:tutorial
npm run test:sharing
npm run test:preview
npm run test:gameplay
npm run check:preview-production
npm run check:daily-generation
npm run check:daily-designs
npm run check:launch-fox
```

43 tests passed: Daily 13, retention 12, homepage 2, tutorial 4, sharing 7,
preview 1, and new gameplay contracts 4. All 30 campaign levels passed with zero
errors/warnings. Both frozen banks reproduced exactly and Fox's integrity check
passed.

Browser regressions also covered real conflict creation/removal, full color cycles,
recolor/reset counts, Campaign unlocks/tutorial replay, silent shared-seed loading,
Custom repeat completion, Daily attempts/streak/replay, theme/settings styles,
completion sound counts, mobile hold-to-trace/zoom, fullscreen, and developer
preview progress isolation. Audio cues were instrumented; physical speaker output
and physical-device behavior were not verified.
