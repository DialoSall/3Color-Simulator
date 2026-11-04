import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { levels } from "../data/levels";
import GraphCanvas from "./GraphCanvas";
import { cloneGraph, cycleVertexColor, formatGameTime } from "../utils/gameplay";
import { getConflicts, isSolved } from "../utils/graphValidation";
import GameSettings from "./GameSettings";
import { useColorTheme } from "../hooks/useColorTheme";
import SoundToggle from "./SoundToggle";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useCampaignTutorial } from "../hooks/useCampaignTutorial";

const PROGRESS_KEY = "3color-highest-completed-level";

function getSavedHighestCompleted() {
  if (typeof window === "undefined") {
    return -1;
  }

  let savedValue;
  try { savedValue = window.localStorage.getItem(PROGRESS_KEY); } catch { return -1; }

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

function LevelMode({ preview = false, previewLevelId, onPreviewLevelChange } = {}) {
  const navigate = useNavigate();
  const params = useParams();
  const isPreview = import.meta.env.DEV && preview;
  const levelId = isPreview ? previewLevelId : params.levelId;

  const requestedStartingIndex = getLevelIndexFromParam(levelId);
  const safeStartingIndex = Math.min(
    Math.max(requestedStartingIndex, 0),
    levels.length - 1
  );

  const [levelIndex, setLevelIndex] = useState(safeStartingIndex);
  const [currentLevel, setCurrentLevel] = useState(() =>
    cloneGraph(levels[safeStartingIndex])
  );
  const [recolors, setRecolors] = useState(0);
  const [visitedVertices, setVisitedVertices] = useState(() => new Set());
  const [lastVertexId, setLastVertexId] = useState(null);
  const [highestCompleted, setHighestCompleted] = useState(
    () => isPreview ? -1 : getSavedHighestCompleted()
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
  const tutorial = useCampaignTutorial(currentLevel.id === 1 && !isPreview);
  

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


  const highestUnlocked = isPreview ? levels.length - 1 : Math.min(
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
      if (isPreview) onPreviewLevelChange?.(1);
      else navigate("/levels/1", { replace: true });
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
    setCurrentLevel(cloneGraph(levels[requestedIndex]));
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);
    setElapsedMilliseconds(0);
    setTimerRunning(false);
    setResets(0);
    completionSoundPlayedRef.current = false;
  }, [levelId, highestUnlocked, levelIndex, navigate, isPreview, onPreviewLevelChange]);

  useEffect(() => {
    if (!solved) {
      return;
    }

    if (isPreview) return;

    setHighestCompleted((previousHighest) => {
      const nextHighest = Math.max(previousHighest, levelIndex);

      if (nextHighest !== previousHighest) {
        try {
          window.localStorage.setItem(PROGRESS_KEY, String(nextHighest));
        } catch { /* Unlocks remain usable during this session if embedded storage is blocked. */ }
      }

      return nextHighest;
    });
  }, [solved, levelIndex, isPreview]);

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

    if (isPreview) onPreviewLevelChange?.(levels[nextIndex].id);
    else navigate(`/levels/${levels[nextIndex].id}`);

    setLevelIndex(nextIndex);
    setCurrentLevel(cloneGraph(levels[nextIndex]));
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
    if (!tutorial.canColor(vertexId)) return;
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

    const updatedVertices = currentLevel.vertices.map(vertex => cycleVertexColor(vertex, vertexId));

    const nextConflictCount = getConflicts(
      updatedVertices,
      currentLevel.edges
    ).length;

    tutorial.onMove(vertexId, updatedVertices, currentLevel.edges);

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
    tutorial.reset();

    setCurrentLevel(cloneGraph(levels[levelIndex]));

    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);

    setResets((previousResets) => previousResets + 1);
  }

  function handleReplayLevel() {
    playSound("reset");
    tutorial.reset();
    
    setCurrentLevel(cloneGraph(levels[levelIndex]));
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
                  <strong>{formatGameTime(elapsedMilliseconds)}</strong>
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

                  {tutorial.reinforcement && <p className="tutorialReinforcement">That's it. Color every circle, and never let connected circles match.</p>}

                  <h3>
                    {levelIndex === levels.length - 1
                      ? (isPreview ? "Preview complete." : "You finished every level.")
                      : isPreview ? "Preview complete. Your campaign progress is unchanged." : `Level ${levelIndex + 2} unlocked.`}
                  </h3>

                  <div className="completionStats">
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
                  </div>

                  <div className="completionActions">
                    {tutorial.canReplay && <button className="completionSecondaryButton" onClick={() => { handleReplayLevel(); tutorial.replay(); }}>Replay tutorial</button>}
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
                highlightedVertexIds={tutorial.guidance?.vertexIds}
                highlightedEdges={tutorial.guidance?.edges}
                interactiveVertexIds={tutorial.guidance?.allowedIds}
                guidance={tutorial.step > 0 && (
                  <section className="tutorialGuidance" aria-label="Level 1 tutorial">
                    <div role="status" aria-live="polite" aria-atomic="true">
                      <span className="eyebrow">Quick start · Step {tutorial.step} of 4</span>
                      <p>{tutorial.guidance.message}</p>
                      {tutorial.step < 4 && <small>{tutorial.step === 3 ? "Change either highlighted circle." : "Follow the highlighted circle."} Tap, click, or use Enter / Space.</small>}
                    </div>
                    <button type="button" onClick={() => {
                      tutorial.skip();
                      graphSectionRef.current?.querySelector('.graphViewport')?.focus({ preventScroll: true });
                    }}>Skip tutorial</button>
                  </section>
                )}
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

                  {tutorial.canReplay && <button type="button" className="tutorialReplay" onClick={() => { handleReplayLevel(); tutorial.replay(); scrollToGraph(); }}>Replay tutorial</button>}
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
            {tutorial.storageError && <p role="status">{tutorial.storageError}</p>}
        </main>
    );
}

export default LevelMode;
