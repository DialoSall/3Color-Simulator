export const dailyPuzzles = [
  {
    id: "daily-001",
    name: "Daily Puzzle #1",
    description:
      "Today's graph-coloring challenge. Color every circle so connected circles never share the same color.",
    width: 520,
    height: 420,
    vertices: [
      { id: 1, x: 260, y: 60, color: null },
      { id: 2, x: 150, y: 150, color: null },
      { id: 3, x: 370, y: 150, color: null },
      { id: 4, x: 120, y: 290, color: null },
      { id: 5, x: 260, y: 350, color: null },
      { id: 6, x: 400, y: 290, color: null },
    ],
    edges: [
      [1, 2],
      [1, 3],
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 5],
      [3, 6],
      [4, 5],
      [5, 6],
    ],
  },
];

const DAILY_START_DATE_UTC = Date.UTC(2026, 8, 3); // September 3, 2026
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getDailyDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getDailyPuzzle(date = new Date()) {
  const todayUTC = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );

  const daysSinceStart = Math.max(
    0,
    Math.floor((todayUTC - DAILY_START_DATE_UTC) / MILLISECONDS_PER_DAY)
  );

  const sourcePuzzle = dailyPuzzles[daysSinceStart % dailyPuzzles.length];

  return {
    ...sourcePuzzle,
    dateKey: getDailyDateKey(date),
    dailyNumber: daysSinceStart + 1,
    name: `Daily Puzzle #${daysSinceStart + 1}`,
    description:
      "Today's graph-coloring challenge. Color every circle so connected circles never share the same color.",
  };
}