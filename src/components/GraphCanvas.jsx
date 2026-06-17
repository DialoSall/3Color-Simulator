import { getEdgeKey } from "../utils/graphValidation";

const colorMap = {
  red: "#ff3b30",
  blue: "#007aff",
  yellow: "#ffcc00",
  null: "#d1d1d6",
};

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
}) {
  const conflictKeys = new Set(conflicts.map(([a, b]) => getEdgeKey(a, b)));
  const vertexRadius = getVertexRadius(vertices.length);

  const getVertexById = (id) => {
    return vertices.find((vertex) => vertex.id === id);
  };

  return (
    <div className="graphCanvasWrap">
      <svg className="graphCanvas" viewBox={`0 0 ${width} ${height}`}>
        {edges.map(([a, b]) => {
          const start = getVertexById(a);
          const end = getVertexById(b);
          const isConflict = conflictKeys.has(getEdgeKey(a, b));

          return (
            <line
              key={`${a}-${b}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              className={isConflict ? "edge conflictEdge" : "edge"}
            />
          );
        })}

        {vertices.map((vertex) => (
          <g
            key={vertex.id}
            className="vertexGroup"
            onClick={() => onVertexClick(vertex.id)}
          >
            <circle
              cx={vertex.x}
              cy={vertex.y}
              r={vertexRadius}
              fill={colorMap[vertex.color]}
              className="vertex"
            />
            <text
              x={vertex.x}
              y={vertex.y + 6}
              textAnchor="middle"
              className="vertexLabel"
            >
              {vertex.id}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default GraphCanvas;