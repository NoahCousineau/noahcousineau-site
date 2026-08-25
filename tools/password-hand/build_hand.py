"""Cut Noah's fifteen password-hand poses out of their PSDs and register them.

2026-08-23: "The hand will fly up with a slight rotation and be stuck on
frame 1... the text will fade and the hand will rotate from the 'stop'
position to a thumbs up... I noticed that the individual hand frames are not
perfectly aligned though, so I could use your help with that."

THE SEQUENCE is a quarter turn: an open palm ("stop") whose fingers curl in
over fifteen shots until it reads as a thumbs up. The arm swings with it,
leaving through the bottom of the frame at the start and through the right
edge by the end.

REGISTRATION IS THE WHOLE POINT OF THIS FILE, and the hard part is that
these frames are *supposed* to move. Rotation is the animation; a naive
"line up the silhouettes" pass would cancel exactly the thing Noah shot.
So the alignment runs in three steps:

  1. ROTATE IT OUT FIRST. Noah's own demo (Password Animation Demo/*.svg)
     annotates every pose with a guide box he turned to match it, which
     gives a measured angle per frame for free — see POSE_ANGLE. Rotating
     frame i by the angle it gains before comparing it with frame i+1
     leaves only the translation between them, which is the error.
  2. MEASURE BY CORRELATION, not by centroid. The arm slides off the edge
     of the canvas as it swings, so the visible area changes by 25% across
     the sequence and any centre-of-mass anchor drifts with it. An FFT
     cross-correlation of the two alpha masks peaks at the true offset
     regardless.
  3. FIT A TREND AND CORRECT TO IT. Accumulating the per-pair offsets gives
     the path the hand's body takes through the sequence. Some of that is
     real (Noah's wrist genuinely travels as he turns it) and some is shake
     between shots. A quadratic can follow the first and cannot follow the
     second, so the correction is "distance from the fitted curve".

     What that finds, and the reason this was worth doing: frames 1-8 and
     10-15 sit within ~15px of the trend, but frame 9 jumps 64px right and
     58px down in a single step — Noah must have moved between those two
     shots. At 60fps that one frame is the visible hitch in the flick.

WHY NOT JUST FLATTEN THE PATH ENTIRELY: correcting every frame onto frame
1 would drag frame 15 by 178px, a seventh of the canvas. The drift is
smooth and monotone, which is what real wrist travel looks like; removing
it would make the turn read as mechanical, and would also swing the arm's
cut edge around inside the crop.

EVERY FRAME IS CROPPED TO THE SAME BOX so the component can place them all
at one rectangle and let the artwork carry the motion. A per-frame crop
would need per-frame geometry in the markup and would reintroduce, as
layout, exactly the misregistration this file removes.
"""

# Each pose's rotation in degrees, read off the guide box Noah drew around it
# in Password Animation Demo/Password Hand Animation-{06..19}.svg. Frame 1 is
# the reference and so is 0 by definition.
POSE_ANGLE = [
    0, -8.12, -14.31, -24.91, -30, -45, -46.84, -54.62,
    -61.96, -68.28, -71.39, -74.56, -77.69, -80.61, -84.88,
]

# Where the demo file puts the 1500x1200 artwork, converted from its 192x108
# viewBox to the site's 1920x1080 artboard: translate(43.01 9.54) scale(.07).
ART_X, ART_Y = 430.1, 95.4
ART_W, ART_H = 1500 * 0.7, 1200 * 0.7  # 0.07 * 10

import json
import os

import numpy as np
from PIL import Image
from psd_tools import PSDImage
from scipy import ndimage as ndi
from scipy.signal import fftconvolve

SRC = "/Users/noahcousineau/Desktop/portfolio/Home and About Animations/Edited/Password Hand"
SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(SITE, "public/assets/home/password-hand")
TS_OUT = os.path.join(SITE, "src/lib/passwordHand.ts")
SCRATCH = "/private/tmp/claude-501/-Users-noahcousineau-Desktop-portfolio-noahcousineau-site/5a92aba5-9f87-47c5-91a0-843e0e91e314/scratchpad/phand"

