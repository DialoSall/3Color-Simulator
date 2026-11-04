import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preview } from "vite";
import { getDailyMetadataForDate } from "../src/data/dailyIndex.js";
import { DAILY_PROGRESS_KEY, createDailyProgressService } from "../src/services/dailyProgress.js";
import { getDailyPuzzleForDate } from "./lib/dailyCatalog.js";
import { solveThreeColoring } from "./lib/dailyGraph.js";
import { buildDailyResultShare } from "../src/utils/dailyResultSharing.js";
import { getRouteMetadata } from "../src/seo/metadata.js";
import { getDailyDateKey, addDailyDays } from "../src/utils/dailyDate.js";

import { waitFor, connect } from "./lib/browserHarness.js";

test("production Daily date routes, navigation, retention, analytics and offline reload", { timeout: 120000 }, async t => {
  const candidates = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
  let binary;
  for (const path of candidates) { try { await access(path); binary = path; break; } catch { /* Try the next installed browser. */ } }
  assert.ok(binary, "Install Chrome or set CHROME_PATH to run this explicit browser check.");
  const profile = await mkdtemp(join(tmpdir(), "3color-daily-route-chrome-"));
  const server = await preview({ preview: { host: "127.0.0.1", port: 0, strictPort: true }, logLevel: "silent" });
  let serverRunning = true;
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const chrome = spawn(binary, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-sync", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let browser;
  t.after(async () => {
    browser?.close();
    if (chrome.exitCode === null) {
      const exited = new Promise(resolve => chrome.once("exit", resolve));
      chrome.kill("SIGTERM");
      await exited;
    }
    if (serverRunning) await server.close();
    await rm(profile, { recursive: true, force: true });
  });
  const debugPort = await waitFor(async () => {
    try { return (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; } catch { return null; }
  }, "Chrome debugging endpoint");
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  browser = await connect(pages.find(page => page.type === "page").webSocketDebuggerUrl);
  const { send, evaluate: ev } = browser;
  const until = expression => waitFor(() => ev(expression), expression);
  const reload = async () => {
    const previous = await ev("window.__dailyDocument");
    await send("Page.reload");
    await until(`window.__dailyDocument && window.__dailyDocument !== ${JSON.stringify(previous)}`);
  };
  const go = async path => {
    await send("Page.navigate", { url: `${base}${path}` });
    await until(`location.pathname === ${JSON.stringify(path)} && !!document.querySelector('main')`);
  };
  const graph = async date => {
    const puzzle = getDailyPuzzleForDate(date);
    await until(`document.querySelector('.levelHeader h2')?.textContent === ${JSON.stringify(puzzle.name)} && document.querySelectorAll('.vertex').length === ${puzzle.vertices.length}`);
  };
  const button = async text => {
    await ev(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
  };
  const select = async date => {
    await ev(`document.querySelector('.dailyDateButton').click()`);
    await until("!!document.querySelector('.dailyCalendar')");
    await ev(`document.querySelector('[data-date="${date}"]').click()`);
    await until(`location.pathname === '/daily/${date}' && !document.querySelector('.dailyCalendar')`);
    await graph(date);
    await until(`document.querySelector('link[rel="canonical"]')?.href === 'https://3color.app/daily/${date}'`);
    assert.equal(await ev("document.querySelectorAll('link[rel=canonical]').length"), 1);
  };
  const events = name => ev(`window.dataLayer.filter(event => event[0] === 'event' && event[1] === ${JSON.stringify(name)}).map(event => event[2])`);
  const progress = () => ev(`JSON.parse(localStorage.getItem('${DAILY_PROGRESS_KEY}'))`);
  const values = new Map();
  const service = createDailyProgressService({ storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
  for (const date of ["2026-11-04", "2026-11-06"]) await service.completeAttempt(getDailyMetadataForDate(date), `fixture-${date}`, { timeMilliseconds: 72000, recolors: 0, resets: 0, completedAt: `${date}T17:00:00Z` });
  const original = JSON.parse(values.get(DAILY_PROGRESS_KEY));
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Network.setBlockedURLs", { urls: ["*googletagmanager.com*", "*google-analytics.com*", "*vercel-insights.com*"] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__dailyDocument = crypto.randomUUID();
    const NativeDate = Date;
    window.__dailyNow = sessionStorage.getItem('route-clock') ?? '2026-11-07T17:00:00Z';
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [window.__dailyNow])); }
      static now() { return NativeDate.parse(window.__dailyNow); }
    };
    if (!localStorage.getItem('route-fixture')) {
      localStorage.setItem('route-fixture', '1');
      localStorage.setItem('${DAILY_PROGRESS_KEY}', ${JSON.stringify(JSON.stringify(original))});
    }
    window.__dailyRequests = []; window.__releaseDaily = [];
    const nativeFetch = fetch.bind(window);
    window.fetch = async (...args) => {
      if (/\\/daily\\/\\d{4}-\\d{2}\\./.test(String(args[0]))) {
        window.__dailyRequests.push(String(args[0]));
        if (sessionStorage.getItem('hold-daily') === '1') await new Promise(resolve => window.__releaseDaily.push(resolve));
      }
      return nativeFetch(...args);
    };
  ` });

  await t.test("invalid and future direct loads show no puzzle or payload requests", async () => {
    for (const date of ["2027-01-01", "2026-11-03", "2026-02-30", "bad-date", "2026-11-04/extra"]) {
      await go(`/daily/${date}`);
      await until("document.querySelector('main')?.textContent.includes('This Daily puzzle is unavailable')");
      assert.equal(await ev("document.querySelectorAll('.vertex, .dailyDateButton, .levelHeader, .dailyLoading').length"), 0);
      assert.equal(await ev("window.__dailyRequests.length"), 0);
      await until("document.querySelector('meta[name=robots]')?.content === 'noindex, follow'");
      assert.equal(await ev("document.querySelector('link[rel=canonical]')"), null);
      assert.equal(await ev("document.title"), "Daily Puzzle Unavailable | 3Color");
      assert.deepEqual(await progress(), original);
      assert.equal(await ev("document.querySelector('main a').getAttribute('href')"), "/daily");
    }
  });
  await t.test("launch URL opens directly, waits for lazy data without attempts, and refreshes correctly", async () => {
    const response = await fetch(`${base}/daily/2026-11-04`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /id="root"/);
    const serverHtml = await (await fetch(`${base}/daily/2026-11-04`)).text();
    assert.match(serverHtml, /Fox Face \| 3Color Daily Puzzle – November 4, 2026/);
    assert.match(serverHtml, /rel="canonical" href="https:\/\/3color.app\/daily\/2026-11-04"/);
    await ev("sessionStorage.setItem('hold-daily', '1')");
    await go("/daily/2026-11-04");
    await until("window.__releaseDaily.length === 1 && !!document.querySelector('.dailyLoading')");
    assert.equal(await ev("document.querySelectorAll('.vertex, .gameStatsBar').length"), 0);
    assert.deepEqual(await progress(), original);
    await ev("sessionStorage.removeItem('hold-daily'); window.__releaseDaily.splice(0).forEach(resolve => resolve())");
    await graph("2026-11-04");
    assert.equal(await ev("!!document.querySelector('[aria-label=\"Expand puzzle to full screen\"]')"), await ev("document.fullscreenEnabled"));
    assert.equal(await ev("document.title"), getRouteMetadata("/daily/2026-11-04", "2026-11-07").title);
    assert.equal(await ev("document.querySelector('meta[property=\"og:url\"]').content"), "https://3color.app/daily/2026-11-04");
    assert.equal(await ev("window.__dailyRequests.length"), 1);
    await reload();
    await graph("2026-11-04");
    assert.equal(await ev("location.pathname"), "/daily/2026-11-04");
    assert.equal(await ev("window.__dailyRequests.length"), 0);
    assert.deepEqual(await progress(), original);
    assert.equal(await ev("document.querySelectorAll('.vertexGroup text').length"), 0);
    assert.ok(await ev("Array.from(document.querySelectorAll('.vertexGroup')).every(vertex => vertex.getAttribute('aria-label'))"));
  });
  await t.test("calendar, back/forward and Back to Today follow URLs without duplicate analytics", async () => {
    await select("2026-11-05");
    assert.equal((await events("daily_history_select")).length, 2);
    await ev("history.back()");
    await until("location.pathname === '/daily/2026-11-04'"); await graph("2026-11-04");
    await ev("history.forward()");
    await until("location.pathname === '/daily/2026-11-05'"); await graph("2026-11-05");
    assert.equal((await events("daily_history_select")).length, 4);
    await select("2026-11-07");
    assert.equal(await ev("document.querySelector('.dailyTodayButton')"), null);
    await select("2026-11-06");
    await button("Back to Today");
    await until("location.pathname === '/daily'"); await graph("2026-11-07");
    assert.equal(await ev("document.querySelector('link[rel=canonical]').href"), "https://3color.app/daily/2026-11-07");
    assert.deepEqual(await events("daily_return_today"), [
      { date_key: "2026-11-07", from_date: "2026-11-05", source: "calendar" },
      { date_key: "2026-11-07", from_date: "2026-11-06", source: "button" },
    ]);
    assert.equal((await events("game_start")).length, 1);
    assert.equal(await ev("window.__dailyRequests.length"), 0);
    assert.deepEqual(await progress(), original);
    await ev("document.querySelector('.brand').click()");
    await until("!!document.querySelector('.primaryHomeButton')");
    await until("document.querySelector('link[rel=canonical]')?.href === 'https://3color.app/'");
    assert.equal(await ev("document.querySelectorAll('link[rel=canonical]').length"), 1);
    await ev("document.querySelector('.primaryHomeButton').click()");
    await until("location.pathname === '/daily'"); await graph("2026-11-07");
  });
  await t.test("a late dated solve preserves on-time progress and does not repair the current streak", async () => {
    await select("2026-11-05");
    const puzzle = getDailyPuzzleForDate("2026-11-05");
    const solution = solveThreeColoring(puzzle, { dynamic: true }).solution;
    for (let i = 0; i < puzzle.vertices.length; i++) {
      for (let color = 0; color <= solution[puzzle.vertices[i].id]; color++) {
        await ev(`document.querySelectorAll('.vertexGroup')[${i}].dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
      }
    }
    await until(`JSON.parse(localStorage.getItem('${DAILY_PROGRESS_KEY}')).byPuzzleId['${puzzle.id}']?.['2026-11-05']?.completed === true`);
    assert.equal(await ev("document.querySelector('.dailyStreakReinforcement')"), null);
    assert.match(await ev("document.querySelector('.dailyStreakCurrent').textContent"), /1 day/);
    assert.match(await ev("document.querySelector('.dailyStreakBest').textContent"), /Best: 1 day/);
    const saved = await progress();
    for (const [id, records] of Object.entries(original.byPuzzleId)) assert.deepEqual(saved.byPuzzleId[id], records);
    assert.equal(saved.byPuzzleId[puzzle.id]["2026-11-05"].firstCompletedAt, "2026-11-07T17:00:00.000Z");
    await button("Replay Daily Puzzle");
    await until("!document.querySelector('.completionCard')");
    await button("Reset Puzzle");
    assert.equal(await ev("location.pathname"), "/daily/2026-11-05");
    assert.equal((await progress()).byPuzzleId[puzzle.id]["2026-11-05"].attempts.length, 1);
  });
  await t.test("Daily sharing uses saved bests, credited streaks, native cancellation and canonical clipboard fallback", async () => {
    async function solve(date, slowerThanBest = false) {
      await select(date);
      const puzzle = getDailyPuzzleForDate(date);
      const solution = solveThreeColoring(puzzle, { dynamic: true }).solution;
      if (slowerThanBest) {
        await ev("window.__realPerformanceNow = performance.now.bind(performance); window.__timeOffset = 0; performance.now = () => window.__realPerformanceNow() + window.__timeOffset");
        await ev("document.querySelector('.vertexGroup').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
        await until("Number(document.querySelectorAll('.gameStatsBar strong')[0].textContent) > 0");
        await ev("window.__timeOffset = 90000");
        await until("document.querySelectorAll('.gameStatsBar strong')[0].textContent.startsWith('1:30')");
      }
      for (let i = 0; i < puzzle.vertices.length; i++) {
        for (let color = slowerThanBest && i === 0 ? 1 : 0; color <= solution[puzzle.vertices[i].id]; color++) {
          await ev(`document.querySelectorAll('.vertexGroup')[${i}].dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
        }
      }
      await until("!!document.querySelector('.completionCard')");
      if (slowerThanBest) await ev("performance.now = window.__realPerformanceNow");
    }
    await ev("window.__shares = []; window.__clipboard = []; Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: async data => { window.__shares.push(data); } }); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__clipboard.push(text); } } })");
    await solve("2026-11-07");
    await until("document.querySelector('.dailyStreakReinforcement')?.textContent.includes('2-day streak')");
    await button("Share Result");
    await until("document.querySelector('.shareMessage')?.textContent === 'Thanks for sharing!'");
    const best = (await progress()).byPuzzleId[getDailyMetadataForDate("2026-11-07").id]["2026-11-07"].best;
    const todayData = buildDailyResultShare({ puzzle: getDailyMetadataForDate("2026-11-07"), result: best, isToday: true, currentStreak: 2 });
    assert.deepEqual(await ev("window.__shares"), [todayData]);
    assert.deepEqual(await events("daily_result_share"), [{ date_key: "2026-11-07", is_today: true, difficulty: getDailyMetadataForDate("2026-11-07").difficulty, share_method: "native" }]);
    await ev("navigator.share = async () => { throw new DOMException('Cancelled', 'AbortError'); }");
    await button("Share Result");
    assert.equal((await events("daily_result_share")).length, 1);
    assert.deepEqual(await ev("window.__clipboard"), []);
    assert.equal(await ev("document.querySelector('.shareMessage').textContent"), "Thanks for sharing!");
    await ev("navigator.share = async () => { throw new Error('Native unavailable'); }");
    await button("Share Result");
    await until("document.querySelector('.shareMessage')?.textContent === 'Result copied!'");
    assert.deepEqual(await ev("window.__clipboard"), [`${todayData.text}\n${todayData.url}`]);
    assert.equal((await events("daily_result_share"))[1].share_method, "clipboard");
    await ev("navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); }");
    await button("Share Result");
    await until("document.querySelector('.shareMessage')?.textContent.startsWith('Could not share automatically')");
    assert.equal(await ev("getComputedStyle(document.querySelector('.shareMessage')).whiteSpace"), "pre-line");
    assert.equal((await events("daily_result_share")).length, 2);
    await ev("navigator.share = async data => { window.__shares.push(data); }");
    await solve("2026-11-04", true);
    await button("Share Result");
    await until("document.querySelector('.shareMessage')?.textContent === 'Thanks for sharing!'");
    assert.deepEqual(await ev("window.__shares[1]"), { title: "3Color Daily", text: "3Color Daily · Nov 4\nFox Face · Expert\n✓ 1:12 · 0 recolors", url: "https://3color.app/daily/2026-11-04" });
    assert.equal((await events("daily_result_share"))[2].is_today, false);
    assert.equal((await events("daily_result_share")).length, 3);
    await select("2026-11-05");
  });
  await t.test("PWA serves direct dated URLs offline; cached months work and uncached history can return to Today", async () => {
    const sitemapResponse = await fetch(`${base}/sitemap.xml`);
    assert.match(sitemapResponse.headers.get("content-type"), /application\/xml/);
    assert.equal(sitemapResponse.headers.get("cache-control"), "no-store");
    const sitemap = await sitemapResponse.text();
    assert.ok(sitemap.includes("https://3color.app/daily/2026-11-04"));
    assert.equal(sitemap.includes(`https://3color.app/daily/${addDailyDays(getDailyDateKey(), 1)}`), false);
    await until("!!navigator.serviceWorker.controller");
    const precache = await ev("(async () => { const names = (await caches.keys()).filter(name => name.includes('precache')); return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname)))).flat(); })()");
    assert.ok(precache.includes("/index.html"));
    assert.equal(precache.some(path => /^\/daily\/.+\.json$/.test(path)), false);
    await server.close(); serverRunning = false;
    await reload(); await graph("2026-11-05");
    assert.equal(await ev("location.pathname"), "/daily/2026-11-05");
    await ev("sessionStorage.setItem('route-clock', '2026-12-05T17:00:00Z')");
    await go("/daily/2026-11-04"); await graph("2026-11-04");
    await go("/daily/2026-12-01");
    await until("document.querySelector('.dailyLoading')?.textContent.includes('Reconnect')");
    assert.equal(await ev("document.querySelectorAll('.vertex').length"), 0);
    await button("Back to Today");
    await until("location.pathname === '/daily' && document.querySelector('.dailyDateButton')?.textContent.includes('December 5, 2026')");
    await until("document.querySelector('.dailyLoading')?.textContent.includes('Reconnect')");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await ev("document.documentElement.scrollWidth <= innerWidth + 1"));
    assert.deepEqual(browser.errors, []);
  });
  await t.test("offline shell updates Daily metadata at New York midnight and keeps dated canonicals fixed", async () => {
    const saved = await progress();
    const setClock = async instant => {
      await ev(`window.__dailyNow = ${JSON.stringify(instant)}; sessionStorage.setItem('route-clock', window.__dailyNow); window.dispatchEvent(new Event('focus'))`);
    };
    await setClock("2026-12-06T04:59:59Z");
    await until("document.querySelector('link[rel=canonical]')?.href === 'https://3color.app/daily/2026-12-05'");
    await setClock("2026-12-06T05:00:00Z");
    await until("document.querySelector('link[rel=canonical]')?.href === 'https://3color.app/daily/2026-12-06'");
    await go("/daily/2026-11-04"); await graph("2026-11-04");
    await setClock("2026-12-07T05:00:00Z");
    assert.equal(await ev("document.querySelector('link[rel=canonical]').href"), "https://3color.app/daily/2026-11-04");
    assert.equal(await ev("document.querySelectorAll('link[rel=canonical]').length"), 1);
    assert.equal(await ev("document.querySelector('meta[name=robots]').content"), "index, follow");
    assert.deepEqual(await progress(), saved);
    assert.deepEqual(browser.errors, []);
  });
});
