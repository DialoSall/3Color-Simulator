import { dailySchedule } from "../src/data/dailyIndex.js";
import { getDailyDateKey } from "../src/utils/dailyDate.js";
import { canSelectDailyDate } from "../src/utils/dailyRetention.js";
import { getDailyUrl } from "../src/utils/dailyUrl.js";
import { SITE_ORIGIN } from "../src/seo/metadata.js";

export function createSitemap(today = getDailyDateKey()) {
  // Only campaign Level 1 is publicly accessible without saved unlocks.
  const urls = ["/", "/daily", "/levels/1", "/custom"].map(path => SITE_ORIGIN + path);
  for (const dateKey of Object.keys(dailySchedule).sort()) {
    if (canSelectDailyDate(dateKey, today, dailySchedule)) urls.push(getDailyUrl(dateKey));
  }
  // Publication dates aren't evidence of subsequent edits; omit speculative lastmod.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`;
}
