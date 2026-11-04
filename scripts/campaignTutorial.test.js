import assert from "node:assert/strict";
import test from "node:test";
import { levels } from "../src/data/levels.js";
import { getConflicts, isSolved } from "../src/utils/graphValidation.js";
import { didCompleteTutorialStep } from "../src/utils/campaignTutorial.js";
import { TUTORIAL_PROGRESS_KEY, createTutorialProgressService, hasFinishedTutorial, mergeTutorialProgress } from "../src/services/tutorialProgress.js";

const completed = { tutorialVersion: 1, completed: true, completedAt: "2026-11-04T17:00:00.000Z", skipped: false, skippedAt: null };
const skipped = { tutorialVersion: 1, completed: false, completedAt: null, skipped: true, skippedAt: "2026-11-04T16:00:00.000Z" };
function storageFixture() {
  const values = new Map([["3color-highest-completed-level", "12"]]);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("tutorial steps require real coloring, a real conflict, its removal, and a solved triangle", () => {
  const graph = structuredClone(levels[0]);
  assert.equal(didCompleteTutorialStep(1, 0, graph.vertices, graph.edges), false);
  graph.vertices[2].color = "red";
  assert.equal(didCompleteTutorialStep(1, 2, graph.vertices, graph.edges), false);
  graph.vertices[2].color = null;
  graph.vertices[0].color = "red";
  assert.equal(didCompleteTutorialStep(1, 0, graph.vertices, graph.edges), true);
  assert.equal(didCompleteTutorialStep(2, 1, graph.vertices, graph.edges), false);
  graph.vertices[1].color = "red";
  assert.deepEqual(getConflicts(graph.vertices, graph.edges), [[0, 1]]);
  assert.equal(didCompleteTutorialStep(2, 1, graph.vertices, graph.edges), true);
  assert.equal(didCompleteTutorialStep(3, 0, graph.vertices, graph.edges), false);
  graph.vertices[1].color = "blue";
  assert.equal(didCompleteTutorialStep(3, 1, graph.vertices, graph.edges), true);
  assert.equal(didCompleteTutorialStep(4, 2, graph.vertices, graph.edges), false);
  graph.vertices[2].color = "yellow";
  assert.equal(isSolved(graph.vertices, graph.edges), true);
  assert.equal(didCompleteTutorialStep(4, 2, graph.vertices, graph.edges), true);
  assert.ok(levels[0].vertices.every(vertex => vertex.color === null));
});

test("completion and skip persist independently of campaign unlocks and reload as dismissed", async () => {
  for (const record of [completed, skipped]) {
    const storage = storageFixture();
    const service = createTutorialProgressService({ storage });
    assert.equal(hasFinishedTutorial(await service.getProgress()), false);
    assert.equal(storage.values.has(TUTORIAL_PROGRESS_KEY), false);
    await service.saveProgress(record);
    assert.equal(hasFinishedTutorial(await createTutorialProgressService({ storage }).getProgress()), true);
    assert.equal(storage.values.get("3color-highest-completed-level"), "12");
    assert.equal(storage.values.size, 2);
  }
});

test("account-ready merges are idempotent, retain completion, and preserve newer versions", () => {
  const merged = mergeTutorialProgress(completed, skipped);
  assert.equal(merged.completed, true);
  assert.equal(merged.completedAt, completed.completedAt);
  assert.deepEqual(mergeTutorialProgress(merged, completed), merged);
  assert.deepEqual(mergeTutorialProgress(skipped, completed), merged);
  const newer = { ...completed, tutorialVersion: 2 };
  assert.deepEqual(mergeTutorialProgress(newer, skipped), newer);
  assert.deepEqual(mergeTutorialProgress(completed, newer), newer);
  assert.equal(hasFinishedTutorial(newer), true);
});

test("corrupt records and unavailable storage do not require changing campaign progress", async () => {
  const storage = storageFixture();
  storage.values.set(TUTORIAL_PROGRESS_KEY, "{bad-json");
  assert.equal(hasFinishedTutorial(await createTutorialProgressService({ storage }).getProgress()), false);
  assert.equal(storage.values.get(TUTORIAL_PROGRESS_KEY), "{bad-json");
  const blocked = createTutorialProgressService({ storage: { getItem() { return null; }, setItem() { throw new Error("blocked"); } } });
  await assert.rejects(blocked.saveProgress(completed), /blocked/);
  const memory = createTutorialProgressService({ storage: null });
  await memory.saveProgress(skipped);
  assert.equal(hasFinishedTutorial(await memory.getProgress()), true);
});
