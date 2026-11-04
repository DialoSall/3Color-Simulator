import { createSitemap } from "../server/sitemap.js";

export default function sitemap(request, response) {
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = 200;
  response.end(request.method === "HEAD" ? undefined : createSitemap());
}
