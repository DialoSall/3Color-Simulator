# CrazyGames Basic Launch readiness

Prepared November 4, 2026 from merged main `30e2319`. This is a locally verified
submission build, not a Developer Portal approval or a published CrazyGames game.

## Build and test

```bash
npm run build                  # unchanged web target: dist/
npm run build:crazygames       # separate upload target: dist-crazygames/
npm run test:crazygames:browser
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist-crazygames
```

Open `http://127.0.0.1:8080/`. Upload the **contents** of `dist-crazygames`, with
`index.html` at the upload root. A snapshot ZIP is also prepared at
`artifacts/3color-crazygames.zip` (ignored by Git). To refresh it after rebuilding:

```bash
cd dist-crazygames
zip -q -r -FS ../artifacts/3color-crazygames.zip .
```

Browser tests require Chrome (or `CHROME_PATH`) and Node 22+. They run plain
static servers on temporary ports and a fresh browser profile, not the user's
development server/profile. No Vercel rewrites or backend functions are supplied.

## Platform isolation and requirements

`src/platform.js` reads Vite's build-time mode. The CrazyGames target uses relative
`base: "./"`, HashRouter, and a tiny entry wrapper importing the shared app and
portal-only CSS. No hostname, iframe, or user-agent platform detection is used.
The web target retains BrowserRouter, permanent URLs, SEO, PWA/install behavior,
normal fullscreen, sharing links, and its existing homepage. There is one app,
one tutorial, one schedule/data bank, and the same progress-service boundary.

The upload opens Level 1's existing interactive tutorial immediately. Campaign,
Daily, and Random remain one click away in the shared navigation. The compact
landscape stylesheet fits the tutorial graph and zoom controls at 907×510; the
calendar stays inside the iframe viewport. Extra controls can use ordinary page
scrolling. Existing headings remain available to screen readers.

Only the CrazyGames build suppresses custom fullscreen controls/requests, install
prompts and Apple install tags, service-worker registration/manifest, web SEO
metadata, Google/Vercel analytics, and Custom's outbound Share Puzzle controls.
Daily keeps its compact result body, native sharing, abort handling and clipboard
fallback, but includes **no playable URL**. No unknown CrazyGames URL is invented.
The built HTML/JS contain no `3color.app` URL, SDK, or install code. No ads, login,
accounts, cloud saves, or external promotional links are added.

