import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dailyPuzzles, dailySchedule } from "./lib/dailyCatalog.js";
import { handcraftedPuzzles } from "../src/data/daily/handcrafted.js";

const checking = process.argv.includes("--check");
const root = new URL("../", import.meta.url);
const byId = new Map(dailyPuzzles.map(puzzle => [puzzle.id, puzzle]));
const months = new Map();
const metadata = [];
for (const [dateKey, id] of Object.entries(dailySchedule).sort()) {
  const puzzle = byId.get(id);
  if (!puzzle) throw new Error(`Missing source puzzle: ${id}`);
  const month = dateKey.slice(0, 7);
  if (!months.has(month)) months.set(month, new Map());
  months.get(month).set(id, puzzle);
  metadata.push({ dateKey, id, name: puzzle.name, difficulty: puzzle.difficulty, source: puzzle.source, version: puzzle.version, payload: month, hasDesign: Boolean(puzzle.design) });
}
const outputs = new Map();
const urls = {};
for (const [month, puzzles] of months) {
  const content = JSON.stringify({ schemaVersion: 1, month, puzzles: [...puzzles.values()] }) + "\n";
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  const path = `public/daily/${month}.${hash}.json`;
  urls[month] = `/daily/${month}.${hash}.json`;
  outputs.set(path, content);
}
const legacy = handcraftedPuzzles.map(({ id, dateKey }) => ({ id, dateKey }));
outputs.set("src/data/daily/runtimeIndex.generated.js", `// Derived by generate:daily-runtime. No graph payloads; do not hand-edit.\nexport const dailyMetadata = ${JSON.stringify(metadata, null, 2)};\nexport const dailyPayloads = ${JSON.stringify(urls, null, 2)};\nexport const legacyDailyMetadata = ${JSON.stringify(legacy, null, 2)};\n`);
if (!checking) await mkdir(new URL("public/daily/", root), { recursive: true });
for (const [path, content] of outputs) {
  if (checking) {
    const existing = await readFile(new URL(path, root), "utf8").catch(() => null);
    if (existing !== content) throw new Error(`Stale/missing runtime data: ${path}. Run npm run generate:daily-runtime.`);
  } else await writeFile(new URL(path, root), content);
}
for (const name of await readdir(new URL("public/daily/", root))) {
  if (!outputs.has(`public/daily/${name}`)) {
    if (!/^\d{4}-\d{2}\.[a-f0-9]{16}\.json$/.test(name)) throw new Error(`Unexpected file in generated Daily directory: ${name}`);
    if (checking) throw new Error(`Obsolete runtime payload: ${name}`);
    await rm(new URL(`public/daily/${name}`, root));
  }
}
console.log(`${checking ? "Verified" : "Generated"} graph-free metadata for ${metadata.length} dates and ${months.size} immutable monthly payloads. Validation-only records are excluded.`);
