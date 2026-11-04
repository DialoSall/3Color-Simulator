import assert from "node:assert/strict";
import test from "node:test";
import { COLOR_CYCLE, cloneGraph, cycleVertexColor, formatGameTime } from "../src/utils/gameplay.js";
import { getConflicts, isSolved } from "../src/utils/graphValidation.js";
import { levels } from "../src/data/levels.js";

test("color cycling preserves identity/metadata and leaves other vertices untouched", () => {
  const original = Object.freeze({ id: 500, x: 120, y: 80, color: null, marker: "keep" });
  assert.deepEqual(COLOR_CYCLE, [null, "red", "blue", "yellow"]);
  assert.equal(cycleVertexColor(original, 7), original);
  let vertex = original;
  for (const color of ["red", "blue", "yellow", null]) {
    const next = cycleVertexColor(vertex, 500);
    assert.notEqual(next, vertex);
    assert.deepEqual(next, { ...original, color });
    vertex = next;
  }
  assert.equal(original.color, null);
});

test("graph clones isolate playable arrays without clearing colors or deep-cloning metadata", () => {
  const source = { id: "test", theme: { id: "classic" }, vertices: [{ id: 7, x: 80, y: 100, color: "blue" }, { id: 500, x: 250, y: 100, color: null }], edges: [[7, 500]] };
  const copy = cloneGraph(source);
  assert.deepEqual(copy, source);
  assert.notEqual(copy, source);
  assert.notEqual(copy.vertices, source.vertices);
  assert.notEqual(copy.vertices[0], source.vertices[0]);
  assert.notEqual(copy.edges, source.edges);
  assert.notEqual(copy.edges[0], source.edges[0]);
  assert.equal(copy.theme, source.theme);
  copy.vertices[0].color = "yellow";
  copy.vertices[0].x = 300;
  copy.edges[0][1] = 7;
  assert.equal(source.vertices[0].color, "blue");
  assert.equal(source.vertices[0].x, 80);
  assert.deepEqual(source.edges, [[7, 500]]);
});

test("shared time formatting retains millisecond/minute boundaries and long-game output", () => {
  for (const [milliseconds, expected] of [[0,"0.000"],[1,"0.001"],[99,"0.099"],[999,"0.999"],[1000,"1.000"],[1234,"1.234"],[59999,"59.999"],[60000,"1:00"],[61000,"1:01"],[3599999,"59:59"],[3600000,"60:00"]]) {
    assert.equal(formatGameTime(milliseconds), expected);
  }
});

test("shared moves create/remove real conflicts and solve a pristine cloned campaign triangle", () => {
  const graph = cloneGraph(levels[0]);
  const move = id => { graph.vertices = graph.vertices.map(vertex => cycleVertexColor(vertex, id)); };
  assert.equal(isSolved(graph.vertices, graph.edges), false);
  move(0); move(1);
  assert.deepEqual(getConflicts(graph.vertices, graph.edges), [[0, 1]]);
  move(1);
  assert.deepEqual(getConflicts(graph.vertices, graph.edges), []);
  move(2); move(2); move(2);
  assert.equal(isSolved(graph.vertices, graph.edges), true);
  assert.ok(levels[0].vertices.every(vertex => vertex.color === null));
});
