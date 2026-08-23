"""Darken the Valley Strong "house being drawn" animation's ink colour.

2026-08-23, Noah: "Please make the hero icon for Valley strong darker. Right
now it's a bit grayish." Measured: the drawn line sits around luminance 126
of 255 (neutral R=G=B — genuinely grey, not a dark colour reading light from
compression). All 7 frames darkened together, not just frame 7 (the hero
frame) — they share one ink colour throughout the animation, and darkening
only the last frame would put a visible colour jump right at the moment the
drawing finishes.

A gamma curve (value/255)**GAMMA, not a flat multiply or a hard threshold to
black — the source has real texture (a hand-drawn line's edges antialias
through a real luminance range, measured 66-168), and gamma darkens the
already-dark ink core hard while letting the lighter edge pixels keep
enough separation to still read as a drawn line rather than a printed one.
"""
import glob
import numpy as np
from PIL import Image

GAMMA = 2.0
SRC_DIR = "/Users/noahcousineau/Desktop/portfolio/noahcousineau-site/public/assets/home/project-animations/valley-strong"

if __name__ == "__main__":
    for path in sorted(glob.glob(f"{SRC_DIR}/*.webp")):
        im = Image.open(path).convert("RGBA")
        a = np.array(im).astype(np.float64)
        rgb = a[..., :3] / 255.0
        rgb = np.power(rgb, GAMMA)
        a[..., :3] = np.clip(rgb, 0, 1) * 255
        Image.fromarray(a.astype(np.uint8)).save(path, "WEBP", quality=92, method=6)
        print("darkened", path)
