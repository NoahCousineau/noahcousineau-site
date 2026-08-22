"""Build dark-mode turntable frames aligned to the existing light-mode frames.

Why align to light rather than just centring each dark frame: the light
frames were hand-aligned in Photoshop and the site's RotatingHead applies
per-frame x/y/scale corrections calibrated against THEM
(lightModeStaggeredAdjustments). Registering each dark frame onto its light
counterpart means the dark sheet inherits that same calibration, so the
animation doesn't jitter and toggling modes doesn't make the head jump.

Registration scores the silhouette of the SKULL+FACE only (the top ~55% of
the light head). Below that the two sessions genuinely differ - the light
frames were cut at the collar by hand, the dark ones have a black t-shirt -
so that region is not evidence about alignment.

SHIRT REMOVAL is by colour temperature, not luminance or connectivity.
Measured over the raw frames: the black tee has R-B of about 0 (median 0,
90th pct 0 - it is neutral), while his hair is warm brown (median R-B 13-22,
10th pct 7-11) even in shadow. Luminance alone cannot separate them (both
sit under 60) and a connectivity flood from the bottom eats hair wherever it
touches the collar, which showed up as a straight horizontal slice across
the back of the head on the profile and rear frames. R-B separates them
cleanly with no spatial assumptions. The search is still restricted to the
lower half of the frame so the (also dark, also fairly neutral) sunglass
lenses can never be caught by it.
"""
import numpy as np
import cv2
from PIL import Image, ImageOps
from rembg import remove, new_session
import os, json, sys

BASE = '/Users/noahcousineau/Desktop/portfolio/rotating-head-turntable'
OUT = f'{BASE}/02-edited-frames/dark-mode'
W, H = 2400, 3600
DS = 8

SHIRT_LUM = 60      # nothing brighter than this is the tee
SHIRT_WARMTH = 4    # R-B below this is neutral => fabric, not hair
SHIRT_MIN_Y = 0.50  # only look in the lower half: keeps the lenses safe
SHIRT_MIN_AREA = 20000

sess = new_session("u2net")


def light_mask_and_geom(n):
    a = np.array(Image.open(f'{BASE}/02-edited-frames/light-mode/LightMode{n}.png').convert('RGBA'))
    m = a[..., 3] > 60
    ys, xs = np.where(m)
    top, bot = int(ys.min()), int(ys.max())
    jaw = int(top + 0.55 * (bot - top))
    sel = (ys >= top) & (ys <= jaw)
    return m, top, bot, jaw, float(xs[sel].mean())


def dark_rgba(n):
    """Full cut-out pipeline: closed-form matte, shirt removal, exposure
    match to the light shoot, sheen cut and edge tidy. See matte.py."""
    import matte
    return np.array(matte.cutout(f'{BASE}/01-raw-photos/originals/DarkMode{n}.JPG')
                    .resize((W, H), Image.LANCZOS))


def geom(mask, frac=0.55):
    ys, xs = np.where(mask)
    top, bot = int(ys.min()), int(ys.max())
    cut = int(top + frac * (bot - top))
    sel = (ys >= top) & (ys <= cut)
    return top, float(xs[sel].mean())


