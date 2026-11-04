import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getRouteMetadata, renderPageMetadata, SITE_ORIGIN } from "../src/seo/metadata.js";

let shell;
export default async function page(request, response) {
  const url = new URL(request.url, SITE_ORIGIN);
  const path = url.searchParams.get("routePath") ?? url.pathname;
  url.searchParams.delete("routePath");
  shell ??= readFile(join(process.cwd(), "dist/index.html"), "utf8");
  const metadata = getRouteMetadata(path + url.search);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  // Neither future noindex responses nor /daily canonicals may outlive midnight.
  response.setHeader("Cache-Control", "no-store");
  response.statusCode = 200;
  response.end(request.method === "HEAD" ? undefined : renderPageMetadata(await shell, metadata));
}
