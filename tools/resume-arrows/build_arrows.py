"""Cut Noah's clay arrows out of one photograph and normalise them.

2026-08-23: "For the download my resume section, I want some arrows pointing
at the resume. Let's choose four from the psd I'm attaching, at least one
red, one blue, and one yellow... Two of these will be on the left side of
the browser pointing radially at the resume and two others will be on the
other side doing the same."

The source is a single unedited shot of twelve arrows — four red, four blue,
four yellow — laid out on white and pointing every which way.

EVERY ARROW IS ROTATED TO POINT RIGHT before export, which is the whole
trick that makes the component simple: aiming one at the résumé link is then
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
"""

# index (1-based, in scan order) -> the direction the arrow points in the
# source photograph, degrees, screen coords: 0 right, 90 down, 180 left.
SOURCE_ANGLE = {
    1: 8, 2: 3, 3: 187, 4: 195,
    5: 0, 6: 5, 7: 180, 8: 190,
    9: 178, 10: -10, 11: -5, 12: -8,
}

# Not every arrow in the photo is usable.
#   4, 8  cut out with a hard straight edge and a notched corner — a matting
#         artefact rather than the clay.
#   7     is a chunky three-pronged shape with no clear tip; rendered at size
#         it does not read as pointing anywhere at either rotation, so there
#         is no angle that would fix it.
# That still leaves nine — three red, two blue, four yellow — which is plenty
# for a random pick of four that has to include one of each colour.
SKIP = {4, 7, 8}
import json
import os

import numpy as np
from PIL import Image
from psd_tools import PSDImage
from scipy import ndimage as ndi

SRC = "/Users/noahcousineau/Desktop/portfolio/Home and About Animations/Unedited/ClayArrows.psd"
SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(SITE, "public/assets/home/resume-arrows")
TS_OUT = os.path.join(SITE, "src/lib/resumeArrows.ts")
SHEET = "/private/tmp/claude-501/-Users-noahcousineau-Desktop-portfolio-noahcousineau-site/5a92aba5-9f87-47c5-91a0-843e0e91e314/scratchpad/arrows-check.png"

# The backdrop is paper-white; clay is saturated. Keying on saturation rather
# than brightness keeps the arrows' own highlights, which are bright but
# never grey.
MIN_SAT = 60
MIN_AREA = 20000
OUT_W = 420


def cut_out(rgb):
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    mask = (mx - mn) > MIN_SAT
    mask = ndi.binary_closing(mask, np.ones((9, 9)))
    mask = ndi.binary_fill_holes(mask)
    return mask


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
    im = PSDImage.open(SRC).composite().convert("RGB")
    rgb = np.array(im)
    mask = cut_out(rgb)
    lab, n = ndi.label(mask)
    print(f"  {n} components in {im.size}")

    arrows = []
    tiles = []
    found = 0
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < MIN_AREA:
            continue
        found += 1
        if found in SKIP:
            print(f"  arrow {found}: skipped (matting artefact)")
            continue
        ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        ang = SOURCE_ANGLE[found]
        colour = hue_name(rgb, m)

        # Build an RGBA cut-out, then rotate so it points right.
        sub = np.dstack([rgb, (m * 255).astype(np.uint8)])[y0:y1 + 1, x0:x1 + 1]
        pil = Image.fromarray(sub, "RGBA")
        # expand=True keeps the whole arrow; the rotation is negated because
        # PIL turns anticlockwise while these angles are screen-space.
        pil = pil.rotate(ang, resample=Image.BICUBIC, expand=True)
        a = np.array(pil)
        yy, xx = np.where(a[..., 3] > 10)
        pil = pil.crop((xx.min(), yy.min(), xx.max() + 1, yy.max() + 1))

        w = OUT_W
        h = max(1, round(pil.height * OUT_W / pil.width))
        pil = pil.resize((w, h), Image.LANCZOS)
        idx = len(arrows) + 1
        pil.save(os.path.join(OUT, f"{idx}.webp"), format="WEBP", quality=88, method=6)
        arrows.append(dict(src=f"{idx}.webp", colour=colour, width=w, height=h))
        tiles.append(pil)
        print(f"  arrow {idx} (src #{found}): {colour:6s} points {ang:5} deg -> {w}x{h}")

    # Contact sheet: every one of these must be pointing RIGHT.
    if tiles:
        tw, th = 220, 160
        cols = 4
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (tw * cols, th * rows), "white")
        for k, t in enumerate(tiles):
            s = min(tw / t.width, th / t.height)
            r = t.resize((int(t.width * s), int(t.height * s)))
            bg = Image.new("RGB", (tw, th), "white")
            bg.paste(r, ((tw - r.width) // 2, (th - r.height) // 2), r)
            sheet.paste(bg, ((k % cols) * tw, (k // cols) * th))
        os.makedirs(os.path.dirname(SHEET), exist_ok=True)
        sheet.save(SHEET)
        print(f"  contact sheet -> {SHEET}")

    lines = ['''/**
 * Noah's clay arrows for the résumé link, cut out of one photograph.
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
