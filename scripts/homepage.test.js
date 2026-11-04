import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDailyPuzzleForDate } from "./lib/dailyCatalog.js";

test("Daily preview preserves actual layouts and theme, hides color assignments, and stays noninteractive", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "3color-home-test-"));
  const vite = await createServer({ cacheDir, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom" });
  try {
    const { default: Preview } = await vite.ssrLoadModule("/src/components/DailyGraphPreview.jsx");
    const render = puzzle => renderToString(createElement(Preview, { puzzle }));
    const fox = getDailyPuzzleForDate("2026-11-04");
    const html = render(fox);
    assert.equal((html.match(/<circle /g) ?? []).length, fox.vertices.length);
    assert.equal((html.match(/<line /g) ?? []).length, fox.edges.length);
    for (const { x, y } of fox.vertices) assert.ok(html.includes(`cx="${x}" cy="${y}"`));
    for (const color of Object.values(fox.theme.colors)) assert.ok(html.includes(color));
    assert.match(html, /role="img" aria-label="Fox Face puzzle preview" focusable="false"/);
    assert.match(html, /<g aria-hidden="true">/);
    assert.doesNotMatch(html, /<text|role="button"|tabindex|class="vertex|fill=/);
    assert.equal(render({ ...fox, vertices: fox.vertices.map((vertex, i) => ({ ...vertex, color: ["red", "blue", "yellow"][i % 3] })) }), html);
    const butterfly = getDailyPuzzleForDate("2026-11-05");
    const motif = render(butterfly);
    assert.equal((motif.match(/class="previewContour"/g) ?? []).length, butterfly.design.contourEdges.length);
    assert.equal((motif.match(/<line /g) ?? []).length, butterfly.edges.length);
  } finally { await vite.close(); await rm(cacheDir, { recursive: true, force: true }); }
});

test("homepage presents the exact launch puzzle, one usable Daily action, and a secondary tutorial path while history loads", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "3color-home-test-"));
  const vite = await createServer({ cacheDir, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom" });
  const NativeDate = globalThis.Date;
  try {
    const { default: Home } = await vite.ssrLoadModule("/src/components/HomeScreen.jsx");
    globalThis.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : ["2026-11-04T17:00:00.000Z"])); }
      static now() { return NativeDate.parse("2026-11-04T17:00:00.000Z"); }
    };
    const html = renderToString(createElement(MemoryRouter, null, createElement(Home)));
    assert.match(html, /Today&#x27;s 3Color/);
    assert.match(html, /Fox Face/);
    assert.match(html, /Expert/);
    assert.match(html, /November 4, 2026/);
    assert.match(html, /Loading streak/);
    assert.equal((html.match(/<button /g) ?? []).length, 1);
    assert.match(html, /Play Today&#x27;s Puzzle/);
    assert.match(html, /href="\/levels\/1"/);
    assert.doesNotMatch(html, /disabled|Share 3Color|Play at your own pace|Random graphs|Every connection checks out|30 levels|Daily #/);
  } finally { globalThis.Date = NativeDate; await vite.close(); await rm(cacheDir, { recursive: true, force: true }); }
});
