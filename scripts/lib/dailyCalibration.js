import { levels } from "../../src/data/levels.js";
import { evaluateDifficulty } from "./dailyGraph.js";

export function calibrateDaily() {
  const campaign = levels.filter(level => level.id >= 25 && level.id <= 30).map(level => ({
    id: level.id, name: level.name, vertices: level.vertices.length, edges: level.edges.length,
    ...evaluateDifficulty(level),
  }));
  const scores = campaign.map(level => level.score).sort((a, b) => a - b);
  return { evaluatorVersion: 1, probes: 8, scoreFormula: "meanNodes + 4*meanBacktracks + 2*meanDecisions", campaign,
    bands: { Challenging: [scores[0], scores[2]], Hard: [scores[2], scores[4]], Expert: [scores[4], scores[5]] },
  };
}

export function classifyDifficulty(metrics, calibration) {
  if (!metrics) return null;
  for (const [name, [low, high]] of Object.entries(calibration.bands)) {
    if (metrics.score >= low && (name === "Expert" ? metrics.score <= high : metrics.score < high)) return name;
  }
  return null;
}
