"""Register a project's animation frames so the subject behaves consistently.

Noah, on the Sprouts apple: "please adjust the sizing and location of each
frame of the animation to look like the apple is consistent." Each animation
needs a different treatment, because each is doing a different thing:

  ANCHOR — the point that must hold still between frames.
    "stem"   the top of the shape (Sprouts). The apple is eaten from the
             sides, so the stem is the only landmark that survives; aligning
             on the centroid or the bbox would drag the apple sideways as the
             bites grow. Measured across the five frames the stem's width is
             117/116/115/118/115px, which is what makes it usable.
    "center" the centre of the shape (CAC). "Have the heart grow from the
             center."
    "base"   the bottom edge (Olympics). "Have the flame growing from the
             base."

  SCALE — whether the subject's size is meaningful.
    "normalise"  every frame forced to one height (Sprouts). The apple's real
                 size never changes; the 1025/1024/1018/1022/1023 spread is
                 camera distance, not the apple.
    "preserve"   frames keep their relative sizes (CAC, Olympics), because
                 the growth IS the animation. The set is then scaled as a
                 whole so its LAST frame matches a target size — Noah: "The
                 final heart should be about the size of the apple."

Size is compared as the geometric mean of the bounding box, so a tall flame
and a round heart can be matched sensibly against a roughly square apple
rather than one axis being made to agree while the other runs away.
"""
import os
import sys
import json
import numpy as np
from PIL import Image

ALPHA = 40
STEM_BAND = 0.09
PAD = 0.06

# Every animation is scaled so its final frame has this geometric-mean size,
# in the shared pixel space the canvases are built in. It is the Sprouts
# apple's own first frame, which is the thing Noah is asking the others to
# match.
REFERENCE_SIZE = 1033.0


def shape(path):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    op = a[..., 3] > ALPHA
    ys, xs = np.where(op)
    return im, dict(
        x0=int(xs.min()), x1=int(xs.max()), y0=int(ys.min()), y1=int(ys.max()),
        w=int(xs.max() - xs.min() + 1), h=int(ys.max() - ys.min() + 1),
    )


def anchor_of(im, m, mode):
    """Return the (x, y) in image space that must stay fixed between frames."""
    if mode == "stem":
        a = np.array(im)
        op = a[..., 3] > ALPHA
        band = op.copy()
        band[int(m["y0"] + STEM_BAND * m["h"]):] = False
        _, bx = np.where(band)
        return float(bx.mean()), float(m["y0"])
    if mode == "center":
        return (m["x0"] + m["x1"]) / 2.0, (m["y0"] + m["y1"]) / 2.0
    if mode == "base":
        return (m["x0"] + m["x1"]) / 2.0, float(m["y1"])
    raise ValueError(f"unknown anchor {mode!r}")


def align(paths, anchor="stem", scale_mode="normalise", pad=PAD,
          reference_size=REFERENCE_SIZE):
    frames = [shape(p) for p in paths]

    if scale_mode == "normalise":
        target_h = float(np.median([m["h"] for _, m in frames]))
        scales = [target_h / m["h"] for _, m in frames]
    elif scale_mode == "preserve":
        # Keep the frames' relative sizes; scale the SET so the last frame
        # lands on the reference.
        last = frames[-1][1]
        k = reference_size / float(np.sqrt(last["w"] * last["h"]))
        scales = [k] * len(frames)
    else:
        raise ValueError(f"unknown scale mode {scale_mode!r}")

    placed = []
    for (im, m), s in zip(frames, scales):
        w, h = im.size
        im2 = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        ax, ay = anchor_of(im, m, anchor)
        placed.append((im2, ax * s, ay * s))

    lefts, rights, tops, bottoms = [], [], [], []
    for im2, ax, ay in placed:
        a = np.array(im2)
        ys, xs = np.where(a[..., 3] > ALPHA)
        lefts.append(xs.min() - ax); rights.append(xs.max() - ax)
        tops.append(ys.min() - ay);  bottoms.append(ys.max() - ay)
    l, r, t, b = min(lefts), max(rights), min(tops), max(bottoms)
    padpx = int(round(max(r - l, b - t) * pad))
    cw = int(round(r - l)) + 2 * padpx
    ch = int(round(b - t)) + 2 * padpx
    ax0 = int(round(-l)) + padpx
    ay0 = int(round(-t)) + padpx

    out = []
    for im2, ax, ay in placed:
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(im2, (int(round(ax0 - ax)), int(round(ay0 - ay))))
        out.append(canvas)
    return out


def build(src_paths, dst_dir, anchor, scale_mode, out_width=700, quality=92):
    frames = align(src_paths, anchor=anchor, scale_mode=scale_mode)
    os.makedirs(dst_dir, exist_ok=True)
    W, H = frames[0].size
    out_h = max(1, round(H * out_width / W))
    total = 0
    for i, f in enumerate(frames, 1):
        p = os.path.join(dst_dir, f"{i}.webp")
        f.resize((out_width, out_h), Image.LANCZOS).save(p, "WEBP", quality=quality, method=6)
        total += os.path.getsize(p)
    info = dict(dir=dst_dir, frames=len(frames), canvas=[W, H],
                out=[out_width, out_h], kb=round(total / 1024))
    return info


if __name__ == "__main__":
    print(json.dumps(build(sys.argv[1].split(","), sys.argv[2], sys.argv[3], sys.argv[4]), indent=1))
