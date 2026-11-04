# Daily search metadata and discovery

## One metadata policy

`src/seo/metadata.js` resolves each route using the lightweight Daily index and
existing New York date/availability utilities. It never imports graph payloads,
the full source catalog, saved results, or solution/color data. A single tag
descriptor list drives both escaped HTML generation and browser head updates.

For a valid dated Daily, the exact patterns are:

```text
{name} | 3Color Daily Puzzle – {Month D, YYYY}
Play the {Month D, YYYY} 3Color Daily puzzle, {name}. Solve this {difficulty} graph-coloring challenge using only three colors.
```

Example: `Fox Face | 3Color Daily Puzzle – November 4, 2026`.
Open Graph and Twitter titles/descriptions use those same values. The existing
`https://3color.app/3color-preview.png?v=1` image remains unchanged. This does not
change the result-share text or add per-puzzle images.

| Route | Canonical | Robots |
| --- | --- | --- |
| `/` (including tracking queries) | `https://3color.app/` | index, follow |
| `/daily` | Today's public dated URL | index, follow |
| Public `/daily/YYYY-MM-DD` | Its own dated URL | index, follow |
| Future/pre-launch/malformed/missing Daily | None; generic unavailable metadata | noindex, follow |
| Campaign routes | `https://3color.app/levels/1` | index, follow |
| `/custom`, including seeded entry URLs | `https://3color.app/custom` | index, follow |
| Other unmatched routes | None until the existing router redirects | noindex, follow |

Campaign levels depend on device-local unlocks and redirect new visitors to Level
1. They consolidate to the public campaign entry rather than advertising locked
level pages. This affects only metadata, not progression or routes. Custom seeds
keep working; they share the generic Custom canonical without putting seeds or
graph data into metadata.

## Initial HTML, navigation, and canonical consistency

`api/page.js` reads the built Vite `dist/index.html` shell, replaces its managed
SEO block using the route policy, and returns the same app/assets. This is head
rendering, not React gameplay SSR. Shared dated URLs therefore have useful title,
description, canonical, and social tags in their initial network HTML, including
for crawlers that do not run JavaScript. The response is the same for bots and
users; there is no user-agent-specific rendering.

`RouteMetadata` is the only browser head writer. It updates managed tags after
navigation and New York midnight through the existing `useDailyDate` hook. It
does not start attempts, access progress storage, or fetch graph payloads.
Historical dated canonicals stay fixed while `/daily` follows the actual day.

