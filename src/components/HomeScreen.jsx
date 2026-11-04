import { Link, useNavigate } from "react-router-dom";
import InstallPrompt from "./InstallPrompt";
import DailyGraphPreview from "./DailyGraphPreview";
import { useDailyDate } from "../hooks/useDailyDate";
import { useDailyHistory } from "../hooks/useDailyHistory";
import { getDailyMetadataForDate, MissingDailyPuzzleError } from "../data/dailyIndex";
import { useDailyPuzzle } from "../hooks/useDailyPuzzle";
import { dailyProgressService } from "../services/dailyProgress";
import { DAILY_LAUNCH_DATE } from "../utils/dailyDate";
import { formatDailyDate, getDailyStreaks } from "../utils/dailyRetention";
import { trackEvent } from "../utils/analytics";

function HomeScreen({ progressService = dailyProgressService } = {}) {
  const navigate = useNavigate();
  const today = useDailyDate();
  const launched = today >= DAILY_LAUNCH_DATE;
  const history = useDailyHistory(today, progressService, launched);
  let metadata;
  try {
    if (launched) metadata = getDailyMetadataForDate(today);
  } catch (error) {
    if (!(error instanceof MissingDailyPuzzleError)) throw error;
  }
  const { puzzle, loading, error, retry } = useDailyPuzzle(metadata ? today : null);
  const completed = Boolean(history.records.find(record => record.dateKey === today && record.puzzleId === metadata?.id)?.completed);
  const streak = getDailyStreaks(history.records, today);
  const historyReady = launched && !history.loading && !history.error;
  const streakLabel = history.error ? "Streak unavailable" : !historyReady ? "Loading streak…"
    : streak.current === 0 && !completed ? "Start your streak today" : `${streak.current} ${streak.current === 1 ? "day" : "days"}`;

  function trackCta(event) {
    trackEvent(event, {
      date_key: today,
      puzzle_id: metadata?.id ?? "unavailable",
      daily_completed: completed,
      daily_history_status: history.error ? "error" : history.loading ? "loading" : "ready",
    });
  }

  return (
    <main className="app homeApp">
      <section className="homeDaily" aria-labelledby="home-title">
        <header className="homeDailyHeading">
          <h1 id="home-title">Today's 3Color</h1>
          <h2>{metadata?.name ?? "Daily Puzzle"}</h2>
          <p className="homeDailyMeta">{metadata && <>{metadata.difficulty} <span aria-hidden="true">·</span> </>}<time dateTime={today}>{formatDailyDate(today)}</time></p>
          {completed && <span className="homeDailyCompleted"><span aria-hidden="true">✓</span> Completed today</span>}
        </header>

        {puzzle ? <DailyGraphPreview puzzle={puzzle} /> : metadata ? <div className="dailyGraphPreview dailyPreviewPlaceholder" role="status" aria-busy={loading}>
          <div className="homeGraph">{loading ? "Loading puzzle…" : "Preview unavailable. Reconnect to load this puzzle."}</div>
          <div className="homePreviewPalette" aria-hidden="true"><span /></div>
          {error && <button type="button" className="dailyLoadRetry" onClick={retry}>Try again</button>}
        </div>
          : <p className="homeDailyUnavailable">{launched ? "Today's puzzle is unavailable." : "Daily puzzles begin November 4, 2026."}</p>}

        {launched && <p className="homeDailyStreak" role="status">
          <span aria-hidden="true">🔥</span>{" "}{streakLabel}
          {historyReady && streak.best > 0 && <span className="homeDailyBest"> · Best {streak.best}</span>}
        </p>}

        <div className="homeActions">
          <button type="button" className="primaryHomeButton" onClick={() => { trackCta("homepage_daily_click"); navigate("/daily"); }}>
            {completed ? "Replay Today's Puzzle" : "Play Today's Puzzle"}
          </button>
        </div>
        <p className="homeDailyRule">3 colors. Connected circles can't match.</p>
        <Link className="homeCampaignLink" to="/levels/1" onClick={() => trackCta("homepage_campaign_click")}>New to 3Color? Start with Level 1 →</Link>
        <InstallPrompt />
      </section>
    </main>
  );
}

export default HomeScreen;
