// Offline visual review: build first, then pass a phase label and output directory.
// Uses the real production renderer in an isolated browser; never a player's profile.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { preview } from "vite";
import { levels } from "../src/data/levels.js";
import { connect, pause, waitFor } from "./lib/browserHarness.js";
import { solveThreeColoring } from "./lib/dailyGraph.js";

const phase = process.argv[2] ?? "review";
const output = resolve(process.argv[3] ?? "/private/tmp/3color-campaign-layouts");
await mkdir(output, { recursive: true });
const candidates = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
let binary;
for (const path of candidates) { try { await access(path); binary = path; break; } catch { /* Try another browser. */ } }
assert.ok(binary, "Install Chrome or set CHROME_PATH.");
const profile = await mkdtemp(join(tmpdir(), "3color-campaign-review-"));
const server = await preview({ preview: { host: "127.0.0.1", port: 0, strictPort: true }, logLevel: "silent" });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const chrome = spawn(binary, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-sync", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let browser;
try {
  const port = await waitFor(async () => {
    try { return (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; } catch { return null; }
  }, "Chrome debugging endpoint");
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  browser = await connect(pages.find(page => page.type === "page").webSocketDebuggerUrl);
  const { send, evaluate: ev } = browser;
  const until = expression => waitFor(() => ev(expression), expression);
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["*googletagmanager.com*", "*google-analytics.com*", "*vercel-insights.com*"] });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    localStorage.setItem('3color-highest-completed-level', '29');
    localStorage.setItem('3color-appearance', 'light');
    localStorage.setItem('3color-sound-enabled', 'false');
    window.__campaignRequests = [];
    const nativeFetch = fetch.bind(window);
    window.fetch = (...args) => { window.__campaignRequests.push(String(args[0])); return nativeFetch(...args); };
  ` });
  const result = { phase, viewports: {} };
  for (const [device, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: device === "mobile" });
    const images = [], measurements = [];
    for (const level of levels.slice(19)) {
      await send("Page.navigate", { url: `${base}/levels/${level.id}` });
      await until(`(document.querySelector('.mobileGameIdentity h1')?.textContent === ${JSON.stringify(level.name)} || document.querySelector('.gameHeading h1')?.textContent.startsWith('Level ${level.id} ')) && document.querySelectorAll('.vertexGroup').length === ${level.vertices.length}`);
      if (width <= 600) await ev("document.querySelector('[aria-label=\"Fit graph to screen\"]').click()");
      await pause(60);
      const measurement = await ev(`(() => {
        const graph = document.querySelector('.graphCanvas'), wrap = document.querySelector('.graphCanvasWrap');
        const rect = wrap.getBoundingClientRect(), svg = graph.getBoundingClientRect();
        const circles = [...graph.querySelectorAll('.vertex')].map(circle => { const r = circle.getBoundingClientRect(); return { width: r.width, x: r.x, y: r.y, right: r.right, bottom: r.bottom }; });
        return { level: ${level.id}, clip: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height, scale: 1 }, graphWidth: svg.width, graphHeight: svg.height,
          minCircleDiameter: Math.min(...circles.map(circle => circle.width)),
          clipped: circles.some(circle => circle.x < svg.x || circle.y < svg.y || circle.right > svg.right || circle.bottom > svg.bottom),
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          labels: graph.querySelectorAll('text').length,
          dailyPayloadRequests: window.__campaignRequests.filter(url => /\\/daily\\/.+\\.json/.test(url)).length };
      })()`);
      assert.equal(measurement.clipped, false);
      assert.equal(measurement.horizontalOverflow, false);
      assert.equal(measurement.labels, 0);
      assert.equal(measurement.dailyPayloadRequests, 0);
      const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: measurement.clip });
      await writeFile(join(output, `${phase}-${device}-${level.id}.png`), Buffer.from(data, "base64"));
      images.push({ name: `${level.id} · ${level.name}`, data });
      measurements.push(measurement);
      if ([25, 27, 28, 29, 30].includes(level.id)) {
        // Actual pointer/touch input at circle centers, then keyboard/solve/reset.
        const target = async index => ev(`(() => { const vertex = document.querySelectorAll('.vertexGroup')[${index}]; vertex.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = vertex.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        for (const index of [0, 1]) {
          const point = await target(index);
          if (device === "mobile") {
            await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
            await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          } else {
            await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
            await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
          }
          await until(`document.querySelectorAll('.vertexGroup')[${index}].getAttribute('aria-label').includes(', red,')`);
        }
        assert.ok(await ev("document.querySelectorAll('.conflictEdge').length > 0"));
        await ev("(document.querySelector('[aria-label=\"Reset puzzle\"]') ?? [...document.querySelectorAll('button')].find(button => button.textContent === 'Reset Puzzle')).click()");
        await until("[...document.querySelectorAll('.vertexGroup')].every(vertex => vertex.getAttribute('aria-label').includes('uncolored'))");
        await ev("document.querySelector('.vertexGroup').focus()");
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        await until("document.querySelector('.vertexGroup').getAttribute('aria-label').includes(', red,')");
        await ev("document.querySelector('[aria-label=\"Zoom in\"]').click()");
        await until("document.querySelector('.graphCanvasWrap').dataset.zoom === '110'");
        await ev("document.querySelector('[aria-label=\"Fit graph to screen\"]').click()");
        const solution = solveThreeColoring(level, { dynamic: true }).solution;
        for (let i = 0; i < level.vertices.length; i++) {
          const color = await ev(`document.querySelectorAll('.vertexGroup')[${i}].getAttribute('aria-label').split(', ')[1]`);
          const steps = (solution[level.vertices[i].id] + 1 - ["uncolored", "red", "blue", "yellow"].indexOf(color) + 4) % 4;
          for (let step = 0; step < steps; step++) await ev(`document.querySelectorAll('.vertexGroup')[${i}].dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
        }
        await until("!!document.querySelector('.completionCard')");
        assert.equal(await ev("localStorage.getItem('3color-highest-completed-level')"), "29");
        assert.equal(await ev("document.querySelectorAll('.conflictEdge').length"), 0);
      }
    }
    const sheet = await ev(`(async () => {
      const images = ${JSON.stringify(images)};
      const cellWidth = ${device === "desktop" ? 540 : 390};
      const loaded = await Promise.all(images.map(async item => { const image = new Image(); image.src = 'data:image/png;base64,' + item.data; await image.decode(); return { ...item, image }; }));
      const rowHeight = Math.ceil(Math.max(...loaded.map(item => item.image.height * (cellWidth - 24) / item.image.width))) + 58;
      const canvas = document.createElement('canvas'); canvas.width = cellWidth * 3; canvas.height = rowHeight * Math.ceil(loaded.length / 3) + 48;
      const context = canvas.getContext('2d'); context.fillStyle = '#f5f5f7'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#1d1d1f'; context.font = 'bold 20px system-ui'; context.fillText(${JSON.stringify(`${phase} · ${device} ${width}×${height} · actual Campaign renderer`)}, 14, 30);
      loaded.forEach(({ name, image }, i) => { const x = i % 3 * cellWidth + 12, y = Math.floor(i / 3) * rowHeight + 48;
        context.font = 'bold 17px system-ui'; context.fillText(name, x, y + 22); context.drawImage(image, x, y + 36, cellWidth - 24, image.height * (cellWidth - 24) / image.width); });
      return canvas.toDataURL('image/png').split(',')[1];
    })()`);
    await writeFile(join(output, `${phase}-${device}.png`), Buffer.from(sheet, "base64"));
    result.viewports[device] = measurements;
  }
  assert.deepEqual(browser.errors, []);
  await writeFile(join(output, `${phase}-measurements.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Captured all 11 Campaign graphs at desktop and mobile sizes: ${output}/${phase}-{desktop,mobile}.png`);
} finally {
  browser?.close();
  if (chrome.exitCode === null) {
    const exited = new Promise(resolve => chrome.once("exit", resolve));
    chrome.kill("SIGTERM"); await exited;
  }
  await server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
