import { levels } from "../src/data/levels.js";

const COLOR_COUNT = 3;

function normalizeEdge(edge) {
  const [a, b] = edge;
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function validateLevelShape(level, index) {
  const errors = [];
  const warnings = [];

  if (!Number.isInteger(level.id)) {
    errors.push("Level id must be an integer.");
  }

  if (level.id !== index + 1) {
    warnings.push(`Expected id ${index + 1}, found id ${level.id}.`);
  }

  if (!level.name) {
    errors.push("Missing level name.");
  }

  if (!level.difficulty) {
    errors.push("Missing level difficulty.");
  }

  if (!level.description) {
    errors.push("Missing level description.");
  }

  if (!Array.isArray(level.vertices) || level.vertices.length === 0) {
    errors.push("Level must have at least one vertex.");
    return { errors, warnings };
  }

  if (!Array.isArray(level.edges)) {
    errors.push("Level edges must be an array.");
    return { errors, warnings };
  }

  const vertexIds = new Set();

  for (const vertex of level.vertices) {
    if (!Number.isInteger(vertex.id)) {
      errors.push(`Vertex has invalid id: ${JSON.stringify(vertex)}`);
      continue;
    }

    if (vertexIds.has(vertex.id)) {
      errors.push(`Duplicate vertex id: ${vertex.id}.`);
    }

    vertexIds.add(vertex.id);

    if (typeof vertex.x !== "number" || typeof vertex.y !== "number") {
      errors.push(`Vertex ${vertex.id} must have numeric x and y coordinates.`);
    }

    if (vertex.color !== null) {
      warnings.push(`Vertex ${vertex.id} starts with color "${vertex.color}". Expected null.`);
    }
  }

  const seenEdges = new Set();

  for (const edge of level.edges) {
    if (!Array.isArray(edge) || edge.length !== 2) {
      errors.push(`Invalid edge: ${JSON.stringify(edge)}.`);
      continue;
    }

    const [a, b] = edge;

    if (!vertexIds.has(a)) {
      errors.push(`Edge references missing vertex ${a}.`);
    }

    if (!vertexIds.has(b)) {
      errors.push(`Edge references missing vertex ${b}.`);
    }

    if (a === b) {
      errors.push(`Self-loop found on vertex ${a}.`);
    }

    const edgeKey = normalizeEdge(edge);

    if (seenEdges.has(edgeKey)) {
      warnings.push(`Duplicate edge found: [${a}, ${b}].`);
    }

    seenEdges.add(edgeKey);
  }

  const connectedVertices = new Set();

  for (const [a, b] of level.edges) {
    connectedVertices.add(a);
    connectedVertices.add(b);
  }

  for (const vertex of level.vertices) {
    if (!connectedVertices.has(vertex.id)) {
      warnings.push(`Vertex ${vertex.id} is isolated.`);
    }
  }

  return { errors, warnings };
}

function buildAdjacency(level) {
  const adjacency = new Map();

  for (const vertex of level.vertices) {
    adjacency.set(vertex.id, new Set());
  }

  for (const [a, b] of level.edges) {
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  }

  return adjacency;
}

function findThreeColoring(level) {
  const adjacency = buildAdjacency(level);

  const vertexIds = level.vertices
    .map((vertex) => vertex.id)
    .sort((a, b) => adjacency.get(b).size - adjacency.get(a).size);

  const assignment = new Map();

  function canUseColor(vertexId, color) {
    for (const neighborId of adjacency.get(vertexId)) {
      if (assignment.get(neighborId) === color) {
        return false;
      }
    }

    return true;
  }

  function backtrack(position) {
    if (position === vertexIds.length) {
      return true;
    }

    const vertexId = vertexIds[position];

    for (let color = 0; color < COLOR_COUNT; color += 1) {
      if (!canUseColor(vertexId, color)) {
        continue;
      }

      assignment.set(vertexId, color);

      if (backtrack(position + 1)) {
        return true;
      }

      assignment.delete(vertexId);
    }

    return false;
  }

  const isColorable = backtrack(0);

  if (!isColorable) {
    return null;
  }

  return Object.fromEntries(
    [...assignment.entries()].sort(([a], [b]) => a - b)
  );
}

function validateColoring(level, coloring) {
  const errors = [];

  for (const vertex of level.vertices) {
    if (!Number.isInteger(coloring[vertex.id])) {
      errors.push(`Vertex ${vertex.id} has no assigned color.`);
    }
  }

  for (const [a, b] of level.edges) {
    if (coloring[a] === coloring[b]) {
      errors.push(`Invalid coloring: edge [${a}, ${b}] has matching colors.`);
    }
  }

  return errors;
}

let totalErrors = 0;
let totalWarnings = 0;

console.log(`Checking ${levels.length} levels...\n`);

levels.forEach((level, index) => {
  const label = `Level ${level.id ?? index + 1}: ${level.name ?? "Untitled"}`;
  const { errors, warnings } = validateLevelShape(level, index);

  if (errors.length > 0) {
    totalErrors += errors.length;

    console.log(`Error ${label}`);

    for (const error of errors) {
      console.log(`   Error: ${error}`);
    }

    for (const warning of warnings) {
      totalWarnings += 1;
      console.log(`   Warning: ${warning}`);
    }

    console.log("");
    return;
  }

  const coloring = findThreeColoring(level);

  if (!coloring) {
    totalErrors += 1;
    console.log(`Error ${label}`);
    console.log("   Error: No valid 3-coloring exists.");
    console.log("");
    return;
  }

  const coloringErrors = validateColoring(level, coloring);

  if (coloringErrors.length > 0) {
    totalErrors += coloringErrors.length;

    console.log(`Error ${label}`);

    for (const error of coloringErrors) {
      console.log(`   Error: ${error}`);
    }

    console.log("");
    return;
  }

  if (warnings.length > 0) {
    console.log(`⚠️  ${label}`);

    for (const warning of warnings) {
      totalWarnings += 1;
      console.log(`   Warning: ${warning}`);
    }

    console.log("");
    return;
  }

  console.log(`Success ${label}`);
});

console.log("\nValidation complete.");
console.log(`Errors: ${totalErrors}`);
console.log(`Warnings: ${totalWarnings}`);

if (totalErrors > 0) {
  process.exit(1);
}