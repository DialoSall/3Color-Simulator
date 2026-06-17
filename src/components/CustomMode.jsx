import { useMemo, useState } from "react";
import GraphCanvas from "./GraphCanvas";
import { getConflicts, isSolved } from "../utils/graphValidation";
import { generateRandomGraph } from "../utils/randomGraph";

const colorCycle = [null, "red", "blue", "yellow"];

function cloneGraph(graph) {
  return {
    ...graph,
    vertices: graph.vertices.map((vertex) => ({ ...vertex })),
    edges: graph.edges.map((edge) => [...edge]),
  };
}

function resetGraphColors(graph) {
  return {
    ...graph,
    vertices: graph.vertices.map((vertex) => ({
      ...vertex,
      color: null,
    })),
  };
}

function CustomMode({ onBackHome }) {
  const [vertexCountInput, setVertexCountInput] = useState("8");
  const [edgeProbability, setEdgeProbability] = useState(0.25);
  const [currentGraph, setCurrentGraph] = useState(() =>
    generateRandomGraph(8, 0.25)
  );
  const [moves, setMoves] = useState(0);

  const conflicts = useMemo(() => {
    return getConflicts(currentGraph.vertices, currentGraph.edges);
  }, [currentGraph]);

  const solved = useMemo(() => {
    return isSolved(currentGraph.vertices, currentGraph.edges);
  }, [currentGraph]);

function handleGenerateGraph() {
  const parsedVertexCount = Number(vertexCountInput);

  if (
    Number.isNaN(parsedVertexCount) ||
    parsedVertexCount < 3 ||
    parsedVertexCount > 24
  ) {
    return;
  }

  const nextGraph = generateRandomGraph(parsedVertexCount, edgeProbability);
  setCurrentGraph(nextGraph);
  setMoves(0);
}

  function handleResetColors() {
    setCurrentGraph((previousGraph) => resetGraphColors(previousGraph));
    setMoves(0);
  }

  function handleVertexClick(vertexId) {
    setCurrentGraph((previousGraph) => {
      const updatedVertices = previousGraph.vertices.map((vertex) => {
        if (vertex.id !== vertexId) return vertex;

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

    setMoves((previousMoves) => previousMoves + 1);
  }

  return (
    <main className="app">
      <button className="backButton" onClick={onBackHome}>
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
              <span>Moves</span>
              <strong>{moves}</strong>
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