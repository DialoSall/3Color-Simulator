export const levels = [
  {
    id: 1,
    name: "Three-Way Split",
    difficulty: "Intro",
    description:
      "Give each of the three circles a different color.",
    vertices: [
      { id: 0, x: 300, y: 90, color: null },
      { id: 1, x: 150, y: 340, color: null },
      { id: 2, x: 450, y: 340, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
  },

  {
    id: 2,
    name: "Around the Square",
    difficulty: "Intro",
    description:
      "You can solve this puzzle using only two of the three colors.",
    vertices: [
      { id: 0, x: 170, y: 120, color: null },
      { id: 1, x: 430, y: 120, color: null },
      { id: 2, x: 430, y: 350, color: null },
      { id: 3, x: 170, y: 350, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
  },

  {
    id: 3,
    name: "House Rules",
    difficulty: "Easy",
    description:
      "The triangle-shaped roof means you will need all three colors.",
    vertices: [
      { id: 0, x: 180, y: 210, color: null },
      { id: 1, x: 420, y: 210, color: null },
      { id: 2, x: 420, y: 390, color: null },
      { id: 3, x: 180, y: 390, color: null },
      { id: 4, x: 300, y: 70, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 4],
      [1, 4],
    ],
  },

  {
    id: 4,
    name: "The Diamond",
    difficulty: "Easy",
    description:
      "These two triangles share the same two circles, so each choice affects both sides.",
    vertices: [
      { id: 0, x: 300, y: 80, color: null },
      { id: 1, x: 300, y: 390, color: null },
      { id: 2, x: 120, y: 235, color: null },
      { id: 3, x: 480, y: 235, color: null },
    ],
    edges: [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
    ],
  },

  {
    id: 5,
    name: "Bow Tie",
    difficulty: "Easy",
    description:
      "Two triangles share one central vertex. Its color affects both sides of the graph.",
    vertices: [
      { id: 0, x: 300, y: 240, color: null },
      { id: 1, x: 110, y: 100, color: null },
      { id: 2, x: 110, y: 380, color: null },
      { id: 3, x: 490, y: 100, color: null },
      { id: 4, x: 490, y: 380, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
      [0, 3],
      [3, 4],
      [4, 0],
    ],
  },
  {
    id: 6,
    name: "Broken Pentagon",
    difficulty: "Medium",
    description:
      "The extra shortcut makes this five-sided puzzle more difficult.",
    vertices: [
      { id: 0, x: 300, y: 70, color: null },
      { id: 1, x: 500, y: 190, color: null },
      { id: 2, x: 430, y: 400, color: null },
      { id: 3, x: 170, y: 400, color: null },
      { id: 4, x: 100, y: 190, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [0, 2],
    ],
  },

  {
    id: 7,
    name: "Twin Triangles",
    difficulty: "Medium",
    description:
      "Two triangles are linked together. Choices on one side restrict the other.",
    vertices: [
      { id: 0, x: 100, y: 110, color: null },
      { id: 1, x: 100, y: 370, color: null },
      { id: 2, x: 260, y: 240, color: null },
      { id: 3, x: 340, y: 240, color: null },
      { id: 4, x: 500, y: 110, color: null },
      { id: 5, x: 500, y: 370, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
      [5, 3],
      [0, 4],
      [2, 3],
    ],
  },

  {
    id: 8,
    name: "Triangular Prism",
    difficulty: "Medium",
    description:
      "Two triangles are connected by matching edges, creating a symmetric puzzle.",
    vertices: [
      { id: 0, x: 170, y: 80, color: null },
      { id: 1, x: 70, y: 290, color: null },
      { id: 2, x: 270, y: 290, color: null },

      { id: 3, x: 430, y: 170, color: null },
      { id: 4, x: 330, y: 380, color: null },
      { id: 5, x: 530, y: 380, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
      [5, 3],
      [0, 3],
      [1, 4],
      [2, 5],
    ],
  },

  {
    id: 9,
    name: "Sun Lock",
    difficulty: "Medium",
    description:
      "The central triangle forces the colors of every surrounding vertex.",
    vertices: [
      { id: 0, x: 300, y: 130, color: null },
      { id: 1, x: 190, y: 320, color: null },
      { id: 2, x: 410, y: 320, color: null },
      { id: 3, x: 150, y: 100, color: null },
      { id: 4, x: 300, y: 430, color: null },
      { id: 5, x: 450, y: 100, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 0],
      [3, 1],
      [4, 1],
      [4, 2],
      [5, 2],
      [5, 0],
    ],
  },

  {
    id: 10,
    name: "The Wheel",
    difficulty: "Challenging",
    description:
      "The center connects to every outside circle, making each color choice important.",
    vertices: [
      { id: 0, x: 300, y: 60, color: null },
      { id: 1, x: 490, y: 150, color: null },
      { id: 2, x: 490, y: 350, color: null },
      { id: 3, x: 300, y: 440, color: null },
      { id: 4, x: 110, y: 350, color: null },
      { id: 5, x: 110, y: 150, color: null },
      { id: 6, x: 300, y: 250, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [6, 0],
      [6, 1],
      [6, 2],
      [6, 3],
      [6, 4],
      [6, 5],
    ],
  },
  {
    id: 11,
    name: "Color Cascade",
    difficulty: "Challenging",
    description:
      "Each triangle overlaps with the next, so one color choice can affect the entire puzzle.",
    width: 800,
    height: 600,
    vertices: [
      { id: 0, x: 70, y: 70, color: null },
      { id: 1, x: 153, y: 288, color: null },
      { id: 2, x: 282, y: 194, color: null },
      { id: 3, x: 393, y: 317, color: null },
      { id: 4, x: 516, y: 406, color: null },
      { id: 5, x: 640, y: 324, color: null },
      { id: 6, x: 730, y: 530, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],

      [1, 3],
      [2, 3],

      [2, 4],
      [3, 4],

      [3, 5],
      [4, 5],

      [4, 6],
      [5, 6],
    ],
  },

  {
    id: 12,
    name: "Branching Paths",
    difficulty: "Challenging",
    description:
      "Several triangle branches spread outward from the center. Each branch depends on earlier color choices.",
    width: 800,
    height: 600,
    vertices: [
      { id: 0, x: 432, y: 408, color: null },
      { id: 1, x: 315, y: 238, color: null },
      { id: 2, x: 174, y: 367, color: null },
      { id: 3, x: 605, y: 308, color: null },
      { id: 4, x: 70, y: 201, color: null },
      { id: 5, x: 224, y: 530, color: null },
      { id: 6, x: 730, y: 435, color: null },
      { id: 7, x: 159, y: 70, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],

      [0, 3],
      [1, 3],

      [1, 4],
      [2, 4],

      [2, 5],
      [0, 5],

      [0, 6],
      [3, 6],

      [1, 7],
      [4, 7],
    ],
  },

  {
    id: 13,
    name: "Second Ring",
    difficulty: "Hard",
    description:
      "The center affects the outer circles, which then affect the circles beyond them.",
    width: 800,
    height: 600,
    vertices: [
      { id: 0, x: 287, y: 356, color: null },
      { id: 1, x: 498, y: 442, color: null },
      { id: 2, x: 494, y: 263, color: null },
      { id: 3, x: 256, y: 506, color: null },
      { id: 4, x: 689, y: 388, color: null },
      { id: 5, x: 334, y: 168, color: null },
      { id: 6, x: 70, y: 462, color: null },
      { id: 7, x: 730, y: 530, color: null },
      { id: 8, x: 479, y: 70, color: null },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],

      [3, 0],
      [3, 1],

      [4, 1],
      [4, 2],

      [5, 2],
      [5, 0],

      [6, 0],
      [6, 3],

      [7, 1],
      [7, 4],

      [8, 2],
      [8, 5],
    ],
  },

  {
    id: 14,
    name: "Hidden Structure",
    difficulty: "Hard",
    description:
      "The pattern is harder to see now. Look carefully for circles that affect several others.",
    width: 900,
    height: 650,
    vertices: [
      { id: 0, x: 518, y: 553, color: null },
      { id: 1, x: 390, y: 110, color: null },
      { id: 2, x: 474, y: 390, color: null },
      { id: 3, x: 210, y: 224, color: null },
      { id: 4, x: 170, y: 396, color: null },
      { id: 5, x: 685, y: 143, color: null },
      { id: 6, x: 70, y: 70, color: null },
      { id: 7, x: 662, y: 300, color: null },
      { id: 8, x: 830, y: 456, color: null },
      { id: 9, x: 84, y: 580, color: null },
    ],
    edges: [
      [0, 2],
      [0, 8],
      [0, 9],

      [1, 2],
      [1, 5],
      [1, 6],

      [3, 1],
      [3, 2],
      [3, 4],
      [3, 5],
      [3, 6],

      [4, 2],
      [4, 9],

      [7, 1],
      [7, 2],
      [7, 4],
      [7, 5],
      [7, 8],

      [8, 2],
    ],
  },

  {
    id: 15,
    name: "The Web",
    difficulty: "Expert",
    description:
      "Almost every part of this puzzle affects another, leaving little room for mistakes.",
    width: 900,
    height: 650,
    vertices: [
      { id: 0, x: 392, y: 351, color: null },
      { id: 1, x: 196, y: 503, color: null },
      { id: 2, x: 70, y: 438, color: null },
      { id: 3, x: 313, y: 188, color: null },
      { id: 4, x: 619, y: 70, color: null },
      { id: 5, x: 648, y: 466, color: null },
      { id: 6, x: 474, y: 191, color: null },
      { id: 7, x: 830, y: 249, color: null },
      { id: 8, x: 232, y: 336, color: null },
      { id: 9, x: 139, y: 176, color: null },
      { id: 10, x: 390, y: 580, color: null },
      { id: 11, x: 664, y: 310, color: null },
    ],
    edges: [
      [0, 2],
      [0, 5],
      [0, 6],
      [0, 9],
      [0, 11],

      [1, 2],

      [3, 1],
      [3, 4],
      [3, 6],
      [3, 8],
      [3, 9],

      [4, 6],

      [7, 4],
      [7, 5],
      [7, 11],

      [8, 2],
      [8, 6],
      [8, 9],

      [10, 1],
      [10, 5],
      [10, 8],

      [11, 5],
      [11, 6],
    ],
  },
];