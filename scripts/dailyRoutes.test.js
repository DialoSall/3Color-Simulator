import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDailyPath, getDailyUrl } from "../src/utils/dailyUrl.js";

test("Daily URL helpers produce canonical date routes and reject malformed labels", () => {
  assert.equal(getDailyPath("2026-11-04"), "/daily/2026-11-04");
  assert.equal(getDailyUrl("2026-11-04"), "https://3color.app/daily/2026-11-04");
  for (const date of [null, "2026-1-04", "2026-02-30", "../custom", "2026-11-04?seed=x"]) {
    assert.throws(() => getDailyUrl(date), /Invalid Daily date/);
  }
});

test("actual app routes resolve Daily dates before any graph payload is loaded", async t => {
  const cacheDir = await mkdtemp(join(tmpdir(), "3color-daily-route-test-"));
  const vite = await createServer({ cacheDir, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom" });
  const NativeDate = globalThis.Date;
  let now = "2026-11-07T17:00:00Z";
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return NativeDate.parse(now); }
  };
  try {
    const { default: App } = await vite.ssrLoadModule("/src/App.jsx");
    const render = path => renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(App)));
    await t.test("/daily uses today's New York date and date routes select exact historical/launch puzzles", () => {
      assert.match(render("/daily"), /Today&#x27;s 3Color/);
      assert.match(render("/daily"), /November 7, 2026/);
      const past = render("/daily/2026-11-05");
      assert.match(past, /Past Daily Puzzle/);
      assert.match(past, /Butterfly/);
      assert.match(past, /November 5, 2026/);
      assert.match(past, /Loading puzzle/);
      assert.match(past, /Back to Today/);
      assert.match(render("/daily/2026-11-04"), /Fox Face/);
      assert.doesNotMatch(past, /Daily #|class="vertex|<text/);
    });
    await t.test("future, pre-launch, impossible, malformed, and extra-segment dates reveal no puzzle metadata", () => {
      for (const path of ["2026-11-08", "2026-11-03", "2026-02-30", "not-a-date", "2026-11-04/extra", "2026-11-04%2Fextra"]) {
        const html = render(`/daily/${path}`);
        assert.match(html, /This Daily puzzle is unavailable/);
        assert.match(html, /href="\/daily"[^>]*>Back to today&#x27;s Daily/);
        assert.doesNotMatch(html, /Fox Face|Butterfly|Expert|Hard|Challenging|Loading puzzle|dailyDateButton|class="vertex/);
      }
    });
    await t.test("a valid date label with no scheduled puzzle is unavailable", () => {
      now = "2027-11-05T17:00:00Z";
      assert.match(render("/daily/2027-11-04"), /This Daily puzzle is unavailable/);
    });
    await t.test("New York rollover advances /daily while an explicit date remains fixed", () => {
      now = "2026-11-05T04:59:59Z";
      assert.match(render("/daily"), /November 4, 2026/);
      assert.match(render("/daily/2026-11-05"), /This Daily puzzle is unavailable/);
      now = "2026-11-05T05:00:00Z";
      assert.match(render("/daily"), /November 5, 2026/);
      const fixed = render("/daily/2026-11-04");
      assert.match(fixed, /November 4, 2026/);
      assert.match(fixed, /Past Daily Puzzle/);
    });
  } finally {
    globalThis.Date = NativeDate;
    await vite.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
});
