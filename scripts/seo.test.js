import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getRouteMetadata, getMetadataTags, renderPageMetadata, SOCIAL_IMAGE } from "../src/seo/metadata.js";
import { createSitemap } from "../server/sitemap.js";
import { getDailyDateKey } from "../src/utils/dailyDate.js";

const today = "2026-11-07";
const canonical = date => `https://3color.app/daily/${date}`;
const locations = xml => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);

test("homepage metadata describes the game and canonicalizes query variants to the root", () => {
  const metadata = getRouteMetadata("/?utm_source=friend", today);
  assert.equal(metadata.canonical, "https://3color.app/");
  assert.match(metadata.title, /^3Color \| Graph Coloring/);
  assert.match(metadata.description, /Daily.*30 campaign levels.*custom graph/);
  assert.equal(metadata.robots, "index, follow");
});

test("/daily uses today's dated metadata and canonical, without requesting a graph", () => {
  assert.deepEqual(getRouteMetadata("/daily", today), getRouteMetadata("/daily/2026-11-07", today));
  assert.equal(getRouteMetadata("/daily", today).canonical, canonical(today));
  assert.deepEqual(Object.keys(getRouteMetadata("/daily", today)).sort(), ["canonical", "description", "robots", "title"]);
});

test("launch and historical dated routes have exact self-canonical titles and descriptions", () => {
  assert.deepEqual(getRouteMetadata("/daily/2026-11-04", today), {
    title: "Fox Face | 3Color Daily Puzzle – November 4, 2026",
    description: "Play the November 4, 2026 3Color Daily puzzle, Fox Face. Solve this Expert graph-coloring challenge using only three colors.",
    canonical: canonical("2026-11-04"), robots: "index, follow",
  });
  const historical = getRouteMetadata("/daily/2026-11-05/?utm_source=friend#graph", today);
  assert.match(historical.title, /^Butterfly \| 3Color Daily Puzzle – November 5, 2026$/);
  assert.equal(historical.canonical, canonical("2026-11-05"));
  assert.doesNotMatch(JSON.stringify(historical), /Daily #|daily-2026|vertices|edges|solution/);
});

test("future, malformed, impossible, extra-segment, pre-launch and missing dates have identical private noindex metadata", () => {
  const unavailable = getRouteMetadata("/daily/2027-01-01", today);
  for (const path of ["2026-11-08", "2026-11-03", "2026-09-22", "2026-02-30", "garbage", "2026-11-04/extra", "%E0%A4%A", "2026-11-04%2Fextra"]) {
    assert.deepEqual(getRouteMetadata(`/daily/${path}`, today), unavailable);
  }
  assert.deepEqual(getRouteMetadata("/daily/2027-11-04", "2027-11-05"), unavailable);
  assert.deepEqual(getRouteMetadata("/daily", "2026-11-03"), unavailable);
  assert.deepEqual(getRouteMetadata("/daily", "2027-11-04"), unavailable);
  assert.equal(unavailable.robots, "noindex, follow");
  assert.equal(unavailable.canonical, null);
  assert.doesNotMatch(JSON.stringify(getMetadataTags(unavailable)), /Fox|Butterfly|Expert|Hard|Challenging|payload|motif|2027/);
});

test("canonical availability follows New York midnight rather than UTC", () => {
  for (const [instant, date] of [["2026-11-05T04:59:59Z", "2026-11-04"], ["2026-11-05T05:00:00Z", "2026-11-05"], ["2027-03-15T03:59:59Z", "2027-03-14"], ["2027-03-15T04:00:00Z", "2027-03-15"]]) {
    const day = getDailyDateKey(new Date(instant));
    assert.equal(day, date);
    assert.equal(getRouteMetadata("/daily", day).canonical, canonical(date));
  }
});

test("campaign, custom, seeded and unknown routes do not inherit the homepage canonical", () => {
  for (const [path, expected] of [["/levels", "/levels/1"], ["/levels/1", "/levels/1"], ["/levels/30", "/levels/1"], ["/custom", "/custom"], ["/?seed=test", "/custom"], ["/custom?seed=test", "/custom"]]) {
    assert.equal(getRouteMetadata(path, today).canonical, `https://3color.app${expected}`);
  }
  assert.equal(getRouteMetadata("/unknown", today).robots, "noindex, follow");
  assert.equal(getRouteMetadata("/dev/preview", today).canonical, null);
});

test("social tags match the page title/description and reuse the existing generic image", () => {
  const metadata = getRouteMetadata("/daily/2026-11-04", today);
  const tags = Object.fromEntries(getMetadataTags(metadata).map(tag => [tag.key, tag]));
  for (const key of ["og:title", "twitter:title"]) assert.equal(tags[key].attributes.content, metadata.title);
  for (const key of ["og:description", "twitter:description"]) assert.equal(tags[key].attributes.content, metadata.description);
  assert.equal(tags["og:url"].attributes.content, metadata.canonical);
  for (const key of ["og:image", "twitter:image"]) assert.equal(tags[key].attributes.content, SOCIAL_IMAGE);
});

test("server rendering replaces a single managed block, escapes values and leaves shell functionality intact", async () => {
  const shell = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const metadata = getRouteMetadata("/daily/2026-11-04", today);
  const html = renderPageMetadata(shell, metadata);
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  assert.match(html, /href="https:\/\/3color.app\/daily\/2026-11-04"/);
  assert.ok(html.includes('meta name="theme-color"'));
  assert.ok(html.includes('src="/src/main.jsx"'));
  assert.ok(html.includes('id="root"'));
  assert.equal((html.match(/<title/g) ?? []).length, 1);
  assert.doesNotMatch(renderPageMetadata(shell, metadata, { includeCanonical: false }), /rel="canonical"/);
  assert.match(renderPageMetadata(shell, { ...metadata, title: '</title><script>"&' }), /&lt;\/title&gt;&lt;script&gt;&quot;&amp;/);
  assert.throws(() => renderPageMetadata("missing markers", metadata), /Expected one SEO block/);
});

test("dynamic sitemap includes public dates from launch through today, never tomorrow or history before launch", () => {
  const xml = createSitemap("2026-11-07");
  const urls = locations(xml);
  assert.deepEqual(urls.slice(0, 4), ["https://3color.app/", "https://3color.app/daily", "https://3color.app/levels/1", "https://3color.app/custom"]);
  assert.ok(urls.includes(canonical("2026-11-04")));
  assert.ok(urls.includes(canonical("2026-11-07")));
  assert.equal(urls.length, 8);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every(url => new URL(url).origin === "https://3color.app"));
  assert.doesNotMatch(xml, /2026-11-03|2026-11-08|lastmod|Fox|vertices|edges|payload/);
  assert.match(xml, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
});

test("sitemap advances at New York midnight without rebuilding, and clamps to the scheduled bank end", () => {
  assert.equal(locations(createSitemap("2026-11-03")).length, 4);
  assert.equal(locations(createSitemap("2026-11-04")).length, 5);
  const last = locations(createSitemap("2028-01-01"));
  assert.equal(last.length, 369);
  assert.equal(last.at(-1), canonical("2027-11-03"));
  assert.doesNotMatch(createSitemap("2028-01-01"), /2027-11-04|2028-01-01/);
});
