"""Register a project's animation frames so the subject behaves consistently.

Noah, on the Sprouts apple: "please adjust the sizing and location of each
frame of the animation to look like the apple is consistent." Each animation
needs a different treatment, because each is doing a different thing:

  ANCHOR — the point that must hold still between frames.
    "template"  match frame 1's own silhouette into every later frame
                (Valley Strong). A house is drawn around a person, so the
                PERSON is what must not move — but he is only isolatable in
                frame 1, where he is the entire drawing. Every later frame
                buries him in walls and a roof, so no landmark test finds him.
                Instead frame 1 is slid and scaled over each later frame until
                the most of it is covered, which locates the same drawing
                inside the bigger one. Measured before doing this, frame 1
                overlapped the later frames only 21-35%, so the shots really
                do wander; these are photographs of a drawing being added to,
                not layers on one canvas.
    "stem"   the top of the shape (Sprouts). The apple is eaten from the
             sides, so the stem is the only landmark that survives; aligning
             on the centroid or the bbox would drag the apple sideways as the
             bites grow. Measured across the five frames the stem's width is
             117/116/115/118/115px, which is what makes it usable.
    "center" the centre of the shape (CAC). "Have the heart grow from the
             center."
    "base"   the bottom edge (Olympics). "Have the flame growing from the
             base."
    "tip"    the far end in the down-right direction (the ampersand). Noah:
             "It starts from the bottom right corner and then traces out the
             '&'." This is a length of blue tube laid out by hand and
             re-photographed at each stage, so the part already down SHIFTS
             between shots — pairwise template matching pins the scale against
             whichever bound it is given and still only covers 72-80% of the
             previous frame, because the previous frame is genuinely no longer
             in the same place. What IS stable is the free end the tube was
             started from: its centroid wanders about 4% of the canvas across
             all seven frames. Holding that still is what makes the growth
             read as a trace leaving one fixed origin.

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
# How many of the most extreme pixels define a "tip". Enough to average out
# the fuzz of a matte edge, few enough to stay on the end of the tube.
TIP_PIXELS = 400

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
    if mode == "tip":
        ys, xs = np.where(_mask(im))
        far = np.argsort(xs.astype(np.int64) + ys)[-TIP_PIXELS:]
        return float(xs[far].mean()), float(ys[far].mean())
    raise ValueError(f"unknown anchor {mode!r}")


def _mask(im, alpha=ALPHA):
    return np.array(im)[..., 3] > alpha


def _template_offsets(images):
    """Locate frame 1's drawing inside every later frame.

    Scores the share of the REFERENCE's pixels that the candidate covers, not
    IoU: later frames legitimately contain far more ink, so intersection over
    union would punish them for the house and pull the fit off the person.
    """
    import cv2

    DS = 4
    small = [cv2.resize(_mask(im).astype(np.uint8), None, fx=1 / DS, fy=1 / DS,
                        interpolation=cv2.INTER_AREA) > 0 for im in images]
    ref_s = small[0]
    ry, rx = np.where(ref_s)
    ref_pts = np.stack([rx, ry], 1)
    total = max(len(ref_pts), 1)

    def cover(m, scale, dx, dy):
        H, W = m.shape
        pts = (ref_pts * scale).astype(int)
        xs = pts[:, 0] + dx
        ys = pts[:, 1] + dy
        ok = (xs >= 0) & (xs < W) & (ys >= 0) & (ys < H)
        if not ok.any():
            return -1.0
        return m[ys[ok], xs[ok]].sum() / total

    out = [(1.0, 0.0, 0.0)]
    for m in small[1:]:
        best = (-1.0, 1.0, 0, 0)
        for scale in np.arange(0.86, 1.15, 0.02):
            for dy in range(-40, 41, 4):
                for dx in range(-40, 41, 4):
                    c = cover(m, scale, dx, dy)
                    if c > best[0]:
                        best = (c, scale, dx, dy)
        _, s0, dx0, dy0 = best
        for scale in np.arange(s0 - 0.02, s0 + 0.021, 0.005):
            for dy in range(dy0 - 4, dy0 + 5):
                for dx in range(dx0 - 4, dx0 + 5):
                    c = cover(m, scale, dx, dy)
                    if c > best[0]:
                        best = (c, scale, dx, dy)
        _, scale, dx, dy = best
        out.append((scale, dx * DS, dy * DS))
    return out


def align(paths, anchor="stem", scale_mode="normalise", pad=PAD,
          reference_size=REFERENCE_SIZE):
    frames = [shape(p) for p in paths]

    if anchor == "template":
        images = [im for im, _ in frames]
        offs = _template_offsets(images)
        _ref_im, ref_m = frames[0]
        ax0 = (ref_m["x0"] + ref_m["x1"]) / 2.0
        ay0 = (ref_m["y0"] + ref_m["y1"]) / 2.0
        placed = []
        for (im, _m), (sc, dx, dy) in zip(frames, offs):
            # a frame-1 point p appears at p*sc + (dx,dy) here, so undo that
            inv = 1.0 / sc
            w, h = im.size
            im2 = im.resize((max(1, round(w * inv)), max(1, round(h * inv))), Image.LANCZOS)
            placed.append((im2, (ax0 * sc + dx) * inv, (ay0 * sc + dy) * inv))
        # Template matching fixes the frames RELATIVE to each other but says
        # nothing about how big the result should be, so the set still has to
        # be brought to the shared reference like the others.
        return _rescale_to_reference(_compose(placed, pad), reference_size)

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

    return _compose(placed, pad)


def _rescale_to_reference(frames, reference_size):
    """Scale a composed set so its LAST frame matches the shared size."""
    a = np.array(frames[-1])
    ys, xs = np.where(a[..., 3] > ALPHA)
    geo = float(np.sqrt((xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1)))
    k = reference_size / geo
    W, H = frames[0].size
    size = (max(1, round(W * k)), max(1, round(H * k)))
    return [f.resize(size, Image.LANCZOS) for f in frames]


def _compose(placed, pad):
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
