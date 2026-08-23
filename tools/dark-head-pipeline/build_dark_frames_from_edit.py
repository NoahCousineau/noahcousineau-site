"""Register Noah's OWN dark-mode cut-outs onto the light turntable frames.

2026-08-22, Noah: "I also took the time to manually edit the images used for
the dark mode head. I'm sharing a folder that has the darkmode silhouetted
and color corrected heads."

That retires everything build_dark_frames.py did to MAKE a cut-out — the
closed-form matting, the R-B shirt test, the Reinhard exposure transfer, the
blown-sheen repair. All of it existed to approximate by machine what he has
now done by hand, and his edges and grade are better. matte.py and
build_dark_frames.py are kept for the record, not run.

What still has to happen is REGISTRATION, and for the same reason as before:
the light frames were hand-aligned in Photoshop and RotatingHead's per-frame
corrections (lightModeStaggeredAdjustments) are calibrated against them, so
a dark frame that merely sits centred in its cell would make the head jump
when the theme is toggled. Each of his crops is tight to its own silhouette
and a different pixel size, so each has to be put back into the shared
2400x3600 frame in the place its light counterpart occupies.

Scoring is over the SKULL ONLY (light top down to 55% of the head's height).
Below that the two shoots genuinely differ - the light frames were cut at the
collar, his dark crops end at a shorter neck - so that region is not evidence
about alignment. Scale is locked to the median across all frames and only
translation is fitted per frame: the turntable was shot at a fixed camera
distance and his crops don't rescale, so a per-frame scale would only pulse
the head's size through the loop.
"""
import os
import sys
import json

import numpy as np
import cv2
from PIL import Image
from psd_tools import PSDImage

BASE = '/Users/noahcousineau/Desktop/portfolio/rotating-head-turntable'
EDIT = f'{BASE}/02-edited-frames/dark-mode_NoahEdit'
OUT = f'{BASE}/02-edited-frames/dark-mode-noah'
W, H = 2400, 3600
DS = 8
# Frame 28 is missing from the light set, and the two must stay index-aligned
# because the sheet is addressed by index. He edited a 28; it goes unused.
FRAMES = [n for n in range(1, 33) if n != 28]


def light_geom(n):
    a = np.array(Image.open(f'{BASE}/02-edited-frames/light-mode/LightMode{n}.png').convert('RGBA'))
    m = a[..., 3] > 60
    ys, xs = np.where(m)
    top, bot = int(ys.min()), int(ys.max())
    jaw = int(top + 0.55 * (bot - top))
    sel = (ys >= top) & (ys <= jaw)
    return m, top, bot, jaw, float(xs[sel].mean())


def dark_rgba(n):
    """Noah's edit, flattened. Cached as PNG — psd_tools is slow."""
    cache = f'{EDIT}/.flattened'
    os.makedirs(cache, exist_ok=True)
    src = f'{EDIT}/DarkMode{n}.psd'
    dst = f'{cache}/DarkMode{n}.png'
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
        PSDImage.open(src).composite().convert('RGBA').save(dst)
    return np.array(Image.open(dst).convert('RGBA'))


def skull_ref(mask, frac=0.55):
    """(top row, centroid x of the top `frac` of the shape)."""
    ys, xs = np.where(mask)
    top, bot = int(ys.min()), int(ys.max())
    cut = int(top + frac * (bot - top))
    sel = (ys >= top) & (ys <= cut)
    return top, float(xs[sel].mean())


