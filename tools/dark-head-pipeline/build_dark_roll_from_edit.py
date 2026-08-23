"""Build the dark-mode ROLLING head from Noah's own cut-out.

2026-08-22: "I also included a version of the head to use for the eye
tracking in dark mode. I removed the eyes from this." — that is
01-raw-photos/DarkModeNoEyes.psd, a hand-silhouetted, colour-corrected head
with the two eye shapes cut clean through the sunglass lenses.

This replaces build_dark_roll.py, which had to matte the head out of a raw
JPEG, find the lenses as dark blobs and then FADE a socket into each one at
a guessed size and position. None of that is needed now: the sockets are
where Noah put them, so they are simply MEASURED here rather than invented.

Two things are still done to the file:

NECK — the same superellipse cap as the light head, at the narrowest row
below the chin. His export runs the neck off the bottom of the frame; the
ragdoll needs a closed shape to roll on, and the two heads have to match:
"I like how the neck is treated in dark mode. Please apply the same cropping
to the light mode head."

EYES — the pupil artwork is re-tinted for a lens that is now GONE. The old
dark pupils were pushed hard (contrast 1.55, gain .82/.44/.41) to survive
being seen through a lens left at 90% opacity; through an open hole that
same artwork reads as two black smudges. The tint now has to BE the lens
rather than compensate for one, so it is sampled from the real lens right
around each socket and applied gently.
"""
import os
import json

import numpy as np
from PIL import Image
from psd_tools import PSDImage

SRC = '/Users/noahcousineau/Desktop/portfolio/rotating-head-turntable/01-raw-photos/DarkModeNoEyes.psd'
SITE = '/Users/noahcousineau/Desktop/portfolio/noahcousineau-site'
EYE_DIR = f'{SITE}/public/assets/about'
TARGET_W = 1227  # same rendered width as the light head

# CACHE-BUSTED BY FILENAME, not by query string (2026-08-22) — a `?v=`
# attempt 500'd every other image on the site, see the note on this constant
# in src/lib/headAssets.ts. Bump this and headAssets.ts's HEAD_DARK.src /
# srcLeft / srcRight together whenever this script runs again for real.
VERSION = 2
DST = f'{SITE}/public/assets/about/head-dark.v{VERSION}.png'

# How far the pupil is pulled toward the lens colour, 0 = untouched.
EYE_TINT_MIX = 0.55
EYE_TINT_CONTRAST = 1.15
# The rendered pupil is a little larger than the hole so its edge is always
# covered — the ratio the original hand-tuned constants used.
PUPIL_OVERSIZE = 1.145


def sockets(alpha, x0, x1, y0, y1):
    """The transparent holes Noah cut, as connected components.

    Only holes strictly INSIDE the silhouette count, so the transparent
    background can never be mistaken for one: the search is seeded from the
    background and everything it reaches is excluded.
    """
    import cv2
    hole = (alpha < 128).astype(np.uint8)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(hole, 8)
    outside = set(lab[y, x] for y in (0, alpha.shape[0] - 1) for x in range(0, alpha.shape[1], 8))
    cand = [i for i in range(1, n)
            if i not in outside and stats[i, cv2.CC_STAT_AREA] > 500
            and y0 < cent[i][1] < y0 + 0.75 * (y1 - y0)]
    cand.sort(key=lambda i: -stats[i, cv2.CC_STAT_AREA])
    if len(cand) < 2:
        raise RuntimeError(f'expected 2 eye holes, found {len(cand)}')
    pair = sorted(cand[:2], key=lambda i: cent[i][0])
    return [dict(cx=float(cent[i][0]), cy=float(cent[i][1]),
                 w=int(stats[i, cv2.CC_STAT_WIDTH]), h=int(stats[i, cv2.CC_STAT_HEIGHT]),
                 left=int(stats[i, cv2.CC_STAT_LEFT]), top=int(stats[i, cv2.CC_STAT_TOP]))
            for i in pair]


