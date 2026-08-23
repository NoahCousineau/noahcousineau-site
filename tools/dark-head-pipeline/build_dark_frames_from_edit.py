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

2026-08-23, Noah: "my photoshop work was better, but not perfect... I noticed
that my hair can cause some issues and there's a little bit of white or gray
background where my hair gets thin." His mask is otherwise right — this is
DEFRINGE, not re-cutting. A soft-edged hand-cut mask like his leaves colour
contamination in the thin/semi-transparent strands: those pixels were shot
against his real backdrop, so their stored RGB is already a blend of hair and
background, and simple alpha masking never removes that. Photoshop's own
Defringe/Decontaminate tools solve exactly this — `estimate_foreground_ml`
(pymatting) is the same idea: given the observed colour and his alpha, it
solves for the pure foreground colour the alpha implies. His shape is left
untouched; only colour moves, only within a band close to the edge (a
dilation of wherever alpha is already partial) — never in the solid interior,
where the SAME colour rule mis-fired once in testing and left a brown smudge
on a lit patch of cheek. See `defringe()`.

Noah also flagged one extra frame: "there's a few frames where I'm looking
forward... because there's an additional frame, it feels like the rotation
gets stuck." Measured (mean abs colour diff, face band, frame-to-frame) the
step sizes around the wrap are 30->31: 48.8, 31->32: 34.1, 32->1: 38.6,
1->2: 48.2 — an uneven little stutter, both real steps smaller than the
~40-50 typical elsewhere in the loop. Dropping ORIGINAL PHOTO 32 alone (not
adjacent frames — it's genuinely the odd one out, closest to both of its
neighbours) turns that into 30->31: 48.8, 31->1: 41.6, 1->2: 48.2, back in
line with the rest of the loop. Handled entirely by leaving 32 out of
FRAMES; nothing else moves, so `lightModeStaggeredAdjustments` still applies
to dark position-for-position for every frame that survives (see
RotatingHead.tsx for how the two variants' now-different frame counts are
kept independent).
"""
import os
import sys
import json

import numpy as np
import cv2
from PIL import Image
from psd_tools import PSDImage
from pymatting import estimate_foreground_ml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imgutil import premultiplied_resize  # noqa: E402

BASE = '/Users/noahcousineau/Desktop/portfolio/rotating-head-turntable'
EDIT = f'{BASE}/02-edited-frames/dark-mode_NoahEdit'
OUT = f'{BASE}/02-edited-frames/dark-mode-noah'
W, H = 2400, 3600
DS = 8
# Frame 28 is missing from the light set, and the two must stay index-aligned
# because the sheet is addressed by index. He edited a 28; it goes unused.
# Frame 32 is the near-duplicate "stuck looking forward" frame — see the
# module docstring — and is dropped from the DARK sequence only; the light
# sequence is untouched and keeps all 31.
FRAMES = [n for n in range(1, 33) if n not in (28, 32)]


def light_geom(n):
    a = np.array(Image.open(f'{BASE}/02-edited-frames/light-mode/LightMode{n}.png').convert('RGBA'))
    m = a[..., 3] > 60
    ys, xs = np.where(m)
    top, bot = int(ys.min()), int(ys.max())
    jaw = int(top + 0.55 * (bot - top))
    sel = (ys >= top) & (ys <= jaw)
    return m, top, bot, jaw, float(xs[sel].mean())


def defringe(rgba, lo=70.0, hi=170.0, target=(0.85, 0.62, 0.46), band_px=21):
    """Pull the background out of a cutout's semi-transparent hair edge.

    `estimate_foreground_ml` wants the OBSERVED colour (already what a flat
    composite gives us, since there's nothing behind a cutout to have
    blended it further) plus its own alpha, and solves for the true
    foreground colour implied by that alpha — this is what recovers hair
    colour instead of the pale/grey the backdrop left behind. It helps, but
    on its own leaves the fringe still noticeably washed out (2026-08-23,
    Noah: "let's see if we can just refine further").

    Round two adds a recolour pass, restricted to a band around wherever
    alpha is already partial — that boundary restriction is what makes this
    safe to run at all: tried unrestricted once, on a different colour rule
    (desheen's neutral+bright pull), and it caught a lit, slightly-neutral
    patch of cheek in the solid interior and left a visible brown smudge on
    skin. The band can never reach that — it is bounded by distance from an
    actual alpha edge, and a cheek's interior is nowhere near one.

    THE RECOLOUR RULE ITSELF is brightness only, not desheen's neutral+bright
    (round one used that and it barely moved the fringe). Measured directly
    in the worst patch: after decontamination the fringe pixels average R-B
    warmth of ~30, comfortably past desheen's neutral cutoff of 26 — they
    read as "already warm enough" and desheen leaves them alone, even though
    at luminance 105-117 they are still a washed-out light brown, not hair.
    Being IN THE BAND already stands in for the warmth test (nothing back
    there is skin), so brightness alone can drive the pull.

    BAND WIDENED 9px -> 21px (round three, 2026-08-23 — Noah: "There's still
    some issues with the hair on the front of my head... when my head is
    slightly off angle but still looking forward"). Measured on exactly that
    kind of frame: a stray forehead wisp's alpha ran through a wide,
    genuinely gradual 0.2-0.8 transition (not a hard edge) over roughly 80px,
    all of which already satisfies the "partial" test outright — dilation
    was never the limiting factor there, so 9px simply wasn't generous
    enough to also catch the fully-opaque-but-still-pale pixels riding just
    inside that wide a transition. Re-checked at 21px directly against skin
    (the forehead sits a few px from this exact band on an off-angle frame)
    with no smudging, so the wider radius costs nothing there.
    """
    rgb = rgba[..., :3].astype(np.float64) / 255.0
    alpha = rgba[..., 3].astype(np.float64) / 255.0
    F = np.clip(estimate_foreground_ml(rgb, alpha), 0, 1)

    partial = ((alpha > 0.02) & (alpha < 0.98)).astype(np.uint8)
    band = cv2.dilate(partial, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (band_px, band_px))) > 0

    Frgb = F * 255.0
    lum = 0.299 * Frgb[..., 0] + 0.587 * Frgb[..., 1] + 0.114 * Frgb[..., 2]
    pull = np.clip((lum - lo) / (hi - lo), 0, 1)
    w = (pull * band)[..., None]
    warm_target = F * np.array(target)
    F_out = np.clip(F * (1 - w) + warm_target * w, 0, 1)

    out = np.dstack([F_out, alpha])
    return np.clip(out * 255, 0, 255).astype(np.uint8)


def dark_rgba(n):
    """Noah's edit, flattened and defringed. Cached — both steps are slow."""
    cache = f'{EDIT}/.flattened'
    os.makedirs(cache, exist_ok=True)
    src = f'{EDIT}/DarkMode{n}.psd'
    flat = f'{cache}/DarkMode{n}.png'
    if not os.path.exists(flat) or os.path.getmtime(flat) < os.path.getmtime(src):
        PSDImage.open(src).composite().convert('RGBA').save(flat)

    fringed = f'{cache}/DarkMode{n}.defringed.png'
    if not os.path.exists(fringed) or os.path.getmtime(fringed) < os.path.getmtime(flat):
        raw = np.array(Image.open(flat).convert('RGBA'))
        Image.fromarray(defringe(raw)).save(fringed)
    return np.array(Image.open(fringed).convert('RGBA'))


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
    """Full-resolution placement with the fitted transform.

    Resized with premultiplied alpha (imgutil.premultiplied_resize) — a
    plain PIL resize blends each transparent pixel's leftover, meaningless
    RGB into its opaque neighbours, which repaints a soft halo along the
    whole edge regardless of how clean defringe() left the colour underneath
    it. See imgutil.py.
    """
    h, w = rgba.shape[:2]
    src = premultiplied_resize(
        rgba, (max(1, int(round(w * scale))), max(1, int(round(h * scale)))))
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
