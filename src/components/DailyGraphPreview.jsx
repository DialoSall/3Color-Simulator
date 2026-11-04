import { DEFAULT_THEME_ID, getThemeById } from "../data/colorThemes";
import { getEdgeKey } from "../utils/graphValidation";

function DailyGraphPreview({ puzzle }) {
  const theme = puzzle.theme ?? getThemeById(DEFAULT_THEME_ID);
  const vertices = new Map(puzzle.vertices.map(vertex => [vertex.id, vertex]));
  const contours = new Set((puzzle.design?.contourEdges ?? []).map(edge => getEdgeKey(...edge)));
  const xs = puzzle.vertices.map(vertex => vertex.x);
  const ys = puzzle.vertices.map(vertex => vertex.y);
  const left = Math.min(...xs) - 42;
  const top = Math.min(...ys) - 42;
  const width = Math.max(...xs) - left + 42;
  const height = Math.max(...ys) - top + 42;
  const edges = [...puzzle.edges].sort((a,b) => Number(contours.has(getEdgeKey(...a))) - Number(contours.has(getEdgeKey(...b))));

  return (
    <div className="dailyGraphPreview" style={{ "--preview-accent": theme.colors.red }}>
      <svg className="homeGraph" viewBox={`${left} ${top} ${width} ${height}`} role="img" aria-label={`${puzzle.name} puzzle preview`} focusable="false">
        <g aria-hidden="true">
          {edges.map(([a,b]) => {
            const start = vertices.get(a), end = vertices.get(b);
            if (!start || !end) return null;
            const key = getEdgeKey(a,b);
            return <line key={key} className={contours.has(key) ? "previewContour" : undefined} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
          })}
          {puzzle.vertices.map(vertex => <circle key={vertex.id} cx={vertex.x} cy={vertex.y} r="18" />)}
        </g>
      </svg>
      <div className="homePreviewPalette" aria-hidden="true">
        {Object.entries(theme.colors).map(([name,color]) => <span key={name} style={{ backgroundColor: color }} />)}
      </div>
    </div>
  );
}

export default DailyGraphPreview;
