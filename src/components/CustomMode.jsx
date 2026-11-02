import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import GraphCanvas from "./GraphCanvas";
import { getConflicts, isSolved } from "../utils/graphValidation";
import { generateRandomGraph } from "../utils/randomGraph";
import { createPuzzleUrl, readSharedPuzzle } from "../utils/graphSharing";
import ColorThemePicker from "./ColorThemePicker";
import { useColorTheme } from "../hooks/useColorTheme";

const colorCycle = [null, "red", "blue", "yellow"];

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
  const navigate = useNavigate();
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
  }, [seed, sharedPuzzle]);

  const conflicts = useMemo(() => {
    return getConflicts(currentGraph.vertices, currentGraph.edges);
  }, [currentGraph]);

  const solved = useMemo(() => {
    return isSolved(currentGraph.vertices, currentGraph.edges);
  }, [currentGraph]);

function handleGenerateGraph() {
  const parsedVertexCount = Number(vertexCountInput);

  if (
    !Number.isInteger(parsedVertexCount) ||
    parsedVertexCount < 3 ||
    parsedVertexCount > 24
  ) {
    return;
  }

  const nextGraph = generateRandomGraph(
    parsedVertexCount,
    edgeProbability
  );

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
  setCurrentGraph((previousGraph) =>
    resetGraphColors(previousGraph)
  );

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

  setCurrentGraph((previousGraph) => {
    const updatedVertices = previousGraph.vertices.map((vertex) => {
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
      ...previousGraph,
      vertices: updatedVertices,
    };
  });
}

  return (
    <main className="app">
      <button className="backButton" onClick={() => navigate("/")}>
        ← Back Home
      </button>

      <section className="hero">
        <p className="eyebrow">Custom Graph</p>
        <h1>Random Graph</h1>

        <p className="heroText">
          Generate a random graph by choosing the number of vertices and the
          probability that an edge exists between each pair of vertices.
        </p>
      </section>

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

            <GraphCanvas
              vertices={currentGraph.vertices}
              edges={currentGraph.edges}
              conflicts={conflicts}
              onVertexClick={handleVertexClick}
              width={currentGraph.width}
              height={currentGraph.height}
              colorTheme={activeTheme}
            />
        </div>

        <aside className="statusPanel">
          <p className="eyebrow">Generator</p>

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

          <button onClick={handleGenerateGraph}>Generate Graph</button>

          <button onClick={handleSharePuzzle}>Share Puzzle</button>
          <p role="status">{shareMessage}</p>
          {shareUrl && (
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

          <ColorThemePicker
            selectedThemeId={selectedThemeId}
            onThemeChange={setSelectedThemeId}
            activeTheme={activeTheme}
            customTheme={customTheme}
            onCustomThemeChange={setCustomTheme}
          />

          <div className="rules">
            <h3>Note</h3>
            <p>
              Higher edge probability creates denser graphs. Dense graphs are
              usually harder to color and may be impossible to 3-color.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default CustomMode;
