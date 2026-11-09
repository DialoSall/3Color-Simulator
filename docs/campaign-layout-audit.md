# Campaign layout audit

Baseline: merged `main` at `085618b`, reviewed November 9, 2026. The audit covers
Levels 20–30 with the existing circle sizes, renderer, fit, tracing and zoom.

## Initial findings

Crossings count proper intersections between edges without shared endpoints.
Clearance is the shortest distance from an edge to an unrelated circle's center;
subtract the circle radius (26 units, or 25 for Levels 29–30) for visible space.
“Crowded” counts edges within radius + 12 units of an unrelated center. The old
validator's radius + 4 threshold alone misses several visibly cramped layouts.

| Level | Crossings | Min spacing | Min clearance | Crowded edges | Assessment |
| --- | ---: | ---: | ---: | ---: | --- |
| 20 · The Gatehouse | 35 | 156.47 | 30.08 | 4 | Broad spacing, but gates cross through the middle. Follow-up. |
| 21 · Mirror Maze | 15 | 142.70 | 35.94 | 1 | Most readable; triangle groups already visible. Retain. |
| 22 · Bridge Locks | 42 | 143.96 | 30.06 | 3 | Long bridges obscure their triangle groups. Follow-up. |
| 23 · Three Chambers | 46 | 127.53 | 30.11 | 4 | Chambers do not read as distinct regions. Follow-up. |
| 24 · Circuit Board | 20 | 141.03 | 34.60 | 1 | Grid communicates useful structure; one long edge grazes a circle. Retain. |
| 25 · Lockstep | 55 | 82.38 | 30.13 | 8 | Tight inner pair and long interleaved triangles. **Rework.** |
| 26 · Chain Reaction | 23 | 136.95 | 31.03 | 3 | Chain is identifiable; some shortcut crossings. Retain for now. |
| 27 · Signal Tower | 79 | 121.02 | 30.13 | 11 | Triangle rows and distant shortcuts form a central mesh. **Rework.** |
| 28 · Circuit Breaker | 72 | 82.66 | 30.22 | 8 | Compressed upper vertices and long diagonals hide the routes. **Rework.** |
| 29 · Core Pressure | 203 | 83.53 | 29.02 | 16 | Core and outer routes overlap; most edges cross. **Rework.** |
| 30 · Endgame Relay | 347 | 84.38 | 29.00 | 21 | Relay groups disappear in a dense mesh; tight bottom pair. **Rework.** |

All audited graphs have separated circles, but several edges leave only 4–5
graph units outside an unrelated circle. Fit scales a 900×650 board down on a
phone, making these gaps much harder to read. Raw crossing counts are compared
within each level, not used as a measure of mathematical difficulty.

Levels 28, 29 and 30 exceed the planar simple-graph edge bound `3V − 6` by 3,
4 and 11 edges respectively. Some crossings are unavoidable. These are lower
bounds, not claimed exact crossing numbers; no planar drawing or global optimum
is claimed for any level. Coordinate-only reductions demonstrate avoidable
crossings while preserving every coloring constraint.

## Approach

Daily's authored silhouettes, spacing checks, and static output are useful
precedents. Its generator can reject/add connections, which is unsuitable here:
Campaign topology must stay fixed. Reuse the offline geometry/solver utilities
for measurement only, then author static Campaign coordinates. Do not import
Daily banks, motifs, themes, or generators into gameplay.

Campaign imports one small static level array. It clones the active graph when
loading/resetting, and coloring replaces vertex objects without duplicating the
whole bank. Timer updates do rerender the renderer, which rebuilds small maps,
sets and edge ordering. This is existing work on at most 18 circles/59 edges;
coordinate cleanup does not justify a shared renderer/state refactor.

## Revised layouts

Only `x`/`y` in Levels **25, 27, 28, 29 and 30** changed. Vertex IDs/order,
connections/order, names, difficulty labels, descriptions, dimensions, initial
colors and all other levels are unchanged. Exact non-coordinate hashes for all
30 levels and full hashes for untouched levels guard this against regressions.
The existing eight seeded solver probes produce identical difficulty metrics.
This proves unchanged mathematical constraints, not identical human solve times:
removing visual confusion is the intended improvement.

| Level | Crossings before → after | Min spacing before → after | Min clearance before → after | Crowded edges before → after |
| --- | ---: | ---: | ---: | ---: |
| 25 · Lockstep | 55 → 15 | 82.38 → 132.10 | 30.13 → 44.27 | 8 → 0 |
| 27 · Signal Tower | 79 → 21 | 121.02 → 118.85 | 30.13 → 49.64 | 11 → 0 |
| 28 · Circuit Breaker | 72 → 21 | 82.66 → 140.00 | 30.22 → 56.04 | 8 → 0 |
| 29 · Core Pressure | 203 → 54 | 83.53 → 114.02 | 29.02 → 44.87 | 16 → 0 |
| 30 · Endgame Relay | 347 → 78 | 84.38 → 106.10 | 29.00 → 41.21 | 21 → 0 |

- **Lockstep:** left, middle and right triangle groups; aligned top vertices,
  a real horizontal connection chain through the middle, and a vertical right edge.
