import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { levels } from "../src/data/levels.js";
import { campaignIdentity, campaignLayoutMetrics, campaignVertexRadius } from "./lib/campaignLayout.js";
import { evaluateDifficulty, solveThreeColoring } from "./lib/dailyGraph.js";

const baseline = JSON.parse(await readFile(new URL("./fixtures/campaignLayouts.json", import.meta.url)));

test("every Campaign ID, edge, starting color, dimension and metadata stays unchanged", () => {
  assert.equal(levels.length, baseline.levels.length);
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i], original = baseline.levels[i];
    assert.equal(level.id, original.id);
    assert.equal(campaignIdentity(level), original.identity, `Level ${level.id}: non-coordinate data changed`);
    if (!baseline.edited.includes(level.id)) {
      assert.equal(createHash("sha256").update(JSON.stringify(level)).digest("hex"), original.fullHash, `Level ${level.id} must remain entirely unchanged`);
    }
  }
});

test("the five revised layouts reduce crossings, remove near misses and fit the unchanged canvas", () => {
  for (const id of baseline.edited) {
    const level = levels[id - 1], before = baseline.levels[id - 1].before;
    const after = campaignLayoutMetrics(level);
    assert.ok(after.crossings < before.crossings * 0.4, `Level ${id}: expected at least 60% fewer crossings`);
    assert.ok(after.minSpacing >= 105, `Level ${id}: crowded vertices`);
    assert.ok(after.minClearance >= 40, `Level ${id}: edge near an unrelated circle`);
    assert.equal(after.crowdedEdges, 0);
    assert.equal(after.shallowCrossings, 0);
    const radius = campaignVertexRadius(level.vertices.length);
    for (const vertex of level.vertices) {
      assert.ok(Number.isInteger(vertex.x) && Number.isInteger(vertex.y));
      assert.ok(vertex.x >= radius + 16 && vertex.x <= level.width - radius - 16);
      assert.ok(vertex.y >= radius + 16 && vertex.y <= level.height - radius - 16);
    }
    const { solution } = solveThreeColoring(level, { dynamic: true });
    assert.ok(solution);
    for (const [a, b] of level.edges) assert.notEqual(solution[a], solution[b]);
    assert.deepEqual(evaluateDifficulty(level), baseline.levels[id - 1].difficultyMetrics);
  }
});

test("layout audit excludes shared endpoints and reports proper crossings and blocked circles", () => {
  const graph = { vertices: [{ id: 0, x: 0, y: 0 }, { id: 1, x: 200, y: 200 }, { id: 2, x: 0, y: 200 }, { id: 3, x: 200, y: 0 }], edges: [[0, 1], [2, 3], [0, 2]] };
  assert.equal(campaignLayoutMetrics(graph).crossings, 1);
  const blocked = { ...graph, vertices: [...graph.vertices, { id: 4, x: 100, y: 100 }] };
  assert.equal(campaignLayoutMetrics(blocked).minClearance, 0);
  assert.equal(campaignLayoutMetrics(blocked).crowdedEdges, 2);
});
