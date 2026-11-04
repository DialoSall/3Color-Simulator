import { dailySchedule, getDailyMetadataForDate } from "../data/dailyIndex.js";
import { getDailyDateKey } from "../utils/dailyDate.js";
import { canSelectDailyDate, formatDailyDate } from "../utils/dailyRetention.js";
import { getDailyUrl } from "../utils/dailyUrl.js";

export const SITE_ORIGIN = "https://3color.app";
export const SOCIAL_IMAGE = `${SITE_ORIGIN}/3color-preview.png?v=1`;

export function getRouteMetadata(location, today = getDailyDateKey()) {
  const url = new URL(location, SITE_ORIGIN);
  let path;
  try { path = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/"; }
  catch { path = url.pathname.replace(/\/+$/, "") || "/"; }
  const metadata = (title, description, canonical, robots = "index, follow") => ({ title, description, canonical, robots });
  if (url.searchParams.has("seed") || path === "/custom") return metadata("Custom Graph | 3Color", "Create and share a custom 3Color graph puzzle. Color connected circles differently using three colors.", `${SITE_ORIGIN}/custom`);
  if (path === "/") return metadata("3Color | Graph Coloring Puzzle Game", "Play 3Color, a graph-coloring puzzle game. Try today's Daily, learn through 30 campaign levels, or create a custom graph.", `${SITE_ORIGIN}/`);
  if (path === "/daily" || path.startsWith("/daily/")) {
    const dateKey = path === "/daily" ? today : path.slice("/daily/".length);
    if (!canSelectDailyDate(dateKey, today, dailySchedule)) return metadata("Daily Puzzle Unavailable | 3Color", "This Daily puzzle is unavailable. Visit today's 3Color Daily puzzle.", null, "noindex, follow");
    const puzzle = getDailyMetadataForDate(dateKey);
    const date = formatDailyDate(dateKey);
    return metadata(`${puzzle.name} | 3Color Daily Puzzle – ${date}`, `Play the ${date} 3Color Daily puzzle, ${puzzle.name}. Solve this ${puzzle.difficulty} graph-coloring challenge using only three colors.`, getDailyUrl(dateKey));
  }
  if (path === "/levels" || /^\/levels\/([1-9]|[12]\d|30)$/.test(path)) {
    // Individual levels depend on device-local unlocks; index the public entry.
    return metadata("Campaign | 3Color", "Learn graph coloring through 30 progressive 3Color campaign levels. Connected circles must have different colors.", `${SITE_ORIGIN}/levels/1`);
  }
  return metadata("Page Unavailable | 3Color", "Explore 3Color's Daily puzzles, campaign, and custom graphs.", null, "noindex, follow");
}

// One descriptor list drives server HTML and client-side navigation updates.
export function getMetadataTags(metadata, { includeCanonical = true } = {}) {
  const tags = [{ tag: "title", key: "title", text: metadata.title }];
  const meta = (key, value, property = false) => {
    if (value !== null) tags.push({ tag: "meta", key, attributes: { [property ? "property" : "name"]: key, content: value } });
  };
  meta("description", metadata.description);
  meta("robots", metadata.robots);
  if (includeCanonical && metadata.canonical) tags.push({ tag: "link", key: "canonical", attributes: { rel: "canonical", href: metadata.canonical } });
  for (const [key, value] of Object.entries({ "og:title": metadata.title, "og:description": metadata.description, "og:url": metadata.canonical, "og:site_name": "3Color", "og:type": "website", "og:image": SOCIAL_IMAGE, "og:image:secure_url": SOCIAL_IMAGE, "og:image:type": "image/png", "og:image:width": "1200", "og:image:height": "630", "og:image:alt": "3Color graph-coloring puzzle with red, blue, and yellow circles" })) meta(key, value, true);
  for (const [key, value] of Object.entries({ "twitter:card": "summary_large_image", "twitter:title": metadata.title, "twitter:description": metadata.description, "twitter:image": SOCIAL_IMAGE })) meta(key, value);
  return tags;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function renderMetadata(metadata, options) {
  return getMetadataTags(metadata, options).map(({ tag, key, text, attributes = {} }) => {
    const attrs = Object.entries({ "data-seo": key, ...attributes }).map(([name, value]) => `${name}="${escapeHtml(value)}"`).join(" ");
    return tag === "title" ? `<title ${attrs}>${escapeHtml(text)}</title>` : `<${tag} ${attrs}>`;
  }).join("\n");
}

export function renderPageMetadata(html, metadata, options) {
  const marker = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/g;
  if ([...html.matchAll(marker)].length !== 1) throw new Error("Expected one SEO block in the application shell.");
  return html.replace(marker, () => `<!-- seo:start -->\n${renderMetadata(metadata, options)}\n<!-- seo:end -->`);
}
