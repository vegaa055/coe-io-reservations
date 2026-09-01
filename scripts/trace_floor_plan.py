"""Regenerate components/floor-plan/geometry.ts from img/map.png.

The floor plan in the app is not a picture of the map — it is real geometry
traced out of it, so the polygons line up with the drawing the college already
hands out while still being clickable, themeable and tintable by availability.

    python scripts/trace_floor_plan.py inspect   # find the regions
    python scripts/trace_floor_plan.py emit      # write geometry.ts

`inspect` writes scripts/.trace-out/map_components.png with every detected
region outlined and numbered. Open it next to the map, read off which number is
which room, and update ROOMS / CONTEXT below. Then run `emit`.

Requires: pip install pillow numpy

How it works
------------
The drawing is three-valued: 255 white (rooms and outside), 204 grey (corridor
floor), 0 black (walls, doors, text). Rooms are therefore white islands fenced
in by black lines, and a connected-component labelling of the non-wall pixels
isolates them. Outlines come from Moore boundary tracing, simplified with
Ramer-Douglas-Peucker.

Two things to know if you touch this:

* PIL's ImageDraw.floodfill is a silent no-op in Pillow 12 — it neither fills
  nor raises — hence the hand-rolled labeller below.
* The grey circulation loops all the way around the landscaping west of the
  building, making it an annulus. Tracing it whole fills in the courtyard too
  (3.5x the real area), so it is clipped to the viewBox first, which leaves a
  plain band.
"""
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "img", "map.png")
DEST = os.path.join(ROOT, "components", "floor-plan", "geometry.ts")
SCRATCH = os.path.join(ROOT, "scripts", ".trace-out")

WALL_MAX = 128
MIN_AREA = 900
MIN_CORRIDOR_PIECE = 1500
MARGIN = 18
KIOSK = (646, 428, 21)  # cx, cy, r in map coordinates; measured off the drawing

# Region id -> (key, room slug, label). Read the ids off map_components.png.
ROOMS = [
    (13, "commons", "jag-ed-center", "Commons"),
    (11, "b138", "b138", "B138"),
    (9, "b139", "b139", "B139"),
    (17, "b142", "b142", "B142"),
    (19, "b143", "b143", "B143"),
    (14, "b153", "b153", "B153"),
    (16, "b154", "b154", "B154"),
    (20, "b155", "b155", "B155"),
    (31, "c165a", "c165a", "C165a"),
    (29, "c165b", "c165b", "C165b"),
]

CONTEXT = [
    (10, "b137", "B137"),
    (15, "b141", "B141"),
    (12, "b146", "B146"),
    (21, "b156", "B156"),
    (22, "b157", "B157"),
    (23, "b158", "B158"),
    (24, "b159", "B159"),
    (25, "b160", "B160"),
    (26, "restroom-w", "W"),
    (27, "restroom-m", "M"),
    (30, "c166a", "C166A"),
    (28, "c165", "C165"),
]

# Label placement is a design choice, not traced. Overrides the centroid.
LABEL_AT = {"commons": (178, 205)}
BUILDING_LABELS = [("JAG-Ed Center", (400, 52)), ("ATB C State Building", (763, 370))]

sys.setrecursionlimit(100000)


def wall_mask(gray, thicken=1):
    m = gray < WALL_MAX
    out = m.copy()
    for dy in range(-thicken, thicken + 1):
        for dx in range(-thicken, thicken + 1):
            out |= np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return out


def row_runs(row):
    edges = np.flatnonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))
    return list(zip(edges[0::2].tolist(), edges[1::2].tolist()))


def label_regions(open_mask):
    """Run-length + union-find connected components, 4-connected."""
    h, w = open_mask.shape
    labels = np.zeros((h, w), np.int32)
    parent = [0]

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    prev = []
    for y in range(h):
        cur = []
        for s, e in row_runs(open_mask[y]):
            lbl = None
            for ps, pe, pl in prev:
                if ps < e and s < pe:
                    if lbl is None:
                        lbl = find(pl)
                    else:
                        union(lbl, pl)
                        lbl = find(lbl)
            if lbl is None:
                lbl = len(parent)
                parent.append(lbl)
            labels[y, s:e] = lbl
            cur.append((s, e, lbl))
        prev = cur

    roots = np.array([find(i) for i in range(len(parent))], dtype=np.int32)
    return roots[labels]


