import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { levels } from "../data/levels";
import GraphCanvas from "./GraphCanvas";
import { getConflicts, isSolved } from "../utils/graphValidation";
import GameSettings from "./GameSettings";
import { useColorTheme } from "../hooks/useColorTheme";
import SoundToggle from "./SoundToggle";
import { useSoundEffects } from "../hooks/useSoundEffects";

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

function getLevelIndexFromParam(levelId) {
  const parsedLevelId = Number(levelId);

  if (!Number.isInteger(parsedLevelId)) {
    return 0;
  }

  return parsedLevelId - 1;
}

function LevelMode() {
  const navigate = useNavigate();
  const { levelId } = useParams();

  const requestedStartingIndex = getLevelIndexFromParam(levelId);
  const safeStartingIndex = Math.min(
    Math.max(requestedStartingIndex, 0),
    levels.length - 1
  );

  const [levelIndex, setLevelIndex] = useState(safeStartingIndex);
  const [currentLevel, setCurrentLevel] = useState(() =>
    cloneLevel(levels[safeStartingIndex])
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

  const {
    selectedThemeId,
    setSelectedThemeId,
    customTheme,
    setCustomTheme,
    activeTheme,
  } = useColorTheme();

  const { soundEnabled, setSoundEnabled, playSound } = useSoundEffects();
  

  const conflicts = useMemo(() => {
    return getConflicts(currentLevel.vertices, currentLevel.edges);
  }, [currentLevel]);

  const solved = useMemo(() => {
    return isSolved(currentLevel.vertices, currentLevel.edges);
  }, [currentLevel]);

  const levelPickerRef = useRef(null);

  const graphSectionRef = useRef(null);
  const completionCardRef = useRef(null);
  const completionSoundPlayedRef = useRef(false);


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
    const requestedIndex = getLevelIndexFromParam(levelId);

    if (requestedIndex < 0 || requestedIndex >= levels.length) {
      navigate("/levels/1", { replace: true });
      return;
    }

    if (requestedIndex > highestUnlocked) {
      navigate(`/levels/${levels[highestUnlocked].id}`, { replace: true });
      return;
    }

    if (requestedIndex === levelIndex) {
      return;
    }

    setLevelIndex(requestedIndex);
    setCurrentLevel(cloneLevel(levels[requestedIndex]));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);
    setElapsedMilliseconds(0);
    setTimerRunning(false);
    setResets(0);
    completionSoundPlayedRef.current = false;
  }, [levelId, highestUnlocked, levelIndex, navigate]);

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

  function scrollToGraph() {
    if (typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      graphSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
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

    playSound("level");

    navigate(`/levels/${levels[nextIndex].id}`);

    setLevelIndex(nextIndex);
    setCurrentLevel(cloneLevel(levels[nextIndex]));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);

    setElapsedMilliseconds(0);
    setTimerRunning(false);
    setResets(0);

    if (shouldScrollToGraph) {
      scrollToGraph();
    }
  }

  function handleVertexClick(vertexId) {
    playSound("vertex");

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

    const previousConflictCount = conflicts.length;

    const updatedVertices = currentLevel.vertices.map((vertex) => {
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

    const nextConflictCount = getConflicts(
      updatedVertices,
      currentLevel.edges
    ).length;

    setCurrentLevel({
      ...currentLevel,
      vertices: updatedVertices,
    });

    if (nextConflictCount > previousConflictCount) {
      playSound("conflict");
    }
  }

  function handleReset() {
    playSound("reset");

    setCurrentLevel(cloneLevel(levels[levelIndex]));

    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);

    setResets((previousResets) => previousResets + 1);
  }

  function handleReplayLevel() {
    playSound("reset");
    
    setCurrentLevel(cloneLevel(levels[levelIndex]));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);
    setElapsedMilliseconds(0);
    setTimerRunning(false);
    setResets(0);
    completionSoundPlayedRef.current = false;
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
        <main className="app gameApp">
            <header className="gameHeading">
              <div>
                <p className="eyebrow">Campaign</p>
                <h1>Level {currentLevel.id} <span>/ {levels.length}</span></h1>
              </div>
              <p>Connected circles must have different colors.</p>
            </header>

            <details className="levelMap" ref={levelPickerRef}>
              <summary className="levelMapSummary">
                <span>Choose a level</span>
                <span className="levelProgressText">
                  {Math.max(highestCompleted + 1, 0)} of {levels.length} completed
                </span>
              </summary>
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
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => {
                      loadLevel(index, true);
                      levelPickerRef.current.open = false;
                    }}
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
            </details>

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
                key={currentLevel.id}
                vertices={currentLevel.vertices}
                edges={currentLevel.edges}
                conflicts={conflicts}
                onVertexClick={handleVertexClick}
                width={currentLevel.width}
                height={currentLevel.height}
                colorTheme={activeTheme}
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
              <aside className="statusPanel gameControls">
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

                <GameSettings
                  soundControl={
                    <SoundToggle
                      soundEnabled={soundEnabled}
                      onSoundEnabledChange={setSoundEnabled}
                      onPreviewSound={() => playSound("button", { force: true })}
                    />
                  }
                  selectedThemeId={selectedThemeId}
                  onThemeChange={setSelectedThemeId}
                  activeTheme={activeTheme}
                  customTheme={customTheme}
                  onCustomThemeChange={setCustomTheme}
                />

              </aside>
            )}
            </section>
        </main>
    );
}

export default LevelMode;
