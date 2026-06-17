export function getConflicts(vertices, edges) {
  const colorById = new Map(vertices.map((vertex) => [vertex.id, vertex.color]));

  return edges.filter(([a, b]) => {
    const colorA = colorById.get(a);
    const colorB = colorById.get(b);

    return colorA !== null && colorA === colorB;
  });
}

export function isSolved(vertices, edges) {
  const allColored = vertices.every((vertex) => vertex.color !== null);
  const conflicts = getConflicts(vertices, edges);

  return allColored && conflicts.length === 0;
}

export function getEdgeKey(a, b) {
  return [a, b].sort((x, y) => x - y).join("-");
}