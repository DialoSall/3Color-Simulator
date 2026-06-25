import { useEffect, useMemo, useRef, useState } from "react";
import { levels } from "../data/levels";
import GraphCanvas from "./GraphCanvas";
import { getConflicts, isSolved } from "../utils/graphValidation";

const colorCycle = [null, "red", "blue", "yellow"];
const PROGRESS_KEY = "3color-highest-completed-level";

function cloneLevel(level) {
  return {
    ...level,
    vertices: level.vertices.map((vertex) => ({ ...vertex })),
    edges: level.edges.map((edge) => [...edge]),
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

function getSavedHighestCompleted() {
  if (typeof window === "undefined") {
    return -1;
  }

  const savedValue = window.localStorage.getItem(PROGRESS_KEY);

  if (savedValue === null) {
    return -1;
  }

  const parsedValue = Number(savedValue);

  if (!Number.isInteger(parsedValue)) {
    return -1;
  }

  return Math.min(Math.max(parsedValue, -1), levels.length - 1);
}

function LevelMode({ onBackHome }) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(() =>
    cloneLevel(levels[0])
  );
  const [recolors, setRecolors] = useState(0);
  const [visitedVertices, setVisitedVertices] = useState(() => new Set());
  const [lastVertexId, setLastVertexId] = useState(null);
  const [highestCompleted, setHighestCompleted] = useState(
    getSavedHighestCompleted
  );

  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [resets, setResets] = useState(0);
  const elapsedMillisecondsRef = useRef(0);

  const conflicts = useMemo(() => {
    return getConflicts(currentLevel.vertices, currentLevel.edges);
  }, [currentLevel]);

  const solved = useMemo(() => {
    return isSolved(currentLevel.vertices, currentLevel.edges);
  }, [currentLevel]);

  const graphSectionRef = useRef(null);
  const completionCardRef = useRef(null);


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


  const highestUnlocked = Math.min(
    Math.max(highestCompleted + 1, solved ? levelIndex + 1 : 0),
    levels.length - 1
  );
  
  const canGoPrevious = levelIndex > 0;

  const canGoNext =
    levelIndex < levels.length - 1 &&
    levelIndex + 1 <= highestUnlocked;

  useEffect(() => {
    if (!solved) {
      return;
    }

    setHighestCompleted((previousHighest) => {
      const nextHighest = Math.max(previousHighest, levelIndex);

      if (nextHighest !== previousHighest) {
        window.localStorage.setItem(
          PROGRESS_KEY,
          String(nextHighest)
        );
      }

      return nextHighest;
    });
  }, [solved, levelIndex]);

  useEffect(() => {
    if (!solved || typeof window === "undefined") {
      return;
    }

    if (window.innerWidth > 900) {
      return;
    }

    window.setTimeout(() => {
      completionCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 250);
  }, [solved, levelIndex]);

  function scrollToGraphOnMobile() {
    if (typeof window === "undefined") {
      return;
    }

    if (window.innerWidth > 900) {
      return;
    }

    window.setTimeout(() => {
      graphSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function loadLevel(nextIndex, shouldScrollToGraph = false) {
    if (
      nextIndex < 0 ||
      nextIndex >= levels.length ||
      nextIndex > highestUnlocked
    ) {
      return;
    }

    setLevelIndex(nextIndex);
    setCurrentLevel(cloneLevel(levels[nextIndex]));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);

    setElapsedMilliseconds(0);
    setTimerRunning(false);
    setResets(0);

    if (shouldScrollToGraph) {
      scrollToGraphOnMobile();
    }
  }

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

    setCurrentLevel((previousLevel) => {
      const updatedVertices = previousLevel.vertices.map((vertex) => {
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
        ...previousLevel,
        vertices: updatedVertices,
      };
    });
  }

  function handleReset() {
    setCurrentLevel(cloneLevel(levels[levelIndex]));

    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);

    setResets((previousResets) => previousResets + 1);
  }

  function handleReplayLevel() {
    setCurrentLevel(cloneLevel(levels[levelIndex]));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);
    setElapsedMilliseconds(0);
    setTimerRunning(false);
    setResets(0);
  }

  function handlePreviousLevel() {
    if (!canGoPrevious) {
      return;
    }

    loadLevel(levelIndex - 1, true);
  }

  function handleNextLevel() {
    if (!canGoNext) {
      return;
    }

    loadLevel(levelIndex + 1, true);
  }

    return (
        <main className="app">
            <button className="backButton" onClick={onBackHome}>
            ← Back Home
            </button>

            <section className="hero">
            <p className="eyebrow">Level Mode</p>
            <h1>3Color</h1>

            <p className="heroText">
                Complete each graph to unlock the next level.
            </p>
            </section>

            <section className="levelMap">
            <div className="levelMapHeader">
                <div>
                <p className="eyebrow">Campaign</p>
                <h2>Select a Level</h2>
                </div>

                <p className="levelProgressText">
                {Math.max(highestCompleted + 1, 0)} of {levels.length} completed
                </p>
            </div>

            <div className="levelGrid">
                {levels.map((level, index) => {
                const isLocked = index > highestUnlocked;
                const isCompleted = index <= highestCompleted;
                const isCurrent = index === levelIndex;

                const classNames = [
                    "levelButton",
                    isLocked ? "locked" : "",
                    isCompleted ? "completed" : "",
                    isCurrent ? "current" : "",
                ]
                    .filter(Boolean)
                    .join(" ");

                return (
                    <button
                    key={level.id}
                    className={classNames}
                    disabled={isLocked}
                    onClick={() => loadLevel(index, true)}
                    >
                    <span className="levelButtonNumber">
                        {isCompleted ? "✓" : level.id}
                    </span>

                    <span className="levelButtonLabel">
                        {isLocked
                        ? "Locked"
                        : isCompleted
                            ? "Completed"
                            : "Unlocked"}
                    </span>
                    </button>
                );
                })}
            </div>
            </section>

            <section
              className={`gameLayout ${solved ? "gameLayoutSolved" : ""}`}
              ref={graphSectionRef}
            >
            <div className="gamePanel">
              <div className="levelHeader">
                  <div>
                  <p className="eyebrow">
                      Level {currentLevel.id} · {currentLevel.difficulty}
                  </p>

                  <h2>{currentLevel.name}</h2>
                  <p>{currentLevel.description}</p>
                  </div>
              </div>

              <div className="gameStatsBar">
                <div>
                  <span>Level</span>
                  <strong>{currentLevel.id}</strong>
                </div>

                <div>
                  <span>Time</span>
                  <strong>{formatTime(elapsedMilliseconds)}</strong>
                </div>

                <div>
                  <span>Recolors</span>
                  <strong>{recolors}</strong>
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
                    Tap a circle to change its color. Color every circle so that circles
                    connected by a line never have the same color.
                  </p>
                </div>
              )}
              
              {solved && (
                <div
                  className="completionCard"
                  ref={completionCardRef}
                  role="status"
                  aria-live="polite"
                >
                  <div className="completionBadge">✓</div>

                  <p className="completionEyebrow">Level {currentLevel.id} Complete</p>

                  <h3>
                    {levelIndex === levels.length - 1
                      ? "You finished every level."
                      : `Level ${levelIndex + 2} unlocked.`}
                  </h3>

                  <div className="completionStats">
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
                  </div>

                  <div className="completionActions">
                    <button
                      className="completionSecondaryButton"
                      onClick={handleReplayLevel}
                    >
                      Replay Level
                    </button>

                    {levelIndex < levels.length - 1 && (
                      <button
                        className="completionPrimaryButton"
                        onClick={handleNextLevel}
                      >
                        Continue to Level {levelIndex + 2} →
                      </button>
                    )}
                  </div>
                </div>
              )}
            
              <GraphCanvas
                  vertices={currentLevel.vertices}
                  edges={currentLevel.edges}
                  conflicts={conflicts}
                  onVertexClick={handleVertexClick}
                  width={currentLevel.width}
                  height={currentLevel.height}
              />



              {!solved && (
                <div className="levelNavigation">
                  <button
                    className="navigationButton secondaryNavigation"
                    disabled={!canGoPrevious}
                    onClick={handlePreviousLevel}
                  >
                    ← Previous
                  </button>

                  <button
                    className="navigationButton"
                    disabled={!canGoNext}
                    onClick={handleNextLevel}
                  >
                    Next Level →
                  </button>
                </div>
              )}
            </div>

            {!solved && (
              <aside className="statusPanel">
                <p className="eyebrow">Status</p>

                <div className="statusBox">
                  <h3>{conflicts.length > 0 ? "Fix Conflicts" : "Keep Coloring"}</h3>

                  <p>
                    {conflicts.length > 0
                      ? "Some connected circles share the same color. Change one of them to fix the graph."
                      : "Click or tap a circle to change its color."}
                  </p>
                </div>

                <button onClick={handleReset}>Reset Puzzle</button>

                <div className="rules">
                  <h3>Rules</h3>

                  <p>
                    Color every circle. Circles connected by a line cannot share the same color.
                  </p>
                </div>
              </aside>
            )}
            </section>
        </main>
    );
}

export default LevelMode;