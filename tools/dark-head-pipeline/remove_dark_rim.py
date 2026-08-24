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

AND THEN THE ALPHA HAS TO BE FEATHERED, or the fix trades one artefact for
another. 2026-08-23, Noah, on the first version of this: "the rotating head
drop border is now getting a bit messy." Under the dark rim the cut's alpha
was a hard, essentially binary step — 255, 253, 220, 4 over four pixels, and
stair-stepping by whole pixels along its length. The dark line had been
covering that staircase up. Take the line away and the raw jagged cut is
what shows, which reads as a chewed edge rather than a clean one.

So the same region gets a small blur applied to its ALPHA, which is what
antialiasing that boundary means. Restricted to the skin cut for the third
time and for the same reason: the hairline's alpha is already a soft,
genuinely gradual ramp — measured through 0.2-0.8 over tens of pixels — and
blurring it would smear the individual strands that make the hair read as
hair. Verified by eye against the yellow starburst, which is the least
forgiving background on the site for both problems.
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
# ...and only where that interior colour is skin rather than hair, RAMPED
# between these two luminances rather than switched at one.
#
# A hard threshold was the second thing Noah called messy. Lit skin behind the
# cut measures 180-190 and hair just inside the hairline ~110, so a single cut
# at 150 does separate them — but the SHADOWED skin along the side of the neck
# sits below it, so that stretch kept its dark rim while the lit stretch two
# pixels away had been cleaned. The seam between treated and untreated was
# itself the defect. Ramping means the correction fades out where the head
# stops being obviously skin, so there is no edge to see.
SKIN_LO = 95.0
SKIN_HI = 165.0
# How far either side of the cut gets the antialiasing blur, in px.
FEATHER_PX = 2
# Blur radius for that antialiasing. Around a pixel: enough to turn a
# whole-pixel staircase into a ramp, not enough to soften the silhouette
# itself into a glow.
FEATHER_SIGMA = 0.9


def _ramp(v, lo, hi):
    """0 below lo, 1 above hi, smoothstepped between — no hard seam."""
    t = np.clip((v - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def remove_rim(rgba, rim_px=RIM_PX, dark_ratio=DARK_RATIO):
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
    # How much this looks like skin rather than hair, 0..1 (see SKIN_LO/HI).
    w_skin = _ramp(lum_ref, SKIN_LO, SKIN_HI)

    # How much darker the pixel is than the silhouette just inside it, scaled
    # so it reaches full strength well before the rim's real depth (measured
    # 114 against 182, a deficit of 0.37) and tapers to nothing at the
    # threshold, so ordinary shading is nudged rather than flattened.
    deficit = 1.0 - lum_now / np.maximum(lum_ref, 1.0)
    floor = 1.0 - dark_ratio
    w_dark = _ramp(deficit, floor, floor * 2.5)

    # Only inside the shape and only within the contaminated depth.
    in_band = ((alpha > 0) & (depth < rim_px)).astype(np.float32)
    w = (w_skin * w_dark * in_band)[..., None]

    out = a.copy()
    out[..., :3] = a[..., :3] * (1.0 - w) + inward * w

    # --- antialias the cut (see the note at the top) -----------------------
    # The zone straddling the alpha boundary, faded out by the same skin
    # weight so the feather stops where the hair starts without a seam.
    inside = alpha > 127
    d_in = ndimage.distance_transform_edt(inside)
    d_out = ndimage.distance_transform_edt(~inside)
    near_edge = (d_in <= FEATHER_PX) | (d_out <= FEATHER_PX)
    wf = w_skin * near_edge.astype(np.float32)
    if wf.max() > 0:
        smoothed = ndimage.gaussian_filter(alpha, FEATHER_SIGMA)
        new_alpha = alpha * (1.0 - wf) + smoothed * wf
        # A pixel that was fully clear and is now partly opaque would
        # otherwise carry whatever junk colour the transparent area happened
        # to hold (measured: around RGB(52,52,52) out here), and that junk is
        # what a feather would fade IN. Give anything that gained coverage the
        # skin colour it is fading out of.
        gained = new_alpha > alpha + 1.0
        out[..., :3][gained] = inward[gained]
        out[..., 3] = new_alpha
    return np.clip(out, 0, 255).astype(np.uint8)


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
