import { readFile, readdir } from "node:fs/promises";

export default function crazygamesPlugin() {
  return {
    name: "3color-crazygames-bundle",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html
          .replace('src="/src/main.jsx"', 'src="/src/crazygames.jsx"')
          .replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, "<title>3Color</title>")
          .replace(/<meta\s+name="(?:apple-mobile-web-app-[^"]+|google-site-verification)"[^>]*\/?>/g, "")
          .replace(/<link\s+rel="apple-touch-icon"[^>]*\/?>/g, "")
          .replace(/<!-- Google tag[^]*?<script>[\s\S]*?<\/script>/, "");
      },
    },
    async generateBundle() {
      // Copy only assets used by the upload; no web/PWA/SEO deployment files.
      this.emitFile({ type: "asset", fileName: "favicon.png", source: await readFile(new URL("../public/favicon.png", import.meta.url)) });
      for (const name of await readdir(new URL("../public/daily/", import.meta.url))) {
        this.emitFile({ type: "asset", fileName: `daily/${name}`, source: await readFile(new URL(`../public/daily/${name}`, import.meta.url)) });
      }
    },
  };
}
