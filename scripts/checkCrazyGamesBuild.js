import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { dailyPayloads } from "../src/data/daily/runtimeIndex.generated.js";

const root = new URL("../dist-crazygames/", import.meta.url);
const files = [];
async function walk(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`);
    else {
      const content = await readFile(new URL(entry.name, directory));
      files.push({ file: prefix + entry.name, bytes: content.length, gzip: gzipSync(content).length });
    }
  }
}
await walk(root);
const html = await readFile(new URL("index.html", root), "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(match[1].startsWith("./"), `Nonrelative HTML asset: ${match[1]}`);
assert.doesNotMatch(html, /3color\.app|googletagmanager|gtag\(|apple-mobile|manifest|registerSW|canonical|og:/);
assert.ok(!files.some(({ file }) => /sw\.js|workbox|manifest|robots|sitemap|pwa-/.test(file)));
for (const { file } of files.filter(({ file }) => file.endsWith(".js"))) {
  const js = await readFile(new URL(file, root), "utf8");
  assert.doesNotMatch(js, /3color\.app|googletagmanager|_vercel|requestFullscreen|Add 3Color|beforeinstallprompt|serviceWorker\.register|CrazyGames\.SDK|sdk\.crazygames|crazygames-sdk|3color-daily-bank-v1:|3color-daily-design-v2:/);
}
for (const path of Object.values(dailyPayloads)) {
  const relative = path.replace(/^\//, "");
  const bytes = await readFile(new URL(relative, root));
  const expected = await readFile(new URL(`../public/${relative}`, import.meta.url));
  assert.deepEqual(bytes, expected);
  assert.ok(path.includes(createHash("sha256").update(bytes).digest("hex").slice(0, 16)));
}
const total = files.reduce((sum, file) => sum + file.bytes, 0);
// Without an SDK the platform evaluates the complete upload against these limits.
assert.ok(total < 20_000_000 && files.length < 1500);
assert.ok((await stat(new URL("index.html", root))).isFile());
console.log(`CrazyGames submission: ${files.length} files; ${total} bytes (${(total / 1e6).toFixed(3)} MB), below the 20 MB mobile and 50 MB Basic targets.`);
console.log("Largest assets:", files.sort((a, b) => b.bytes - a.bytes).slice(0, 6));
console.log("Verified relative entry assets, exact lazy monthly payloads, no external playable URL, SDK, PWA registration or custom fullscreen request.");
