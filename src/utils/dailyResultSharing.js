import { formatDailyDate } from "./dailyRetention.js";
import { getDailyUrl } from "./dailyUrl.js";
import { trackEvent } from "./analytics.js";
import { IS_CRAZYGAMES } from "../platform.js";

export function buildDailyResultShare({ puzzle, result, isToday, currentStreak }) {
  const seconds = Math.floor(result.timeMilliseconds / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const lines = [
    `3Color Daily · ${formatDailyDate(puzzle.dateKey, { month: "short", day: "numeric" })}`,
    `${puzzle.name} · ${puzzle.difficulty}`,
    `✓ ${time} · ${result.recolors} ${result.recolors === 1 ? "recolor" : "recolors"}`,
  ];
  // DailyMode supplies zero until today's on-time credit is confirmed.
  if (isToday && currentStreak > 0) lines.push(`🔥 ${currentStreak}-day streak`);
  return { title: "3Color Daily", text: lines.join("\n"), ...(!IS_CRAZYGAMES ? { url: getDailyUrl(puzzle.dateKey) } : {}) };
}

export async function shareDailyResult(details, {
  navigator: navigatorApi = globalThis.navigator,
  isSecureContext = globalThis.isSecureContext,
  track = trackEvent,
} = {}) {
  const shareData = buildDailyResultShare(details);
  const clipboardText = [shareData.text, shareData.url].filter(Boolean).join("\n");
  let method;
  try {
    if (navigatorApi?.share && isSecureContext) {
      await navigatorApi.share(shareData);
      method = "native";
    }
  } catch (error) {
    if (error?.name === "AbortError") return null;
  }
  if (!method) {
    try {
      await navigatorApi.clipboard.writeText(clipboardText);
      method = "clipboard";
    } catch {
      return `Could not share automatically. Copy this result:\n${clipboardText}`;
    }
  }
  track("daily_result_share", {
    date_key: details.puzzle.dateKey,
    is_today: details.isToday,
    difficulty: details.puzzle.difficulty,
    share_method: method,
  });
  return method === "native" ? "Thanks for sharing!" : "Result copied!";
}