- **Signal Tower:** staggered central triangles between separated side routes;
  no longer a large pile of long horizontal chords. Its minimum spacing is
  slightly lower, but stays above 118 units while edge clearance rises markedly.
- **Circuit Breaker:** a connected vertical spine (3–7–11–10), a separate upper
  right triangle, and a lower left cluster. Alignment follows existing edges.
- **Core Pressure:** distributed interior constraints within an open perimeter;
  hubs and triangle attachments are separated instead of sitting on shortcuts.
- **Endgame Relay:** broad outer routes around staggered interior relays, leaving
  room around every unrelated circle. Still the densest board, with 59 edges.

Candidates were explored offline using the locally installed Graphviz and a
seeded coordinate search penalizing crossings, close vertices, edge near-misses
and shallow crossing angles. Coordinates were then spaced/aligned and checked in
the real renderer. No solution/color assignment was used to place vertices.
Only the selected integer coordinates are retained in the application. Graphviz
and the search are not application/build dependencies, and no authoring engine
runs during gameplay. No contour edges, curved edges or decorative links were added.

## Visual review

Real production-renderer screenshots, light appearance, at **1440×1000** and
**390×844**; contact sheets scale screenshots for comparison. WebP copies are
lossless. They include the unedited levels for context and no visible vertex IDs.

| View | Before, all Levels 20–30 | After, all Levels 20–30 | Five edited levels side by side |
| --- | --- | --- | --- |
| Desktop | [Before](campaign-layouts/before-desktop.webp) | [After](campaign-layouts/after-desktop.webp) | [Comparison](campaign-layouts/comparison-desktop.webp) |
| Mobile | [Before](campaign-layouts/before-mobile.webp) | [After](campaign-layouts/after-mobile.webp) | [Comparison](campaign-layouts/comparison-mobile.webp) |

The browser check confirms no clipped circles, page horizontal overflow, vertex
labels, or Daily payload requests for any of the 22 level/viewport combinations.
Graph fit remains approximately 886×640 desktop and 339×245 mobile. Circle sizes
and hit targets are unchanged: the smallest circles at phone fit are about
18.8 CSS pixels wide, so existing zoom/fullscreen remains useful for precision.
Normal vertical page scrolling remains. Fullscreen and the responsive shell
were not redesigned. A physical-device ergonomics review remains useful.

The five revised levels also pass actual mouse/touch input at circle centers,
keyboard coloring, conflict display, reset, zoom/fit, and a complete three-color
solve in both viewports. An isolated profile with unlocked levels is used; real
player storage is never touched. Existing saved-progress keys and routes are unchanged.

## Loading, memory and bundle impact

Same Vite version, production configuration and dependency tree before/after:

| Measurement | Before | After |
| --- | ---: | ---: |
| Initial JS, Vite minified | 392.27 kB | 392.27 kB |
| Initial JS, Vite gzip | 109.44 kB | 109.39 kB |
| Campaign data as compact JSON | 21,778 bytes | 21,779 bytes |
| Static bank vertices / edges | 305 / 650 | 305 / 650 |

The compression difference is negligible. There is no claimed heap/CPU reduction:
renderer code, object counts, cloning and allocation behavior are unchanged.
Static coordinates avoid introducing any per-frame layout work, extra graph
copies, or retained layout caches. The audit, baseline hashes and screenshots
are outside the browser dependency graph. Daily's 15 monthly JSON payloads stay
lazy, outside JavaScript and the PWA precache; production checks still enforce it.

Potential follow-up: profile GraphCanvas during the 25 ms timer updates before
considering memoization. Its current event callbacks and tutorial props change
identity, so a superficial memo wrapper would not fix the work. That change
would affect all modes and is intentionally outside this coordinate cleanup.

## Validation and repeatable inspection

```sh
npm run test:campaign-layouts
npm run validate:levels
npm run lint
npm run build
npm run check:campaign-layouts:browser -- review /private/tmp/3color-campaign-layouts
```

The browser command requires Chrome (or `CHROME_PATH`) and uses the existing
Chrome DevTools harness. It writes individual PNGs, desktop/mobile contact
sheets and raw viewport measurements to the chosen directory. It runs against
the latest production build; no production preview/debug UI was added.

The existing development tool also opens any level without unlocks:
`/dev/preview?mode=campaign&level=25` under `npm run dev`.

Passed: lint, production build/postbuild checks, all 30 level validations with
zero errors/warnings, the three new layout tests, all 82 existing non-browser
tests, 8 analytics tests, 8 Daily browser results, and the CrazyGames build/checks
and 6 browser results. Daily validation, runtime integrity, generation/design
reproduction, and launch Fox checks also pass. No Daily source data changed.

## Remaining priorities

1. **23, then 22:** expose chamber/bridge groupings; their 46/42 crossings now
   stand out relative to the revised boards.
2. **20:** more clearance around the gates and fewer central crossings.
3. **29–30:** improved considerably, but still intrinsically dense. Some crossings
   are proven unavoidable; the exact minimum is unknown. Do not remove shortcuts
   or constraints to force a cleaner picture.
4. **24 and 26:** minor near-misses/shortcuts; lower priority. Level 21 can stay.
