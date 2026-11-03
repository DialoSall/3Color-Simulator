# 3Color

A browser puzzle game based on graph 3-coloring: color every circle so connected
circles have different colors.

**Play:** [https://3color.app/](https://3color.app/)

## Features

- **Campaign:** 30 progressive levels, unlocks, and progress saved on this device.
- **Daily Puzzle:** UTC-dated challenges, locally saved daily best results, replay,
  and shareable completion text. The latest published graph remains active until
  a newer puzzle is available.
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
```

## Future Ideas

- Accounts and progress sync across devices
- Saved, named palette collections
- Broader personal-best tracking and browsable result history across modes
- Leaderboards, more puzzles, and native mobile distribution

Built by [Dialo Sall](https://github.com/DialoSall).
