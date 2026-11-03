import assert from "node:assert/strict";
import test from "node:test";
import {
  serializeGraph,
  deserializeGraph,
  createPuzzleUrl,
  readSharedPuzzle,
} from "../src/utils/graphSharing.js";
import { generateRandomGraph } from "../src/utils/randomGraph.js";

const graph = {
  width: 900,
  height: 620,
  vertices: [
    { id: 20, x: 0.1, y: 100.123456789, color: "red" },
    { id: 7, x: 300, y: 0, color: "blue" },
    { id: 500, x: 900, y: 620, color: "yellow" },
  ],
  edges: [[500, 20], [7, 20]],
};

function connections(edges) {
  return edges.map(([a, b]) => [a, b].sort((x, y) => x - y).join(":")).sort();
}

function assertSamePuzzle(actual, expected) {
  assert.equal(actual.width, expected.width);
  assert.equal(actual.height, expected.height);
  assert.deepEqual(actual.vertices, expected.vertices.map((vertex) => ({ ...vertex, color: null })));
  assert.deepEqual(connections(actual.edges), connections(expected.edges));
}

function alterSeed(seed, alter) {
  const bytes = Buffer.from(seed, "base64url");
  alter(bytes);
  return bytes.toString("base64url");
}

test("exact coordinates, dimensions, IDs, and connections round-trip with colors reset", () => {
  const seed = serializeGraph(graph);
  assert.match(seed, /^[A-Za-z0-9_-]+$/);
  const decoded = deserializeGraph(seed);
  assertSamePuzzle(decoded, graph);
  assert.equal(serializeGraph(decoded), seed);
  assert.equal(graph.vertices[0].color, "red");
});

test("generated graphs of every supported size and sparse/dense extremes round-trip", () => {
  for (let count = 3; count <= 24; count++) {
    for (const probability of [0, 0.25, 1]) {
      const generated = generateRandomGraph(count, probability);
      const seed = serializeGraph(generated);
      assertSamePuzzle(deserializeGraph(seed), generated);
      assert.ok(seed.length <= 647, `Unexpected seed length: ${seed.length}`);
    }
  }
});

test("share URLs replace stale seeds, preserve origin and other parameters, and load exactly", () => {
  for (const base of ["https://3color.app/?utm_source=friend&seed=old", "http://localhost:5173/daily?seed=old"]) {
    const url = new URL(createPuzzleUrl(graph, base));
    assert.equal(url.origin, new URL(base).origin);
    assert.equal(url.pathname, "/custom");
    assert.equal(url.searchParams.getAll("seed").length, 1);
    assert.equal(url.searchParams.get("utm_source"), new URL(base).searchParams.get("utm_source"));
    assertSamePuzzle(readSharedPuzzle(url.search).graph, graph);
  }
});

test("no seed keeps normal generation; empty or malformed seeds produce a recovery message", () => {
  assert.deepEqual(readSharedPuzzle("?utm_source=friend"), { graph: null, error: "" });
  for (const search of ["?seed=", "?seed=garbage", "?seed=%3Cscript%3E", `?seed=${"a".repeat(10000)}`]) {
    const result = readSharedPuzzle(search);
    assert.equal(result.graph, null);
    assert.match(result.error, /invalid or unsupported/);
  }
});

test("unsupported versions, truncation, extra data, bad counts and corrupt geometry are rejected", () => {
  const seed = serializeGraph(graph);
  const invalidSeeds = [
    "A", "__", `${seed}!`, seed.slice(0, -4), `${seed}AAAA`,
    alterSeed(seed, (bytes) => { bytes[0] = 99; }),
    alterSeed(seed, (bytes) => { bytes[1] = 25; }),
    alterSeed(seed, (bytes) => { bytes.writeDoubleBE(Infinity, 2); }),
    alterSeed(seed, (bytes) => { bytes.writeDoubleBE(NaN, 20); }),
    alterSeed(seed, (bytes) => { bytes.writeDoubleBE(-1, 20); }),
    alterSeed(seed, (bytes) => { bytes.writeUInt16BE(20, 36); }),
  ];
  for (const invalid of invalidSeeds) {
    assert.throws(() => deserializeGraph(invalid));
  }
});

test("serialization rejects dangling edges, self loops, duplicates and unsupported vertices", () => {
  for (const edges of [[[20, 999]], [[20, 20]], [[20, 7], [7, 20]], [[20]], [null]]) {
    assert.throws(() => serializeGraph({ ...graph, edges }));
  }
  for (const vertex of [null, { id: -1, x: 50, y: 50 }, { id: 20, x: Infinity, y: 50 }]) {
    assert.throws(() => serializeGraph({ ...graph, vertices: [vertex, ...graph.vertices.slice(1)] }));
  }
});

test("the game renders a seeded graph with exact SVG geometry and recovers from bad links", async () => {
  const { createServer } = await import("vite");
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { MemoryRouter } = await import("react-router-dom");
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
  });
  try {
    const { default: App } = await vite.ssrLoadModule("/src/App.jsx");
    const render = (url) => renderToString(createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(App)
    ));
    const html = render(`/custom?seed=${serializeGraph(graph)}`);
    assert.match(html, /Shared Puzzle/);
    assert.match(html, /Share Puzzle/);
    assert.match(html, /viewBox="0 0 900 620"/);
    assert.equal((html.match(/class="vertex"/g) ?? []).length, 3);
    assert.equal((html.match(/class="edge"/g) ?? []).length, 2);
    for (const { x, y } of graph.vertices) {
      assert.ok(html.includes(`cx="${x}" cy="${y}"`));
    }
    assert.equal((html.match(/fill="var\(--uncolored-vertex\)"/g) ?? []).length, 3);
    assert.match(render("/custom?seed=invalid"), /invalid or unsupported/);
    assert.match(render("/"), /Start Challenge/);
  } finally {
    await vite.close();
  }
});
