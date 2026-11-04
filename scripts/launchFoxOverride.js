// Owner-authorized, pinned launch-day exception. The general scheduling command
// still rejects today/past dates. This script cannot select another date or graph.
import { readFile, writeFile } from "node:fs/promises";
import { handcraftedPuzzles } from "../src/data/daily/handcrafted.js";
import { generatedDailyPuzzles } from "../src/data/daily/generated/index.js";
import { dailyOverrides } from "../src/data/daily/overrides.js";
import { fingerprint } from "./lib/dailyIntegrity.js";
import { validateDailyPuzzle } from "./lib/dailyValidation.js";
import { calibrateDaily } from "./lib/dailyCalibration.js";

const dateKey = "2026-11-04";
const id = "daily-2026-11-04-fox-v2";
const historical = handcraftedPuzzles.find(puzzle => puzzle.id === "daily-002");
const original = generatedDailyPuzzles.find(puzzle => puzzle.dateKey === dateKey);
if (!historical || original?.id !== "daily-2026-11-04-v1") throw new Error("Unexpected launch source puzzles.");
const fox = { ...structuredClone(historical), id, dateKey, version: 2, source: "handcrafted" };
const errors = validateDailyPuzzle(fox, { calibration: calibrateDaily() });
if (errors.length) throw new Error(errors.join("\n"));

const ledgerPath = new URL("../src/data/daily/integrity.json", import.meta.url);
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
for (const source of [historical, original]) {
  if (ledger.puzzles[source.id] !== fingerprint(source)) throw new Error(`Frozen source changed: ${source.id}`);
}
if (![original.id, id].includes(ledger.schedule[dateKey])) throw new Error("Unexpected launch-day schedule; refusing replacement.");
if (ledger.puzzles[id] && ledger.puzzles[id] !== fingerprint(fox)) throw new Error("Launch Fox identity is already locked to different content.");
const existing = dailyOverrides.filter(puzzle => puzzle.dateKey === dateKey);
if (existing.length > 1 || (existing.length && fingerprint(existing[0]) !== fingerprint(fox))) throw new Error("Unexpected launch override; refusing replacement.");
const installed = existing.length === 1 && ledger.schedule[dateKey] === id && ledger.puzzles[id] === fingerprint(fox);
if (process.argv.includes("--check")) {
  if (!installed) throw new Error("Launch Fox override is missing or inconsistent.");
} else if (!installed) {
  const overrides = [...dailyOverrides.filter(puzzle => puzzle.dateKey !== dateKey), fox].sort((a,b) => a.dateKey.localeCompare(b.dateKey));
  ledger.puzzles[id] = fingerprint(fox);
  ledger.schedule[dateKey] = id;
  await writeFile(new URL("../src/data/daily/overrides.js", import.meta.url), `// Managed by schedule:daily. Launch Fox installed by scripts/launchFoxOverride.js.\nexport const dailyOverrides = ${JSON.stringify(overrides, null, 2)};\n`);
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
}
console.log(`Launch Fox override ${process.argv.includes("--check") ? "verified" : "installed"}: ${id}. Historical Fox and generated safety bank preserved.`);