def register(lm, dm, ltop, ljaw, lcx):
    lsm = cv2.resize(lm.astype(np.uint8), (W // DS, H // DS), interpolation=cv2.INTER_AREA) > 0
    dsm = cv2.resize(dm.astype(np.uint8), (W // DS, H // DS), interpolation=cv2.INTER_AREA) > 0
    region = np.zeros_like(lsm)
    region[ltop // DS:ljaw // DS + 1, :] = True
    target = lsm & region
    btop, bcx = ltop / DS, lcx / DS

    def score(scale, dy, dx):
        sm = cv2.resize(dsm.astype(np.uint8), None, fx=scale, fy=scale,
                        interpolation=cv2.INTER_NEAREST) > 0
        if not sm.any():
            return -1
        t, c = geom(sm)
        oy, ox = int(round(btop - t + dy)), int(round(bcx - c + dx))
        canvas = np.zeros_like(lsm, dtype=bool)
        y0, x0 = max(oy, 0), max(ox, 0)
        y1, x1 = min(oy + sm.shape[0], lsm.shape[0]), min(ox + sm.shape[1], lsm.shape[1])
        if y1 <= y0 or x1 <= x0:
            return -1
        canvas[y0:y1, x0:x1] = sm[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        cand = canvas & region
        u = np.logical_or(cand, target).sum()
        return np.logical_and(cand, target).sum() / u if u else -1

    best = (-1, 0.8, 0, 0)
    for s in np.arange(0.62, 0.97, 0.02):
        for dy in range(-10, 11, 2):
            for dx in range(-10, 11, 2):
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


def process(n, feather=9, band=240):
    lm, ltop, lbot, ljaw, lcx = light_mask_and_geom(n)
    drgba = dark_rgba(n)
    dm = drgba[..., 3] > 60
    iou, scale, dy_ds, dx_ds = register(lm, dm, ltop, ljaw, lcx)

    src = np.array(Image.fromarray(drgba).resize(
        (int(round(W * scale)), int(round(H * scale))), Image.LANCZOS))
    sm = src[..., 3] > 60
    t, c = geom(sm)
    oy = int(round(ltop - t + dy_ds * DS))
    ox = int(round(lcx - c + dx_ds * DS))
    placed = np.zeros((H, W, 4), np.uint8)
    y0, x0 = max(oy, 0), max(ox, 0)
    y1, x1 = min(oy + src.shape[0], H), min(ox + src.shape[1], W)
    placed[y0:y1, x0:x1] = src[y0 - oy:y1 - oy, x0 - ox:x1 - ox]

    # Trim the collar to the light frame's own silhouette so both modes end
    # at the same place; dark keeps its own outline above the jaw.
    soft = np.clip(cv2.GaussianBlur(lm.astype(np.float32), (0, 0), feather) * 1.15, 0, 1)
    allow = np.ones((H, W), np.float32)
    for i, y in enumerate(range(ljaw, min(ljaw + band, H))):
        tt = i / band
        allow[y] = (1 - tt) + tt * soft[y]
    if ljaw + band < H:
        allow[ljaw + band:] = soft[ljaw + band:]
    placed[..., 3] = (placed[..., 3].astype(np.float32) * allow).astype(np.uint8)
    return Image.fromarray(placed), dict(frame=n, iou=round(float(iou), 4),
                                         scale=round(float(scale), 4),
                                         dy=int(dy_ds * DS), dx=int(dx_ds * DS))


def refit_translation(lm, dm, ltop, ljaw, lcx, scale):
    """Translation-only fit at a fixed scale."""
    lsm = cv2.resize(lm.astype(np.uint8), (W // DS, H // DS), interpolation=cv2.INTER_AREA) > 0
    dsm = cv2.resize(dm.astype(np.uint8), (W // DS, H // DS), interpolation=cv2.INTER_AREA) > 0
    region = np.zeros_like(lsm)
    region[ltop // DS:ljaw // DS + 1, :] = True
    target = lsm & region
    btop, bcx = ltop / DS, lcx / DS
    sm = cv2.resize(dsm.astype(np.uint8), None, fx=scale, fy=scale,
                    interpolation=cv2.INTER_NEAREST) > 0
    t, c = geom(sm)
    best = (-1, 0, 0)
    for dy in range(-16, 17):
        for dx in range(-16, 17):
            oy, ox = int(round(btop - t + dy)), int(round(bcx - c + dx))
            canvas = np.zeros_like(lsm, dtype=bool)
            y0, x0 = max(oy, 0), max(ox, 0)
            y1, x1 = min(oy + sm.shape[0], lsm.shape[0]), min(ox + sm.shape[1], lsm.shape[1])
            if y1 <= y0 or x1 <= x0:
                continue
            canvas[y0:y1, x0:x1] = sm[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
            cand = canvas & region
            u = np.logical_or(cand, target).sum()
            v = np.logical_and(cand, target).sum() / u if u else -1
            if v > best[0]:
                best = (v, dy, dx)
    return best


def render(n, cutout, scale, dy, dx, feather=9, band=240):
    lm, ltop, lbot, ljaw, lcx = light_mask_and_geom(n)
    src = np.array(Image.fromarray(cutout).resize(
        (int(round(W * scale)), int(round(H * scale))), Image.LANCZOS))
    sm = src[..., 3] > 60
    t, c = geom(sm)
    oy = int(round(ltop - t + dy))
    ox = int(round(lcx - c + dx))
    placed = np.zeros((H, W, 4), np.uint8)
    y0, x0 = max(oy, 0), max(ox, 0)
    y1, x1 = min(oy + src.shape[0], H), min(ox + src.shape[1], W)
    placed[y0:y1, x0:x1] = src[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    soft = np.clip(cv2.GaussianBlur(lm.astype(np.float32), (0, 0), feather) * 1.15, 0, 1)
    allow = np.ones((H, W), np.float32)
    for i, y in enumerate(range(ljaw, min(ljaw + band, H))):
        tt = i / band
        allow[y] = (1 - tt) + tt * soft[y]
    if ljaw + band < H:
        allow[ljaw + band:] = soft[ljaw + band:]
    placed[..., 3] = (placed[..., 3].astype(np.float32) * allow).astype(np.uint8)
    return Image.fromarray(placed)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    CACHE = '/private/tmp/claude-501/-Users-noahcousineau-Desktop-portfolio-noahcousineau-site/5a92aba5-9f87-47c5-91a0-843e0e91e314/scratchpad/headwork/cutouts'
    os.makedirs(CACHE, exist_ok=True)
    frames = [int(x) for x in sys.argv[1:]] or [n for n in range(1, 33) if n != 28]

    # PASS 1 — cut out, and fit scale+translation per frame.
    scales = {}
    for n in frames:
        cut = dark_rgba(n)
        Image.fromarray(cut).save(f'{CACHE}/{n}.png')
        lm, ltop, lbot, ljaw, lcx = light_mask_and_geom(n)
        iou, s, dy, dx = register(lm, cut[..., 3] > 60, ltop, ljaw, lcx)
        scales[n] = s
        print(f'pass1 frame {n}: iou={iou:.4f} scale={s:.4f}', flush=True)

    # The turntable was shot at a fixed camera distance, so the true scale is
    # constant; per-frame scale estimates vary (0.695-0.79 measured) only
    # because the silhouette itself changes as the head turns. Using them
    # per-frame would pulse the head's size through the loop, so lock the
    # median and re-fit translation only.
    gs = float(np.median(list(scales.values())))
    print(f'GLOBAL SCALE = {gs:.4f} (from {len(scales)} frames)', flush=True)

    rep = []
    for n in frames:
        cut = np.array(Image.open(f'{CACHE}/{n}.png').convert('RGBA'))
        lm, ltop, lbot, ljaw, lcx = light_mask_and_geom(n)
        iou, dy, dx = refit_translation(lm, cut[..., 3] > 60, ltop, ljaw, lcx, gs)
        img = render(n, cut, gs, dy * DS, dx * DS)
        img.save(f'{OUT}/DarkMode{n}.png', optimize=True)
        info = dict(frame=n, iou=round(float(iou), 4), scale=round(gs, 4),
                    dy=int(dy * DS), dx=int(dx * DS))
        rep.append(info)
        print(json.dumps(info), flush=True)
    with open(f'{OUT}/_alignment.json', 'w') as f:
        json.dump(dict(globalScale=gs, frames=rep), f, indent=1)
