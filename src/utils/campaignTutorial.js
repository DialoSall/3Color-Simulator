import { getConflicts, isSolved } from "./graphValidation.js";

export const tutorialSteps = [
  null,
  { name: "learn_coloring", message: "Tap a circle to give it a color.", vertexIds: [0], edges: [], allowedIds: [0] },
  { name: "create_conflict", message: "Connected circles cannot have the same color. Tap this connected circle.", vertexIds: [1], edges: [[0, 1]], allowedIds: [1] },
  { name: "fix_conflict", message: "Red line = conflict. Change either circle so the connected colors are different.", vertexIds: [0, 1], edges: [[0, 1]], allowedIds: [0, 1] },
  { name: "finish_puzzle", message: "Now color every circle with no conflicts.", vertexIds: [], edges: [], allowedIds: null },
];

// Read the real post-move graph; no tutorial colors or shadow puzzle state.
export function didCompleteTutorialStep(step, vertexId, vertices, edges) {
  if (step === 1) return vertexId === 0 && vertices.some(vertex => vertex.id === 0 && vertex.color !== null);
  if (step === 2) return vertexId === 1 && getConflicts(vertices, edges).some(([a, b]) => (a === 0 && b === 1) || (a === 1 && b === 0));
  if (step === 3) return [0, 1].includes(vertexId) && getConflicts(vertices, edges).length === 0;
  if (step === 4) return isSolved(vertices, edges);
  return false;
}
