import { useEffect, useState } from "react";
import { getDailyDateKey, millisecondsUntilNextDaily } from "../utils/dailyDate.js";

export function useDailyDate() {
  const [dateKey, setDateKey] = useState(getDailyDateKey);
  useEffect(() => {
    let timer;
    const refresh = () => {
      window.clearTimeout(timer);
      setDateKey(getDailyDateKey());
      timer = window.setTimeout(refresh, millisecondsUntilNextDaily() + 25);
    };
    refresh();
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('focus',refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange',refresh);
      window.removeEventListener('focus',refresh);
    };
  },[]);
  return dateKey;
}
