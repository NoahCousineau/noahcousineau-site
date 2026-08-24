"""Build the four animated elements that sit behind (and in front of) the
home page's rotating head.

2026-08-23, Noah: "I spent some time to finally replace the generic yellow
shape animation that we have behind the rotating head... Furthest back is a
red star, then a yellow star, then my head, then the blue star, then the
pencil marks."

Source: "Home and About Animations/Edited/Behind Head/<Set>/*.psd", each set
a hand-shot sequence of a paper cut-out re-photographed frame by frame.

REGISTRATION IS THE WHOLE JOB HERE. These are photographs of paper on a
table, not layers on one canvas — Noah: "I tried my best to photograph this
steady, but please try to keep the frames aligned." Left raw, the frames
wander by tens of pixels between shots and the animation reads as camera
shake rather than as the shape changing. Every set is therefore pasted onto
one shared canvas with its CENTROID at the canvas centre, which is also
exactly what Noah asked for on the growing stars: "Have this around a common
center point."

WHY THE CENTROID rather than the bounding box's centre: the bbox is defined
by the two most extreme pixels, so on a star it is driven entirely by
whichever spikes happen to be longest in that frame — precisely the thing
that is supposed to be changing. The centroid is an average over every
opaque pixel, so a spike growing on one side moves it by a little rather
than snapping the whole frame sideways.

SCALE IS PRESERVED THROUGHOUT, and for the yellow star that is a measured
decision rather than a default. "The star is not growing in this, rather
it's just changing shape" reads like an instruction to normalise its size,
and the first pass did — by area, which turned out to be exactly wrong.
Measured across the eight yellow frames: the AREA swings 29% (min/max
0.712) while the bounding box's diagonal holds to within 0.8% (0.9916).
That combination says the camera was steady and the spikes are genuinely
retracting and extending — the area is changing because the SHAPE is,
which is the animation itself. Normalising it applied a compensating
±9% scale to every frame and put a breathing wobble into a set that did
not have one. So nothing is rescaled anywhere; only the position is
corrected.

The pencil clusters are not a sequence at all: four separate static
drawings, each cropped to its own ink. Their animation is a wipe applied at
render time (see BehindHead.tsx), not a set of frames.
"""
import json
import os
import re

import numpy as np
from PIL import Image
from psd_tools import PSDImage

SRC = "/Users/noahcousineau/Desktop/portfolio/Home and About Animations/Edited/Behind Head"
SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(SITE, "public/assets/home/behind-head")
TS_OUT = os.path.join(SITE, "src/lib/behindHead.ts")

ALPHA = 10
# Breathing room around the union of every frame, as a fraction of the
# canvas — keeps a spike that grows late in the sequence from touching the
# edge and looking clipped.
PAD = 0.03

# name -> (folder, output width in px, normalise?)
#
# `normalise` is kept as a switch rather than deleted because it is the right
# treatment for a set genuinely shot at varying camera distance; it is simply
# off for all three of these (see the docstring's measurement).
#
# Output widths are chosen per set against how big each element is actually
# drawn on the page (see BehindHead.tsx): the yellow star spans most of the
# composition and needs the resolution, the pencil clusters are thumbnails.
# name -> (folder, output width in px, normalise?, webp quality)
#
# The yellow star is quality 70 against everything else's 84, and that is a
# measured trade rather than a guess: it is one big flat wash of photographed
# paper, which is the easiest thing there is to compress, and it is also by
# far the heaviest element (8 frames of 1000px against red's 5 small ones).
# Compared crops at 84/76/68/60 — the paper grain is indistinguishable down
# to 68 — while the payload runs 1344kB/832kB/576kB/480kB. These frames load
# behind PageLoader, which holds the page until every image has decoded, so
# the weight is paid directly in how long the reader waits.
SETS = {
    "yellow": ("Yellow Star", 1000, False, 70),
    "red": ("Red Star", 720, False, 84),
    "blue": ("Blue Star", 820, False, 84),
}
PENCIL = ("Pencil Marks", 460, 84)


def webp(quality):
    return dict(format="WEBP", quality=quality, method=6)


def flatten(path):
    return PSDImage.open(path).composite().convert("RGBA")


def stats(im):
    a = np.array(im)
    op = a[..., 3] > ALPHA
    ys, xs = np.where(op)
    if len(xs) == 0:
        return None
    return dict(
        cx=float(xs.mean()),
        cy=float(ys.mean()),
        x0=int(xs.min()), x1=int(xs.max()),
        y0=int(ys.min()), y1=int(ys.max()),
        area=int(op.sum()),
    )


def natural_key(p):
    m = re.search(r"(\d+)", os.path.basename(p))
    return int(m.group(1)) if m else 0


