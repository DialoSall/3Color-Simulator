import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, preview } from "vite";
import { levels } from "../src/data/levels.js";
import { getDailyMetadataForDate } from "../src/data/dailyIndex.js";
import { DAILY_PROGRESS_KEY, createDailyProgressService } from "../src/services/dailyProgress.js";
import { serializeGraph } from "../src/utils/graphSharing.js";
import { dailyPuzzles, getDailyPuzzleForDate } from "./lib/dailyCatalog.js";
import { solveThreeColoring } from "./lib/dailyGraph.js";
import { connect, pause, waitFor } from "./lib/browserHarness.js";

test("the existing GA4 tag, initialization and measurement configuration remain singular", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal((html.match(/src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-C1XR652FB6"/g) ?? []).length, 1);
  assert.equal((html.match(/function gtag\(/g) ?? []).length, 1);
  assert.equal((html.match(/gtag\('js',/g) ?? []).length, 1);
  assert.equal((html.match(/gtag\('config', 'G-C1XR652FB6'\)/g) ?? []).length, 1);
});

test("the existing transport logs in development, skips server rendering and stays disabled in CrazyGames", async t => {
  const originalWindow = globalThis.window;
  const calls = [], logs = [];
  t.mock.method(console, "log", (...args) => logs.push(args));
  try {
    for (const mode of ["development", "crazygames"]) {
      const cacheDir = await mkdtemp(join(tmpdir(), "3color-analytics-unit-"));
      const vite = await createServer({ configFile: false, mode, cacheDir, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
      try {
        const { trackEvent } = await vite.ssrLoadModule("/src/utils/analytics.js");
        delete globalThis.window;
        assert.doesNotThrow(() => trackEvent("daily_complete"));
        globalThis.window = { gtag: (...args) => calls.push(args) };
        trackEvent("daily_complete", { date_key: "2026-11-05" });
      } finally { await vite.close(); await rm(cacheDir, { recursive: true, force: true }); }
    }
    assert.deepEqual(calls, []);
    assert.deepEqual(logs, [["[Analytics]", "daily_complete", { date_key: "2026-11-05" }]]);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("production completion events follow genuine solves without changing existing analytics", { timeout: 120000 }, async t => {
  const candidates = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
  let binary;
  for (const path of candidates) { try { await access(path); binary = path; break; } catch { /* Try the next installed browser. */ } }
  assert.ok(binary, "Install Chrome or set CHROME_PATH to run this browser check.");
  const profile = await mkdtemp(join(tmpdir(), "3color-analytics-chrome-"));
  const server = await preview({ preview: { host: "127.0.0.1", port: 0, strictPort: true }, logLevel: "silent" });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const chrome = spawn(binary, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-sync", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let browser;
  t.after(async () => {
    browser?.close();
    if (chrome.exitCode === null) {
      const exited = new Promise(resolve => chrome.once("exit", resolve));
      chrome.kill("SIGTERM"); await exited;
    }
    await server.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });
  const debugPort = await waitFor(async () => {
    try { return (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; } catch { return null; }
  }, "Chrome debugging endpoint");
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  browser = await connect(pages.find(page => page.type === "page").webSocketDebuggerUrl);
  const { send, evaluate: ev } = browser;
  const until = expression => waitFor(() => ev(expression), expression);
  const events = name => ev(`window.dataLayer.filter(event => event[0] === 'event' && event[1] === ${JSON.stringify(name)}).map(event => event[2])`);
  const click = index => ev(`document.querySelectorAll('.vertexGroup')[${index}].dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  const button = text => ev(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
  const go = async path => {
    const previous = await ev("window.__analyticsDocument");
    await send("Page.navigate", { url: `${base}${path}` });
    await until(`window.__analyticsDocument && window.__analyticsDocument !== ${JSON.stringify(previous)} && !!document.querySelector('main')`);
  };
  const graph = async puzzle => until(`document.querySelector('.levelHeader h2')?.textContent === ${JSON.stringify(puzzle.name)} && document.querySelectorAll('.vertexGroup').length === ${puzzle.vertices.length}`);
  async function solve(puzzle) {
    const solution = solveThreeColoring(puzzle, { dynamic: true }).solution;
    for (let i = 0; i < puzzle.vertices.length; i++) {
      const color = await ev(`document.querySelectorAll('.vertexGroup')[${i}].getAttribute('aria-label').split(', ')[1]`);
      const steps = (solution[puzzle.vertices[i].id] + 1 - ["uncolored", "red", "blue", "yellow"].indexOf(color) + 4) % 4;
      for (let step = 0; step < steps; step++) await click(i);
    }
  }
  const record = puzzle => ev(`JSON.parse(localStorage.getItem('${DAILY_PROGRESS_KEY}')).byPuzzleId['${puzzle.id}']['${puzzle.dateKey}']`);
  const emittedAttemptIds = new Set(["saved-fox"]);
  async function assertDailyEvent(puzzle, index, firstCompletion, isToday) {
    await until(`window.dataLayer.filter(event => event[0] === 'event' && event[1] === 'daily_complete').length === ${index + 1}`);
    const event = (await events("daily_complete"))[index];
    const saved = await record(puzzle);
    // Records sort by stable ID, not completion time. Find this solve's new attempt.
    const attempts = saved.attempts.filter(attempt => attempt.completedAt && !emittedAttemptIds.has(attempt.id));
    assert.equal(attempts.length, 1);
    emittedAttemptIds.add(attempts[0].id);
    const result = attempts[0].result;
    assert.deepEqual(event, { date_key: puzzle.dateKey, difficulty: puzzle.difficulty, is_today: isToday, time_ms: result.timeMilliseconds, recolors: result.recolors, resets: result.resets, first_completion: firstCompletion });
  }
  const today = getDailyPuzzleForDate("2026-11-05");
  const fox = getDailyPuzzleForDate("2026-11-04");
  const retired = dailyPuzzles.find(puzzle => puzzle.dateKey === today.dateKey && puzzle.id !== today.id);
  assert.ok(retired);
  const values = new Map();
  const service = createDailyProgressService({ storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
  const fixtureResult = { timeMilliseconds: 72000, recolors: 2, resets: 0, completedAt: "2026-11-05T17:00:00Z" };
  await service.completeAttempt(getDailyMetadataForDate(fox.dateKey), "saved-fox", fixtureResult);
  await service.completeAttempt(retired, "retired-puzzle", fixtureResult);
  const originalRetired = JSON.parse(values.get(DAILY_PROGRESS_KEY)).byPuzzleId[retired.id];
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["*googletagmanager.com*", "*google-analytics.com*", "*vercel-insights.com*"] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__analyticsDocument = crypto.randomUUID();
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : ['2026-11-05T17:00:00Z'])); }
      static now() { return NativeDate.parse('2026-11-05T17:00:00Z'); }
    };
    if (!localStorage.getItem('analytics-fixture')) {
      localStorage.setItem('analytics-fixture', '1');
      localStorage.setItem('${DAILY_PROGRESS_KEY}', ${JSON.stringify(values.get(DAILY_PROGRESS_KEY))});
    }
  ` });

  await t.test("today emits one saved completion, unaffected by retired IDs or solved rerenders", async () => {
    await go("/");
    await until("!!document.querySelector('.primaryHomeButton')");
    await ev("document.querySelector('.primaryHomeButton').click()");
    await graph(today);
    assert.equal((await events("homepage_daily_click")).length, 1);
    assert.equal((await events("game_start")).length, 1);
    assert.deepEqual(await events("daily_complete"), []);
    assert.equal(await ev("document.querySelectorAll('script[src*=\"googletagmanager.com/gtag/js\"]').length"), 1);
    assert.equal(await ev("window.dataLayer.filter(event => event[0] === 'config' && event[1] === 'G-C1XR652FB6').length"), 1);
    await click(0); await button("Reset Puzzle");
    await click(0); await click(1);
    for (let i = 0; i < 4; i++) await click(0); // Return to a visited circle without changing its final color.
    await solve(today);
    await assertDailyEvent(today, 0, true, true);
    assert.equal((await events("daily_complete"))[0].resets, 1);
    assert.ok((await events("daily_complete"))[0].recolors > 0);
    await ev("document.querySelector('.soundToggle').click(); document.querySelector('.dailyDateButton').click()");
    await until("!!document.querySelector('.dailyCalendar')");
    await ev("document.querySelector('.dailyDateButton').click(); document.querySelector('[aria-label=\"Zoom in\"]').click()");
    await pause(150);
    assert.equal((await events("daily_complete")).length, 1);
    assert.equal((await events("game_start")).length, 1);
    const savedRetired = await ev(`JSON.parse(localStorage.getItem('${DAILY_PROGRESS_KEY}')).byPuzzleId['${retired.id}']`);
    assert.deepEqual(savedRetired, originalRetired);
  });
  await t.test("Daily replay has a new attempt, while re-saving the same solved attempt is deduplicated", async () => {
    await button("Replay Daily Puzzle");
    await until("!document.querySelector('.completionCard')");
    await solve(today);
    await assertDailyEvent(today, 1, false, true);
    assert.equal((await record(today)).attempts.length, 2);
    // Change a vertex away from its solution and back, updating the already-saved attempt.
    for (let i = 0; i < 4; i++) await click(0);
    await until("!!document.querySelector('.completionCard')");
    await pause(150);
    assert.equal((await events("daily_complete")).length, 2);
    assert.equal((await record(today)).attempts.length, 2);
    assert.equal((await events("game_start")).length, 1);
  });
  await t.test("historical saved results do not auto-fire; a new solve has first_completion false", async () => {
    await go(`/daily/${fox.dateKey}`); await graph(fox);
    assert.deepEqual(await events("daily_complete"), []);
    assert.deepEqual(await events("daily_history_select"), [{ date_key: fox.dateKey }]);
    await solve(fox);
    await assertDailyEvent(fox, 0, false, false);
    assert.equal((await record(fox)).attempts.length, 2);
    await ev("Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} })");
    await button("Share Result");
    await until("document.querySelector('.shareMessage')?.textContent === 'Thanks for sharing!'");
    assert.deepEqual(await events("daily_result_share"), [{ date_key: fox.dateKey, is_today: false, difficulty: fox.difficulty, share_method: "native" }]);
    assert.equal((await events("daily_complete")).length, 1);
  });
  await t.test("Campaign completion coexists with tutorial, homepage and start events; replay can solve again", async () => {
    await go("/"); await until("!!document.querySelector('.homeCampaignLink')");
    await ev("document.querySelector('.homeCampaignLink').click()");
    await graph(levels[0]);
    await until("document.querySelector('.tutorialGuidance')?.textContent.includes('Step 1')");
    assert.equal((await events("homepage_campaign_click")).length, 1);
    assert.equal((await events("tutorial_start")).length, 1);
    await click(0); await click(1); await click(1); await click(2); await click(2); await click(2);
    await until("!!document.querySelector('.completionCard')");
    const completions = await events("campaign_level_complete");
    assert.equal(completions.length, 1);
    assert.deepEqual(completions[0], { level: 1, time_ms: completions[0].time_ms, recolors: 0, resets: 0 });
    assert.ok(Number.isInteger(completions[0].time_ms) && completions[0].time_ms >= 0);
    assert.equal((await events("tutorial_complete")).length, 1);
    assert.deepEqual((await events("tutorial_step_complete")).map(event => event.step_number), [1, 2, 3, 4]);
    assert.equal(await ev("localStorage.getItem('3color-highest-completed-level')"), "0");
    await ev("document.querySelector('[aria-label=\"Zoom in\"]').click()");
    await pause(100);
    assert.equal((await events("campaign_level_complete")).length, 1);
    await button("Replay Level"); await until("!document.querySelector('.completionCard')");
    await button("Reset Puzzle"); await solve(levels[0]);
    await until("window.dataLayer.filter(event => event[1] === 'campaign_level_complete').length === 2");
    assert.equal((await events("campaign_level_complete"))[1].resets, 1);
    assert.equal((await events("tutorial_complete")).length, 1);
    assert.equal((await events("game_start")).length, 1);
  });
  await t.test("Custom emits once per solve, supports reset/re-solving, and adds no unavailable stats", async () => {
    const puzzle = { ...levels[0], width: 600, height: 480 };
    await go(`/custom?seed=${serializeGraph(puzzle)}`);
    await until("document.querySelectorAll('.vertexGroup').length === 3");
    assert.deepEqual(await events("custom_complete"), []);
    await solve(puzzle);
    await until("!!document.querySelector('.statusBox.solved')");
    assert.deepEqual(await events("custom_complete"), [{ vertex_count: 3, edge_count: 3, recolors: 0 }]);
    await ev("document.querySelector('.soundToggle').click(); document.querySelectorAll('.themePresetButton')[1].click()");
    await pause(100);
    assert.equal((await events("custom_complete")).length, 1);
    await button("Reset Colors"); await until("!document.querySelector('.statusBox.solved')");
    await solve(puzzle);
    await until("window.dataLayer.filter(event => event[1] === 'custom_complete').length === 2");
    assert.deepEqual((await events("custom_complete"))[1], { vertex_count: 3, edge_count: 3, recolors: 0 });
    for (let i = 0; i < 4; i++) await click(0);
    await until("window.dataLayer.filter(event => event[1] === 'custom_complete').length === 3");
    assert.equal((await events("custom_complete"))[2].recolors, 1);
    assert.equal((await events("game_start")).length, 1);
    assert.deepEqual(browser.errors, []);
  });
});
