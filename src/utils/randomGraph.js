const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function createInitialVertices(vertexCount, width, height, margin) {
  const usableWidth = width - margin * 2;
  const usableHeight = height - margin * 2;
  const aspectRatio = usableWidth / usableHeight;

  const columns = Math.ceil(Math.sqrt(vertexCount * aspectRatio));
  const rows = Math.ceil(vertexCount / columns);

  const cellWidth = usableWidth / columns;
  const cellHeight = usableHeight / rows;

  const cells = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      cells.push({ row, column });
    }
  }

  const shuffledCells = shuffle(cells);

  return Array.from({ length: vertexCount }, (_, index) => {
    const { row, column } = shuffledCells[index];

    const jitterX = (Math.random() - 0.5) * cellWidth * 0.5;
    const jitterY = (Math.random() - 0.5) * cellHeight * 0.5;

    return {
      id: index,
      x: margin + (column + 0.5) * cellWidth + jitterX,
      y: margin + (row + 0.5) * cellHeight + jitterY,
      color: null,
    };
  });
}

function getPointToSegmentInfo(point, start, end) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared =
    segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    const offsetX = point.x - start.x;
    const offsetY = point.y - start.y;
    const distance = Math.hypot(offsetX, offsetY);

    return {
      distance,
      unitX: distance > 0 ? offsetX / distance : 1,
      unitY: distance > 0 ? offsetY / distance : 0,
    };
  }

  const projection =
    ((point.x - start.x) * segmentX +
      (point.y - start.y) * segmentY) /
    segmentLengthSquared;

  const t = clamp(projection, 0, 1);

  const closestX = start.x + t * segmentX;
  const closestY = start.y + t * segmentY;

  let offsetX = point.x - closestX;
  let offsetY = point.y - closestY;
  let distance = Math.hypot(offsetX, offsetY);

  if (distance < 0.001) {
    const segmentLength = Math.hypot(segmentX, segmentY) || 1;

    offsetX = -segmentY / segmentLength;
    offsetY = segmentX / segmentLength;
    distance = 0;
  }

  const offsetLength = Math.hypot(offsetX, offsetY) || 1;

  return {
    distance,
    unitX: offsetX / offsetLength,
    unitY: offsetY / offsetLength,
  };
}

