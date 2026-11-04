import { useEffect, useState } from "react";
import { getDailyPuzzleForDate } from "../data/dailyPuzzles.js";

export function useDailyPuzzle(dateKey, load = getDailyPuzzleForDate) {
  const cached = dateKey ? load.peek?.(dateKey) ?? null : null;
  const [state, setState] = useState(() => ({ dateKey, puzzle: cached, error: null }));
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const ready = dateKey ? load.peek?.(dateKey) ?? null : null;
    setState({ dateKey, puzzle: ready, error: null });
    if (dateKey && !ready) load(dateKey).then(puzzle => {
      if (!cancelled) setState({ dateKey, puzzle, error: null });
    }).catch(error => {
      if (!cancelled) setState({ dateKey, puzzle: null, error });
    });
    return () => { cancelled = true; };
  }, [dateKey, load, revision]);
  const current = cached ? { puzzle: cached, error: null } : state.dateKey === dateKey ? state : { puzzle: null, error: null };
  return { ...current, loading: Boolean(dateKey && !current.puzzle && !current.error), retry: () => setRevision(value => value + 1) };
}
