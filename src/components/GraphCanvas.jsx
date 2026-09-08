import { getThemeById, DEFAULT_THEME_ID } from "../data/colorThemes";
import { getEdgeKey } from "../utils/graphValidation";

const UNCOLORED_VERTEX_COLOR = "#d1d1d6";

function getVertexRadius(vertexCount) {
  if (vertexCount <= 8) return 34;
  if (vertexCount <= 12) return 30;
  if (vertexCount <= 16) return 26;
  return 25;
}

function GraphCanvas({
  vertices,
  edges,
  conflicts,
  onVertexClick,
  width = 600,
  height = 480,
  activeVertexId = null,
  onVertexHover,
  onVertexLeave,
  colorTheme = getThemeById(DEFAULT_THEME_ID),
  toolbar = null,
}) {
  const activeTheme = colorTheme ?? getThemeById(DEFAULT_THEME_ID);

  const conflictKeys = new Set(
    conflicts.map(([a, b]) => getEdgeKey(a, b))
  );

  const vertexRadius = getVertexRadius(vertices.length);

  const getVertexById = (id) => {
    return vertices.find((vertex) => vertex.id === id);
  };

  const activeEdgeKeys = new Set();
  const adjacentVertexIds = new Set();

  if (activeVertexId !== null) {
    for (const [a, b] of edges) {
      if (a === activeVertexId || b === activeVertexId) {
        activeEdgeKeys.add(getEdgeKey(a, b));
        adjacentVertexIds.add(a === activeVertexId ? b : a);
      }
    }
  }

  const hasActiveVertex = activeVertexId !== null;

  return (
    <div className="graphCanvasWrap">
      {toolbar && <div className="graphToolbar">{toolbar}</div>}
      
      <svg
        className="graphCanvas"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Interactive graph coloring puzzle"
      >
        {edges.map(([a, b]) => {
          const start = getVertexById(a);
          const end = getVertexById(b);

          if (!start || !end) {
            return null;
          }

          const edgeKey = getEdgeKey(a, b);
          const isConflict = conflictKeys.has(edgeKey);
          const isActiveEdge = activeEdgeKeys.has(edgeKey);

          const classNames = [
            "edge",
            isConflict ? "conflictEdge" : "",
            isActiveEdge ? "activeEdge" : "",
            hasActiveVertex && !isActiveEdge ? "dimmedEdge" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <line
              key={edgeKey}
              className={classNames}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
            />
          );
        })}

        {vertices.map((vertex) => {
          const isAdjacentVertex = adjacentVertexIds.has(vertex.id);

          const classNames = [
            "vertex",
            isAdjacentVertex ? "adjacentVertex" : "",
            hasActiveVertex &&
            vertex.id !== activeVertexId &&
            !isAdjacentVertex
              ? "dimmedVertex"
              : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <g
              key={vertex.id}
              className="vertexGroup"
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") {
                  onVertexHover?.(vertex.id);
                }
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") {
                  onVertexLeave?.();
                }
              }}
              onClick={() => onVertexClick(vertex.id)}
            >
              <circle
                className={classNames}
                cx={vertex.x}
                cy={vertex.y}
                r={vertexRadius}
                fill={
                  vertex.color === null
                    ? UNCOLORED_VERTEX_COLOR
                    : activeTheme.colors[vertex.color] ?? UNCOLORED_VERTEX_COLOR
                }
              />

              <text
                className="vertexLabel"
                x={vertex.x}
                y={vertex.y + 6}
                textAnchor="middle"
              >
                {vertex.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default GraphCanvas;