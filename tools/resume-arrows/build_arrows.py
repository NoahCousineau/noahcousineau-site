"""Cut Noah's clay arrows out of one photograph and normalise them.

2026-08-23: "For the download my resume section, I want some arrows pointing
at the resume. Let's choose four from the psd I'm attaching, at least one
red, one blue, and one yellow... Two of these will be on the left side of
the browser pointing radially at the resume and two others will be on the
other side doing the same."

The source is a single shot of twelve arrows — four red, four blue, four
yellow — laid out on white and pointing every which way.

2026-08-24: "The arrows used also seem a bit rough, so try the png I'm
attaching instead." He is right, and the PNG says why. The old source was an
unedited PSD keyed on SATURATION — clay is saturated, paper is not — which
is a decision made per-pixel with no middle ground, so every soft edge in
the photograph became a hard jagged one. `ClayArrows.png` is his own cutout
and carries a REAL ALPHA CHANNEL (83% of the image is transparent, with a
genuine soft fringe), so the shape no longer has to be guessed at.

WHAT THE ALPHA ALONE DOESN'T FIX is that those fringe pixels still hold the
colour the camera saw, which at the edge is clay blended with the white
paper behind it. Masking alone therefore leaves a pale rim — the same fault
as the away-screen figure's halo, arrived at from the other direction. Here
it is one line rather than a matting solve, because unlike that photograph
BOTH unknowns are already known: the backdrop is white and the coverage is
his alpha, so the clay's true colour is just F = (C - (1-a)*255) / a. See
`unfringe`.

EVERY ARROW IS ROTATED TO POINT RIGHT before export, which is the whole
trick that makes the component simple: aiming one at the résumé card is then
just "rotate by the angle from here to there", with no per-arrow correction
table to keep in step with the artwork.

WHICH WAY EACH ARROW POINTS IS A HAND-CHECKED TABLE, not a measurement, and
that is a deliberate retreat. The obvious approach — take the principal axis
of the silhouette for the line it lies along, then decide which end is the
head by which half is wider — was written, run, and thrown away: it got 4 of
12 right, which is no better than guessing. It fails because half of these
are not shafted arrows at all but nearly-symmetric chevrons and fat
pentagons, where "the wider half" is close to a coin flip and the principal
axis of an almost-round blob is barely defined.

Twelve numbers read off a contact sheet are exact, take a minute, and cannot
regress. They live here rather than in the generated file so re-running the
build keeps them. The sheet is still written on every run, and every arrow on
it must point RIGHT — that is what checks the table.

THE TABLE IS INDEXED BY READING ORDER, NOT BY LABEL ORDER. scipy's labelling
numbers components in whatever order it meets them, which is an accident of
the mask; the previous table was written against the PSD's accident and does
not survive the change of source.

Reading order has to be derived carefully, because the obvious spelling is
unstable. Bucketing by `round(centroid_y / 300)` was tried first and silently
renumbered four of the twelve when the mask changed from saturation-keyed to
alpha — these arrows are scattered rather than gridded, so several centroids
sit within a pixel or two of a bucket boundary and flip sides on the
slightest change. Rows are therefore found by GAPS: sort by centroid y, start
a new row wherever the next arrow is more than ROW_GAP below the last, then
sort each row by x. That depends only on the arrows being visibly separated
into rows, which they are, and not on where an arbitrary grid line falls.

Every run prints each arrow's bounding box next to its number, so the table
can be checked against a contact sheet rather than trusted.
"""

# index (1-based, in ORDER_KEY order) -> the direction the arrow points in
# the source photograph, degrees, screen coords: 0 right, 90 down, 180 left.
SOURCE_ANGLE = {
    1: 8, 2: 8, 3: 187, 4: 0,
    5: 5, 6: -8, 7: 0, 8: 0,
    9: 183, 10: -55, 11: 183, 12: -5,
}

