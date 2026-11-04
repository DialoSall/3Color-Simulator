import { useCallback, useEffect, useRef, useState } from "react";
import { DAILY_LAUNCH_DATE } from "../utils/dailyDate.js";
import { dailySchedule } from "../data/dailyIndex.js";
import { getPublicDailyHistory } from "../utils/dailyRetention.js";

export function useDailyHistory(today, service, enabled) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef({ id: 0, mounted: false });
  const refresh = useCallback(async () => {
    const state = request.current;
    if (!state.mounted || !enabled || today < DAILY_LAUNCH_DATE) return;
    const id = ++state.id;
    setLoading(true);
    try {
      const history = await service.getHistory({ startDate: DAILY_LAUNCH_DATE, endDate: today });
      if (state.id !== id || !state.mounted) return;
      setRecords(getPublicDailyHistory(history, today, dailySchedule));
      setError("");
    } catch {
      if (state.id === id && state.mounted) setError("Daily history could not be loaded. You can still play.");
    } finally {
      if (state.id === id && state.mounted) setLoading(false);
    }
  }, [today, service, enabled]);
  useEffect(() => {
    const state = request.current;
    state.mounted = true;
    refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      state.mounted = false;
      state.id++;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  return { records, loading, error, refresh };
}
