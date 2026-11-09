import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import GraphCanvas from "./GraphCanvas";
import { cycleVertexColor } from "../utils/gameplay";
import { getConflicts, isSolved } from "../utils/graphValidation";
import { generateRandomGraph } from "../utils/randomGraph";
import { createPuzzleUrl, readSharedPuzzle } from "../utils/graphSharing";
import GameSettings from "./GameSettings";
import { useColorTheme } from "../hooks/useColorTheme";
import SoundToggle from "./SoundToggle";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { IS_CRAZYGAMES } from "../platform";
import { trackEvent } from "../utils/analytics";
import { useMobileLayout } from "../hooks/useMobileLayout";
import MobileGameShell from "./MobileGameShell";
import GameIconButton from "./GameIconButton";

function resetGraphColors(graph) {
  return {
    ...graph,
    vertices: graph.vertices.map((vertex) => ({
      ...vertex,
      color: null,
    })),
  };
}

function CustomMode() {
  const mobile = useMobileLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const seed = searchParams.get("seed");
  const sharedPuzzle = useMemo(
    () => readSharedPuzzle(seed === null ? "" : new URLSearchParams({ seed }).toString()),
    [seed]
  );
  const [vertexCountInput, setVertexCountInput] = useState(() =>
    String(sharedPuzzle.graph?.vertices.length ?? 8)
  );
  const [edgeProbability, setEdgeProbability] = useState(0.25);
  const [currentGraph, setCurrentGraph] = useState(() =>
    sharedPuzzle.graph ?? generateRandomGraph(8, 0.25)
  );
  const [linkMessage, setLinkMessage] = useState(sharedPuzzle.error);
  const [shareMessage, setShareMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [recolors, setRecolors] = useState(0);
  const [visitedVertices, setVisitedVertices] = useState(() => new Set());
  const [lastVertexId, setLastVertexId] = useState(null);
  const completionSoundPlayedRef = useRef(false);
  const completionTrackedRef = useRef(false);
  const { soundEnabled, setSoundEnabled, playSound } = useSoundEffects();
  const {
    selectedThemeId,
    setSelectedThemeId,
    customTheme,
    setCustomTheme,
    activeTheme,
  } = useColorTheme();

  // Also load links reached through browser navigation while this mode is open.
  useEffect(() => {
    if (seed === null) return;
    const graph = sharedPuzzle.graph ?? generateRandomGraph(8, 0.25);
    setCurrentGraph(graph);
    setVertexCountInput(String(graph.vertices.length));
    setLinkMessage(sharedPuzzle.error);
    setShareMessage("");
    setShareUrl("");
    setRecolors(0);
    setVisitedVertices(new Set());
    setLastVertexId(null);
    completionSoundPlayedRef.current = false;
  }, [seed, sharedPuzzle]);

  const conflicts = useMemo(() => {
    return getConflicts(currentGraph.vertices, currentGraph.edges);
  }, [currentGraph]);

  const solved = useMemo(() => {
    return isSolved(currentGraph.vertices, currentGraph.edges);
  }, [currentGraph]);

  useEffect(() => {
    if (!solved) {
      completionTrackedRef.current = false;
      return;
    }
    if (completionTrackedRef.current) return;
    completionTrackedRef.current = true;
    trackEvent("custom_complete", {
      vertex_count: currentGraph.vertices.length,
      edge_count: currentGraph.edges.length,
      recolors,
    });
  }, [solved, currentGraph.vertices.length, currentGraph.edges.length, recolors]);

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

function handleGenerateGraph() {
  const parsedVertexCount = Number(vertexCountInput);

  if (
    !Number.isInteger(parsedVertexCount) ||
    parsedVertexCount < 3 ||
    parsedVertexCount > 24
  ) {
    return false;
  }

  const nextGraph = generateRandomGraph(
    parsedVertexCount,
    edgeProbability
  );

  playSound("level");
  completionSoundPlayedRef.current = false;
  setCurrentGraph(nextGraph);
  setRecolors(0);
  setVisitedVertices(new Set());
  setLastVertexId(null);
  setLinkMessage("");
  setShareMessage("");
  setShareUrl("");

  // A newly generated graph must not keep the previous puzzle's seed on reload.
  if (searchParams.has("seed")) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("seed");
    setSearchParams(nextParams, { replace: true });
  }
  return true;
}

async function handleSharePuzzle() {
  const url = createPuzzleUrl(currentGraph, window.location.href);
  setShareUrl(url);
  try {
    await navigator.clipboard.writeText(url);
    setShareMessage("Puzzle link copied! Your friend starts with uncolored circles.");
  } catch {
    setShareMessage("Copy the puzzle link below to share it.");
  }
}

function handleResetColors() {
  playSound("reset");
  completionSoundPlayedRef.current = false;
  setCurrentGraph((previousGraph) =>
    resetGraphColors(previousGraph)
  );

  setRecolors(0);
  setVisitedVertices(new Set());
  setLastVertexId(null);
}

function handleVertexClick(vertexId) {
  playSound("vertex");

  const hasVisitedBefore = visitedVertices.has(vertexId);

  const isReturningToVertex =
    hasVisitedBefore &&
    lastVertexId !== null &&
    lastVertexId !== vertexId;

  // Returning to a previously colored circle counts as one recolor.
  // Repeated taps on the same circle to reach blue or yellow do not.
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
    currentGraph.vertices.map(cycleVertex),
    currentGraph.edges
  ).length;

  setCurrentGraph((previousGraph) => ({
    ...previousGraph,
    vertices: previousGraph.vertices.map(cycleVertex),
  }));

  if (nextConflictCount > conflicts.length) {
    playSound("conflict");
  }
}

  const graph = (<GraphCanvas
              mobile={mobile}
              controls={mobile && <GameIconButton icon="reset" label="Reset colors" onClick={handleResetColors} />}
              key={`${currentGraph.id}-${seed}`}
              vertices={currentGraph.vertices}
              edges={currentGraph.edges}
              conflicts={conflicts}
              onVertexClick={handleVertexClick}
              width={currentGraph.width}
              height={currentGraph.height}
              colorTheme={activeTheme}
              toolbar={
                !mobile && <SoundToggle
                  soundEnabled={soundEnabled}
                  onSoundEnabledChange={setSoundEnabled}
                  onPreviewSound={() => playSound("button", { force: true })}
                />
              }
            />);
  const settings = inline => (<GameSettings
            inline={inline}
            soundControl={inline && <SoundToggle soundEnabled={soundEnabled} onSoundEnabledChange={setSoundEnabled} onPreviewSound={() => playSound("button", { force: true })} />}
            selectedThemeId={selectedThemeId}
            onThemeChange={setSelectedThemeId}
            activeTheme={activeTheme}
            customTheme={customTheme}
            onCustomThemeChange={setCustomTheme}
          />);
  const generator = close => (<details className="generatorSettings">
            <summary>Generate another puzzle</summary>
            <div className="generatorFields">

          <div className="formGroup">
            <label htmlFor="vertexCount">Vertices</label>
            <input
                id="vertexCount"
                type="number"
                min="3"
                max="24"
                value={vertexCountInput}
                onChange={(event) => setVertexCountInput(event.target.value)}
                onBlur={() => {
                const parsedVertexCount = Number(vertexCountInput);

                if (
                    vertexCountInput === "" ||
                    Number.isNaN(parsedVertexCount) ||
                    parsedVertexCount < 3
                ) {
                    setVertexCountInput("3");
                } else if (parsedVertexCount > 24) {
                    setVertexCountInput("24");
                }
                }}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="edgeProbability">
              Edge Probability: {Math.round(edgeProbability * 100)}%
            </label>
            <input
              id="edgeProbability"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={edgeProbability}
              onChange={(event) =>
                setEdgeProbability(Number(event.target.value))
              }
            />
          </div>

          <button onClick={() => { if (handleGenerateGraph()) close?.(); }}>Generate Graph</button>
            </div>
          </details>);
  if (mobile) return <MobileGameShell title={currentGraph.name} subtitle={sharedPuzzle.graph ? "Shared graph" : "Random graph"} conflicts={conflicts.length} recolors={recolors} settings={() => settings(true)} description="Random graphs may or may not be 3-colorable."
    menuContent={close => <>{generator(close)}<p>{currentGraph.vertices.length} circles · {currentGraph.edges.length} connections</p>{!IS_CRAZYGAMES && <><button type="button" onClick={handleSharePuzzle}>Share puzzle</button><p role="status">{shareMessage}</p>{shareUrl && <input aria-label="Puzzle link" readOnly value={shareUrl} />}</>}</>}
  >{linkMessage && <p role="status">{linkMessage}</p>}{solved && <div className="completionCard statusBox solved" role="status"><div className="completionBadge">✓</div><h3>Solved!</h3><p>This is a valid 3-coloring.</p><button type="button" onClick={handleResetColors}>Reset Colors</button></div>}{graph}</MobileGameShell>;

  return (
    <main className="app gameApp">
      <header className="gameHeading">
        <div>
          <p className="eyebrow">Custom Graph</p>
          <h1>{sharedPuzzle.graph ? "A shared challenge" : "Make it your own"}</h1>
        </div>
        <p>Connected circles must have different colors.</p>
      </header>

      {linkMessage && <p role="status">{linkMessage}</p>}

      <section className="customLayout">
        <div className="gamePanel">
          <div className="levelHeader">
            <div>
              <p className="eyebrow">Generated Puzzle</p>
              <h2>{currentGraph.name}</h2>
              <p>{currentGraph.description}</p>
            </div>
          </div>

            {graph}
        </div>

        <aside className="statusPanel customControls">
          {generator()}

          {!IS_CRAZYGAMES && <button onClick={handleSharePuzzle}>Share Puzzle</button>}
          {!IS_CRAZYGAMES && <p role="status">{shareMessage}</p>}
          {!IS_CRAZYGAMES && shareUrl && (
            <div className="formGroup">
              <label htmlFor="puzzleShareUrl">Puzzle link</label>
              <input
                id="puzzleShareUrl"
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(event) => event.target.select()}
              />
            </div>
          )}

          <div className={solved ? "statusBox solved" : "statusBox"}>
            <h3>{solved ? "Solved!" : "Custom Puzzle"}</h3>
            <p>
              {solved
                ? "This is a valid 3-coloring."
                : "Random graphs may or may not be 3-colorable."}
            </p>
          </div>

          <div className="stats">
            <div>
              <span>Recolors</span>
              <strong>{recolors}</strong>
            </div>

            <div>
              <span>Edges</span>
              <strong>{currentGraph.edges.length}</strong>
            </div>

            <div>
              <span>Conflicts</span>
              <strong>{conflicts.length}</strong>
            </div>

            <div>
              <span>Vertices</span>
              <strong>{currentGraph.vertices.length}</strong>
            </div>
          </div>

          <button onClick={handleResetColors}>Reset Colors</button>

          {settings(false)}

          <details className="generatorNote">
            <summary>About random graphs</summary>
            <p>
              Higher edge probability creates denser graphs. Dense graphs are
              usually harder to color and may be impossible to 3-color.
            </p>
          </details>
        </aside>
      </section>
    </main>
  );
}

export default CustomMode;
