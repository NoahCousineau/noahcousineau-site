"""Where each new stroke starts, and how far it reaches — for drawing it on.

Noah, 2026-11-01, on Valley Strong: "Since these depend on being drawn out,
let's have these feel like they're being drawn out more instead of appearing
in stages."

The home grid reveals each new frame through a disc that grows from the point
the new stroke begins. For a line that point is one of its ends, and a disc
growing from there uncovers it end to end, at whatever angle it runs — which
straight left-to-right or bottom-to-top wipes could not do for a roof slope.
So for each frame this finds:

  the new mark  what is in this frame and not near anything in the last one.
                "Near" is a dilation, sized to absorb the re-photography: the
                drawing's shots are registered to a pixel or two (see
                align_frames.py).
  its origin    the end of the stroke the pen started from — of its two
                farthest-apart points, the one on the side the stroke runs
                from (left, or bottom).
  its reach     the farthest new pixel from the origin, plus half a stroke so
                the disc clears the mark's far edge rather than its centreline.

All in the 700-wide canvas's own pixels. Prints the TypeScript to paste into
src/lib/projectObjects.ts.

The ampersand was measured this way too, briefly, and dropped: its tube is
re-laid between shots, so the old and new photographs disagree about where
the tube already down lies, and the disc's edge showed as a circle cut
through it. It now plays its frames as near-instant cuts instead.

    python3 tools/project-animations/stroke_reveals.py
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2] / "public/assets/home/project-animations"
NAME = "valley-strong"
FRAMES = 7
GROW = 7
HALF_STROKE = 8
# Which end each stroke starts from, per frame (index 0 is the starting
# figure): floor from its left end, each wall from the bottom, the left roof
# from its eave, the right roof from the peak, the smile from its left corner.
STARTS = [None, "left", "bottom", "bottom", "left", "left", "left"]


def mask(path):
    a = np.asarray(Image.open(path).convert("RGBA"))[:, :, 3]
    return a > 110


def endpoints(ys, xs):
    """The two farthest-apart points of a mark, from its convex outline."""
    pts = np.stack([xs, ys], 1).astype(float)
    # Extremes along 16 directions are enough to contain the diameter's ends.
    cand = set()
    for t in np.linspace(0, np.pi, 16, endpoint=False):
        p = pts @ np.array([np.cos(t), np.sin(t)])
        cand.add(int(p.argmin()))
        cand.add(int(p.argmax()))
    c = pts[list(cand)]
    d = ((c[:, None] - c[None]) ** 2).sum(-1)
    i, j = np.unravel_index(d.argmax(), d.shape)
    return c[i], c[j]


def measure():
    frames = [mask(ROOT / NAME / f"{k}.webp") for k in range(1, FRAMES + 1)]
    out = ["null"]
    for k in range(1, FRAMES):
        old, new = frames[k - 1], frames[k]
        fresh = new & ~ndimage.binary_dilation(old, iterations=GROW)
        fresh = ndimage.binary_opening(fresh, iterations=2)
        lab, cnt = ndimage.label(fresh)
        if cnt == 0:
            raise SystemExit(f"{NAME} frame {k + 1}: nothing new found")
        sizes = ndimage.sum(fresh, lab, range(1, cnt + 1))
        # Keep the mark itself, not stray specks the dilation let through.
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 0.15 * sizes.max()])
        ys, xs = np.nonzero(keep)
        a, b = endpoints(ys, xs)
        if STARTS[k] == "left":
            o = a if a[0] <= b[0] else b
        else:
            o = a if a[1] >= b[1] else b
        ox, oy = float(o[0]), float(o[1])
        reach = float(np.sqrt((xs - ox) ** 2 + (ys - oy) ** 2).max()) + HALF_STROKE
        out.append(f"{{ x: {ox:.0f}, y: {oy:.0f}, r: {reach:.0f} }}")
        print(f"  frame {k + 1}: {len(xs):6d}px new, from ({ox:.0f}, {oy:.0f}) reaching {reach:.0f}", flush=True)
    return out


if __name__ == "__main__":
    rows = measure()
    print("\n    strokes: [\n      " + ",\n      ".join(rows) + ",\n    ],\n")
