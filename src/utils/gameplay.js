export const COLOR_CYCLE = [null, "red", "blue", "yellow"];

export function cycleVertexColor(vertex, vertexId) {
  if (vertex.id !== vertexId) return vertex;
  const currentColorIndex = COLOR_CYCLE.indexOf(vertex.color);
  return { ...vertex, color: COLOR_CYCLE[(currentColorIndex + 1) % COLOR_CYCLE.length] };
}

// Clone playable graph state; retain the existing shallow metadata references.
// This does not clear colors. Campaign/Daily resets clone their pristine source.
export function cloneGraph(graph) {
  return {
    ...graph,
    vertices: graph.vertices.map(vertex => ({ ...vertex })),
    edges: graph.edges.map(edge => [...edge]),
  };
}

export function formatGameTime(totalMilliseconds) {
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  if (totalSeconds < 60) {
    const milliseconds = totalMilliseconds % 1000;
    return `${totalSeconds}.${String(milliseconds).padStart(3, "0")}`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
