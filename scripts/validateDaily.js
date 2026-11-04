import { designedDailyPuzzles } from "../src/data/daily/designed/index.js";
import { dailyDesignBankConfig } from "../src/data/daily/designConfig.js";
import { readFile } from "node:fs/promises";
import { dailyPuzzles, dailySchedule } from "./lib/dailyCatalog.js";
import { generatedDailyPuzzles } from "../src/data/daily/generated/index.js";
import { dailyOverrides } from "../src/data/daily/overrides.js";
import { dailyBankConfig as config } from "../src/data/daily/config.js";
import { getDailyDateKey } from "../src/utils/dailyDate.js";
import { calibrateDaily } from "./lib/dailyCalibration.js";
import { validateDailyBank } from "./lib/dailyValidation.js";
const ledger = JSON.parse(await readFile(new URL('../src/data/daily/integrity.json',import.meta.url),'utf8'));
const savedCalibration = JSON.parse(await readFile(new URL('../src/data/daily/calibration.json',import.meta.url),'utf8'));
const calibration = calibrateDaily();
if (JSON.stringify(calibration.campaign) !== JSON.stringify(savedCalibration.campaign) || JSON.stringify(calibration.bands) !== JSON.stringify(savedCalibration.bands)) throw new Error('Campaign calibration has changed; review Daily difficulty before release.');
const errors = validateDailyBank({puzzles:dailyPuzzles,schedule:dailySchedule,generated:generatedDailyPuzzles,designed:designedDailyPuzzles,designConfig:dailyDesignBankConfig,overrides:dailyOverrides,config,ledger,calibration,today:getDailyDateKey()});
if (errors.length) {
  errors.forEach(error=>console.error(error));
  process.exitCode = 1;
} else console.log(`Daily validation passed: ${generatedDailyPuzzles.length} original generated puzzles, ${designedDailyPuzzles.length} designed replacements, ${Object.keys(dailySchedule).length} exact dates, ${dailyOverrides.length} handcrafted overrides. ${JSON.stringify(config.difficultyCounts)}`);