def lens_colour(rgb, alpha, s):
    """Median colour of the lens in a ring just outside one socket."""
    yy, xx = np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]]
    r = ((xx - s['cx']) / (s['w'] / 2)) ** 2 + ((yy - s['cy']) / (s['h'] / 2)) ** 2
    ring = (r > 1.25) & (r < 2.6) & (alpha > 200)
    return np.median(rgb[ring], axis=0)


def cap_neck(alpha, y0, y1):
    """Close the neck with the light head's superellipse, at the waist."""
    op = alpha > 40
    H, W = alpha.shape
    w = op.sum(1)
    lo, hi = int(y0 + 0.62 * (y1 - y0)), int(y0 + 0.92 * (y1 - y0))
    waist = lo + int(np.argmin(w[lo:hi]))
    B = int((y1 - y0) * 0.115)
    idx = np.where(op[waist])[0]
    cx = (idx.min() + idx.max()) / 2.0
    hw0 = (idx.max() - idx.min()) / 2.0
    yy, xx = np.mgrid[0:H, 0:W]
    t = np.clip((yy - waist) / B, 0, None)
    allowed = hw0 * np.clip(1 - t ** 3.0, 0, 1) ** (1 / 3.0)
    fade = np.clip(0.5 - (np.abs(xx - cx) - allowed) / 1.5, 0, 1)
    factor = np.where(yy < waist, 1.0, fade)
    factor = np.where(yy >= waist + B, 0.0, factor)
    return alpha * factor, waist


def build_dark_eyes(tint):
    for side in ('left', 'right'):
        a = np.array(Image.open(f'{EYE_DIR}/eye-{side}.png').convert('RGBA')).astype(np.float32)
        rgb = a[..., :3] / 255.0
        rgb = np.clip((rgb - 0.5) * EYE_TINT_CONTRAST + 0.5, 0, 1)
        rgb = rgb * (1 - EYE_TINT_MIX) + rgb * (tint / 255.0) * EYE_TINT_MIX * 2.0
        a[..., :3] = np.clip(rgb, 0, 1) * 255
        Image.fromarray(a.astype(np.uint8)).save(f'{EYE_DIR}/eye-{side}-dark.v{VERSION}.png', optimize=True)


def main():
    im = PSDImage.open(SRC).composite().convert('RGBA')
    a = np.array(im).astype(np.float32)
    alpha = a[..., 3]
    ys, xs = np.where(alpha > 40)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())

    eyes = sockets(alpha, x0, x1, y0, y1)
    tint = np.mean([lens_colour(a[..., :3], alpha, s) for s in eyes], axis=0)
    build_dark_eyes(tint)

    alpha, waist = cap_neck(alpha, y0, y1)
    a[..., 3] = alpha
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

    arr = np.array(out)
    ys, xs = np.where(arr[..., 3] > 40)
    bx0, bx1, by0, by1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    crop = out.crop((bx0, by0, bx1 + 1, by1 + 1))
    cw, ch = crop.size
    crop = crop.resize((TARGET_W, int(round(ch * TARGET_W / cw))), Image.LANCZOS)
    crop.save(DST, optimize=True)

    bw, bh = bx1 - bx0 + 1, by1 - by0 + 1
    print(json.dumps({
        'size': list(crop.size),
        'aspect': f'{crop.size[0]}/{crop.size[1]}',
        'aspectVal': round(crop.size[0] / crop.size[1], 4),
        'waistRow': waist,
        'lensTint': [int(round(v)) for v in tint],
        'lensHex': '#%02x%02x%02x' % tuple(int(round(v)) for v in tint),
        'eyes': [{'x': round((s['cx'] - bx0) / bw, 4),
                  'y': round((s['cy'] - by0) / bh, 4),
                  'widthPct': round(s['w'] / bw * 100 * PUPIL_OVERSIZE, 2),
                  'holePx': [s['w'], s['h']]} for s in eyes],
        'mb': round(os.path.getsize(DST) / 1e6, 2),
    }, indent=1))


if __name__ == '__main__':
    main()
