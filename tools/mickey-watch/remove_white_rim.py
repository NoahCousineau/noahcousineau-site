"""Take the white matte halo off the figure in the away-screen clock.

2026-08-23, Noah: "I noticed that we also have some hair fringe on the clock
head. Please try to remove this as well."

WHAT IT IS — measured on body.png, scanning down through the top of the head
at x=300:

    y0-y2   alpha  76-108   RGB(238,236,234)   near-white, semi-transparent
    y3      alpha 218       RGB(193,191,184)
    y4      alpha 249       RGB(177,174,166)
    y5      alpha 255       RGB(169,171,158)   FULLY OPAQUE, still light grey
    y9+     alpha 255       RGB( 80, 61, 46)   actual hair

A light grey at full opacity sitting four pixels off hair half its luminance
is not shading — nothing on a head steps 2x in four pixels. It is the white
studio backdrop, kept by the cutout and then written at an alpha far higher
than the amount of hair actually in those pixels. Two faults compounding: the
colour is contaminated AND the alpha overstates the coverage. Averaged over
the whole silhouette the first shell in from the edge reads luminance 159
against 79 one pixel deeper, so this is the entire outline, not just the hair.

It shows because the away screen is black. On black, "white that should have
been transparent" is the most visible mistake an alpha channel can make.

THE FIX IS THE MATTING EQUATION, not a threshold. A pixel photographed
against a single known background holds C = aF + (1-a)B, with B white here
and F the subject's true colour. F is recoverable: it is what this part of
the figure looks like once past the contaminated band, which a distance
transform gives directly (the nearest pixel at least RIM_PX deep). With F and
B known, the coverage that explains the observed luminance is

    a = (B - C) / (B - F)

so each rim pixel is rewritten to colour F at that alpha. This is worth more
than clamping or darkening the rim: it keeps the SOFTNESS. Hair edges are
genuinely fractional, and thresholding them to "hair colour, opaque" trades a
white halo for a hard cut-out silhouette. Solving for coverage turns a
near-white opaque pixel into a mostly-transparent hair-coloured one, which is
what it always should have been.

Alpha is only ever REDUCED (np.minimum). The equation can also argue for more
coverage than the file claims, and acting on that would grow the figure into
its own background — the one direction where being wrong adds material that
was never photographed.

TWO GUARDS, both against the same instability. Where F is itself near white
the denominator collapses and `a` is noise, so anything within WHITE_GUARD of
the backdrop keeps its original alpha. And the correction is ramped out over
the band by a smoothstep rather than switched off at RIM_PX, because a hard
boundary between corrected and untouched pixels is its own visible seam —
that is what made the first pass at the rotating head's rim read as "messy"
(see tools/dark-head-pipeline/remove_dark_rim.py).
"""
import os
import shutil

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(SITE, "public/images/mickey-watch/body.png")
BACKUP = os.path.join(SITE, "public/images/mickey-watch/body-white-rim-backup.png")
SHEET = "/private/tmp/claude-501/-Users-noahcousineau-Desktop-portfolio-noahcousineau-site/5a92aba5-9f87-47c5-91a0-843e0e91e314/scratchpad/clock-head-fix.png"

BACKDROP = 255.0   # the studio white this was shot against
# How far the bleed reaches, and how far in to look for a colour that is
# clean. These are SEPARATE numbers, and conflating them was the first
# version's mistake: sampling F at the edge of the contaminated band meant F
# was itself contaminated, so the equation dutifully replaced light grey with
# slightly different light grey. Re-reading the scan at the top of this file,
# the colour does not settle to real hair — RGB(80,61,46) — until y9 or y10,
# so the band is 10 deep and the sample has to come from past that.
RIM_PX = 12
SAMPLE_PX = 18
# ...and the correction holds at FULL strength through this fraction of the
# band before ramping out, rather than ramping from the very edge. The bleed
# is roughly even across its depth and then stops; a ramp that starts falling
# immediately leaves the inner half of it barely touched, which showed up as a
# bright line sitting a few pixels inside the crown once the outer glow was
# gone. Holding flat is safe because the equation is self-limiting — where the
# pixel already matches its own interior colour it returns a ~ 1 and nothing
# moves — so a wider window costs nothing on clean pixels.
HOLD = 0.55
# HOW FAR BELOW THE BACKDROP F HAS TO SIT before the equation is trusted,
# ramped between these two rather than switched at one.
#
# The equation is far more sensitive on light subject matter than dark. On
# hair at luminance 62 the denominator is 193 and a stray ten levels of
# lightness barely moves the answer; on skin at 190 the denominator is 65, and
# an edge pixel ten levels light enough reads as 15% less coverage. Running it
# on the face at the same strength as the hair chewed visible bites out of the
# jaw, the chin and the shoulder — the correction was eating the subject.
#
# Guarding light interiors out costs nothing that shows. A white halo against
# white-ish skin is a few levels of contrast; against hair and a black shirt it
# is the whole complaint. Skin (255-190 = 65) ramps to nothing, hair
# (255-62 = 193) and the shirt are corrected in full.
GUARD_LO, GUARD_HI = 70, 110
ALPHA_MIN = 16


