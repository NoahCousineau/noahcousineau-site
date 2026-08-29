#!/usr/bin/env python3
"""Cut Noah's pencil envelope down to something a browser should download.

2026-08-29, Noah, on the new newsletter section: "instead of a rotating resume
paper, it will now be a rotating pencil drawing of an envelope. It will have
the same 3D effect, but will rotate in the opposite way... Since this is a
pencil drawing, make sure it changes with the light mode and dark mode
settings."

THE SOURCES ARE 4167x4167 AND 400KB EACH, which is print resolution for
something that renders at 331px on a desktop and 170px on a phone. Trimmed to
the drawing's own bounds and resized to TARGET_PX, they come out around a
fortieth of that.

PREMULTIPLIED, LIKE EVERY OTHER CUT-OUT HERE. The artwork is 94% transparent,
and transparent pixels left at RGB(0,0,0) get averaged into the edges by any
later resize — the browser's included. `bleed_edges` gives them a plausible
colour first and `premultiplied_resize` keeps the downscale honest; both come
from the head pipeline, where the same mistake cost two rounds of "there's a
dark border on the head".

DARK MODE IS A PLAIN CSS INVERT, and the artwork earns it: measured, the ink
is 0.079 mean saturation on the front and 0.121 on the back, against 0.56-0.99
for the photographic objects elsewhere on the site. That is the same test the
header icons use to decide what may invert.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dark-head-pipeline"))
from imgutil import bleed_edges, premultiplied_resize  # noqa: E402

# THREE dirnames, not two: this file is tools/envelope/build_envelope.py, so
# two only reaches `tools/`. The first run wrote a perfectly good pair of webps
# into tools/public/assets/about/ and reported success, and the page 404'd.
SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC_DIR = "/Users/noahcousineau/Desktop/portfolio/Home and About Animations"
OUT_DIR = os.path.join(SITE, "public", "assets", "about")
# Twice the widest it is ever drawn (331px on a desktop), so a 2x display has
# real pixels to work with and nothing else is carried.
TARGET_PX = 900
# Keep a little clear margin round the drawing so the rotation's edge-on
# frames don't clip against the box.
PAD_FRAC = 0.04


def build(name: str) -> None:
    src = os.path.join(SRC_DIR, f"Envelope-{name}.png")
    im = Image.open(src).convert("RGBA")
    a = np.array(im)
    ys, xs = np.where(a[..., 3] > 24)
    if not len(ys):
        raise SystemExit(f"{src}: no ink found")
    pad = int(max(a.shape[:2]) * PAD_FRAC)
    y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + 1 + pad)
    a = a[y0:y1, x0:x1]
    a = bleed_edges(a)
    h, w = a.shape[:2]
    scale = TARGET_PX / max(w, h)
    a = premultiplied_resize(a, (max(1, round(w * scale)), max(1, round(h * scale))))
    out = os.path.join(OUT_DIR, f"envelope-{name}.webp")
    Image.fromarray(a).save(out, "WEBP", quality=92, method=6, exact=True)
    print(f"  {name}: {im.size} -> {a.shape[1]}x{a.shape[0]}  "
          f"{os.path.getsize(src)//1024}kB -> {os.path.getsize(out)//1024}kB")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for n in ("front", "back"):
        build(n)