N = 15
ALPHA_MIN = 16
COARSE = 2      # measure alignment on a half-scale mask; the answer is in
                # whole source pixels either way and it is 4x less work
SEARCH = 50     # +/- this many coarse px, i.e. +/- 100 source px
PAD = 8         # breathing room around the union crop
OUT_W = 1200
# Frame 1 is held on screen for as long as it takes to type a password; the
# other fourteen go past in 250ms, so they can be cheaper.
Q_HELD, Q_FLICK = 88, 74


def load_frames():
    out = []
    for i in range(1, N + 1):
        im = PSDImage.open(os.path.join(SRC, f"PasswordHand{i}.psd")).composite()
        out.append(im.convert("RGBA"))
    return out


def masks(frames, sc):
    return [(np.array(f)[..., 3] > ALPHA_MIN).astype(np.float32)[::sc, ::sc] for f in frames]


def best_shift(a, b):
    """Offset (dx, dy) that, applied to `a`, best overlaps it with `b`."""
    h, w = a.shape
    c = fftconvolve(b, a[::-1, ::-1], mode="same")
    cy, cx = h // 2, w // 2
    win = c[cy - SEARCH:cy + SEARCH + 1, cx - SEARCH:cx + SEARCH + 1]
    k = np.unravel_index(np.argmax(win), win.shape)
    return k[1] - SEARCH, k[0] - SEARCH


def iou(a, b):
    u = np.maximum(a, b).sum()
    return float(np.minimum(a, b).sum() / u) if u else 0.0


def corrections(frames):
    """Per-frame (dx, dy) in source pixels that puts each frame on the trend."""
    m = masks(frames, COARSE)
    path = [np.zeros(2)]
    print("  pair    dtheta   offset(px)    IoU raw -> aligned")
    for i in range(N - 1):
        d = POSE_ANGLE[i + 1] - POSE_ANGLE[i]
        # ndi.rotate turns anticlockwise for positive angles; POSE_ANGLE is
        # screen-space (y down), hence the negation.
        rot = ndi.rotate(m[i], -d, reshape=False, order=1, mode="constant", cval=0)
        dx, dy = best_shift(rot, m[i + 1])
        shifted = np.roll(np.roll(rot, dy, 0), dx, 1)
        print(f"  {i+1:2d}->{i+2:<2d} {d:7.2f}  ({dx*COARSE:5d},{dy*COARSE:5d})   "
              f"{iou(rot, m[i+1]):.3f} -> {iou(shifted, m[i+1]):.3f}")
        path.append(path[-1] + np.array([dx * COARSE, dy * COARSE], float))

    p = np.array(path)
    t = np.arange(N, dtype=float)
    fit = np.stack([np.polyval(np.polyfit(t, p[:, k], 2), t) for k in (0, 1)], 1)
    # The fitted path is returned too: it is where each frame's content ends
    # up once corrected, which is what the wrist cut has to follow. See
    # `wrist_cut`.
    return np.rint(fit - p).astype(int), fit


# --- the wrist -------------------------------------------------------------
#
# 2026-08-24, Noah: "notice how I cropped off my wrist in the sketch/demo.
# Make sure that you crop off the wrist at a consistent point so the wrist/arm
# doesn't grow at all during the animation."
#
# Measuring frame by frame says he is right and says why. The arm's width
# where it meets the bottom of the canvas runs 369, 379, 397, 426, 479, 516
# pixels across the first six poses — it does not grow because he moved, it
# grows because a rotating arm crossing a FIXED horizontal crop line presents
# more of itself to that line as it swings, the same way a pencil laid across
# a ruler covers more of it as you turn the pencil.
#
# So the cut cannot be fixed on the canvas; it has to be fixed on the ARM. It
# is defined once in frame 1's coordinates — a straight line across the wrist,
# perpendicular to the forearm — and then carried through each frame by the
# same rotation and translation the registration already establishes for that
# frame. That is what "a consistent point" means when the thing being cut is
# turning: consistent relative to the wrist, not to the frame.
#
# CUT_FROM_TIP is how far down the arm the cut sits, as a fraction of the
# hand's own height in frame 1, measured from the fingertips. 0.86 leaves the
# heel of the palm and a short stub of wrist and takes the rest.
CUT_FROM_TIP = 0.86
CUT_ANGLE_DEG = 0.0   # the cut is square across the arm in frame 1


