import { Link, useNavigate } from "react-router-dom";
import InstallPrompt from "./InstallPrompt";
import DailyGraphPreview from "./DailyGraphPreview";
import { useDailyDate } from "../hooks/useDailyDate";
import { useDailyHistory } from "../hooks/useDailyHistory";
import { getDailyPuzzleForDate, MissingDailyPuzzleError } from "../data/dailyPuzzles";
import { dailyProgressService } from "../services/dailyProgress";
import { DAILY_LAUNCH_DATE } from "../utils/dailyDate";
import { formatDailyDate, getDailyStreaks } from "../utils/dailyRetention";
import { trackEvent } from "../utils/analytics";

function HomeScreen({ progressService = dailyProgressService } = {}) {
  const navigate = useNavigate();
  const today = useDailyDate();
  const launched = today >= DAILY_LAUNCH_DATE;
  const history = useDailyHistory(today, progressService, launched);
  let puzzle;
  try {
    if (launched) puzzle = getDailyPuzzleForDate(today);
  } catch (error) {
    if (!(error instanceof MissingDailyPuzzleError)) throw error;
  }
  const completed = Boolean(history.records.find(record => record.dateKey === today && record.puzzleId === puzzle?.id)?.completed);
  const streak = getDailyStreaks(history.records, today);
  const historyReady = launched && !history.loading && !history.error;
  const streakLabel = history.error ? "Streak unavailable" : !historyReady ? "Loading streak…"
    : streak.current === 0 && !completed ? "Start your streak today" : `${streak.current} ${streak.current === 1 ? "day" : "days"}`;

  function trackCta(event) {
    trackEvent(event, {
      date_key: today,
      puzzle_id: puzzle?.id ?? "unavailable",
      daily_completed: completed,
      daily_history_status: history.error ? "error" : history.loading ? "loading" : "ready",
    });
  }

  return (
    <main className="app homeApp">
      <section className="homeDaily" aria-labelledby="home-title">
        <header className="homeDailyHeading">
          <h1 id="home-title">Today's 3Color</h1>
          <h2>{puzzle?.name ?? "Daily Puzzle"}</h2>
          <p className="homeDailyMeta">{puzzle && <>{puzzle.difficulty} <span aria-hidden="true">·</span> </>}<time dateTime={today}>{formatDailyDate(today)}</time></p>
          {completed && <span className="homeDailyCompleted"><span aria-hidden="true">✓</span> Completed today</span>}
        </header>

        {puzzle ? <DailyGraphPreview puzzle={puzzle} />
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
