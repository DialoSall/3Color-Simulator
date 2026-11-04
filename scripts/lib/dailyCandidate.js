import { adjacency, distanceToSegment, evaluateDifficulty, isBipartite, isConnected, layoutMetrics, seededRandom, shuffle, topologySignature } from "./dailyGraph.js";
import { classifyDifficulty } from "./dailyCalibration.js";

export function generateCandidate(seed, calibration) {
  const random = seededRandom(seed);
  const count = 16 + Math.floor(random() * 4);
  const width = 1100, height = 800;
  const cells = shuffle(Array.from({length: 20}, (_, i) => i), random).slice(0, count);
  const vertices = cells.map((cell, id) => ({ id,
    x: Math.round(110 + (cell % 5) * 220 + (random() - 0.5) * 110),
    y: Math.round(100 + Math.floor(cell / 5) * 200 + (random() - 0.5) * 90),
    color: null,
  }));
  const planted = shuffle(Array.from({length: count}, (_, i) => i % 3), random);
  const allowed = [];
  for (let a = 0; a < count; a++) {
    for (let b = a + 1; b < count; b++) {
      if (planted[a] === planted[b]) continue;
      if (vertices.some(vertex => vertex.id !== a && vertex.id !== b && distanceToSegment(vertex, vertices[a], vertices[b]) < 34)) continue;
      allowed.push([a, b]);
    }
  }
  const edgeCount = Math.round((0.28 + random() * 0.105) * count * (count - 1) / 2);
  if (allowed.length < edgeCount) return null;
  const edges = shuffle(allowed, random).slice(0, edgeCount).sort(([a,b],[c,d]) => a-c || b-d);
  const graph = {width, height, vertices, edges};
  if ([...adjacency(graph).values()].some(neighbors => neighbors.size < 2) || !isConnected(graph) || isBipartite(graph)) return null;
  const layout = layoutMetrics(graph);
  if (layout.vertexSpacing < 100 || layout.edgeClearance < 34) return null;
  const metrics = evaluateDifficulty(graph);
  const difficulty = classifyDifficulty(metrics, calibration);
  if (!difficulty) return null;
  return { ...graph, difficulty, metrics: { ...metrics,
    minVertexSpacing: Number(layout.vertexSpacing.toFixed(3)), minEdgeClearance: Number(layout.edgeClearance.toFixed(3)),
  }, signature: topologySignature(graph) };
}