def trace_contour(mask):
    ys, xs = np.nonzero(mask)
    start = (int(ys.min()), int(xs[ys == ys.min()].min()))
    h, w = mask.shape
    nbrs = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]

    def solid(p):
        y, x = p
        return 0 <= y < h and 0 <= x < w and mask[y, x]

    contour, cur, backtrack = [start], start, 6
    for _ in range(800000):
        moved = False
        for k in range(8):
            d = (backtrack + 1 + k) % 8
            cand = (cur[0] + nbrs[d][0], cur[1] + nbrs[d][1])
            if solid(cand):
                backtrack = (d + 5) % 8
                cur = cand
                contour.append(cur)
                moved = True
                break
        if not moved:
            break
        if cur == start and len(contour) > 3:
            break
    return contour


def rdp(points, eps):
    if len(points) < 3:
        return points
    a, b = np.array(points[0], float), np.array(points[-1], float)
    ab = b - a
    norm = float(np.hypot(*ab))
    dmax, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        q = np.array(points[i], float) - a
        d = float(np.hypot(*q)) if norm == 0 else abs(ab[0] * q[1] - ab[1] * q[0]) / norm
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(points[: idx + 1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]


def outline(mask, eps=2.5):
    pts = [(int(x), int(y)) for (y, x) in rdp(trace_contour(mask), eps)]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts


def analyse():
    gray = np.asarray(Image.open(SRC).convert("L"))
    labels = label_regions(~wall_mask(gray))
    h, w = gray.shape

    regions = []
    for lbl in np.unique(labels):
        if lbl == 0:
            continue
        mask = labels == lbl
        area = int(mask.sum())
        if area < MIN_AREA:
            continue
        ys, xs = np.nonzero(mask)
        regions.append(
            {
                "mask": mask,
                "area": area,
                "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                "centroid": (int(xs.mean()), int(ys.mean())),
                "outside": bool(
                    xs.min() <= 1 or ys.min() <= 1 or xs.max() >= w - 2 or ys.max() >= h - 2
                ),
                "fill": float(gray[mask].mean()),
            }
        )

    regions.sort(key=lambda r: (r["bbox"][0], r["bbox"][1]))
    for i, r in enumerate(regions):
        r["id"] = i
        r["points"] = outline(r["mask"])
    return gray, regions


def cmd_inspect():
    os.makedirs(SCRATCH, exist_ok=True)
    _, regions = analyse()

    overlay = Image.open(SRC).convert("RGB")
    draw = ImageDraw.Draw(overlay, "RGBA")
    try:
        font = ImageFont.truetype("arialbd.ttf", 16)
    except Exception:
        font = ImageFont.load_default()
    palette = [(0, 130, 255), (0, 170, 90), (235, 120, 0), (205, 0, 160), (120, 90, 235)]
    for r in regions:
        if r["outside"] or len(r["points"]) < 3:
            continue
        c = palette[r["id"] % len(palette)]
        draw.polygon(r["points"], fill=c + (80,), outline=c + (255,), width=3)
    for r in regions:
        if r["outside"]:
            continue
        cx, cy = r["centroid"]
        draw.rectangle([cx - 12, cy - 10, cx + 12, cy + 10], fill=(255, 255, 255, 240))
        draw.text((cx - 8, cy - 8), str(r["id"]), fill=(200, 0, 0), font=font)
    out = os.path.join(SCRATCH, "map_components.png")
    overlay.save(out)

    print(f"{len(regions)} regions >= {MIN_AREA}px\n")
    for r in regions:
        kind = "OUTSIDE" if r["outside"] else ("corridor" if r["fill"] < 235 else "room")
        print(
            f"  id={r['id']:2d} {kind:8s} area={r['area']:7d} "
            f"bbox={str(r['bbox']):24s} centroid={r['centroid']}"
        )
    print(f"\nwrote {out}")


def cmd_emit():
    gray, regions = analyse()
    by_id = {r["id"]: r for r in regions}

    framed = [rid for rid, *_ in ROOMS] + [rid for rid, *_ in CONTEXT]
    xs = [p[0] for rid in framed for p in by_id[rid]["points"]]
    ys = [p[1] for rid in framed for p in by_id[rid]["points"]]
    ox, oy = min(xs) - MARGIN, min(ys) - MARGIN
    width, height = max(xs) + MARGIN - ox, max(ys) + MARGIN - oy

    def block(rid, key, slug, label, indent=2):
        pad = " " * indent
        pts = [(x - ox, y - oy) for x, y in by_id[rid]["points"]]
        cx, cy = LABEL_AT.get(key, by_id[rid]["centroid"])
        if key not in LABEL_AT:
            cx, cy = cx - ox, cy - oy
        body = "\n".join(f"{pad}    [{x}, {y}]," for x, y in pts)
        return (
            f"{pad}{{\n"
            f'{pad}  key: "{key}",\n'
            f"{pad}  slug: {f'\"{slug}\"' if slug else 'null'},\n"
            f'{pad}  label: "{label}",\n'
            f"{pad}  labelAt: [{cx}, {cy}],\n"
            f"{pad}  points: [\n{body}\n{pad}  ],\n"
            f"{pad}}},"
        )

    # Circulation: clip to the frame first so the annulus becomes a band.
    corridor = max(
        (r for r in regions if 180 < r["fill"] < 230), key=lambda r: r["area"]
    )["mask"]
    clip = np.zeros_like(corridor)
    clip[oy : oy + height, ox : ox + width] = True
    clipped = corridor & clip
    bands = []
    sub = label_regions(clipped)
    for lbl in np.unique(sub):
        if lbl == 0:
            continue
        m = (sub == lbl) & clipped
        if m.sum() < MIN_CORRIDOR_PIECE:
            continue
        bands.append([(x - ox, y - oy) for x, y in outline(m, eps=2.0)])

    bands_src = "\n".join(
        "  [\n" + "\n".join(f"    [{x}, {y}]," for x, y in b) + "\n  ]," for b in bands
    )
    buildings_src = "\n".join(
        f'  {{ label: "{name}", at: [{x}, {y}] }},' for name, (x, y) in BUILDING_LABELS
    )
    kx, ky, kr = KIOSK

    ts = f'''/**
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

export const PLAN_VIEWBOX = {{ width: {width}, height: {height} }};

export type PlanShape = {{
  key: string;
  /** Room slug when the space can be reserved; null for context-only shapes. */
  slug: string | null;
  label: string;
  points: [number, number][];
  /** Where the label sits, if the polygon centroid is not a good spot. */
  labelAt?: [number, number];
}};

export const PLAN_ROOMS: PlanShape[] = [
{chr(10).join(block(*r) for r in ROOMS)}
];

/** Drawn for orientation, never clickable. */
export const PLAN_CONTEXT: PlanShape[] = [
{chr(10).join(block(rid, key, None, label) for rid, key, label in CONTEXT)}
];

/**
 * The corridor floor, clipped to the frame. On the source drawing the grey
 * circulation loops right around the landscaping west of the building, so
 * tracing it whole would fill in the courtyard too.
 */
export const PLAN_CIRCULATION: [number, number][][] = [
{bands_src}
];

export const PLAN_KIOSK = {{ cx: {kx - ox}, cy: {ky - oy}, r: {kr}, label: "Kiosk" }};

/** Building names, placed in open ground away from the room polygons. */
export const PLAN_BUILDINGS: {{ label: string; at: [number, number] }}[] = [
{buildings_src}
];

/**
 * Rooms the plan can actually draw. A room may exist in the database before it
 * has geometry here, so callers should check this before offering a
 * "find it on the plan" view.
 */
export const PLANNED_SLUGS = new Set(
  PLAN_ROOMS.map((shape) => shape.slug).filter((slug): slug is string => slug !== null),
);

export function toPointsAttr(points: [number, number][]): string {{
  return points.map(([x, y]) => `${{x}},${{y}}`).join(" ");
}}

export function centroid(shape: PlanShape): [number, number] {{
  if (shape.labelAt) return shape.labelAt;
  const n = shape.points.length;
  const sum = shape.points.reduce<[number, number]>(
    (acc, [x, y]) => [acc[0] + x, acc[1] + y],
    [0, 0],
  );
  return [Math.round(sum[0] / n), Math.round(sum[1] / n)];
}}
'''

    with open(DEST, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(ts)

    print(f"viewBox {width} x {height} (origin {ox},{oy} in map coords)")
    print(f"{len(ROOMS)} reservable, {len(CONTEXT)} context, {len(bands)} corridor band(s)")
    print("wrote", os.path.relpath(DEST, ROOT))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "inspect"
    if mode == "inspect":
        cmd_inspect()
    elif mode == "emit":
        cmd_emit()
    else:
        sys.exit(f"unknown mode {mode!r}; expected 'inspect' or 'emit'")