# Not every arrow in the photo reads as one at the size these render.
#   4, 8, 12  fat near-symmetric pentagons — at ~150 artboard units across
#             they read as blobs, not as anything pointing anywhere, and no
#             rotation fixes that.
#   10        a bare V with no shaft. Rotated to -20 it read as pointing
#             up-right, to -55 as pointing down-left; a 35-degree change
#             should not swing a reading that far, and the fact that it does
#             is the measurement telling you the shape has no direction to
#             read. Both ends are prongs and the vertex is as blunt as they
#             are, so "which way does this point" has no answer to get right.
# (The old build skipped three for the same kind of reason; they are not the
# same three, because the numbering changed with the source — see the
# docstring.)
# That leaves eight — three red, three blue, two yellow. Only four are ever
# on screen at once, and pickFour still has at least one of every colour to
# draw from, which is the only guarantee it needs.
SKIP = {4, 8, 10, 12}

import json  # noqa: F401  (kept: the TS emitter below has used it before)
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

SRC = "/Users/noahcousineau/Desktop/portfolio/Home and About Animations/ClayArrows.png"
SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(SITE, "public/assets/home/resume-arrows")
TS_OUT = os.path.join(SITE, "src/lib/resumeArrows.ts")
SCRATCH = ("/private/tmp/claude-501/-Users-noahcousineau-Desktop-portfolio-"
           "noahcousineau-site/5a92aba5-9f87-47c5-91a0-843e0e91e314/scratchpad")
SHEET = os.path.join(SCRATCH, "arrows-check.png")

SOLID = 128      # alpha above this is "definitely arrow", for labelling
FRINGE = 8       # ...and above this is worth keeping, for the soft edge
GROW = 3         # px of dilation, so the component keeps its own soft fringe
ROW_GAP = 250    # px between centroid rows; see the docstring on reading order
MIN_AREA = 20000
OUT_W = 420


def unfringe(rgb, a):
    """Undo the white paper still mixed into the semi-transparent edge.

    A cutout keeps the colour the camera saw, so an edge pixel at alpha a is
    already clay·a + paper·(1-a). Solving that for the clay is exact here
    (unlike a matte, nothing has to be estimated) and is what stops the
    arrows rendering with a pale rim against the page.

    Guarded at low alpha because the division blows up there — below ~6%
    coverage the observed pixel is essentially all paper and carries no
    recoverable colour, and those pixels are too faint to see either way.
    """
    f = a[..., None] / 255.0
    out = np.where(f > 0.06, (rgb - (1 - f) * 255.0) / np.maximum(f, 1e-6), rgb)
    return np.clip(out, 0, 255)


