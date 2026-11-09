// Authoring/test analysis only. Never imported by the browser application.
import { createHash } from "node:crypto";
import { distanceToSegment, layoutMetrics } from "./dailyGraph.js";

export function campaignVertexRadius(count) {
  return count <= 8 ? 34 : count <= 12 ? 30 : count <= 16 ? 26 : 25;
}

// Includes IDs, edge order and all non-coordinate metadata, not just isomorphism.
export function campaignIdentity(level) {
  const { vertices, ...rest } = level;
  return createHash("sha256").update(JSON.stringify({ ...rest, vertices: vertices.map(vertex => Object.fromEntries(Object.entries(vertex).filter(([key]) => key !== "x" && key !== "y"))) })).digest("hex");
}

export function campaignLayoutMetrics(level) {
  const vertices = new Map(level.vertices.map(vertex => [vertex.id, vertex]));
  const radius = campaignVertexRadius(vertices.size);
  const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let crossings = 0, shallowCrossings = 0, crowdedEdges = 0;
  for (let i = 0; i < level.edges.length; i++) {
    const [a, b] = level.edges[i];
    const p = vertices.get(a), q = vertices.get(b);
    for (let j = i + 1; j < level.edges.length; j++) {
      const [c, d] = level.edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      const r = vertices.get(c), s = vertices.get(d);
      if (orient(p, q, r) * orient(p, q, s) < 0 && orient(r, s, p) * orient(r, s, q) < 0) {
        crossings++;
        const cosine = Math.abs(((q.x - p.x) * (s.x - r.x) + (q.y - p.y) * (s.y - r.y)) / (Math.hypot(q.x - p.x, q.y - p.y) * Math.hypot(s.x - r.x, s.y - r.y)));
        if (cosine > Math.cos(Math.PI / 12)) shallowCrossings++;
      }
    }
    if (level.vertices.some(vertex => vertex.id !== a && vertex.id !== b && distanceToSegment(vertex, p, q) < radius + 12)) crowdedEdges++;
  }
  const { vertexSpacing, edgeClearance } = layoutMetrics(level);
  return {
    crossings, shallowCrossings, crowdedEdges,
    minSpacing: Number(vertexSpacing.toFixed(2)),
    minClearance: Number(edgeClearance.toFixed(2)),
    // Euler's bound is a lower bound, not an exact crossing-number claim.
    crossingLowerBound: Math.max(0, level.edges.length - 3 * vertices.size + 6),
  };
}
