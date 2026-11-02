// Version 1: header (version, vertex count, float64 width/height), followed by
// uint16 IDs + float64 x/y coordinates, then one bit per possible undirected edge.
// Float64 preserves coordinates exactly; colors and play progress are not shared.
const VERSION = 1;
const MAX_VERTICES = 24;
const HEADER_BYTES = 18;
const VERTEX_BYTES = 18;

function byteLength(vertexCount) {
  const possibleEdges = (vertexCount * (vertexCount - 1)) / 2;
  return HEADER_BYTES + vertexCount * VERTEX_BYTES + Math.ceil(possibleEdges / 8);
}

function validateGraph({ width, height, vertices, edges }) {
  if (
    !Number.isFinite(width) || width <= 0 || width > 10000 ||
    !Number.isFinite(height) || height <= 0 || height > 10000 ||
    !Array.isArray(vertices) || vertices.length < 3 || vertices.length > MAX_VERTICES ||
    !Array.isArray(edges) || edges.length > (vertices.length * (vertices.length - 1)) / 2
  ) {
    throw new Error("Invalid graph dimensions or size.");
  }

  const ids = new Set();
  for (const vertex of vertices) {
    if (
      !vertex || !Number.isInteger(vertex.id) || vertex.id < 0 || vertex.id > 65535 ||
      ids.has(vertex.id) ||
      !Number.isFinite(vertex.x) || vertex.x < 0 || vertex.x > width ||
      !Number.isFinite(vertex.y) || vertex.y < 0 || vertex.y > height
    ) {
      throw new Error("Invalid graph vertex.");
    }
    ids.add(vertex.id);
  }

  const connections = new Set();
  for (const edge of edges) {
    if (
      !Array.isArray(edge) || edge.length !== 2 ||
      !ids.has(edge[0]) || !ids.has(edge[1]) || edge[0] === edge[1]
    ) {
      throw new Error("Invalid graph connection.");
    }
    const key = edgeKey(...edge);
    if (connections.has(key)) {
      throw new Error("Duplicate graph connection.");
    }
    connections.add(key);
  }
  return connections;
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Encode a 3–24 vertex puzzle as a URL-safe seed without rounding coordinates. */
export function serializeGraph(graph) {
  const connections = validateGraph(graph);
  const { width, height, vertices } = graph;
  const bytes = new Uint8Array(byteLength(vertices.length));
  const view = new DataView(bytes.buffer);
  bytes[0] = VERSION;
  bytes[1] = vertices.length;
  view.setFloat64(2, width);
  view.setFloat64(10, height);

  vertices.forEach(({ id, x, y }, index) => {
    const offset = HEADER_BYTES + index * VERTEX_BYTES;
    view.setUint16(offset, id);
    view.setFloat64(offset + 2, x);
    view.setFloat64(offset + 10, y);
  });

  const edgeOffset = HEADER_BYTES + vertices.length * VERTEX_BYTES;
  let bit = 0;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++, bit++) {
      if (connections.has(edgeKey(vertices[i].id, vertices[j].id))) {
        bytes[edgeOffset + (bit >> 3)] |= 1 << (bit % 8);
      }
    }
  }

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode and validate untrusted URL data. Throws on invalid/unsupported seeds. */
export function deserializeGraph(seed) {
  if (
    typeof seed !== "string" || !seed ||
    seed.length > Math.ceil(byteLength(MAX_VERTICES) * 4 / 3) ||
    seed.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(seed)
  ) {
    throw new Error("Invalid puzzle seed.");
  }

  const base64 = seed.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const count = bytes[1];
  if (
    bytes[0] !== VERSION || count < 3 || count > MAX_VERTICES ||
    bytes.length !== byteLength(count)
  ) {
    throw new Error("Invalid or unsupported puzzle seed.");
  }

  const view = new DataView(bytes.buffer);
  const width = view.getFloat64(2);
  const height = view.getFloat64(10);
  const vertices = Array.from({ length: count }, (_, index) => {
    const offset = HEADER_BYTES + index * VERTEX_BYTES;
    return {
      id: view.getUint16(offset),
      x: view.getFloat64(offset + 2),
      y: view.getFloat64(offset + 10),
      color: null,
    };
  });

  const edges = [];
  const edgeOffset = HEADER_BYTES + count * VERTEX_BYTES;
  let bit = 0;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++, bit++) {
      if (bytes[edgeOffset + (bit >> 3)] & (1 << (bit % 8))) {
        edges.push([vertices[i].id, vertices[j].id]);
      }
    }
  }

  const graph = {
    id: "shared-puzzle",
    name: "Shared Puzzle",
    description: "Color this shared graph. It may or may not be 3-colorable.",
    width,
    height,
    vertices,
    edges,
  };
  validateGraph(graph);
  return graph;
}

/** Build a playable link on the supplied origin, keeping other query parameters. */
export function createPuzzleUrl(graph, baseUrl) {
  const url = new URL(baseUrl);
  url.pathname = "/custom";
  url.searchParams.set("seed", serializeGraph(graph));
  return url.toString();
}

/** Read a seed without letting a malformed link crash the game. */
export function readSharedPuzzle(search) {
  const seed = new URLSearchParams(search).get("seed");
  if (seed === null) return { graph: null, error: "" };

  try {
    return { graph: deserializeGraph(seed), error: "" };
  } catch {
    return {
      graph: null,
      error: "This puzzle link is invalid or unsupported. A random puzzle was generated instead.",
    };
  }
}
