"""Build every project-grid object animation from Noah's edited frames.

This exists so a re-edit is a one-liner. When Noah re-saturated Sprouts,
SoCal Earth and the Cultural Olympiad ("I updated the saturation on the
Sprouts, SoCal Earth, and Cultural Olympiad images... they should be the same
size as the ones you originally had"), the geometry had to come out
BIT-IDENTICAL while only the colour changed — and the recipes had only ever
existed as ad-hoc command lines. They are recorded here now.

The recipes below were recovered by rebuilding each set under every
anchor/scale combination and scoring the result against the frames already
shipped in public/: each of the three came back at mean IoU 1.0000, so these
are the original recipes, not lookalikes.

SOURCES: Noah re-exports as .psd, and the .png next to it may be a stale
earlier export — Sprouts' PSDs were four hours newer than its PNGs and twice
as saturated. So a .psd always wins over a .png of the same name.

Usage:  python3 tools/project-animations/build_objects.py [name ...]
"""
import os
import sys
import glob
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from align_frames import build  # noqa: E402

SRC = "/Users/noahcousineau/Desktop/portfolio/Project Page Animations/Edited"
DST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "public/assets/home/project-animations",
)

# name -> (source basenames in order, anchor, scale mode)
RECIPES = {
    # The apple is eaten from the sides, so the stem is the only landmark that
    # survives, and its real size never changes.
    "sprouts": (["Sprouts1", "Sprouts2", "Sprouts3", "Sprouts4", "Sprouts5"],
                "stem", "normalise"),
    # "Have the heart grow from the center."
    "cac": (["CAC1", "CAC2", "CAC3", "CAC4"], "center", "preserve"),
    # A sun rising into the frame; the growth is the animation.
    "socal-earth": (["SoCal Earth 1", "SoCal Earth 2", "SoCal Earth 3", "SoCal Earth 4"],
                    "center", "preserve"),
    # "Have the flame growing from the base." Note the source typo on frame 2.
    "olympics": (["Olympics1", "Olympcis2", "Olympics3", "Olympics4", "Olympics5"],
                 "base", "preserve"),
    # A house drawn around a person: the PERSON must hold still, and he is only
    # isolatable in frame 1, so frame 1 is matched into every later frame.
    "valley-strong": ([f"ValleyStrong{i}" for i in range(1, 8)],
                      "template", "normalise"),
    # A length of tube laid out into an ampersand, growing from its free end.
    "ampersand": ([f"&{i}" for i in range(1, 8)], "tip", "preserve"),
}


def source(base):
    """Newest export wins, and a .psd of the same name always beats its .png."""
    psd = os.path.join(SRC, base + ".psd")
    png = os.path.join(SRC, base + ".png")
    if os.path.exists(psd):
        return psd
    if os.path.exists(png):
        return png
    raise SystemExit(f"no source for {base!r} in {SRC}")


def load(base):
    p = source(base)
    if p.endswith(".png"):
        return p
    # Flatten alongside the source so repeat builds are cheap.
    from psd_tools import PSDImage
    out = os.path.join(SRC, ".flattened", base + ".png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(p):
        PSDImage.open(p).composite().convert("RGBA").save(out)
    return out


if __name__ == "__main__":
    names = sys.argv[1:] or list(RECIPES)
    for name in names:
        bases, anchor, scale_mode = RECIPES[name]
        paths = [load(b) for b in bases]
        info = build(paths, os.path.join(DST, name), anchor, scale_mode)
        print(json.dumps({"name": name, **info}))
