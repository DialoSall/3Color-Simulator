import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import GraphCanvas from "./GraphCanvas";
import { cloneGraph, cycleVertexColor, formatGameTime } from "../utils/gameplay";
import { getConflicts, isSolved } from "../utils/graphValidation";
import { dailySchedule, getDailyMetadataForDate, MissingDailyPuzzleError } from "../data/dailyIndex";
import { useDailyPuzzle } from "../hooks/useDailyPuzzle";
import { useDailyDate } from "../hooks/useDailyDate";
import { useDailyProgress } from "../hooks/useDailyProgress";
import GameSettings from "./GameSettings";
import { useColorTheme } from "../hooks/useColorTheme";
import SoundToggle from "./SoundToggle";
import { useSoundEffects } from "../hooks/useSoundEffects";
import DailyCalendar from "./DailyCalendar";
import { useDailyHistory } from "../hooks/useDailyHistory";
import { dailyProgressService } from "../services/dailyProgress";
import { DAILY_LAUNCH_DATE } from "../utils/dailyDate";
import { canSelectDailyDate, earnsDailyStreakCredit, formatDailyDate, getDailyStreaks } from "../utils/dailyRetention";
import { trackEvent } from "../utils/analytics";
import { getDailyPath } from "../utils/dailyUrl";
import { shareDailyResult } from "../utils/dailyResultSharing";

function DailyMode({ progressService = dailyProgressService, previewDateKey } = {}) {
  const today = useDailyDate();
  const params = useParams();
  const navigate = useNavigate();
  const isPreview = import.meta.env.DEV && Boolean(previewDateKey);
  const dateKey = isPreview ? previewDateKey : params.dateKey ?? params["*"] ?? today;
  const available = isPreview || canSelectDailyDate(dateKey, today, dailySchedule);
  const isToday = dateKey === today;
  const history = useDailyHistory(today, progressService, !isPreview);
  const streaks = getDailyStreaks(history.records, today);
  const todayRecord = history.records.find(record => record.dateKey === today);
  const todayCredited = todayRecord && earnsDailyStreakCredit(todayRecord, today);
  const streakLabel = history.loading ? "Loading streak…" : history.error ? "Streak unavailable"
    : streaks.current === 0 && !todayRecord?.completed ? "Start your streak today"
    : `${streaks.current} ${streaks.current === 1 ? "day" : "days"}`;
  let metadata;
  try {
    if (available) metadata = getDailyMetadataForDate(dateKey);
  } catch (error) {
    if (!(error instanceof MissingDailyPuzzleError)) throw error;
  }
  const { puzzle, loading, error, retry } = useDailyPuzzle(metadata ? dateKey : null);
  // Measure the selected route once, including direct links and back/forward.
  const previousDate = useRef(null);
  useEffect(() => {
    if (!isPreview && available && dateKey < today && previousDate.current !== dateKey) {
      trackEvent("daily_history_select", { date_key: dateKey });
    }
    previousDate.current = dateKey;
  }, [isPreview, available, dateKey, today]);

  function chooseDate(date, source = "calendar") {
    if (!canSelectDailyDate(date, today, dailySchedule)) return;
    if (date === today && !isToday) trackEvent("daily_return_today", { date_key: date, from_date: dateKey, source });
    navigate(source === "button" ? "/daily" : getDailyPath(date));
  }

  if (!metadata) return <main className="app gameApp">
    <header className="gameHeading"><div><p className="eyebrow">Daily Puzzle</p><h1>Daily Puzzle</h1></div></header>
    <p role="status">{today < DAILY_LAUNCH_DATE ? "Daily puzzles launch November 4, 2026." : "This Daily puzzle is unavailable."}</p>
    <Link to="/daily">Back to today's Daily</Link>
  </main>;

  return <main className="app gameApp">
    <header className="gameHeading">
      <div><p className="eyebrow">Daily Puzzle</p><h1>{isPreview ? "Daily Puzzle Preview" : isToday ? "Today's 3Color" : "Past Daily Puzzle"}</h1></div>
      <p>Connected circles must have different colors.</p>
    </header>
    {isPreview ? <p className="eyebrow">{formatDailyDate(dateKey)}</p> : today >= DAILY_LAUNCH_DATE && <div className="dailyRetentionBar">
      <DailyCalendar dateKey={dateKey} today={today} records={history.records} loading={history.loading} error={history.error} schedule={dailySchedule}
        onSelect={chooseDate} onOpen={() => { history.refresh(); trackEvent("daily_calendar_open", { date_key: dateKey }); }} />
      {!isToday && <button type="button" className="dailyTodayButton" onClick={() => chooseDate(today, "button")}>Back to Today</button>}
      <div className="dailyStreaks" role="group" aria-label="Daily streaks">
        <strong className="dailyStreakCurrent" aria-label={`Current streak: ${streakLabel}`}>
          <span aria-hidden="true">🔥</span>{" "}{streakLabel}
        </strong>
        <span className="dailyStreakBest">Best: {history.loading ? "…" : history.error ? "—" : `${streaks.best} ${streaks.best === 1 ? "day" : "days"}`}</span>
      </div>
    </div>}
    {!isPreview && history.error && <p role="status">{history.error}</p>}
    {puzzle ? <DailyGame key={`${dateKey}:${puzzle.id}`} dailyPuzzle={puzzle} progressService={progressService} preview={isPreview} isToday={isToday} onCompletionSaved={history.refresh}
      currentStreak={!history.loading && !history.error && todayCredited ? streaks.current : 0} />
      : <section className="dailyLoading gamePanel" aria-busy={loading}>
        <h2>{metadata.name}</h2>
        <p role="status">{loading ? "Loading puzzle…" : "This puzzle is not available right now. Reconnect and try again."}</p>
        {error && <button type="button" className="dailyLoadRetry" onClick={retry}>Try again</button>}
      </section>}
  </main>;
}

