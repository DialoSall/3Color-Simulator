export const dailyPuzzles = [
  {
    id: "daily-001",
    dateKey: "2026-09-03",
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
  {
    id: "daily-002",
    dateKey: "2026-09-22",
    name: "Fox Face",
    description:
      "A fox-shaped challenge built from tightly connected regions. Watch how choices near the ears and eyes constrain the rest of the face.",
    theme: {
      id: "fox",
      name: "Fox",
      colors: {
        red: "#d96a2b",
        blue: "#2b2118",
        yellow: "#f4d9a6",
      },
    },
    width: 900,
    height: 650,
    vertices: [
      { id: 0, x: 220, y: 70, color: null },
      { id: 1, x: 680, y: 70, color: null },

      { id: 2, x: 300, y: 175, color: null },
      { id: 3, x: 600, y: 175, color: null },
      { id: 4, x: 450, y: 125, color: null },

      { id: 5, x: 145, y: 255, color: null },
      { id: 6, x: 755, y: 255, color: null },

      { id: 7, x: 320, y: 300, color: null },
      { id: 8, x: 580, y: 300, color: null },
      { id: 9, x: 235, y: 365, color: null },
      { id: 10, x: 665, y: 365, color: null },
      { id: 11, x: 450, y: 300, color: null },

      { id: 12, x: 350, y: 430, color: null },
      { id: 13, x: 550, y: 430, color: null },
      { id: 14, x: 450, y: 470, color: null },

      { id: 15, x: 295, y: 520, color: null },
      { id: 16, x: 605, y: 520, color: null },
      { id: 17, x: 450, y: 585, color: null },
    ],
    edges: [
      [0, 5],
      [5, 9],
      [9, 15],
      [15, 17],
      [17, 16],
      [16, 10],
      [10, 6],
      [6, 1],

      [0, 2],
      [2, 4],
      [4, 3],
      [3, 1],
      [0, 4],
      [1, 4],

      [2, 7],
      [7, 11],
      [11, 8],
      [8, 3],
      [5, 7],
      [6, 8],
      [7, 9],
      [8, 10],

      [9, 12],
      [12, 14],
      [14, 13],
      [13, 10],

      [11, 12],
      [11, 13],
      [11, 14],

      [12, 15],
      [13, 16],
      [14, 17],

      [7, 12],
      [8, 13],
      [4, 11],

      [12, 17],
      [13, 17],
      [2, 11],
      [3, 11],
      [2, 9],
      [3, 10],
      [2, 8],
      [3, 7],
      [4, 12],
      [4, 13],
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
  const dateKey = getDailyDateKey(date);

  const todayUTC = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );

  const daysSinceStart = Math.max(
    0,
    Math.floor((todayUTC - DAILY_START_DATE_UTC) / MILLISECONDS_PER_DAY)
  );

  const availablePuzzles = dailyPuzzles
    .filter((puzzle) => puzzle.dateKey <= dateKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const sourcePuzzle =
    availablePuzzles[availablePuzzles.length - 1] ?? dailyPuzzles[0];

  return {
    ...sourcePuzzle,
    dateKey,
    dailyNumber: daysSinceStart + 1,
  };
}