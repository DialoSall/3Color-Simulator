// Offline-only deterministic graph analysis. Nothing here is imported by the app.
export function adjacency(graph) {
  const neighbors = new Map(graph.vertices.map(({ id }) => [id, new Set()]));
  for (const [a, b] of graph.edges) {
    neighbors.get(a)?.add(b);
    neighbors.get(b)?.add(a);
  }
  return neighbors;
}

export function seededRandom(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  }
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function solveThreeColoring(graph, { tieSeed = 0, colorSeed = null, dynamic = false, nodeLimit = 100000 } = {}) {
  const neighbors = adjacency(graph);
  const ids = [...neighbors.keys()].sort((a, b) => a - b);
  const tieOrder = shuffle(ids, seededRandom(`solver-${tieSeed}`));
  const ranks = new Map(tieOrder.map((id, i) => [id, i]));
  const order = [...ids].sort((a, b) => neighbors.get(b).size - neighbors.get(a).size || ranks.get(a) - ranks.get(b));
  const colorOrders = colorSeed === null ? null : new Map(ids.map(id=>[id,shuffle([0,1,2],seededRandom(`colors-${colorSeed}-${id}`))]));
  const assigned = new Map();
  const metrics = { nodes: 0, backtracks: 0, decisions: 0, forcedMoves: 0, exhausted: false };
  function search() {
    metrics.nodes++;
    if (metrics.nodes > nodeLimit) {
      metrics.exhausted = true;
      return false;
    }
    if (assigned.size === ids.length) return true;
    let id = order.find((candidate) => !assigned.has(candidate));
    if (dynamic) {
      let bestSaturation = -1;
      for (const candidate of order) {
        if (assigned.has(candidate)) continue;
        const saturation = new Set([...neighbors.get(candidate)].filter(n => assigned.has(n)).map(n => assigned.get(n))).size;
        if (saturation > bestSaturation) {
          id = candidate;
          bestSaturation = saturation;
        }
      }
    }
    const used = new Set([...neighbors.get(id)].map(n => assigned.get(n)));
    const available = (colorOrders?.get(id) ?? [0,1,2]).filter(color => !used.has(color));
    if (available.length === 1) metrics.forcedMoves++;
    if (available.length > 1 && assigned.size > 1) metrics.decisions++;
    for (const color of available) {
      // Global color permutations do not create a different solution.
      if (!assigned.size && color !== 0) continue;
      assigned.set(id, color);
      if (search()) return true;
      assigned.delete(id);
      metrics.backtracks++;
      if (metrics.exhausted) return false;
    }
    return false;
  }
  const solved = search();
  return { solution: solved ? Object.fromEntries(assigned) : null, ...metrics };
}

export function evaluateDifficulty(graph) {
  const probes = Array.from({ length: 8 }, (_, tieSeed) => solveThreeColoring(graph, { tieSeed }));
  if (probes.some(probe => !probe.solution)) return null;
  const mean = key => Number((probes.reduce((sum, probe) => sum + probe[key], 0) / probes.length).toFixed(3));
  const meanNodes = mean('nodes');
  const meanBacktracks = mean('backtracks');
  const meanDecisions = mean('decisions');
  return {
    meanNodes,
    meanBacktracks,
    meanDecisions,
    forcedRatio: Number((mean('forcedMoves') / Math.max(1, meanNodes - 1)).toFixed(3)),
    score: Number((meanNodes + 4 * meanBacktracks + 2 * meanDecisions).toFixed(3)),
    density: Number((2 * graph.edges.length / (graph.vertices.length * (graph.vertices.length - 1))).toFixed(4)),
    cycleRank: graph.edges.length - graph.vertices.length + 1,
  };
}

export function isConnected(graph) {
  const neighbors = adjacency(graph);
  if (!neighbors.size) return false;
  const reached = new Set();
  const queue = [graph.vertices[0].id];
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (reached.has(id)) continue;
    reached.add(id);
    queue.push(...neighbors.get(id));
  }
  return reached.size === neighbors.size;
}

export function isBipartite(graph) {
  const neighbors = adjacency(graph);
  const colors = new Map();
  for (const root of neighbors.keys()) {
    if (colors.has(root)) continue;
    colors.set(root, 0);
    const queue = [root];
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      for (const neighbor of neighbors.get(id)) {
        if (colors.get(neighbor) === colors.get(id)) return false;
        if (!colors.has(neighbor)) {
          colors.set(neighbor, 1 - colors.get(id));
          queue.push(neighbor);
        }
      }
    }
  }
  return true;
}

export function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0;
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}

export function layoutMetrics(graph) {
  let vertexSpacing = Infinity;
  let edgeClearance = Infinity;
  const vertices = new Map(graph.vertices.map(vertex => [vertex.id, vertex]));
  for (let i = 0; i < graph.vertices.length; i++) {
    for (let j = i + 1; j < graph.vertices.length; j++) {
      const a = graph.vertices[i], b = graph.vertices[j];
      vertexSpacing = Math.min(vertexSpacing, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  for (const [a, b] of graph.edges) {
    for (const vertex of graph.vertices) {
      if (vertex.id !== a && vertex.id !== b) {
        edgeClearance = Math.min(edgeClearance, distanceToSegment(vertex, vertices.get(a), vertices.get(b)));
      }
    }
  }
  return { vertexSpacing, edgeClearance };
}

// An isomorphism-invariant Weisfeiler–Leman signature. Rejecting matching
// signatures conservatively also rejects every relabeling of an existing graph.
export function topologySignature(graph) {
  const neighbors = adjacency(graph);
  let labels = new Map([...neighbors].map(([id, adjacent]) => [id, String(adjacent.size)]));
  const hash = text => {
    let value = 2166136261;
    for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
    return (value >>> 0).toString(16);
  };
  for (let round = 0; round < graph.vertices.length; round++) {
    labels = new Map([...neighbors].map(([id, adjacent]) => [id,
      hash(`${labels.get(id)}:[${[...adjacent].map(n => labels.get(n)).sort().join(',')}]`),
    ]));
  }
  return `${graph.vertices.length}/${graph.edges.length}/${[...labels.values()].sort().join('.')}`;
}