def _place(dsm, scale, btop, bcx, dy, dx, shape):
    sm = cv2.resize(dsm.astype(np.uint8), None, fx=scale, fy=scale,
                    interpolation=cv2.INTER_NEAREST) > 0
    if not sm.any():
        return None
    t, c = skull_ref(sm)
    oy, ox = int(round(btop - t + dy)), int(round(bcx - c + dx))
    canvas = np.zeros(shape, bool)
    y0, x0 = max(oy, 0), max(ox, 0)
    y1, x1 = min(oy + sm.shape[0], shape[0]), min(ox + sm.shape[1], shape[1])
    if y1 <= y0 or x1 <= x0:
        return None
    canvas[y0:y1, x0:x1] = sm[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return canvas


def fit(lm, dark_mask, ltop, ljaw, lcx, scales, shifts):
    """IoU-best (scale, dy, dx) over the skull region, at 1/DS resolution."""
    lsm = cv2.resize(lm.astype(np.uint8), (W // DS, H // DS), interpolation=cv2.INTER_AREA) > 0
    dsm = cv2.resize(dark_mask.astype(np.uint8), None, fx=1 / DS, fy=1 / DS,
                     interpolation=cv2.INTER_AREA) > 0
    region = np.zeros_like(lsm)
    region[ltop // DS:ljaw // DS + 1, :] = True
    target = lsm & region
    btop, bcx = ltop / DS, lcx / DS

    def score(s, dy, dx):
        canvas = _place(dsm, s, btop, bcx, dy, dx, lsm.shape)
        if canvas is None:
            return -1.0
        cand = canvas & region
        u = np.logical_or(cand, target).sum()
        return np.logical_and(cand, target).sum() / u if u else -1.0

    best = (-1.0, 1.0, 0, 0)
    for s in scales:
        for dy in shifts:
            for dx in shifts:
                v = score(s, dy, dx)
                if v > best[0]:
                    best = (v, s, dy, dx)
    _, s0, dy0, dx0 = best
    for s in np.arange(s0 - 0.02, s0 + 0.021, 0.005):
        for dy in range(dy0 - 2, dy0 + 3):
            for dx in range(dx0 - 2, dx0 + 3):
                v = score(s, dy, dx)
                if v > best[0]:
                    best = (v, s, dy, dx)
    return best


def render(rgba, ltop, lcx, scale, dy, dx):
    """Full-resolution placement with the fitted transform."""
    h, w = rgba.shape[:2]
    src = np.array(Image.fromarray(rgba).resize(
        (max(1, int(round(w * scale))), max(1, int(round(h * scale)))), Image.LANCZOS))
    t, c = skull_ref(src[..., 3] > 60)
    oy, ox = int(round(ltop - t + dy)), int(round(lcx - c + dx))
    placed = np.zeros((H, W, 4), np.uint8)
    y0, x0 = max(oy, 0), max(ox, 0)
    y1, x1 = min(oy + src.shape[0], H), min(ox + src.shape[1], W)
    placed[y0:y1, x0:x1] = src[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return Image.fromarray(placed)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    frames = [int(x) for x in sys.argv[1:]] or FRAMES

    # PASS 1 — scale per frame, to take a median from.
    coarse = np.arange(0.90, 1.26, 0.02)
    est = {}
    for n in frames:
        lm, ltop, lbot, ljaw, lcx = light_geom(n)
        iou, s, dy, dx = fit(lm, dark_rgba(n)[..., 3] > 60, ltop, ljaw, lcx,
                             coarse, range(-12, 13, 2))
        est[n] = s
        print(f'pass1 frame {n}: iou={iou:.4f} scale={s:.4f}', flush=True)

    gs = float(np.median(list(est.values())))
    print(f'GLOBAL SCALE = {gs:.4f} (spread {min(est.values()):.3f}-{max(est.values()):.3f})',
          flush=True)

    # PASS 2 — translation only, at the locked scale.
    rep = []
    for n in frames:
        lm, ltop, lbot, ljaw, lcx = light_geom(n)
        rgba = dark_rgba(n)
        iou, _, dy, dx = fit(lm, rgba[..., 3] > 60, ltop, ljaw, lcx, [gs], range(-20, 21))
        img = render(rgba, ltop, lcx, gs, dy * DS, dx * DS)
        img.save(f'{OUT}/DarkMode{n}.png', optimize=True)
        a = np.array(img)[..., 3] > 60
        ys, _ = np.where(a)
        info = dict(frame=n, iou=round(float(iou), 4), dy=int(dy * DS), dx=int(dx * DS),
                    top=int(ys.min()), bottom=int(ys.max()), lightBottom=int(lbot))
        rep.append(info)
        print(json.dumps(info), flush=True)
    with open(f'{OUT}/_alignment.json', 'w') as f:
        json.dump(dict(globalScale=gs, frames=rep), f, indent=1)
