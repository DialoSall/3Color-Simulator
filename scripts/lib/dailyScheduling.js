import { addDailyDays } from "../../src/utils/dailyDate.js";
import { fingerprint } from "./dailyIntegrity.js";
import { validateDailyPuzzle } from "./dailyValidation.js";

export function planDailyReplacement({puzzle, overrides, puzzles, config, ledger, calibration, today}) {
  const errors = validateDailyPuzzle(puzzle,{calibration});
  if (errors.length) throw new Error(errors.join('\n'));
  if (puzzle.source !== 'handcrafted') throw new Error('Replacement must be handcrafted.');
  if (puzzle.dateKey <= today) throw new Error('Published/today puzzles cannot be replaced. Choose a future date.');
  if (puzzle.dateKey < config.rolloutDate || puzzle.dateKey > addDailyDays(config.rolloutDate,config.days-1)) throw new Error('Choose a date covered by the frozen bank.');
  if (puzzles.some(existing=>existing.id===puzzle.id) || ledger.puzzles[puzzle.id]) throw new Error('Use a new immutable puzzle id for a handcrafted replacement.');
  const nextLedger = structuredClone(ledger);
  nextLedger.puzzles[puzzle.id] = fingerprint(puzzle);
  nextLedger.schedule[puzzle.dateKey] = puzzle.id;
  return {
    overrides: [...overrides.filter(existing=>existing.dateKey!==puzzle.dateKey),puzzle].sort((a,b)=>a.dateKey.localeCompare(b.dateKey)),
    ledger: nextLedger,
  };
}
