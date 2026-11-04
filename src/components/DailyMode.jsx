import { useEffect, useMemo, useRef, useState } from "react";
import GraphCanvas from "./GraphCanvas";
import { getConflicts, isSolved } from "../utils/graphValidation";
import { getDailyPuzzleForDate, MissingDailyPuzzleError } from "../data/dailyPuzzles";
import { useDailyDate } from "../hooks/useDailyDate";
import { useDailyProgress } from "../hooks/useDailyProgress";
import GameSettings from "./GameSettings";
import { useColorTheme } from "../hooks/useColorTheme";
import SoundToggle from "./SoundToggle";
import { useSoundEffects } from "../hooks/useSoundEffects";

const colorCycle = [null, "red", "blue", "yellow"];
const DAILY_URL = "https://3color.app/daily";

function clonePuzzle(puzzle) {
  return {
    ...puzzle,
    vertices: puzzle.vertices.map((vertex) => ({ ...vertex })),
    edges: puzzle.edges.map((edge) => [...edge]),
  };
}

function formatTime(totalMilliseconds) {
  const totalSeconds = Math.floor(totalMilliseconds / 1000);

  if (totalSeconds < 60) {
    const milliseconds = totalMilliseconds % 1000;
    return `${totalSeconds}.${String(milliseconds).padStart(3, "0")}`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function DailyMode({ progressService, previewDateKey } = {}) {
  const today = useDailyDate();
  const isPreview = import.meta.env.DEV && Boolean(previewDateKey);
  const dateKey = isPreview ? previewDateKey : today;
  let puzzle;
  try {
    puzzle = getDailyPuzzleForDate(dateKey);
  } catch (error) {
    if (!(error instanceof MissingDailyPuzzleError)) throw error;
    return (
      <main className="app gameApp">
        <header className="gameHeading"><h1>Today's 3Color</h1></header>
        <p role="status">The Daily puzzle for {dateKey} is unavailable. Please check back later.</p>
      </main>
    );
  }
  return <DailyGame key={`${dateKey}:${puzzle.id}`} dailyPuzzle={puzzle} progressService={progressService} preview={isPreview} />;
}

function DailyGame({ dailyPuzzle, progressService, preview }) {
  const isPreview = import.meta.env.DEV && preview;
  const {
    bestResult: savedCompletion, progressError, recordMove, recordReset,
    completeAttempt, replayAttempt,
  } = useDailyProgress(dailyPuzzle, progressService);
  const [usePuzzleTheme, setUsePuzzleTheme] = useState(Boolean(dailyPuzzle.theme));
  const [currentPuzzle, setCurrentPuzzle] = useState(() =>
    clonePuzzle(dailyPuzzle)
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

    const cycleVertex = (vertex) => {
      if (vertex.id !== vertexId) {
        return vertex;
      }

      const currentColorIndex = colorCycle.indexOf(vertex.color);

      const nextColor =
        colorCycle[(currentColorIndex + 1) % colorCycle.length];

      return {
        ...vertex,
        color: nextColor,
      };
    };

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
    setCurrentPuzzle(clonePuzzle(dailyPuzzle));
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
    setCurrentPuzzle(clonePuzzle(dailyPuzzle));
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

    const text = `I completed today's 3Color puzzle in ${formatTime(
      resultToShare.timeMilliseconds
    )} with ${resultToShare.recolors} recolors and ${
      resultToShare.resets
    } resets.`;

    const shareData = {
      title: "3Color Daily Puzzle",
      text,
      url: DAILY_URL,
    };

    try {
      if (navigator.share && window.isSecureContext) {
        await navigator.share(shareData);
        setShareMessage("Thanks for sharing!");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${DAILY_URL}`);
      setShareMessage("Result copied!");
    } catch {
      setShareMessage(`${text} ${DAILY_URL}`);
    }
  }

  return (
    <main className="app gameApp">
      <header className="gameHeading">
        <div>
          <p className="eyebrow">Daily Puzzle</p>
          <h1>{isPreview ? 'Daily Puzzle Preview' : "Today's 3Color"}</h1>
        </div>
        <p>Connected circles must have different colors.</p>
      </header>

      {progressError && <p role="status">{progressError}</p>}

      <section className={`gameLayout ${solved ? "gameLayoutSolved" : ""}`}>
        <div className="gamePanel">
          <div className="levelHeader">
            <div>
              <p className="eyebrow">
                {dailyPuzzle.dateKey} · Daily #{dailyPuzzle.dailyNumber}
              </p>

              <h2>{dailyPuzzle.name}</h2>
              <p>{dailyPuzzle.description}</p>
            </div>
          </div>

          <div className="gameStatsBar">
            <div>
              <span>Time</span>
              <strong>{formatTime(elapsedMilliseconds)}</strong>
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

              <h3>{isPreview ? "This test result stays in your preview session." : "You completed today’s puzzle."}</h3>

              <div className="completionStats">
                <div>
                  <span>Best Time</span>
                  <strong>
                    {formatTime(
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
              <h3>{savedCompletion ? "Completed Today" : "Not Completed Yet"}</h3>

              <p>
                {savedCompletion
                  ? `Your best time today is ${formatTime(
                      savedCompletion.timeMilliseconds
                    )}.`
                  : "Solve today's puzzle to save your result on this device."}
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
    </main>
  );
}

export default DailyMode;
