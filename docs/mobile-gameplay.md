# Mobile game shell refinement

Baseline: the **actual uncommitted `improvement/mobile-gameplay` working tree**
from the preceding redesign, captured before this refinement on November 9, 2026.
This is not a comparison against merged `main`. The retained appearance hook/view
and npm test command were already part of that local work.

## Final structure

Campaign, Daily and Random render a mobile game shell at widths up to 600px.
The desktop header, level map, duplicated titles/stat cards and bottom Settings
row are not mounted in that layout. Desktop still renders its existing layout.
Graph and completion elements are shared between the two views; mode-specific
coloring, attempts, timers, progression, sounds and result handling stay in each mode.

The shell uses `100dvh`, safe-area padding and a flex content region with
`min-height: 0`. The graph measures its actual allocated space minus guidance
and the thumb-control rail. There are no mobile height budgets such as
`100svh - 540px` or minimum-height cards around a small SVG. Tutorial guidance
stays immediately above the board. Normal boards are centered within the space
left by the compact title/timer/conflict header and bottom control rail.

One corner hamburger opens a native modal drawer containing game modes,
Campaign level selection, Daily calendar/streak/best information where relevant,
Random generation/sharing, settings and help/tutorial access. It is closed by
default. The drawer has a sticky close control, scrolling content and a backdrop.
Native modal behavior makes the background inert and contains keyboard focus;
Escape/backdrop/close restore focus to the opener. Nested calendar Escape closes
the calendar first. A guard prevents a queued native close event from closing a
rapidly reopened drawer. Body scrolling is restored on close/unmount.

There is one settings view, mounted only while the menu is open. `GameSettings`
can render its existing body inline in the drawer or as the desktop disclosure.
Color presets/custom colors, audio and appearance reuse existing hooks and keys.
The mobile viewport has one shared media-query subscription in `App`, rather
than separate listeners in every component. No dependencies or game-engine
abstraction were added.

Fullscreen maximize/minimize, zoom, fit, reset and level navigation use real
44px icon buttons with accessible labels, titles and focus states. The global
full-width button rule now excludes icon controls without increasing its
specificity. The fullscreen/zoom icons also replace their old text on desktop;
desktop graph dimensions and positions are unchanged.

## Play view versus whole-graph overview

A wide graph cannot occupy portrait height at whole-graph fit without distortion
or cropping. The old blank area mainly came from that aspect ratio, compounded
by controls and page sections. Merely removing text would not solve it.

Normal mobile play therefore starts at a **uniform, height-limited zoom capped
at 200%**, centered horizontally. The visible hint says **“Drag to explore · Fit
for overview”**, and the percentage remains visible. **Horizontal panning is
intentional and required to inspect every vertex on wide boards.** The Fit icon
returns to 100%, resets panning, and reveals every circle in one tap. It is not
a claim that a 780px-wide SVG fits on a 390px-wide phone.

The active Level 1 tutorial always uses whole-graph fit, including replay, so all
three targets remain visible. Instructions, four-step progression, allowed moves,
highlights, skip, replay and persistence are unchanged.

### Actual measurements

CSS pixels, initial page scroll zero. Level 30 has an unchanged 900×650 viewBox.
“Visible window” is the screen-width section of the zoomed SVG. Circle diameter
is measured from the rendered SVG circles, without counting clipped fragments.

| Viewport | Before: fitted SVG | New: rendered SVG | New visible window | Zoom | Circle diameter before → after | Whole circles initially visible |
| --- | --- | --- | --- | ---: | --- | ---: |
| 320×568 | 302×218 | 544×393 | 320×393 | 170% | 16.8 → 30.2 | 10 / 18 |
| 375×812 | 357×258 | 750×542 | 375×542 | 200% | 19.8 → 41.7 | 8 / 18 |
| 390×844 | 372×269 | 780×563 | 390×563 | 200% | 20.7 → 43.3 | 8 / 18 |
| 430×932 | 412×298 | 860×621 | 430×621 | 200% | 22.9 → 47.8 | 8 / 18 |

At 390×844, Level 30's graph top is approximately **142px**, versus **137px**
before, while its visible graph height more than doubles. At the same 100% Fit,
it is only **390×282**, versus **372×269** before: that smaller improvement comes
from recovering horizontal padding. The remainder is an explicit zoom tradeoff.

Today's Daily is **Lantern**, `daily-2026-11-09-design-v2`, with an unchanged
1100×800 viewBox. At 390×844 its SVG changes **372×271 → 780×567**, circles
**16.9 → 35.5px**, at 200%; 16 of 18 circles are fully visible initially.
Fit shows all 18 at **390×284**. Level 25 uses the same frame/scale as Level 30.

The 320×568 tutorial changes **285×228 → 320×256**, and its graph top moves
**263 → 211px**. All three circles and the controls fit initially. Its document
height falls **675 → 568px**. At 390×844 the tutorial is 390×312 at 100%, directly
below its guidance. Extra portrait height remains unused by this three-circle
puzzle rather than hiding any tutorial targets.

All normal mobile document heights equal their viewport heights, with no initial
vertical page scrolling or required vertical content scrolling. Random's old
page heights were **1149, 1075, 1085 and 1113px** at the four phone sizes; the new
shell is **568, 812, 844 and 932px** respectively. Zooming may require internal
panning; completion content can scroll inside the shell on a short screen.

