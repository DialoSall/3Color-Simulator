import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import page from "../api/page.js";
import sitemap from "../api/sitemap.js";

const shell = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
assert.doesNotMatch(shell, /rel="canonical"/);
assert.equal((shell.match(/<title\b/g) ?? []).length, 1);
assert.match(await readFile(new URL("../dist/robots.txt", import.meta.url), "utf8"), /^Sitemap: https:\/\/3color.app\/sitemap\.xml$/m);
await assert.rejects(access(new URL("../dist/sitemap.xml", import.meta.url)));
const routing = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
assert.equal(routing.functions["api/page.js"].includeFiles, "dist/index.html");
assert.equal(routing.rewrites[0].source, "/sitemap.xml");
assert.equal(routing.rewrites[0].destination, "/api/sitemap");
assert.ok(routing.headers.some(rule => rule.headers.some(header => header.value.includes("immutable"))));

async function response(handler, url, method = "GET") {
  const result = { headers: {} };
  await handler({ url, method }, { setHeader: (name, value) => { result.headers[name] = value; }, set statusCode(value) { result.status = value; }, end: body => { result.body = body; } });
  return result;
}
const NativeDate = globalThis.Date;
let now = "2026-11-05T04:59:59Z";
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return NativeDate.parse(now); }
};
try {
  const launch = await response(page, "/api/page?routePath=/daily/2026-11-04");
  assert.equal(launch.status, 200);
  assert.equal(launch.headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(launch.headers["Cache-Control"], "no-store");
  assert.match(launch.body, /Fox Face \| 3Color Daily Puzzle – November 4, 2026/);
  assert.match(launch.body, /rel="canonical" href="https:\/\/3color.app\/daily\/2026-11-04"/);
  assert.match(launch.body, /\/assets\/.+\.js/);
  const future = await response(page, "/api/page?routePath=/daily/2026-11-05");
  assert.match(future.body, /content="noindex, follow"/);
  assert.doesNotMatch(future.body, /Butterfly|Expert|rel="canonical"/);
  const before = await response(sitemap, "/sitemap.xml");
  assert.equal(before.headers["Cache-Control"], "no-store");
  assert.equal(before.headers["Content-Type"], "application/xml; charset=utf-8");
  assert.match(before.body, /daily\/2026-11-04/);
  assert.doesNotMatch(before.body, /daily\/2026-11-05/);
  now = "2026-11-05T05:00:00Z";
  const after = await response(sitemap, "/sitemap.xml");
  assert.match(after.body, /daily\/2026-11-05/);
  assert.doesNotMatch(after.body, /daily\/2026-11-06/);
  const today = await response(page, "/api/page?routePath=/daily");
  assert.match(today.body, /rel="canonical" href="https:\/\/3color.app\/daily\/2026-11-05"/);
  assert.match(today.body, /Butterfly/);
  assert.equal((await response(sitemap, "/sitemap.xml", "HEAD")).body, undefined);
} finally { globalThis.Date = NativeDate; }
console.log("Production SEO shell, server HTML/social tags, sitemap endpoint, midnight rollover and Vercel wiring checks passed.");