def build_set(name, folder, out_w, normalise, quality):
    d = os.path.join(SRC, folder)
    files = sorted(
        [os.path.join(d, f) for f in os.listdir(d) if f.lower().endswith(".psd")],
        key=natural_key,
    )
    frames = []
    for f in files:
        im = flatten(f)
        s = stats(im)
        if s is None:
            continue
        frames.append((im, s))

    areas = [s["area"] for _, s in frames]
    print(f"  {name}: {len(frames)} frames, area spread "
          f"{min(areas)/max(areas):.3f} (min/max)")

    # Scale each frame so every one covers the same area, for the sets where
    # size is camera distance rather than animation.
    scales = [1.0] * len(frames)
    if normalise:
        target = float(np.median(areas))
        scales = [float(np.sqrt(target / s["area"])) for _, s in frames]
        print(f"    normalised: scales {min(scales):.3f}-{max(scales):.3f}")

    # Extent from the centroid, in each direction, over every frame — the
    # canvas has to hold the union of all of them with centroids coincident.
    l = r = t = b = 0.0
    for (im, s), k in zip(frames, scales):
        l = max(l, (s["cx"] - s["x0"]) * k)
        r = max(r, (s["x1"] - s["cx"]) * k)
        t = max(t, (s["cy"] - s["y0"]) * k)
        b = max(b, (s["y1"] - s["cy"]) * k)
    half_w = max(l, r) * (1 + PAD)
    half_h = max(t, b) * (1 + PAD)
    cw, ch = int(round(half_w * 2)), int(round(half_h * 2))

    dst = os.path.join(OUT, name)
    os.makedirs(dst, exist_ok=True)
    scale_out = out_w / cw
    out_h = int(round(ch * scale_out))

    for i, ((im, s), k) in enumerate(zip(frames, scales), start=1):
        if k != 1.0:
            im = im.resize((max(1, int(round(im.width * k))),
                            max(1, int(round(im.height * k)))), Image.LANCZOS)
        cx, cy = s["cx"] * k, s["cy"] * k
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(im, (int(round(half_w - cx)), int(round(half_h - cy))))
        canvas = canvas.resize((out_w, out_h), Image.LANCZOS)
        canvas.save(os.path.join(dst, f"{i}.webp"), **webp(quality))

    kb = sum(os.path.getsize(os.path.join(dst, f)) for f in os.listdir(dst)) // 1024
    print(f"    canvas {cw}x{ch} -> {out_w}x{out_h}, {len(frames)} frames, {kb}kB")
    return dict(frames=len(frames), width=out_w, height=out_h)


def build_pencils():
    folder, out_w, quality = PENCIL
    d = os.path.join(SRC, folder)
    files = sorted(
        [os.path.join(d, f) for f in os.listdir(d) if f.lower().endswith(".psd")],
        key=natural_key,
    )
    dst = os.path.join(OUT, "pencil")
    os.makedirs(dst, exist_ok=True)
    out = []
    for i, f in enumerate(files, start=1):
        im = flatten(f)
        s = stats(im)
        crop = im.crop((s["x0"], s["y0"], s["x1"] + 1, s["y1"] + 1))
        h = int(round(crop.height * out_w / crop.width))
        crop = crop.resize((out_w, h), Image.LANCZOS)
        crop.save(os.path.join(dst, f"{i}.webp"), **webp(quality))
        out.append(dict(width=out_w, height=h))
        print(f"  pencil {i}: {crop.width}x{crop.height}")
    return out


TS_HEADER = '''/**
 * The home page's behind-the-head animation set — Noah's paper cut-outs,
 * re-photographed frame by frame.
 *
 * GENERATED by tools/behind-head/build_behind.py — do not edit by hand.
 * Re-run that script when the source PSDs change; the sizes here are each
 * set's real pixel dimensions after frame registration, which BehindHead
 * uses for aspect ratios.
 *
 * 2026-08-23, Noah: "Furthest back is a red star, then a yellow star, then
 * my head, then the blue star, then the pencil marks."
 */

export type BehindSet = {
  /** Frame image paths, in order, starting at frame 1. */
  frames: string[];
  /** Registered canvas size, shared by every frame in the set. */
  width: number;
  height: number;
};

export type PencilMark = { src: string; width: number; height: number };

'''


def write_ts(sets, pencils):
    lines = [TS_HEADER]
    lines.append("export const BEHIND_SETS: Record<string, BehindSet> = {")
    for name, info in sets.items():
        srcs = ", ".join(
            f'"/assets/home/behind-head/{name}/{i}.webp"'
            for i in range(1, info["frames"] + 1)
        )
        lines.append(f'  {name}: {{')
        lines.append(f"    frames: [{srcs}],")
        lines.append(f'    width: {info["width"]},')
        lines.append(f'    height: {info["height"]},')
        lines.append("  },")
    lines.append("};")
    lines.append("")
    lines.append("export const PENCIL_MARKS: PencilMark[] = [")
    for i, p in enumerate(pencils, start=1):
        lines.append(
            f'  {{ src: "/assets/home/behind-head/pencil/{i}.webp", '
            f'width: {p["width"]}, height: {p["height"]} }},'
        )
    lines.append("];")
    lines.append("")
    with open(TS_OUT, "w") as f:
        f.write("\n".join(lines))
    print("wrote", TS_OUT)


def main():
    os.makedirs(OUT, exist_ok=True)
    built = {}
    for name, (folder, w, norm, q) in SETS.items():
        built[name] = build_set(name, folder, w, norm, q)
    pencils = build_pencils()
    with open(os.path.join(OUT, "_manifest.json"), "w") as f:
        json.dump(dict(sets=built, pencils=pencils), f, indent=1)
    write_ts(built, pencils)


if __name__ == "__main__":
    main()