At 1440×1000, graph geometry/position matches the baseline for Levels 1/25/30,
Daily and Random. The intentional desktop visual difference is the graph-control
icons. Full raw data, including initial pan offsets, fully visible circle counts,
Fit geometry and document heights: [measurements.json](mobile-gameplay/measurements.json).

## Screenshots

Each comparison contains full viewport screenshots of Level 1, Levels 25/30,
today's Daily and Random. Random uses a fixed seeded fixture for a fair visual
comparison; unseeded generation is separately tested. Before is on the left.

| Size | Initial full viewport | Scrolled to page bottom |
| --- | --- | --- |
| 320×568 | [Comparison](mobile-gameplay/comparison-320x568.webp) | [Page bottom](mobile-gameplay/page-bottom-320x568.webp) |
| 375×812 | [Comparison](mobile-gameplay/comparison-375x812.webp) | [Page bottom](mobile-gameplay/page-bottom-375x812.webp) |
| 390×844 | [Comparison](mobile-gameplay/comparison-390x844.webp) | [Page bottom](mobile-gameplay/page-bottom-390x844.webp) |
| 430×932 | [Comparison](mobile-gameplay/comparison-430x932.webp) | [Page bottom](mobile-gameplay/page-bottom-430x932.webp) |

Standalone lossless views: [play](mobile-gameplay/play-390x844.webp),
[Fit overview](mobile-gameplay/overview-390x844.webp),
[menu open](mobile-gameplay/menu-390x844.webp),
[drawer bottom/help](mobile-gameplay/menu-bottom-320x568.webp),
[dark settings](mobile-gameplay/settings-dark-320x568.webp),
[tutorial](mobile-gameplay/tutorial-320x568.webp), and
[completion](mobile-gameplay/completion-320x568.webp).
Review images live in docs, outside production assets and the PWA precache.

## Removed and refactored code

- Removed the preceding mobile CSS patch, hidden label variants, `puzzleGame` /
  `solvedControls` workarounds, permanent mobile Daily sound control, separate
  mobile Settings row and absolute-positioned level picker.
- Removed obsolete mobile gameplay rules for desktop-only markup and merged the
  remaining homepage/header phone styles into one App.css media query. App.css
  falls from 1287 to 1159 lines; the separate mobile shell stylesheet has 68 lines.
- Reused one graph, completion view, generator and settings renderer per mode.
  No hidden duplicate settings or alternate source of preference state remains.
- Kept DailyGame at a stable position across responsive changes so resizing an
  active Daily does not discard coloring, stats or its saved attempt identity.
- Random generation closes the drawer on success; invalid input keeps it open.

Changed runtime files: `App.jsx`, `App.css`, `AppHeader.jsx`, `LevelMode.jsx`,
`DailyMode.jsx`, `CustomMode.jsx`, `GraphCanvas.jsx`, and `GameSettings.jsx`.
New small UI helpers: `MobileGameShell.jsx/.css`, `GameIcon.jsx`,
`GameIconButton.jsx`, and `hooks/useMobileLayout.js`. The existing uncommitted
`AppearanceControl.jsx` and appearance context/hook are retained.
Tests changed: `mobileGameplay.browser.test.js` plus title/menu/zoom selectors in
Daily, CrazyGames and Campaign layout browser checks. Functional assertions were
retained; the Campaign authoring check explicitly uses Fit for layout review.

## Validation and footprint

```sh
npm run lint
npm run build
npm run test:mobile-gameplay:browser
```

Passed **114 test results**: 85 existing non-browser, 7 mobile shell/menu,
8 analytics, 8 Daily browser/PWA and 6 embedded-game browser results. Also passed
the full 22-view Campaign desktop/mobile layout review, complete solves in Fit,
all 30 level validations with zero warnings, Daily runtime/integrity validation,
generation/design reproduction and launch Fox checks. Both production builds pass.

Coverage includes all requested phone sizes and modes, real touch tracing/taps
and panning, fit/zoom/fullscreen, reset, tutorial replay/skip/progression,
completion/sharing, menu focus containment/return, Escape/backdrop dismissal,
scrolling, preferences/reload/system appearance, responsive Daily state retention,
calendar/level/mode navigation and Random generation.

| Production output | Previous local redesign | This refinement |
| --- | ---: | ---: |
| Main JS | 393.70 kB | 401.68 kB |
| Main JS gzip | 109.69 kB | 111.84 kB |
| CSS | 36.57 kB | 34.83 kB |
| CSS gzip | 7.97 kB | 7.77 kB |

No dependencies were added. The extra JS implements the native drawer,
responsive view selection and icon controls; closed drawers do not mount settings.
No graph-layout engine, extra timer, puzzle payload or preference store was added.
No graph data/topology/content, Daily IDs/schedule, storage schemas or SEO changed.

Remaining limitations are deliberate initial horizontal cropping in play view,
letterboxing in Fit/tutorial view, and internal result scrolling on very short
screens. Physical iOS/Android color pickers, browser chrome and fullscreen policy
have not been checked on hardware; Chrome touch emulation and iframe checks pass.
