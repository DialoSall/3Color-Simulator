import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dailyPayloads } from "../src/data/daily/runtimeIndex.generated.js";

const root = new URL("../dist/", import.meta.url);
const worker = await readFile(new URL("sw.js", root), "utf8");
for (const url of Object.values(dailyPayloads)) {
  const file = url.split("/").at(-1);
  if (worker.includes(file)) throw new Error(`Daily payload was precached: ${file}`);
  const content = await readFile(new URL(`.${url}`, root));
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  if (!file.includes(`.${hash}.json`)) throw new Error(`Daily payload hash mismatch: ${file}`);
}
for (const file of await readdir(new URL("assets/", root))) {
  if (!file.endsWith(".js")) continue;
  const content = await readFile(new URL(`assets/${file}`, root), "utf8");
  if (/3color-daily-bank-v1:|3color-daily-design-v2:/.test(content)) throw new Error(`Daily graph bank leaked into initial JS: ${file}`);
}
console.log(`Production keeps ${Object.keys(dailyPayloads).length} hashed monthly JSON payloads outside JS and the PWA precache.`);
