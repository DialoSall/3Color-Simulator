# 3Color

A browser puzzle game based on graph 3-coloring: color every circle so connected
circles have different colors.

**Play:** [https://3color.app/](https://3color.app/)

## Features

- **Campaign:** 30 progressive levels, unlocks, and progress saved on this device.
- **Daily Puzzle:** an exact frozen schedule using America/New_York dates, with
  365 new puzzles from November 4, 2026 through November 3, 2027. Includes locally
  saved daily best results, attempts, replay, and shareable completion text.
  Current/best streaks reward on-time solves. Select the date to revisit missed
  puzzles from the November 4 launch; late solves mark completion without repairing a streak.
- **Custom Graph:** generate 3–24 vertices with adjustable edge probability.
  Random graphs are not guaranteed to be 3-colorable.
- **Seeded sharing:** share the exact custom graph's coordinates, connections,
  and canvas size through a URL. Recipients start with uncolored circles; no
  database or account is required.
- Campaign/Daily timers, per-mode stats, conflict detection, and reset controls.
- Color presets and custom colors, with palette preferences saved locally.
- Web Audio sound effects for moves, new conflicts, resets, puzzle changes, and
  completion; one persisted mute preference across all modes.
- Remembered **Light / Dark / System** appearance, separate from puzzle colors.
- Desktop and mobile layouts, hover/touch connection tracing, keyboard controls,
  zoom, and full screen on supported browsers.
- PWA installation / Add to Home Screen support, social sharing, and analytics.

## Playing

Click or tap a circle to cycle its color. Hover on desktop or press and hold on a
touchscreen to trace its connections without recoloring it. Keyboard users can
focus a circle and press Enter or Space to change its color.

Use **+ / −** for 10% zoom steps, scroll inside the canvas to explore, and select
**Fit** to reset the view. **Expand** opens full screen where supported; Exit or
Escape returns to the page, as does completing a puzzle.

Open **Choose a level** or **Puzzle colors** when needed. Campaign sound is in
**Colors & sound**; Daily and Custom have a sound toggle in the graph toolbar.
Mute, color, appearance, progress, and daily results are stored on this browser,
not synced across devices.

In Custom Graph, **Share Puzzle** copies a `/custom?seed=…` link (or displays it
for manual copying). `/?seed=…` also works. Invalid seeds fall back to a random
puzzle with a message; generating another graph clears the previous seed.

## Development

Built with React, React Router, JavaScript/CSS, Vite, and Vite PWA; hosted on Vercel.

```bash
git clone https://github.com/DialoSall/3Color-Simulator.git
cd 3Color-Simulator
npm ci
npm run dev
```

For a phone on the same Wi-Fi, run `npm run dev -- --host 0.0.0.0` and open the
printed network URL. Build with `npm run build`; inspect it with `npm run preview`.

Checks:

```bash
npm run lint
npm run build
npm run validate:levels
npm run test:sharing
npm run validate:daily
npm run test:daily
npm run test:retention
npm run check:daily-generation
npm run check:daily-designs
npm run test:preview
```

## Development Preview

Run `npm run dev` and select **Preview** in the header, or open
`http://localhost:5173/dev/preview`.

- **Daily bank:** choose any scheduled date, or use Previous / Next. The preview
  starts at the next recognizable design and shows its ID, motif, difficulty,
  and solver score.
- **Campaign (all 30):** select any level, including locked levels.
- Preview results stay in memory and do not update real campaign unlocks or Daily
  progress. Reloading/leaving the tool clears its test session; **Reset test
  progress** clears it immediately. Appearance, palette, and mute preferences are
  shared with normal play.
- **Copy puzzle JSON** exports the selected puzzle for review. Collapse the
  development panel for more graph space.

The route, controls, and styles are excluded from production builds; normal
campaign routes still enforce unlocks. The build checks this automatically.

## Maintaining Daily Puzzles

November 4 launches with **Fox Face**, under its own new puzzle identity. Historical
puzzles and the original generated safety bank retain their data. November 5 onward
uses 22 authored motifs, including animals, objects, and symbols. Their outlines
are actual puzzle connections, and every date has its own validated graph.

The official Daily graph is loaded from checked-in monthly data; it is never
randomly generated in a player's browser. `npm run generate:daily` reproduces the
original safety bank. `npm run generate:daily-designs` reproduces the recognizable
design bank. Builds validate coverage, graph quality, and integrity locks.
Missing dates show an unavailable message rather than reusing yesterday's graph.

Use `npm run schedule:daily -- path/to/puzzle.json` for a handcrafted replacement
on a future date. Extend the bank before November 4, 2027. See
[Daily architecture and authoring](docs/daily-puzzles.md) for calibration, immutable
IDs, replacement rules, and progress migration details.

## Future Ideas

- Accounts and progress sync across devices
- Saved, named palette collections
- Broader personal-best tracking and browsable result history across modes
- Leaderboards, more puzzles, and native mobile distribution

Built by [Dialo Sall](https://github.com/DialoSall).
