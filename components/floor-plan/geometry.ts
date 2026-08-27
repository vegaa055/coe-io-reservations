/**
 * Floor-plan geometry for the JAG-Ed Center, in the coordinate space of the
 * original handout diagrams (786 x 980).
 *
 * The reservable polygons were traced from the highlighted PNGs in /img
 * ("B### HL.png"), so they line up exactly with the diagrams the center already
 * hands out. B137, B141 and B146 are drawn for orientation only — they are not
 * in the reservation handout.
 *
 * Heads-up for whoever edits the source diagrams: "JAG-Ed Diagram.png" and
 * "JAG-Ed Center Diagram.png" label two rooms B139 and two rooms B153. The
 * per-room highlight files are the correct ones and are what these points came
 * from.
 */

export const PLAN_VIEWBOX = { width: 786, height: 980 };

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
    points: [
      [207, 55],
      [732, 183],
      [630, 596],
      [630, 690],
      [510, 690],
      [507, 660],
      [384, 660],
      [380, 624],
      [259, 624],
      [258, 563],
      [107, 563],
      [106, 504],
      [141, 506],
      [175, 369],
      [175, 357],
      [156, 350],
      [187, 231],
      [190, 202],
      [171, 196],
    ],
    labelAt: [470, 500],
  },
  {
    key: "b138",
    slug: "b138",
    label: "B138",
    points: [
      [63, 175],
      [188, 206],
      [152, 352],
      [26, 320],
    ],
  },
  {
    key: "b139",
    slug: "b139",
    label: "B139",
    points: [
      [47, 330],
      [171, 361],
      [136, 504],
      [14, 475],
    ],
  },
  {
    key: "b142",
    slug: "b142",
    label: "B142",
    points: [
      [471, 290],
      [523, 371],
      [452, 415],
      [402, 336],
    ],
  },
  {
    key: "b143",
    slug: "b143",
    label: "B143",
    points: [
      [503, 191],
      [595, 212],
      [576, 296],
      [483, 276],
    ],
  },
  {
    key: "b153",
    slug: "b153",
    label: "B153",
    points: [
      [260, 627],
      [377, 628],
      [376, 884],
      [258, 881],
    ],
  },
  {
    key: "b154",
    slug: "b154",
    label: "B154",
    points: [
      [383, 664],
      [504, 664],
      [503, 883],
      [380, 883],
    ],
  },
  {
    key: "b155",
    slug: "b155",
    label: "B155",
    points: [
      [508, 694],
      [631, 695],
      [631, 883],
      [507, 883],
    ],
  },
];

/** Drawn for orientation, never clickable. */
export const PLAN_CONTEXT: PlanShape[] = [
  {
    key: "b137",
    slug: null,
    label: "B137",
    points: [
      [79, 20],
      [204, 51],
      [168, 197],
      [42, 165],
    ],
  },
  {
    key: "b141",
    slug: null,
    label: "B141",
    points: [
      [302, 314],
      [380, 335],
      [356, 427],
      [275, 404],
    ],
  },
  {
    key: "b146",
    slug: null,
    label: "B146",
    points: [
      [48, 563],
      [258, 563],
      [258, 883],
      [48, 883],
    ],
  },
];

export const PLAN_KIOSK = { cx: 380, cy: 230, r: 50, label: "Security" };

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
