/**
 * Floor-plan geometry for the College of Engineering reservable rooms, in the
 * coordinate space of img/map.png.
 *
 * GENERATED — do not edit the `points` by hand.
 *   python scripts/trace_floor_plan.py emit
 *
 * Every polygon was traced from the source drawing rather than drawn by hand,
 * so the plan lines up with the map the college already hands out. `labelAt`
 * and PLAN_BUILDINGS are layout choices and live in the script's LABEL_AT /
 * BUILDING_LABELS tables.
 *
 * Only PLAN_ROOMS are reservable. PLAN_CONTEXT is drawn for orientation:
 * B137/B141/B146, the B156-B160 offices, the restrooms, and C165/C166A, none
 * of which are in the reservation handouts.
 */

export const PLAN_VIEWBOX = { width: 860, height: 392 };

export type PlanShape = {
  key: string;
  /** Room slug when the space can be reserved; null for context-only shapes. */
  slug: string | null;
  label: string;
  points: [number, number][];
  /** Where the label sits, if the polygon centroid is not a good spot. */
  labelAt?: [number, number];
};

export const PLAN_ROOMS: PlanShape[] = [
  {
    key: "commons",
    slug: "jag-ed-center",
    label: "Commons",
    labelAt: [178, 205],
    points: [
      [71, 26],
      [285, 77],
      [245, 236],
      [252, 259],
      [252, 274],
      [192, 257],
      [191, 274],
      [131, 258],
      [130, 275],
      [93, 264],
      [92, 256],
      [85, 250],
      [81, 251],
      [78, 260],
      [74, 259],
      [73, 233],
      [35, 233],
      [36, 212],
      [55, 215],
      [58, 211],
      [72, 153],
      [71, 149],
      [58, 147],
      [72, 87],
      [57, 82],
    ],
  },
  {
    key: "b138",
    slug: "b138",
    label: "B138",
    labelAt: [41, 111],
    points: [
      [32, 82],
      [66, 90],
      [56, 131],
      [48, 132],
      [42, 139],
      [43, 143],
      [52, 145],
      [19, 138],
    ],
  },
  {
    key: "b139",
    slug: "b139",
    label: "B139",
    labelAt: [41, 176],
    points: [
      [32, 147],
      [66, 154],
      [56, 195],
      [46, 199],
      [41, 207],
      [18, 203],
    ],
  },
  {
    key: "b142",
    slug: "b142",
    label: "B142",
    labelAt: [160, 139],
    points: [
      [164, 115],
      [184, 146],
      [156, 164],
      [137, 133],
    ],
  },
  {
    key: "b143",
    slug: "b143",
    label: "B143",
    labelAt: [195, 92],
    points: [
      [181, 72],
      [217, 80],
      [210, 113],
      [174, 105],
    ],
  },
  {
    key: "b153",
    slug: "b153",
    label: "B153",
    labelAt: [101, 322],
    points: [
      [74, 264],
      [130, 280],
      [131, 373],
      [75, 374],
    ],
  },
  {
    key: "b154",
    slug: "b154",
    label: "B154",
    labelAt: [162, 323],
    points: [
      [135, 264],
      [146, 267],
      [144, 278],
      [155, 277],
      [162, 271],
      [191, 280],
      [191, 373],
      [136, 373],
    ],
  },
  {
    key: "b155",
    slug: "b155",
    label: "B155",
    labelAt: [223, 323],
    points: [
      [196, 263],
      [204, 266],
      [203, 277],
      [212, 277],
      [220, 270],
      [252, 280],
      [253, 372],
      [196, 373],
    ],
  },
  {
    key: "c165a",
    slug: "c165a",
    label: "C165a",
    labelAt: [782, 190],
    points: [
      [709, 138],
      [842, 172],
      [826, 242],
      [741, 224],
      [750, 180],
      [711, 171],
      [716, 169],
      [712, 155],
      [720, 149],
      [722, 142],
    ],
  },
  {
    key: "c165b",
    slug: "c165b",
    label: "C165b",
    labelAt: [763, 272],
    points: [
      [740, 229],
      [825, 247],
      [810, 313],
      [676, 286],
      [689, 287],
      [685, 272],
      [695, 261],
      [731, 268],
    ],
  },
];

