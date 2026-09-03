import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GraphCanvas from "./GraphCanvas";
import { getConflicts, isSolved } from "../utils/graphValidation";
import { getDailyPuzzle } from "../data/dailyPuzzles";

const colorCycle = [null, "red", "blue", "yellow"];
const DAILY_COMPLETIONS_KEY = "3color-daily-completions";
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

function getSavedDailyCompletions() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const savedValue = window.localStorage.getItem(DAILY_COMPLETIONS_KEY);

    if (!savedValue) {
      return {};
    }

    return JSON.parse(savedValue);
  } catch {
    return {};
  }
}

function getSavedDailyCompletion(dateKey) {
  const completions = getSavedDailyCompletions();
  return completions[dateKey] ?? null;
}

function isBetterResult(nextResult, previousResult) {
  if (!previousResult) {
    return true;
  }

  if (nextResult.timeMilliseconds !== previousResult.timeMilliseconds) {
    return nextResult.timeMilliseconds < previousResult.timeMilliseconds;
  }

  if (nextResult.recolors !== previousResult.recolors) {
    return nextResult.recolors < previousResult.recolors;
  }

  return nextResult.resets < previousResult.resets;
}

function saveDailyCompletion(dateKey, result) {
  if (typeof window === "undefined") {
    return result;
  }

  const completions = getSavedDailyCompletions();
  const previousResult = completions[dateKey];

  if (isBetterResult(result, previousResult)) {
    completions[dateKey] = result;
    window.localStorage.setItem(
      DAILY_COMPLETIONS_KEY,
      JSON.stringify(completions)
    );

    return result;
  }

  return previousResult;
}

function DailyMode() {
  const navigate = useNavigate();

  const dailyPuzzle = useMemo(() => getDailyPuzzle(), []);

  const [currentPuzzle, setCurrentPuzzle] = useState(() =>
    clonePuzzle(dailyPuzzle)
  );

  const [recolors, setRecolors] = useState(0);
  const [visitedVertices, setVisitedVertices] = useState(() => new Set());
  const [lastVertexId, setLastVertexId] = useState(null);
  const [resets, setResets] = useState(0);
  const [hoveredVertexId, setHoveredVertexId] = useState(null);
  const [shareMessage, setShareMessage] = useState("");
  const [savedCompletion, setSavedCompletion] = useState(() =>
    getSavedDailyCompletion(dailyPuzzle.dateKey)
  );

  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const elapsedMillisecondsRef = useRef(0);

  const conflicts = useMemo(() => {
    return getConflicts(currentPuzzle.vertices, currentPuzzle.edges);
  }, [currentPuzzle]);

  const solved = useMemo(() => {
    return isSolved(currentPuzzle.vertices, currentPuzzle.edges);
  }, [currentPuzzle]);

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
      dateKey: dailyPuzzle.dateKey,
      dailyNumber: dailyPuzzle.dailyNumber,
      sourceLevelId: dailyPuzzle.id,
      timeMilliseconds: elapsedMilliseconds,
      recolors,
      resets,
      completedAt: new Date().toISOString(),
    };

    const savedResult = saveDailyCompletion(dailyPuzzle.dateKey, result);
    setSavedCompletion(savedResult);
  }, [
    solved,
    dailyPuzzle.dateKey,
    dailyPuzzle.dailyNumber,
    dailyPuzzle.id,
    elapsedMilliseconds,
    recolors,
    resets,
  ]);

  function handleVertexClick(vertexId) {
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

    setCurrentPuzzle((previousPuzzle) => {
      const updatedVertices = previousPuzzle.vertices.map((vertex) => {
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
      });

      return {
        ...previousPuzzle,
        vertices: updatedVertices,
      };
    });
  }

  function handleReplayDailyPuzzle() {
    setCurrentPuzzle(clonePuzzle(dailyPuzzle));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);
    setResets(0);
    setHoveredVertexId(null);
    setElapsedMilliseconds(0);
    setTimerRunning(false);
    setShareMessage("");
  }

  function handleResetColors() {
    setCurrentPuzzle(clonePuzzle(dailyPuzzle));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);
    setHoveredVertexId(null);
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
    <main className="app">
      <button className="backButton" onClick={() => navigate("/")}>
        ← Back Home
      </button>

      <section className="hero">
        <p className="eyebrow">Daily Puzzle</p>
        <h1>Today&apos;s 3Color</h1>

        <p className="heroText">
          A new graph-coloring puzzle every day. Complete today&apos;s graph
          and try to beat your best result.
        </p>
      </section>

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

          {!solved && (
            <div className="quickInstructions">
              <span className="instructionIcon">?</span>

              <p>
                Tap a circle to change its color. Color every circle so that
                connected circles never have the same color.
              </p>
            </div>
          )}

          {solved && (
            <div className="completionCard" role="status" aria-live="polite">
              <div className="completionBadge">✓</div>

              <p className="completionEyebrow">Daily Puzzle Complete</p>

              <h3>You completed today&apos;s puzzle.</h3>

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

                <button
                  className="completionPrimaryButton"
                  onClick={handleShareResult}
                >
                  Share Result
                </button>
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
            activeVertexId={hoveredVertexId}
            onVertexHover={setHoveredVertexId}
            onVertexLeave={() => setHoveredVertexId(null)}
          />
        </div>

        {!solved && (
          <aside className="statusPanel">
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

            <div className="rules">
              <h3>Rules</h3>

              <p>
                Color every circle. Circles connected by a line cannot share
                the same color.
              </p>
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}

export default DailyMode;