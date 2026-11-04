import sitemap from "../api/sitemap.js";
import page from "../api/page.js";
import { getRouteMetadata, renderPageMetadata } from "../src/seo/metadata.js";

export default function seoPlugin() {
  return {
    name: "3color-route-metadata",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        // The reusable/offline shell deliberately has no canonical. The server
        // supplies one for each HTML response; JS supplies one on static hosts.
        return renderPageMetadata(html, getRouteMetadata(context.server ? context.originalUrl ?? context.path : "/"), { includeCanonical: Boolean(context.server) });
      },
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (new URL(request.url, "http://localhost").pathname === "/sitemap.xml") sitemap(request, response);
        else next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url, "http://localhost").pathname;
        if (path === "/sitemap.xml") sitemap(request, response);
        else if (/^\/(daily|levels|custom)(\/|$)/.test(path) && !path.endsWith(".json")) page(request, response).catch(next);
        else next();
      });
    },
  };
}