def wrist_cut(shape, angle_deg, offset, tip_y, hand_h, centre):
    """Boolean mask of everything to KEEP for one frame.

    `angle_deg` is that frame's pose angle and `offset` the translation the
    registration puts it at, so the line follows the arm rather than the
    canvas. The rotation is about the image centre because that is the axis
    ndi.rotate used when the offsets were measured — a cut rotated about any
    other point would be a different line by the time it reached the edge.
    """
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    # Into the frame-1 reference: undo this frame's translation, then its
    # rotation about the centre.
    xx -= offset[0]
    yy -= offset[1]
    cx, cy = centre
    th = np.deg2rad(angle_deg)
    ct, st = np.cos(th), np.sin(th)
    rx = ct * (xx - cx) + st * (yy - cy) + cx
    ry = -st * (xx - cx) + ct * (yy - cy) + cy
    cut_y = tip_y + CUT_FROM_TIP * hand_h
    a = np.deg2rad(CUT_ANGLE_DEG)
    # Keep everything above the line (in frame-1 space).
    return (ry - cut_y) * np.cos(a) - (rx - cx) * np.sin(a) < 0


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))   # stale exports would ship silently
    os.makedirs(SCRATCH, exist_ok=True)

    print(f"  loading {N} PSDs")
    frames = load_frames()
    corr, trend = corrections(frames)
    print("  correction to trend (px):")
    for i, (dx, dy) in enumerate(corr):
        flag = "  <-- outlier" if max(abs(dx), abs(dy)) > 20 else ""
        print(f"    frame {i+1:2d}  ({dx:4d},{dy:4d}){flag}")

    shifted = []
    for f, (dx, dy) in zip(frames, corr):
        a = np.array(f)
        a = np.roll(np.roll(a, dy, axis=0), dx, axis=1)
        # np.roll wraps; blank whatever came round the far side.
        if dy > 0: a[:dy] = 0
        elif dy < 0: a[dy:] = 0
        if dx > 0: a[:, :dx] = 0
        elif dx < 0: a[:, dx:] = 0
        shifted.append(a)

    # Frame 1's hand, which the cut is defined against.
    m0 = shifted[0][..., 3] > ALPHA_MIN
    ys0, _ = np.where(m0)
    tip_y, hand_h = float(ys0.min()), float(ys0.max() - ys0.min())
    centre = (shifted[0].shape[1] / 2.0, shifted[0].shape[0] / 2.0)
    print(f"  wrist cut at {CUT_FROM_TIP:.2f} of the hand's height below the "
          f"fingertips (y={tip_y + CUT_FROM_TIP * hand_h:.0f} in frame 1)")

    before = [int((a[..., 3] > ALPHA_MIN).sum()) for a in shifted]
    for i, a in enumerate(shifted):
        keep = wrist_cut(a.shape[:2], POSE_ANGLE[i], trend[i] - trend[0],
                         tip_y, hand_h, centre)
        a[~keep] = 0
    after = [int((a[..., 3] > ALPHA_MIN).sum()) for a in shifted]
    print("  arm removed per frame (px): " +
          " ".join(str(b - c) for b, c in zip(before, after)))

    # One crop box for all fifteen, so the component places them identically.
    union = np.zeros(shifted[0].shape[:2], bool)
    for a in shifted:
        union |= a[..., 3] > ALPHA_MIN
    ys, xs = np.where(union)
    H, W = union.shape
    x0, x1 = max(0, xs.min() - PAD), min(W, xs.max() + 1 + PAD)
    y0, y1 = max(0, ys.min() - PAD), min(H, ys.max() + 1 + PAD)
    cw, ch = x1 - x0, y1 - y0
    print(f"  shared crop ({x0},{y0}) {cw}x{ch} of {W}x{H}")

    out_h = round(ch * OUT_W / cw)
    tiles = []
    for i, a in enumerate(shifted, 1):
        pil = Image.fromarray(a[y0:y1, x0:x1], "RGBA").resize((OUT_W, out_h), Image.LANCZOS)
        q = Q_HELD if i == 1 else Q_FLICK
        pil.save(os.path.join(OUT, f"{i}.webp"), format="WEBP", quality=q, method=6)
        tiles.append(pil)

    # The crop box, expressed where the component needs it: 1920x1080 units.
    sx, sy = ART_W / 1500, ART_H / 1200
    box = dict(x=round(ART_X + x0 * sx, 2), y=round(ART_Y + y0 * sy, 2),
               w=round(cw * sx, 2), h=round(ch * sy, 2))
    print(f"  artboard box {box}")

    _sheet(tiles)

    with open(TS_OUT, "w") as f:
        f.write(f"""/**
 * Noah's fifteen password-hand poses, cut from PSDs and registered.
 *
 * GENERATED by tools/password-hand/build_hand.py — do not edit by hand.
 *
 * ALL FIFTEEN SHARE ONE BOX. They were cropped to the union of their own
 * silhouettes after alignment, so drawing every frame at HAND_BOX is what
 * keeps them in register; giving any frame its own rectangle would undo it.
 * The box is in the 1920x1080 artboard units the rest of the site uses, in
 * the position Noah's demo file puts the artwork.
 */

export const HAND_BOX = {json.dumps(box)};

/**
 * Where the UNCROPPED 1500x1200 artwork's top-left sits, same units. The
 * fly-in rotates and scales about this point because that is what Noah's
 * demo does (its transform is on the whole artwork, not on a crop), and the
 * two differ by enough — {round(box["x"] - ART_X)} units — to change the
 * shape of the arc.
 */
export const HAND_ART_ORIGIN = {{ x: {ART_X}, y: {ART_Y} }};

export const HAND_FRAMES: string[] = [
{chr(10).join(f'  "/assets/home/password-hand/{i}.webp",' for i in range(1, N + 1))}
];

/** Natural pixel size of every frame, for next/image. */
export const HAND_PIXELS = {{ width: {OUT_W}, height: {out_h} }};
""")
    kb = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024
    print(f"  {N} frames {OUT_W}x{out_h}, {kb}kB -> {TS_OUT}")


def _sheet(tiles):
    tw, th, cols = 250, 200, 5
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (tw * cols, th * rows), "white")
    for k, t in enumerate(tiles):
        r = t.resize((tw, th), Image.LANCZOS)
        bg = Image.new("RGB", (tw, th), "white")
        bg.paste(r, (0, 0), r)
        sheet.paste(bg, ((k % cols) * tw, (k // cols) * th))
    sheet.save(os.path.join(SCRATCH, "aligned-sheet.png"))

    # Onion skin: every frame stacked faintly. The wrist should read as one
    # thick mark rather than fifteen scattered ones if registration worked.
    acc = np.zeros((tiles[0].height, tiles[0].width), np.float32)
    for t in tiles:
        acc += (np.array(t)[..., 3] > 16)
    acc = (255 - acc / len(tiles) * 255).astype(np.uint8)
    Image.fromarray(acc).save(os.path.join(SCRATCH, "aligned-onion.png"))
    print(f"  sheet + onion skin -> {SCRATCH}")


if __name__ == "__main__":
    main()