def hue_name(rgb, mask):
    px = rgb[mask].astype(float)
    r, g, b = px[:, 0].mean(), px[:, 1].mean(), px[:, 2].mean()
    if r > g and r > b * 1.2 and g < r * 0.7:
        return "red"
    if b > r and b > g:
        return "blue"
    return "yellow"


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))   # stale exports would ship silently

    im = Image.open(SRC).convert("RGBA")
    src = np.array(im)
    rgb, alpha = src[..., :3].astype(float), src[..., 3]
    true_rgb = unfringe(rgb, alpha.astype(float))

    lab, n = ndi.label(alpha > SOLID)
    keep = [i for i in range(1, n + 1) if (lab == i).sum() >= MIN_AREA]
    print(f"  {n} components in {im.size}, {len(keep)} above {MIN_AREA}px")

    # See the docstring: reading order by row GAPS, not by a grid line that
    # several of these sit exactly on top of.
    cents = ndi.center_of_mass(alpha > SOLID, lab, keep)
    by_y = sorted(zip(keep, cents), key=lambda t: t[1][0])
    rows, row = [], [by_y[0]]
    for prev, cur in zip(by_y, by_y[1:]):
        if cur[1][0] - prev[1][0] > ROW_GAP:
            rows.append(row)
            row = []
        row.append(cur)
    rows.append(row)
    order = [i for r in rows for i, _ in sorted(r, key=lambda t: t[1][1])]

    arrows, tiles = [], []
    for src_no, i in enumerate(order, 1):
        if src_no in SKIP:
            ys, xs = np.where(lab == i)
            print(f"  arrow {src_no}: skipped (blob)  "
                  f"bbox x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()}")
            continue
        m = ndi.binary_dilation(lab == i, np.ones((GROW * 2 + 1,) * 2))
        ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()

        a = np.where(m, alpha, 0)[y0:y1 + 1, x0:x1 + 1]
        a = np.where(a > FRINGE, a, 0)
        sub = np.dstack([true_rgb[y0:y1 + 1, x0:x1 + 1].astype(np.uint8), a])
        pil = Image.fromarray(sub, "RGBA")

        ang = SOURCE_ANGLE[src_no]
        # expand=True keeps the whole arrow; PIL turns anticlockwise while
        # these angles are screen-space, hence no negation of an already
        # screen-space number read off the sheet.
        pil = pil.rotate(ang, resample=Image.BICUBIC, expand=True)
        arr = np.array(pil)
        yy, xx = np.where(arr[..., 3] > FRINGE)
        pil = pil.crop((xx.min(), yy.min(), xx.max() + 1, yy.max() + 1))

        w = OUT_W
        h = max(1, round(pil.height * OUT_W / pil.width))
        pil = pil.resize((w, h), Image.LANCZOS)
        idx = len(arrows) + 1
        pil.save(os.path.join(OUT, f"{idx}.webp"), format="WEBP", quality=90, method=6)
        colour = hue_name(src[..., :3], lab == i)
        arrows.append(dict(src=f"{idx}.webp", colour=colour, width=w, height=h))
        tiles.append(pil)
        print(f"  arrow {idx} (src #{src_no}): {colour:6s} points {ang:5} deg  "
              f"bbox x{x0}-{x1} y{y0}-{y1} -> {w}x{h}")

    # Contact sheet: every one of these must be pointing RIGHT.
    if tiles:
        tw, th, cols = 220, 170, 4
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (tw * cols, th * rows), "white")
        draw = ImageDraw.Draw(sheet)
        for k, t in enumerate(tiles):
            s = min(tw / t.width, (th - 20) / t.height)
            r = t.resize((max(1, int(t.width * s)), max(1, int(t.height * s))))
            bg = Image.new("RGB", (tw, th), "white")
            bg.paste(r, ((tw - r.width) // 2, 20 + (th - 20 - r.height) // 2), r)
            sheet.paste(bg, ((k % cols) * tw, (k // cols) * th))
            draw.text(((k % cols) * tw + 6, (k // cols) * th + 5), f"{k + 1}", fill="black")
        os.makedirs(os.path.dirname(SHEET), exist_ok=True)
        sheet.save(SHEET)
        print(f"  contact sheet -> {SHEET}")

    lines = ['''/**
 * Noah's clay arrows for the résumé card, cut out of one photograph.
 *
 * GENERATED by tools/resume-arrows/build_arrows.py — do not edit by hand.
 *
 * EVERY ARROW POINTS RIGHT in its own artwork, whatever direction it was
 * lying in when photographed. Aiming one is therefore just a rotation to the
 * bearing of its target, with no per-arrow offset to look up.
 */

export type ResumeArrow = {
  src: string;
  colour: "red" | "blue" | "yellow";
  width: number;
  height: number;
};

export const RESUME_ARROWS: ResumeArrow[] = [''']
    for a in arrows:
        lines.append(
            f'  {{ src: "/assets/home/resume-arrows/{a["src"]}", '
            f'colour: "{a["colour"]}", width: {a["width"]}, height: {a["height"]} }},'
        )
    lines.append("];")
    lines.append("")
    with open(TS_OUT, "w") as f:
        f.write("\n".join(lines))

    kb = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024
    counts = {}
    for a in arrows:
        counts[a["colour"]] = counts.get(a["colour"], 0) + 1
    print(f"  {len(arrows)} arrows {counts}, {kb}kB -> {TS_OUT}")


if __name__ == "__main__":
    main()
