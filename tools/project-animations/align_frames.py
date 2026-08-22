"""Register a project's animation frames so the subject doesn't jump.

Noah, on the Sprouts apple: "please adjust the sizing and location of each
frame of the animation to look like the apple is consistent."

The frames are hand-shot, so each one sits at a slightly different position
and camera distance — measured across the five Sprouts frames, the shape's
top edge wanders 33px and its horizontal position 74px, which would read as
the apple hopping around while it is eaten.

ANCHOR: the STEM. Picking an anchor is the whole problem here, because the
apple is being eaten — most of its outline is legitimately changing shape
frame to frame, so aligning on the centroid or the bounding box would drag
the apple sideways as the bites get bigger. The stem is the one feature that
survives to the last frame untouched, and it measures as a stable landmark:
its width is 117/116/115/118/115px and its pixel count varies under 5% across
the set.

SCALE: normalised on the shape's total height, which likewise should not
change — the bites all come out of the side, so top and bottom persist even
in the core. Measured heights are 1025/1024/1018/1022/1023, so this is only
correcting camera distance, about a third of a percent.
"""
import os
import sys
import numpy as np
from PIL import Image

ALPHA = 40
STEM_BAND = 0.09      # top slice of the shape treated as "the stem"
TARGET_H = 1024       # every frame normalised to this shape height
PAD = 0.06            # canvas padding around the union of all frames


def measure(path):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    op = a[..., 3] > ALPHA
    ys, xs = np.where(op)
    top, bot = int(ys.min()), int(ys.max())
    h = bot - top + 1
    band = op.copy()
    band[int(top + STEM_BAND * h):] = False
    by, bx = np.where(band)
    return im, dict(top=top, bot=bot, h=h, stem_cx=float(bx.mean()))


def align(paths, target_h=TARGET_H, pad=PAD):
    frames = [measure(p) for p in paths]
    # Where each frame's anchor lands after scaling, relative to its own art.
    scaled = []
    for im, m in frames:
        s = target_h / m["h"]
        w, h = im.size
        im2 = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        scaled.append((im2, m["stem_cx"] * s, m["top"] * s))

    # Canvas big enough for every frame once their anchors coincide.
    lefts, rights, bottoms = [], [], []
    for im2, ax, ay in scaled:
        a = np.array(im2)
        ys, xs = np.where(a[..., 3] > ALPHA)
        lefts.append(xs.min() - ax)
        rights.append(xs.max() - ax)
        bottoms.append(ys.max() - ay)
    span_l, span_r, span_b = min(lefts), max(rights), max(bottoms)
    padpx = int(round(target_h * pad))
    cw = int(round(span_r - span_l)) + 2 * padpx
    ch = int(round(span_b)) + 2 * padpx
    anchor_x = int(round(-span_l)) + padpx
    anchor_y = padpx

    out = []
    for im2, ax, ay in scaled:
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(im2, (int(round(anchor_x - ax)), int(round(anchor_y - ay))))
        out.append(canvas)
    return out


if __name__ == "__main__":
    src_dir, prefix, n, dst_dir = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    paths = [os.path.join(src_dir, f"{prefix}{i}.png") for i in range(1, n + 1)]
    frames = align(paths)
    os.makedirs(dst_dir, exist_ok=True)
    for i, f in enumerate(frames, 1):
        p = os.path.join(dst_dir, f"{i}.png")
        f.save(p, optimize=True)
    print(f"{len(frames)} frames -> {frames[0].size[0]}x{frames[0].size[1]} in {dst_dir}")
    for i, f in enumerate(frames, 1):
        a = np.array(f); ys, xs = np.where(a[..., 3] > ALPHA)
        print(f"  {i}: bbox x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()} "
              f"({os.path.getsize(os.path.join(dst_dir, f'{i}.png'))/1024:.0f}KB)")
