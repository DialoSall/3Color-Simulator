import { useEffect, useMemo, useState } from "react";
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

function getSavedHighestCompleted() {
  if (typeof window === "undefined") {
    return -1;
  }

  const savedValue = window.localStorage.getItem(PROGRESS_KEY);
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

  const conflicts = useMemo(() => {
    return getConflicts(currentLevel.vertices, currentLevel.edges);
  }, [currentLevel]);

  const solved = useMemo(() => {
    return isSolved(currentLevel.vertices, currentLevel.edges);
  }, [currentLevel]);

  const highestUnlocked = Math.min(
    highestCompleted + 1,
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

  function loadLevel(nextIndex) {
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
  }

  function handleVertexClick(vertexId) {
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
  }

  function handlePreviousLevel() {
    if (!canGoPrevious) {
      return;
    }

    loadLevel(levelIndex - 1);
  }

  function handleNextLevel() {
    if (!canGoNext) {
      return;
    }

    loadLevel(levelIndex + 1);
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
                    onClick={() => loadLevel(index)}
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

            <section className="gameLayout">
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

              <div className="quickInstructions">
                <span className="instructionIcon">?</span>

                <p>
                  Tap a circle to change its color. Color every circle so that circles
                  connected by a line never have the same color.
                </p>
              </div>
            
              <GraphCanvas
                  vertices={currentLevel.vertices}
                  edges={currentLevel.edges}
                  conflicts={conflicts}
                  onVertexClick={handleVertexClick}
                  width={currentLevel.width}
                  height={currentLevel.height}
              />

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
            </div>

            <aside className="statusPanel">
                <p className="eyebrow">Status</p>

                <div className={solved ? "statusBox solved" : "statusBox"}>
                <h3>{solved ? "Level Complete!" : "Keep Coloring"}</h3>

                <p>
                    {solved
                    ? levelIndex === levels.length - 1
                        ? "You completed every available level."
                        : `Level ${levelIndex + 2} is now unlocked.`
                    : "Click or tap a circle to change its color."}
                </p>
                </div>

                <div className="stats">
                <div>
                    <span>Recolors</span>
                    <strong>{recolors}</strong>
                </div>

                <div>
                    <span>Conflicts</span>
                    <strong>{conflicts.length}</strong>
                </div>
                </div>

                <button onClick={handleReset}>Reset Puzzle</button>

                {solved && levelIndex < levels.length - 1 && (
                <button
                    className="nextLevelButton"
                    onClick={() => loadLevel(levelIndex + 1)}
                >
                    Continue to Level {levelIndex + 2} →
                </button>
                )}

                <div className="rules">
                <h3>Rules</h3>
                <p>
                    Color every circle. Circles connected by a line cannot share the same color.
                </p>
                </div>
            </aside>
            </section>
        </main>
    );
}

export default LevelMode;