function applyForceDirectedLayout(vertices, edges, width, height) {
    const vertexCount = vertices.length;

    const margin = vertexCount >= 20 ? 75 : 55;
    const iterations = vertexCount >= 20 ? 450 : 350;

    const minimumSpacing =
    vertexCount <= 8
        ? 90
        : vertexCount <= 14
        ? 82
        : vertexCount <= 20
            ? 76
            : 72;

    const edgeClearance =
    vertexCount >= 20
        ? 48
        : vertexCount <= 12
        ? 50
        : 44;

    const idealEdgeLength = clamp(
    680 / Math.sqrt(Math.max(vertexCount, 1)),
    110,
    175
    );

    const repulsionBase =
    vertexCount >= 20
        ? 22000
        : vertexCount >= 14
        ? 18000
        : 14000;

  const idToIndex = new Map(
    vertices.map((vertex, index) => [vertex.id, index])
  );

  const velocities = vertices.map(() => ({
    x: 0,
    y: 0,
  }));

  for (let iteration = 0; iteration < iterations; iteration++) {
    const forces = vertices.map(() => ({
      x: 0,
      y: 0,
    }));

    // Repel every pair of vertices.
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        let dx = vertices[i].x - vertices[j].x;
        let dy = vertices[i].y - vertices[j].y;
        let distance = Math.hypot(dx, dy);

        if (distance < 0.001) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          distance = Math.hypot(dx, dy) || 1;
        }

        const unitX = dx / distance;
        const unitY = dy / distance;

        const repulsionStrength = repulsionBase / (distance * distance);

        forces[i].x += unitX * repulsionStrength;
        forces[i].y += unitY * repulsionStrength;
        forces[j].x -= unitX * repulsionStrength;
        forces[j].y -= unitY * repulsionStrength;

        if (distance < minimumSpacing) {
          const collisionStrength =
            (minimumSpacing - distance) * 0.45;

          forces[i].x += unitX * collisionStrength;
          forces[i].y += unitY * collisionStrength;
          forces[j].x -= unitX * collisionStrength;
          forces[j].y -= unitY * collisionStrength;
        }
      }
    }

    // Treat edges like springs.
    for (const [startId, endId] of edges) {
      const startIndex = idToIndex.get(startId);
      const endIndex = idToIndex.get(endId);

      const start = vertices[startIndex];
      const end = vertices[endIndex];

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy) || 1;

      const unitX = dx / distance;
      const unitY = dy / distance;

      const springStrength =
        (distance - idealEdgeLength) * 0.022;

      forces[startIndex].x += unitX * springStrength;
      forces[startIndex].y += unitY * springStrength;
      forces[endIndex].x -= unitX * springStrength;
      forces[endIndex].y -= unitY * springStrength;
    }

    // Keep unrelated vertices away from edges.
    if (iteration > 80) {
      for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex++) {
        const vertex = vertices[vertexIndex];

        for (const [startId, endId] of edges) {
          if (vertex.id === startId || vertex.id === endId) {
            continue;
          }

          const startIndex = idToIndex.get(startId);
          const endIndex = idToIndex.get(endId);

          const edgeInfo = getPointToSegmentInfo(
            vertex,
            vertices[startIndex],
            vertices[endIndex]
          );

          if (edgeInfo.distance < edgeClearance) {
            const avoidanceStrength =
              (edgeClearance - edgeInfo.distance) * 0.3;

            forces[vertexIndex].x +=
              edgeInfo.unitX * avoidanceStrength;
            forces[vertexIndex].y +=
              edgeInfo.unitY * avoidanceStrength;

            // Slightly move the edge endpoints in the opposite direction.
            forces[startIndex].x -=
              edgeInfo.unitX * avoidanceStrength * 0.06;
            forces[startIndex].y -=
              edgeInfo.unitY * avoidanceStrength * 0.06;

            forces[endIndex].x -=
              edgeInfo.unitX * avoidanceStrength * 0.06;
            forces[endIndex].y -=
              edgeInfo.unitY * avoidanceStrength * 0.06;
          }
        }
      }
    }

    // Gently pull the overall graph toward the center.
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < vertices.length; i++) {
      forces[i].x += (centerX - vertices[i].x) * 0.004;
      forces[i].y += (centerY - vertices[i].y) * 0.004;
    }

    const progress = iteration / iterations;
    const maximumStep = 9 * (1 - progress) + 1.5;

    for (let i = 0; i < vertices.length; i++) {
      velocities[i].x = (velocities[i].x + forces[i].x) * 0.82;
      velocities[i].y = (velocities[i].y + forces[i].y) * 0.82;

      const speed = Math.hypot(
        velocities[i].x,
        velocities[i].y
      );

      if (speed > maximumStep) {
        velocities[i].x =
          (velocities[i].x / speed) * maximumStep;
        velocities[i].y =
          (velocities[i].y / speed) * maximumStep;
      }

      vertices[i].x = clamp(
        vertices[i].x + velocities[i].x,
        margin,
        width - margin
      );

      vertices[i].y = clamp(
        vertices[i].y + velocities[i].y,
        margin,
        height - margin
      );
    }
  }

  return vertices.map((vertex) => ({
    ...vertex,
    x: Math.round(vertex.x),
    y: Math.round(vertex.y),
  }));
}

export function generateRandomGraph(vertexCount, edgeProbability) {
    const width =
    vertexCount >= 20
        ? 1100
        : vertexCount >= 14
        ? 980
        : 900;

    const height =
    vertexCount >= 20
        ? 760
        : vertexCount >= 14
        ? 680
        : 620;

    const margin = vertexCount >= 20 ? 80 : 65;

    const edges = [];

    for (let i = 0; i < vertexCount; i++) {
    for (let j = i + 1; j < vertexCount; j++) {
        if (Math.random() < edgeProbability) {
        edges.push([i, j]);
        }
    }
    }

    const initialVertices = createInitialVertices(
    vertexCount,
    width,
    height,
    margin
    );

    const vertices = applyForceDirectedLayout(
    initialVertices,
    edges,
    width,
    height
    );

    return {
    id: `random-${Date.now()}`,
    name: "Random Graph",
    description:
        "A randomly generated graph. Random graphs are not guaranteed to be 3-colorable.",
    width,
    height,
    vertices,
    edges,
  };
}