The reusable `index.html` shell contains homepage-oriented fallback metadata but
**no canonical**. Vite generates those fallback tags from the same resolver.
This matters for the static homepage, local/static hosting, and the PWA shell:
JavaScript inserts one correct canonical without first declaring a conflicting
root canonical. Server-rendered app responses already declare the correct
canonical, and the browser writes the same value on initial render. This follows
[Google's JavaScript canonical guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
No date-specific metadata is frozen into the offline shell.

Unavailable Daily routes are checked before looking up a puzzle, so their HTML
and rendered head contain no puzzle name/difficulty/payload information. They
get the generic title `Daily Puzzle Unavailable | 3Color`, generic description,
and `noindex, follow`, without a canonical or `og:url`. Responses are `no-store`
so a pre-publication response does not remain cached when the date becomes public.
The existing graph delivery/index remains as designed; this is route-output
privacy, not protection of the already-public source repository or monthly assets.

## Dynamic sitemap

`server/sitemap.js` builds XML from date/ID schedule metadata. `api/sitemap.js`
serves it at the unchanged `/sitemap.xml` URL through a rewrite, computing the
current America/New_York date on **each request**. `Cache-Control: no-store`
prevents responses from spanning a day boundary. No cron job, database, manual
daily edits, rebuilds, or graph downloads are needed to release the next URL.

It includes the homepage, `/daily`, `/levels/1`, `/custom`, and every scheduled
public Daily from launch through today. The explicitly requested `/daily` alias
remains listed alongside its dated canonical. Pre-launch compatibility dates,
tomorrow, nonexistent dates, arbitrary seeds, and locked Campaign levels are
excluded. After the current bank ends, the list stops at November 3, 2027; extend
the source schedule through the existing authoring workflow for the next bank.

There are no speculative `lastmod`, priority, or change-frequency fields. The
repository has no authoritative per-page significant-edit timestamps, and a
puzzle date is not an edit timestamp. See
[Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
`public/sitemap.xml` was removed so Vercel's filesystem precedence cannot shadow
the function. `robots.txt` keeps `Sitemap: https://3color.app/sitemap.xml`.

## Vercel, local preview, and PWA

Two standard Node Vercel Functions are added, without a framework/dependency
change. `vercel.json` explicitly includes `dist/index.html` in the page function;
the sitemap rewrite precedes the SPA catch-all, which now returns the metadata
shell through `api/page`. Static files take precedence over rewrites, preserving
hashed Daily JSON, images, manifest, JS/CSS, and service-worker delivery. The
existing immutable Daily JSON header rule is unchanged. See Vercel's
[configuration reference](https://vercel.com/docs/project-configuration/vercel-json)
and [Vite function support](https://vercel.com/docs/frameworks/frontend/vite).

The Vite SEO plugin applies the same head policy during development, serves the
sitemap locally, and exposes the production page handler in `npm run preview`.
Root/static HTML still exercises canonical insertion through the client.

Workbox keeps `/index.html` as its offline navigation fallback. Daily graph JSON
is still excluded from precache. API and sitemap paths are excluded from the
navigation fallback, so `/sitemap.xml` cannot accidentally return app HTML offline.
No runtime graph cache behavior changed. Offline navigation/refresh of cached
puzzles updates metadata through the same browser component without a server.

## Structured-data decision

No JSON-LD is added. A browser game could fit Google's software-app feature using
`WebApplication`, but that feature requires a real rating/review as well as app
name and price. This project has no genuine visible rating or review data.
Standalone `VideoGame` does not qualify for that rich result; generic Game/WebPage
markup alone offers no supported feature needed here. Inventing reviews or adding
ineligible markup would be misleading. Revisit only with real supporting content.
See [Google's software-app requirements](https://developers.google.com/search/docs/appearance/structured-data/software-app).

## Verification and remaining deployment checks

`test:seo` covers route patterns, canonicals, unavailable-date privacy, social
tags/image, escaped HTML, New York midnight/DST, sitemap discovery and bank end.
`check:seo-production` runs after each build and exercises the actual Node
handlers against the built shell, including a simulated midnight with no rebuild.
It also checks that no static sitemap/root canonical can shadow dynamic output.

The production-browser suite checks initial HTML and rendered head, unique
canonicals after calendar/back/forward/home navigation, Daily canonical rollover
offline, historical stability, actual XML responses, sharing behavior, and cached
graph/app-shell operation with the server stopped. The full existing validation
suite also checks both frozen banks, Fox, progress, tutorials, and sharing.

Before publication, Vercel's actual deployed packaging/rewrite precedence cannot
be fully verified by the local preview. After deploying, inspect raw HTML and the
rendered head for the launch URL, `/daily`, unavailable future dates, and the live
sitemap. Confirm the JSON immutable header and cached PWA refresh still work.
Google still controls discovery/crawl/render timing, indexing, chosen canonical,
and snippets; a sitemap and correct tags do not guarantee inclusion or ranking.
The game body still needs JavaScript rendering. Social platforms may cache older
previews until their next fetch.

## Changed files

- Metadata: `src/seo/metadata.js`, `src/components/RouteMetadata.jsx`, `src/App.jsx`,
  and `index.html`.
- Delivery: `api/page.js`, `api/sitemap.js`, `server/sitemap.js`,
  `server/seoPlugin.js`, `vercel.json`, and `vite.config.js`;
  obsolete `public/sitemap.xml` removed.
- Validation: `scripts/seo.test.js`, `scripts/checkSeoProduction.js`,
  `scripts/dailyRoutes.browser.test.js`, `package.json`, and `eslint.config.js`
  (applies existing Node lint rules to the new server/API directories).
- Documentation: `README.md`, `docs/daily-puzzles.md`, and this file.