def declutter(path):
    a = np.array(Image.open(path).convert("RGBA")).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    op = al > ALPHA_MIN

    # PAD BEFORE MEASURING DEPTH. The figure is cropped hard to the canvas —
    # the crown of the head sits on row 0 — and distance_transform_edt treats
    # the array border as more of the same, so those pixels came back "deep
    # inside the silhouette" and the whole top of the hair, the worst of the
    # halo, was skipped as interior. A one-pixel transparent frame makes the
    # canvas edge count as the edge it visually is. Where the crop genuinely
    # cuts through the body instead, this costs nothing: there F and C are the
    # same dark shirt, so the equation returns a ~ 1 and nothing moves.
    depth = ndi.distance_transform_edt(np.pad(op, 1))[1:-1, 1:-1]
    # F for every pixel: the colour of the nearest one that is both opaque and
    # past the contaminated band.
    core = op & (depth >= SAMPLE_PX)
    if not core.any():
        raise SystemExit("nothing deep enough to sample a true colour from")
    _, (iy, ix) = ndi.distance_transform_edt(~core, return_indices=True)
    F = rgb[iy, ix]

    C_lum = rgb.mean(2)
    F_lum = F.mean(2)

    # a = (B - C) / (B - F), only where the denominator is meaningful.
    denom = BACKDROP - F_lum
    solvable = denom > GUARD_LO
    solved = np.zeros_like(C_lum)
    solved[solvable] = ((BACKDROP - C_lum[solvable]) / denom[solvable]) * 255.0
    solved = np.clip(solved, 0, 255)

    # Ramp the correction out across the band: full at the edge, nothing at
    # RIM_PX, smoothstepped so there is no line where treatment stops.
    t = np.clip((depth / RIM_PX - HOLD) / (1 - HOLD), 0, 1)
    w = 1.0 - (t * t * (3 - 2 * t))
    g = np.clip((denom - GUARD_LO) / (GUARD_HI - GUARD_LO), 0, 1)
    w *= g * g * (3 - 2 * g)
    w[~op] = 0
    w[~solvable] = 0

    out = a.copy()
    out[..., :3] = rgb * (1 - w[..., None]) + F * w[..., None]
    # Only ever take coverage AWAY.
    out[..., 3] = al * (1 - w) + np.minimum(al, solved) * w
    return np.clip(out, 0, 255).astype(np.uint8)


def strip(im, box, bg):
    c = im.crop(box)
    out = Image.new("RGB", c.size, bg)
    out.paste(c, (0, 0), c)
    return out


def main():
    if not os.path.exists(BACKUP):
        shutil.copy2(SRC, BACKUP)
        print(f"  kept the original at {os.path.basename(BACKUP)}")
    before = Image.open(BACKUP).convert("RGBA")
    after = Image.fromarray(declutter(BACKUP))

    a = np.array(before).astype(int)
    b = np.array(after).astype(int)
    op = a[..., 3] > ALPHA_MIN
    d = ndi.distance_transform_edt(op)
    shell = op & (d < 2)
    print(f"  outer shell: luminance {a[..., :3].mean(2)[shell].mean():.0f}"
          f" -> {b[..., :3].mean(2)[shell].mean():.0f},"
          f" alpha {a[..., 3][shell].mean():.0f} -> {b[..., 3][shell].mean():.0f}")
    print(f"  silhouette area: {int(op.sum())} -> {int((b[..., 3] > ALPHA_MIN).sum())} px")

    after.save(SRC)
    print(f"  wrote {os.path.relpath(SRC, SITE)}")

    # Before/after on black, which is the background it has to survive.
    ys, xs = np.where(op)
    y0, y1 = ys.min(), ys.min() + int((ys.max() - ys.min()) * 0.28)
    box = (max(0, xs.min() - 20), max(0, y0 - 20), min(before.width, xs.max() + 20), y1)
    tiles = [strip(before, box, (0, 0, 0)), strip(after, box, (0, 0, 0))]
    sc = 1000 / (tiles[0].width * 2)
    tiles = [t.resize((int(t.width * sc), int(t.height * sc)), Image.LANCZOS) for t in tiles]
    sheet = Image.new("RGB", (tiles[0].width * 2 + 12, tiles[0].height), (60, 60, 60))
    sheet.paste(tiles[0], (0, 0))
    sheet.paste(tiles[1], (tiles[0].width + 12, 0))
    os.makedirs(os.path.dirname(SHEET), exist_ok=True)
    sheet.save(SHEET)
    print(f"  before | after -> {SHEET}")


if __name__ == "__main__":
    main()