/** Drawn for orientation, never clickable. */
export const PLAN_CONTEXT: PlanShape[] = [
  {
    key: "b137",
    slug: null,
    label: "B137",
    labelAt: [42, 47],
    points: [
      [33, 18],
      [66, 25],
      [56, 66],
      [48, 67],
      [42, 74],
      [43, 79],
      [52, 81],
      [19, 73],
    ],
  },
  {
    key: "b141",
    slug: null,
    label: "B141",
    labelAt: [102, 146],
    points: [
      [91, 125],
      [123, 133],
      [115, 169],
      [82, 161],
    ],
  },
  {
    key: "b146",
    slug: null,
    label: "B146",
    labelAt: [41, 258],
    points: [
      [20, 238],
      [58, 238],
      [61, 248],
      [69, 252],
      [69, 274],
      [31, 275],
      [31, 291],
      [21, 285],
    ],
  },
  {
    key: "b156",
    slug: null,
    label: "B156",
    labelAt: [285, 322],
    points: [
      [268, 265],
      [314, 279],
      [314, 372],
      [258, 372],
      [258, 276],
      [266, 272],
    ],
  },
  {
    key: "b157",
    slug: null,
    label: "B157",
    labelAt: [346, 321],
    points: [
      [327, 264],
      [375, 278],
      [376, 371],
      [319, 372],
      [319, 273],
    ],
  },
  {
    key: "b158",
    slug: null,
    label: "B158",
    labelAt: [407, 320],
    points: [
      [388, 263],
      [435, 277],
      [436, 371],
      [381, 371],
      [380, 273],
    ],
  },
  {
    key: "b159",
    slug: null,
    label: "B159",
    labelAt: [467, 319],
    points: [
      [448, 263],
      [496, 277],
      [496, 370],
      [441, 370],
      [440, 272],
      [447, 268],
    ],
  },
  {
    key: "b160",
    slug: null,
    label: "B160",
    labelAt: [528, 320],
    points: [
      [509, 264],
      [557, 278],
      [557, 370],
      [502, 370],
      [501, 274],
      [508, 270],
    ],
  },
  {
    key: "restroom-w",
    slug: null,
    label: "W",
    labelAt: [577, 325],
    points: [
      [562, 279],
      [595, 289],
      [595, 299],
      [573, 300],
      [574, 304],
      [595, 304],
      [595, 369],
      [562, 369],
    ],
  },
  {
    key: "restroom-m",
    slug: null,
    label: "M",
    labelAt: [615, 330],
    points: [
      [600, 290],
      [636, 301],
      [623, 369],
      [600, 369],
      [600, 310],
      [612, 308],
      [610, 304],
      [600, 304],
    ],
  },
  {
    key: "c166a",
    slug: null,
    label: "C166A",
    labelAt: [713, 219],
    points: [
      [701, 174],
      [709, 176],
      [708, 190],
      [718, 189],
      [726, 179],
      [744, 183],
      [728, 262],
      [683, 252],
    ],
  },
  {
    key: "c165",
    slug: null,
    label: "C165",
    labelAt: [731, 324],
    points: [
      [674, 292],
      [808, 318],
      [803, 343],
      [662, 344],
      [669, 314],
      [681, 310],
      [686, 302],
      [684, 298],
      [673, 296],
    ],
  },
];

/**
 * The corridor floor, clipped to the frame. On the source drawing the grey
 * circulation loops right around the landscaping west of the building, so
 * tracing it whole would fill in the courtyard too.
 */
export const PLAN_CIRCULATION: [number, number][][] = [
  [
    [0, 0],
    [120, 0],
    [113, 4],
    [114, 8],
    [140, 16],
    [144, 15],
    [143, 9],
    [147, 7],
    [144, 3],
    [164, 7],
    [167, 0],
    [238, 0],
    [363, 29],
    [376, 37],
    [385, 50],
    [386, 63],
    [381, 75],
    [374, 82],
    [363, 87],
    [346, 88],
    [326, 83],
    [319, 83],
    [317, 86],
    [283, 231],
    [656, 229],
    [660, 223],
    [671, 159],
    [627, 145],
    [617, 135],
    [618, 124],
    [626, 117],
    [641, 117],
    [704, 136],
    [646, 391],
    [626, 391],
    [630, 380],
    [626, 376],
    [0, 381],
    [627, 374],
    [646, 280],
    [645, 277],
    [640, 278],
    [637, 295],
    [616, 289],
    [615, 283],
    [609, 278],
    [601, 285],
    [600, 271],
    [619, 277],
    [623, 275],
    [621, 271],
    [562, 254],
    [557, 255],
    [558, 259],
    [594, 269],
    [595, 283],
    [586, 280],
    [588, 273],
    [585, 271],
    [573, 277],
    [500, 255],
    [496, 256],
    [495, 271],
    [442, 255],
    [435, 256],
    [434, 271],
    [376, 255],
    [374, 272],
    [315, 255],
    [313, 273],
    [258, 257],
    [265, 255],
    [266, 252],
    [259, 245],
    [260, 235],
    [251, 234],
    [284, 103],
    [295, 101],
    [293, 91],
    [299, 85],
    [298, 81],
    [290, 79],
    [291, 72],
    [157, 41],
    [154, 40],
    [157, 30],
    [155, 26],
    [141, 30],
    [133, 21],
    [127, 22],
    [123, 33],
    [5, 5],
    [0, 23],
  ],
];

export const PLAN_KIOSK = { cx: 131, cy: 84, r: 21, label: "Kiosk" };

/** Building names, placed in open ground away from the room polygons. */
export const PLAN_BUILDINGS: { label: string; at: [number, number] }[] = [
  { label: "JAG-Ed Center", at: [400, 52] },
  { label: "ATB C State Building", at: [763, 370] },
];

/**
 * Rooms the plan can actually draw. A room may exist in the database before it
 * has geometry here, so callers should check this before offering a
 * "find it on the plan" view.
 */
export const PLANNED_SLUGS = new Set(
  PLAN_ROOMS.map((shape) => shape.slug).filter((slug): slug is string => slug !== null),
);

export function toPointsAttr(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function centroid(shape: PlanShape): [number, number] {
  if (shape.labelAt) return shape.labelAt;
  const n = shape.points.length;
  const sum = shape.points.reduce<[number, number]>(
    (acc, [x, y]) => [acc[0] + x, acc[1] + y],
    [0, 0],
  );
  return [Math.round(sum[0] / n), Math.round(sum[1] / n)];
}
