import { dailyDesigns } from "./dailyDesigns.js";
import { fingerprint } from "./dailyIntegrity.js";
import { addDailyDays, parseDateKey } from "../../src/utils/dailyDate.js";
import { classifyDifficulty } from "./dailyCalibration.js";
import { adjacency, evaluateDifficulty, isBipartite, isConnected, layoutMetrics, solveThreeColoring, topologySignature } from "./dailyGraph.js";

export function validateDailyPuzzle(puzzle, { historical = false, calibration } = {}) {
  const errors = [];
  if (!puzzle || typeof puzzle !== 'object') return ['Puzzle must be an object.'];
  if (typeof puzzle.id !== 'string' || !/^[a-z\d][a-z\d._:-]{0,127}$/i.test(puzzle.id)) errors.push('Missing/invalid stable id.');
  try { parseDateKey(puzzle.dateKey); } catch { errors.push('Invalid dateKey.'); }
  if (!Number.isInteger(puzzle.version) || puzzle.version < 1) errors.push('Missing positive version.');
  if (!['Challenging', 'Hard', 'Expert'].includes(puzzle.difficulty)) errors.push('Missing difficulty.');
  if (!['generated', 'handcrafted'].includes(puzzle.source)) errors.push('Invalid source.');
  if (!puzzle.name || !puzzle.description) errors.push('Missing name/description.');
  if (!Number.isFinite(puzzle.width) || puzzle.width <= 0 || !Number.isFinite(puzzle.height) || puzzle.height <= 0) errors.push('Invalid canvas dimensions.');
  if (puzzle.theme && (!puzzle.theme.id || !puzzle.theme.name || ['red','blue','yellow'].some(key => !/^#[\da-f]{6}$/i.test(puzzle.theme.colors?.[key])))) errors.push('Invalid puzzle theme.');
  if (!Array.isArray(puzzle.vertices) || puzzle.vertices.length < 3 || puzzle.vertices.length > 24 || !Array.isArray(puzzle.edges)) return [...errors, 'Invalid vertices/edges.'];
  const ids = new Set();
  for (const vertex of puzzle.vertices) {
    if (!vertex || !Number.isInteger(vertex.id) || ids.has(vertex.id) || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y) || vertex.x < 0 || vertex.x > puzzle.width || vertex.y < 0 || vertex.y > puzzle.height || vertex.color !== null) errors.push('Invalid/duplicate vertex.');
    if (vertex) ids.add(vertex.id);
  }
  const seen = new Set();
  for (const edge of puzzle.edges) {
    if (!Array.isArray(edge) || edge.length !== 2 || !ids.has(edge[0]) || !ids.has(edge[1]) || edge[0] === edge[1]) { errors.push('Invalid edge.'); continue; }
    const key = [...edge].sort((a,b)=>a-b).join(':');
    if (seen.has(key)) errors.push('Duplicate edge.');
    seen.add(key);
  }
  if (errors.length) return errors;
  if (!isConnected(puzzle)) errors.push('Disconnected graph or isolated vertices.');
  if (isBipartite(puzzle)) errors.push('Graph does not require three colors.');
  if (!solveThreeColoring(puzzle, {dynamic: true}).solution) errors.push('No validated 3-coloring within the solver budget.');
  if (!historical) {
    const layout = layoutMetrics(puzzle);
    if (layout.vertexSpacing < (puzzle.source === 'generated' ? (puzzle.design ? 72 : 100) : 60)) errors.push('Vertices are too close.');
    if (layout.edgeClearance < 34) errors.push('Edge passes too close to an unrelated vertex.');
  }
  if (puzzle.source === 'generated') {
    const metrics = evaluateDifficulty(puzzle);
    if (!metrics || classifyDifficulty(metrics, calibration) !== puzzle.difficulty) errors.push('Difficulty outside the calibrated band.');
    if (!metrics || metrics.density < 0.26 || metrics.density > 0.4 || [...adjacency(puzzle).values()].some(set=>set.size<2)) errors.push('Unacceptable density/degree.');
    const layout = layoutMetrics(puzzle);
    const expected = {...metrics, minVertexSpacing: Number(layout.vertexSpacing.toFixed(3)), minEdgeClearance: Number(layout.edgeClearance.toFixed(3))};
    if (JSON.stringify(puzzle.metrics) !== JSON.stringify(expected)) errors.push('Missing or stale difficulty/layout metrics.');
    if (!puzzle.generation || !Number.isInteger(puzzle.generation.candidate) || !puzzle.generation.seed || puzzle.generation.version !== (puzzle.design ? 2 : 1)) errors.push('Missing reproducible generation metadata.');
  }
  if (puzzle.design) {
    const design = puzzle.design;
    if (design.version !== 1 || !design.name || !dailyDesigns.some(template=>template.id===design.motif) || !Array.isArray(design.contourEdges)) errors.push('Invalid recognizable design metadata.');
    else for (const edge of design.contourEdges) {
      if (!Array.isArray(edge) || edge.length!==2 || !seen.has([...edge].sort((a,b)=>a-b).join(':'))) errors.push('Design outline must use actual graph edges.');
    }
  }
  return errors;
}

export function validateDailyBank({puzzles, schedule, generated, designed = [], designConfig, overrides, config, ledger, calibration, today}) {
  const errors = [];
  const ids = new Map();
  for (const puzzle of puzzles) {
    if (ids.has(puzzle.id)) errors.push(`Duplicate id: ${puzzle.id}`);
    ids.set(puzzle.id,puzzle);
    const historical = puzzle.id === 'daily-001' || puzzle.id === 'daily-002';
    errors.push(...validateDailyPuzzle(puzzle,{historical,calibration}).map(error=>`${puzzle.id}: ${error}`));
  }
  const seenDates = new Set();
  const signatures = new Set();
  const counts = {Challenging:0,Hard:0,Expert:0};
  for (const puzzle of generated) {
    if (seenDates.has(puzzle.dateKey)) errors.push(`Duplicate generated date: ${puzzle.dateKey}`);
    seenDates.add(puzzle.dateKey);
    counts[puzzle.difficulty]++;
    const signature = topologySignature(puzzle);
    if (signatures.has(signature)) errors.push(`Duplicate topology: ${puzzle.id}`);
    signatures.add(signature);
  }
  const designedDates = new Set();
  const baseByDate = new Map(generated.map(puzzle=>[puzzle.dateKey,puzzle]));
  for (const puzzle of designed) {
    if (designedDates.has(puzzle.dateKey)) errors.push(`Duplicate designed date: ${puzzle.dateKey}`);
    designedDates.add(puzzle.dateKey);
    if (!puzzle.design || puzzle.source!=='generated' || puzzle.dateKey<=designConfig?.preserveThrough || !baseByDate.has(puzzle.dateKey)) errors.push(`Invalid designed replacement: ${puzzle.id}`);
    if (baseByDate.get(puzzle.dateKey)?.difficulty!==puzzle.difficulty) errors.push(`Designed difficulty changed: ${puzzle.id}`);
    const signature = topologySignature(puzzle);
    if (signatures.has(signature)) errors.push(`Duplicate designed topology: ${puzzle.id}`);
    signatures.add(signature);
  }
  if (designConfig) for (const puzzle of generated) {
    if (puzzle.dateKey>designConfig.preserveThrough && !designedDates.has(puzzle.dateKey)) errors.push(`Missing designed date: ${puzzle.dateKey}`);
  }
  if (generated.length !== config.days) errors.push(`Expected ${config.days} generated puzzles.`);
  for (const [difficulty,count] of Object.entries(config.difficultyCounts)) {
    if (counts[difficulty] !== count) errors.push(`Wrong ${difficulty} quota.`);
  }
  for (let day=0;day<config.days;day++) {
    const dateKey = addDailyDays(config.rolloutDate,day);
    if (!seenDates.has(dateKey)) errors.push(`Missing generated date: ${dateKey}`);
    if (!schedule[dateKey] || !ids.has(schedule[dateKey])) errors.push(`Missing scheduled date: ${dateKey}`);
  }
  const overrideDates = new Set();
  const end = addDailyDays(config.rolloutDate,config.days-1);
  for (const puzzle of overrides) {
    if (puzzle.dateKey < config.rolloutDate || puzzle.dateKey > end || puzzle.source !== 'handcrafted') errors.push(`Invalid override: ${puzzle.id}`);
    if (overrideDates.has(puzzle.dateKey)) errors.push(`Duplicate override date: ${puzzle.dateKey}`);
    overrideDates.add(puzzle.dateKey);
  }
  if (ledger.version !== 1) errors.push('Unsupported integrity ledger.');
  for (const puzzle of puzzles) {
    if (ledger.puzzles[puzzle.id] !== fingerprint(puzzle)) errors.push(`Frozen puzzle changed or absent from ledger: ${puzzle.id}`);
  }
  for (const [dateKey,id] of Object.entries(schedule)) {
    try { parseDateKey(dateKey); } catch {errors.push(`Invalid scheduled date: ${dateKey}`);}
    if (!ids.has(id)) errors.push(`Unknown puzzle ${id} on ${dateKey}`);
    if (ledger.schedule[dateKey] !== id) errors.push(`Frozen schedule changed: ${dateKey}`);
    if (dateKey >= config.rolloutDate && ids.get(id)?.dateKey !== dateKey) errors.push(`Puzzle/date mismatch: ${dateKey}`);
  }
  for (const dateKey of Object.keys(ledger.schedule)) {
    if (!Object.hasOwn(schedule,dateKey)) errors.push(`Frozen scheduled date removed: ${dateKey}`);
  }
  if (today && !schedule[today]) errors.push(`Today's Daily is missing (${today}); extend the frozen bank before release.`);
  return errors;
}