These choices follow the current [gameplay requirements](https://docs.crazygames.com/requirements/gameplay/)
for platform fullscreen and outbound promotion. The SDK is optional for Basic
Implementation; without it the complete upload is evaluated against the 50 MB
Basic / 20 MB mobile thresholds. See [technical requirements](https://docs.crazygames.com/requirements/technical/).
The postbuild guard uses the stricter 20 MB total-size target and checks file count.

## Static files, Daily, and storage

HTML assets, icons, CSS/JS and runtime Daily requests resolve relative to the upload
directory. The automated fixture uses `/uploads/3color/game/index.html` inside an
iframe on another origin. Hash navigation/refresh requests only that entry file.
Only the favicon, app assets and the existing 15 immutable monthly JSON files are
copied. The public web's PWA images, robots, sitemap and server functions are absent.

Daily payloads stay lazy and byte-identical to the web source. Starting Campaign
downloads no Daily month. Opening Fox loads November once; another date in that
month and a document reload reuse the loaded cache. The existing loader handles
nested paths and scopes cached revisions to their upload directory. Future and
pre-launch route guards, Fox identity/theme, calendar, on-time streak credit and
late-solve behavior keep the existing implementation.

Progress and preferences use the hosting origin's browser storage, separate from
`3color.app`. They are not synced between hosts or devices. When embedded storage
is denied, the existing Daily/tutorial services can use memory; shared sound,
palette and Campaign storage calls now tolerate denial rather than crashing.
Mute also keeps a shared session fallback across modes. Other saved
progress/preferences cannot be promised across mode changes or reloads when storage is
blocked or cleared. There is no installable/offline app shell in the upload;
the normal web PWA is retained. Daily CacheStorage still works independently of
a service worker when the browser permits it.

## Size audit

Decimal units, complete uncompressed upload:

| Measurement | Result |
| --- | ---: |
| Complete upload | 1,431,476 bytes / 1.431 MB |
| Files | 19 |
| Prepared ZIP | 527,274 bytes / 0.527 MB |
| Initial embedded transfer, uncompressed static fixture including headers | 411,743 bytes / 0.412 MB; 3 requests |
| App JS | 378,225 bytes; 103,747 gzip bytes (Node estimate) |
| Favicon | 310,912 bytes |
| All 15 lazy monthly payloads | 709,279 bytes total |
| Largest month, January 2027 | 60,094 bytes |

Initial requests are HTML, JS, and CSS; neither the year nor even November loads
before choosing Daily. A standalone browser may additionally fetch the favicon.
Actual portal delivery/compression/overhead must be measured in its QA tool.
The entire upload, rather than just this measured initial transfer, is comfortably
below both no-SDK thresholds. No dependency versions or puzzle data were changed.

## Local verification

All 96 test results pass, along with lint, both build targets and production checks.

- Cross-origin iframe at **907×510**, **1216×684**, and **390×844** (touch emulation,
  DPR 1). The small tutorial graph and zoom footer fit in the first frame; the
  calendar fits in the viewport. No horizontal overflow or forced fullscreen.
- Real trusted keyboard/mouse input completes every tutorial step, creates/removes
  its conflict, persists completion, and unlocks the next Campaign level.
- A real Web Audio context is created only after input and reaches `running`;
  mute persists across modes. Interruption recovery is simulated for the next
  gesture; physical audio output/iOS interruption was not exercised.
- Daily today/history, exact Fox palette despite a different saved preset, streak
  credit, text-only native/clipboard result sharing, future-date privacy, monthly
  reuse/reload, and no outbound playable URL.
- Custom generation and seeded loading (silent), presets/custom colors,
  light/dark appearance, zoom/Fit, and touch hold-to-trace without recoloring,
  followed by tap-to-color. Native sharing is stubbed in browser tests.
- No external network dependency or runtime exceptions; storage-denied fresh
  sessions can play the tutorial and complete a Daily with memory-only streaks.
- Normal web browser suite retains fullscreen, homepage, dated URLs, share URLs,
  metadata, saved progress, and offline/PWA behavior. Full bank/Fox/reproduction,
  level, tutorial, sharing, retention and loading validations pass.

## Still required in the Developer Portal

Upload the build, supply the game-page metadata/covers and supported orientation,
then run CrazyGames' own Basic QA. Check their real CDN paths, cross-site iframe
permissions, storage partitioning, clipboard/Web Share support, portal fullscreen
and resizing, and actual download measurements. Test Edge and physical Safari/iOS
and Android devices, safe areas, background/foreground audio, and low-memory
hardware. The local tests do not establish platform acceptance or mobile listing
eligibility. No submission, portal account operation, or SDK integration is done.

Changed files cover platform/entry/router/CSS, Vite's upload plugin and package
scripts, the App/GraphCanvas/Custom guards, Daily URL/cache/share adapters,
sound/palette/Campaign storage guards, and build/browser/cache checks. The shared
browser harness supports both normal and upload tests. Web `App.css`, homepage,
SEO policy/server functions, Vercel config, progress schemas and all puzzle banks
remain untouched.


File inventory:

- Build/config: `.gitignore`, `package.json`, `vite.config.js`,
  `server/crazygamesPlugin.js`.
- Platform/bootstrap: `src/platform.js`, `src/PlatformRouter.jsx`, `src/main.jsx`,
  `src/crazygames.jsx`, `src/crazygames.css`, `src/App.jsx`.
- Mode/input/preferences: `src/components/GraphCanvas.jsx`,
  `src/components/CustomMode.jsx`, `src/components/LevelMode.jsx`,
  `src/hooks/useSoundEffects.js`, `src/hooks/useColorTheme.js`.
- Data/sharing: `src/data/dailyPuzzles.js`, `src/services/dailyPuzzleLoader.js`,
  `src/utils/dailyResultSharing.js`, `src/utils/analytics.js`.
- Checks: `scripts/checkCrazyGamesBuild.js`, `scripts/crazygames.browser.test.js`,
  `scripts/lib/browserHarness.js`, `scripts/dailyLoading.test.js`,
  `scripts/dailyRoutes.browser.test.js`.
- Documentation: `README.md` and this file.
