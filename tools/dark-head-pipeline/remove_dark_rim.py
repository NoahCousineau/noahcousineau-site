"""Remove the dark rim baked into the cut edge of Noah's head cutouts.

2026-08-23, Noah: "On the home page, I noticed a small dark border or drop
shadow is now being used around the head. Let's remove this."

WHAT IT ACTUALLY IS — measured, not guessed. On the light turntable's rear
frame the neck's straight bottom cut runs:

    interior skin      RGB(212,172,163)  alpha 255
    ...
    y-4 .. y-1         RGB(158,104, 81)  alpha 255/253/220   <- the "border"
    first clear pixel  alpha 4

So it is NOT an alpha/compositing halo — those pixels are FULLY OPAQUE and
genuinely that colour in the file. It is a rim of the original photograph's
dark backdrop that survived the cutout, which reads as a drawn outline the
moment the head is placed on the yellow starburst.

That also means defringe() (build_dark_frames_from_edit.py) can never fix
it: that pass exists for SEMI-transparent hair and keys off partial alpha.
A fully opaque rim is invisible to it.

THE DISCRIMINATOR — why this doesn't eat the hair. Two tests, and the
second one is the load-bearing one:

  1. the pixel is markedly darker than the silhouette's own colour just
     further in (at the neck: a rim at 114 mean luminance against skin at
     182), and
  2. that interior colour is LIGHT — actual skin.

Test 1 alone is not enough, and trying it alone is what proved it: hair
genuinely darkens toward its outer strands, so the wispy top of the head
reads as "much darker than the interior" too, and a first pass on that rule
lifted real hair from RGB(71,60,46) to (126,108,96) — visibly bleaching the
hairline. Test 2 excludes that case outright, and it costs nothing real: a
dark rim sitting on dark hair is invisible against dark hair. The rim is
only a defect where it shows, which is exactly where the interior is skin.
So this deliberately fixes the rim around the neck, jaw and ear and leaves
the hairline untouched — matching what Noah can actually see.

`inward` is built by taking the colour of the nearest pixel that is both
opaque and at least RIM_PX inside the edge — a distance transform gives that
directly, and it is exactly "what this bit of the head looks like once you
are past the contaminated band".
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# How far in the contamination reaches. Measured at 4px on the neck cut; 6
# gives headroom for the frames shot slightly softer without reaching real
# interior detail.
RIM_PX = 6
# Only correct a pixel darker than this fraction of its own interior colour.
# 0.90 catches the neck rim (114/182 = 0.63) with a wide margin while leaving
# ordinary shading — which never approaches a 10% step over 6px — alone.
DARK_RATIO = 0.90
# ...and only where that interior colour is genuinely skin-light. Measured:
# skin behind the neck/jaw rim sits at 180-190 mean luminance, the hair just
# inside the hairline at ~110. 150 separates them with room on both sides.
# See THE DISCRIMINATOR above for why this test is the one that matters.
LIGHT_REF = 150.0


def remove_rim(rgba, rim_px=RIM_PX, dark_ratio=DARK_RATIO, light_ref=LIGHT_REF):
    """Replace a dark contaminated edge band with the silhouette's own colour."""
    a = rgba.astype(np.float32)
    alpha = a[..., 3]
    solid = alpha > 250
    if not solid.any():
        return rgba

    # Distance from the outside, measured inside the shape: how deep each
    # pixel sits within the silhouette.
    depth = ndimage.distance_transform_edt(solid)
    deep = solid & (depth >= rim_px)
    if not deep.any():
        return rgba

    # For every pixel, the colour of the nearest DEEP pixel — i.e. the local
    # interior colour, carried outward to the edge.
    idx = ndimage.distance_transform_edt(
        ~deep, return_distances=False, return_indices=True
    )
    inward = a[..., :3][tuple(idx)]

    lum_now = a[..., :3].mean(axis=2)
    lum_ref = inward.mean(axis=2)

    # The band to consider: inside the shape (any alpha at all) but not yet
    # deep. Semi-transparent hair is included — a dark rim can ride on it too
    # — but the ratio test still decides.
    band = (alpha > 0) & (depth < rim_px)
    darker = lum_now < dark_ratio * np.maximum(lum_ref, 1.0)
    fix = band & darker & (lum_ref > light_ref)

    out = a.copy()
    out[..., :3][fix] = inward[fix]
    return out.astype(np.uint8)


def process(path, frame_w=None, frame_h=None):
    """Run over a file. Sprite sheets are processed frame by frame so one
    frame's interior can never bleed into its neighbour across a cell edge."""
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    if frame_w and frame_h:
        h, w = a.shape[:2]
        n = 0
        for y in range(0, h, frame_h):
            for x in range(0, w, frame_w):
                cell = a[y : y + frame_h, x : x + frame_w]
                if cell[..., 3].max() == 0:
                    continue
                a[y : y + frame_h, x : x + frame_w] = remove_rim(cell)
                n += 1
        print(f"  {os.path.basename(path)}: {n} frames")
    else:
        a = remove_rim(a)
        print(f"  {os.path.basename(path)}: single image")
    return Image.fromarray(a)


TARGETS = [
    # (path, frame_w, frame_h) — the two turntables are 960x1440 grids.
    ("public/images/rotating-head/sprite-sheet-light-staggered.webp", 960, 1440),
    ("public/images/rotating-head/sprite-sheet-dark-staggered.webp", 960, 1440),
]


def main():
    for rel, fw, fh in TARGETS:
        p = os.path.join(SITE, rel)
        if not os.path.exists(p):
            print("  skip (missing)", rel)
            continue
        out = process(p, fw, fh)
        if p.endswith(".webp"):
            out.save(p, "WEBP", quality=92, method=6)
        else:
            out.save(p, optimize=True)
        print("  wrote", rel)


if __name__ == "__main__":
    main()