function DailyGame({ dailyPuzzle, progressService, preview, isToday, onCompletionSaved, currentStreak }) {
  const isPreview = import.meta.env.DEV && preview;
  const {
    bestResult: savedCompletion, progressError, recordMove, recordReset,
    completeAttempt, replayAttempt,
  } = useDailyProgress(dailyPuzzle, progressService, onCompletionSaved);
  const [usePuzzleTheme, setUsePuzzleTheme] = useState(Boolean(dailyPuzzle.theme));
  const [currentPuzzle, setCurrentPuzzle] = useState(() =>
    cloneGraph(dailyPuzzle)
  );

  const [recolors, setRecolors] = useState(0);
  const [visitedVertices, setVisitedVertices] = useState(() => new Set());
  const [lastVertexId, setLastVertexId] = useState(null);
  const [resets, setResets] = useState(0);
  const [shareMessage, setShareMessage] = useState("");
  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const elapsedMillisecondsRef = useRef(0);
  const completionSoundPlayedRef = useRef(false);
  const { soundEnabled, setSoundEnabled, playSound } = useSoundEffects();

  const {
    selectedThemeId,
    setSelectedThemeId,
    customTheme,
    setCustomTheme,
    activeTheme,
  } = useColorTheme();

  const conflicts = useMemo(() => {
    return getConflicts(currentPuzzle.vertices, currentPuzzle.edges);
  }, [currentPuzzle]);

  const solved = useMemo(() => {
    return isSolved(currentPuzzle.vertices, currentPuzzle.edges);
  }, [currentPuzzle]);

  useEffect(() => {
    if (!solved) {
      completionSoundPlayedRef.current = false;
      return;
    }

    if (completionSoundPlayedRef.current) {
      return;
    }

    completionSoundPlayedRef.current = true;
    playSound("complete");
  }, [solved, playSound]);

  useEffect(() => {
    elapsedMillisecondsRef.current = elapsedMilliseconds;
  }, [elapsedMilliseconds]);

  useEffect(() => {
    if (!timerRunning || solved) {
      return;
    }

    const startedAt =
      window.performance.now() - elapsedMillisecondsRef.current;

    const intervalId = window.setInterval(() => {
      setElapsedMilliseconds(
        Math.floor(window.performance.now() - startedAt)
      );
    }, 25);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timerRunning, solved]);

  useEffect(() => {
    if (!solved) {
      return;
    }

    const result = {
      timeMilliseconds: elapsedMilliseconds,
      recolors,
      resets,
      completedAt: new Date().toISOString(),
    };

    completeAttempt(result);
  }, [
    solved,
    completeAttempt,
    elapsedMilliseconds,
    recolors,
    resets,
  ]);

  function handleVertexClick(vertexId) {
    playSound("vertex");
    recordMove();

    if (!timerRunning && !solved) {
      setTimerRunning(true);
    }

    const hasVisitedBefore = visitedVertices.has(vertexId);

    const isReturningToVertex =
      hasVisitedBefore &&
      lastVertexId !== null &&
      lastVertexId !== vertexId;

    if (isReturningToVertex) {
      setRecolors((previousRecolors) => previousRecolors + 1);
    }

    setVisitedVertices((previousVisited) => {
      const updatedVisited = new Set(previousVisited);
      updatedVisited.add(vertexId);
      return updatedVisited;
    });

    setLastVertexId(vertexId);

    const cycleVertex = vertex => cycleVertexColor(vertex, vertexId);

    const nextConflictCount = getConflicts(
      currentPuzzle.vertices.map(cycleVertex),
      currentPuzzle.edges
    ).length;

    setCurrentPuzzle((previousPuzzle) => ({
      ...previousPuzzle,
      vertices: previousPuzzle.vertices.map(cycleVertex),
    }));

    if (nextConflictCount > conflicts.length) {
      playSound("conflict");
    }
  }

  function handleReplayDailyPuzzle() {
    playSound("reset");
    replayAttempt();
    completionSoundPlayedRef.current = false;
    setCurrentPuzzle(cloneGraph(dailyPuzzle));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);
    setResets(0);
    setElapsedMilliseconds(0);
    setTimerRunning(false);
    setShareMessage("");
  }

  function handleResetColors() {
    playSound("reset");
    recordReset();
    completionSoundPlayedRef.current = false;
    setCurrentPuzzle(cloneGraph(dailyPuzzle));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);
    setResets((previousResets) => previousResets + 1);
  }

  async function handleShareResult() {
    const resultToShare = savedCompletion ?? {
      timeMilliseconds: elapsedMilliseconds,
      recolors,
      resets,
    };

    const feedback = await shareDailyResult({ puzzle: dailyPuzzle, result: resultToShare, isToday, currentStreak });
    if (feedback !== null) setShareMessage(feedback);
  }

  return (
    <>
      {progressError && <p role="status">{progressError}</p>}

      <section className={`gameLayout ${solved ? "gameLayoutSolved" : ""}`}>
        <div className="gamePanel">
          <div className="levelHeader">
            <div>
              <h2>{dailyPuzzle.name}</h2>
              <p>{dailyPuzzle.description}</p>
            </div>
          </div>

          <div className="gameStatsBar">
            <div>
              <span>Time</span>
              <strong>{formatGameTime(elapsedMilliseconds)}</strong>
            </div>

            <div>
              <span>Recolors</span>
              <strong>{recolors}</strong>
            </div>

            <div>
              <span>Resets</span>
              <strong>{resets}</strong>
            </div>

            <div>
              <span>Conflicts</span>
              <strong>{conflicts.length}</strong>
            </div>
          </div>

          {solved && (
            <div className="completionCard" role="status" aria-live="polite">
              <div className="completionBadge">✓</div>

              <p className="completionEyebrow">{isPreview ? "Daily Preview Complete" : "Daily Puzzle Complete"}</p>

              <h3>{isPreview ? "This test result stays in your preview session." : isToday ? "You completed today’s puzzle." : `You completed the puzzle for ${formatDailyDate(dailyPuzzle.dateKey)}.`}</h3>

              {!isPreview && isToday && currentStreak > 0 && <div className="dailyStreakReinforcement">
                <strong><span aria-hidden="true">🔥</span>{" "}{currentStreak === 1 ? "Streak started!" : `${currentStreak}-day streak!`}</strong>
                <p>Come back tomorrow to keep it going.</p>
              </div>}

              <div className="completionStats">
                <div>
                  <span>Best Time</span>
                  <strong>
                    {formatGameTime(
                      savedCompletion?.timeMilliseconds ?? elapsedMilliseconds
                    )}
                  </strong>
                </div>

                <div>
                  <span>Recolors</span>
                  <strong>{savedCompletion?.recolors ?? recolors}</strong>
                </div>

                <div>
                  <span>Resets</span>
                  <strong>{savedCompletion?.resets ?? resets}</strong>
                </div>
              </div>

              <div className="completionActions">
                <button
                  className="completionSecondaryButton"
                  onClick={handleReplayDailyPuzzle}
                >
                  Replay Daily Puzzle
                </button>

                {!isPreview && <button
                  className="completionPrimaryButton"
                  onClick={handleShareResult}
                >
                  Share Result
                </button>}
              </div>

              {shareMessage && <p className="shareMessage">{shareMessage}</p>}
            </div>
          )}

          <GraphCanvas
            vertices={currentPuzzle.vertices}
            edges={currentPuzzle.edges}
            conflicts={conflicts}
            onVertexClick={handleVertexClick}
            width={currentPuzzle.width}
            height={currentPuzzle.height}
            colorTheme={usePuzzleTheme ? dailyPuzzle.theme : activeTheme}
            design={dailyPuzzle.design}
            toolbar={
              <SoundToggle
                soundEnabled={soundEnabled}
                onSoundEnabledChange={setSoundEnabled}
                onPreviewSound={() => playSound("button", { force: true })}
              />
            }
           />
        </div>

        {!solved && (
          <aside className="statusPanel gameControls">
            <p className="eyebrow">Daily Status</p>

            <div className={savedCompletion ? "statusBox solved" : "statusBox"}>
              <h3>{savedCompletion ? (isToday ? "Completed Today" : "Completed") : "Not Completed Yet"}</h3>

              <p>
                {savedCompletion
                  ? `Your best time${isToday ? " today" : ""} is ${formatGameTime(
                      savedCompletion.timeMilliseconds
                    )}.`
                  : `Solve ${isToday ? "today's" : "this"} puzzle to save your result on this device.${!isToday ? " Late solves count as completed, but do not repair a streak." : ""}`}
              </p>
            </div>

            <button onClick={handleResetColors}>Reset Puzzle</button>

            <GameSettings
                selectedThemeId={usePuzzleTheme ? dailyPuzzle.theme.id : selectedThemeId}
                onThemeChange={(themeId) => {
                  setUsePuzzleTheme(false);
                  setSelectedThemeId(themeId);
                }}
                activeTheme={usePuzzleTheme ? dailyPuzzle.theme : activeTheme}
                customTheme={customTheme}
                onCustomThemeChange={setCustomTheme}
            />

          </aside>
        )}
      </section>
    </>
  );
}

export default DailyMode;
