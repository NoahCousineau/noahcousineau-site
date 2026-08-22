"""Cut-out pipeline for the dark-mode (flash-off) sunglasses photography.

Noah, 2026-08-21: "we need to do a much better job with separating the head
and hair from the background. Clipping is the big issue... Please also try
to match the exposure on the dark mode head to that of the light mode."

Those turned out to be ONE problem wearing two hats. The pale rim around the
hair is not mostly wall bleed — sampling the raw frames at the hair edge
shows the wall at ~(180,180,180) and the top of his hair carrying a genuine
grey ambient sheen, because the flash was off. So the rim is largely real
hair that is simply mis-exposed and desaturated. An earlier attempt to
delete "bright neutral pixels near the edge" therefore punched holes right
through the hair's own highlights: it was removing hair, not background.

What actually works is three separate, ordered fixes:

1. SOFT EDGE — u2net alone returns a hard binary mask, so wisps are all-in
   or all-out. Closed-form matting over a trimap built from it recovers
   fractional alpha, and estimate_foreground_ml recovers the true foreground
   colour at those partial pixels, undoing the wall's contribution to them.

2. EXPOSURE — a Reinhard transfer fitted from the light-mode frames, over
   WARM pixels only on both sides (R-B > 15, i.e. skin and hair, excluding
   the grey wall and the black tee, which would otherwise drag the fit).
   Measured over 8 matched frames: the dark shoot needs roughly 1.19-1.29x
   per channel. That both lifts the level and restores the contrast and
   saturation the flash would have given, which is what turns the grey
   sheen back into brown hair.

3. SILHOUETTE TIDY — Noah's light-mode clipping is deliberately concise:
   a clean, smooth outline with the flyaway wisps sacrificed. Matching that
   look means pushing partial alpha toward a decision and shaving the last
   sliver off the edge, rather than keeping every semi-transparent hair.
"""
import numpy as np
import cv2
from PIL import Image, ImageOps
from rembg import remove, new_session
from pymatting import estimate_alpha_cf, estimate_foreground_ml
import os

_sess = None
_HERE = os.path.dirname(os.path.abspath(__file__))
_CT = np.load(os.path.join(_HERE, "colour_transfer.npy"))
SCALE, SHIFT = _CT[0], _CT[1]


def session():
    global _sess
    if _sess is None:
        _sess = new_session("u2net")
    return _sess


def load(path):
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def matte(src_img, erode=14, dilate=14):
    """Closed-form alpha plus decontaminated foreground colour."""
    img = np.array(src_img).astype(np.float64) / 255.0
    mask = np.array(remove(src_img, session=session(), only_mask=True, post_process_mask=True))
    k = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n * 2 + 1, n * 2 + 1))
    fg = cv2.erode((mask > 200).astype(np.uint8), k(erode))
    bg = cv2.dilate((mask > 50).astype(np.uint8), k(dilate))
    tri = np.full(mask.shape, 0.5)
    tri[fg > 0] = 1.0
    tri[bg == 0] = 0.0
    alpha = np.clip(estimate_alpha_cf(img, tri), 0, 1)
    F = np.clip(estimate_foreground_ml(img, alpha), 0, 1)
    return F, alpha


def expose(F):
    """Reinhard transfer onto the light shoot's warm-pixel statistics."""
    out = F * 255.0
    for c in range(3):
        out[..., c] = out[..., c] * SCALE[c] + SHIFT[c]
    return np.clip(out / 255.0, 0, 1)


def desheen(F, strength=1.0):
    """Turn the flash-off grey sheen on the hair back into hair colour.

    Raising the exposure fixes the body of the hair but makes this worse: the
    ambient sheen along the top of the head is NEUTRAL, so lifting it just
    drives it from grey toward white, leaving a bright rim that still reads
    as background. The fix has to be colour, not alpha — deleting these
    pixels is what punched holes through the hair last time. So anything
    bright AND neutral gets pulled down and warmed toward hair tone, by an
    amount that fades out as the pixel gets warmer or darker. Skin is warm
    and the lenses are dark, so both are left alone.
    """
    rgb = F * 255.0
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    warmth = rgb[..., 0] - rgb[..., 2]
    neutral = np.clip((26.0 - warmth) / 26.0, 0, 1)      # 0 once clearly warm
    bright = np.clip((lum - 105.0) / 85.0, 0, 1)          # 0 for midtones down
    w = (neutral * bright * strength)[..., None]
    warm_target = F * np.array([0.92, 0.74, 0.58])        # darker, warmer
    return np.clip(F * (1 - w) + warm_target * w, 0, 1)


def cut_boundary_sheen(F, alpha, lum_min=150.0, warmth_max=20.0, min_area=400):
    """Cut the blown, textureless sheen band that rims the top of the hair.

    Along the very top of the head the ambient sheen is not just desaturated,
    it is blown flat — no strand texture survives there, so no amount of
    recolouring makes it read as hair; it has to come off. The trap is that
    the same brightness test also hits the hair's own interior highlights,
    and deleting those is what riddled an earlier attempt with holes.

    The discriminator is CONNECTIVITY, not colour: the unrecoverable band is
    the sheen that reaches the silhouette's edge, whereas a highlight sitting
    inside the hair is enclosed by real hair on every side. So the bright,
    neutral pixels are grouped into components and only the ones touching the
    boundary are removed. Interior highlights are untouched by construction.
    """
    rgb = F * 255.0
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    warmth = rgb[..., 0] - rgb[..., 2]
    solid = alpha > 0.5
    sheen = (solid & (lum > lum_min) & (warmth < warmth_max)).astype(np.uint8)
    if not sheen.any():
        return alpha
    # "Touching the boundary" = adjacent to anything that isn't solid.
    outside = cv2.dilate((~solid).astype(np.uint8),
                         cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(sheen, 8)
    kill = np.zeros_like(sheen, bool)
    for i in range(1, n):
        comp = lab == i
        if stats[i, cv2.CC_STAT_AREA] < min_area:
            continue
        if (comp & (outside > 0)).any():
            kill |= comp
    if not kill.any():
        return alpha
    k = cv2.GaussianBlur(kill.astype(np.float32), (0, 0), 2.0)
    return np.clip(alpha * (1.0 - np.clip(k * 1.35, 0, 1)), 0, 1)


def tame_blowouts(F, alpha, lum_hot=212.0, ring_dark=130.0, grow=14, min_area=250):
    """Pull the blown highlights on top of the hair down to hair tone.

    Where the ambient caught the top of his head the highlight is clipped —
    measured on the rear frames, those pixels average (250,213,208) against a
    hair body whose 99th percentile is 208 — and after the exposure transfer
    they come out cream rather than grey, which is why the neutral-seeking
    `desheen` walks straight past them.

    They can't be handled by a global highlight rolloff either: skin lives at
    a similar level, so anything strong enough to fix the hair flattens every
    face in the set. What separates them is their SURROUNDINGS. A blown patch
    on the hair is ringed by hair at lum < 130; a genuine specular highlight
    on the nose or forehead is ringed by skin at 140-190. So each blown patch
    is measured against the ring of pixels just outside it, and only the ones
    sitting in hair get pulled down — toward that ring's own colour, so the
    repair matches the hair it interrupts instead of inventing a tone.
    """
    rgb = F * 255.0
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    opaque = alpha > 0.5
    hot = (opaque & (lum > lum_hot)).astype(np.uint8)
    if not hot.any():
        return F
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow * 2 + 1,) * 2)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(hot, 8)
    out = F.copy()
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < min_area:
            continue
        comp = (lab == i)
        ring = (cv2.dilate(comp.astype(np.uint8), k) > 0) & ~comp & opaque
        if ring.sum() < 200:
            continue
        ring_lum = float(np.median(lum[ring]))
        if ring_lum >= ring_dark:
            continue                       # sitting in skin - a real highlight
        target = np.median(rgb[ring], axis=0) / 255.0
        soft = cv2.GaussianBlur(comp.astype(np.float32), (0, 0), 3.0)[..., None]
        # Not a flat fill: keep some of the patch's own modulation so it reads
        # as lit hair rather than a painted blob.
        repl = target[None, None, :] * 0.82 + out * 0.18
        out = out * (1 - soft) + repl * soft
    return np.clip(out, 0, 1)


def smooth_silhouette(alpha, sigma=7.0, shrink=0.54, feather=1.6):
    """Round the outline into a clean clipping path.

    The rear-facing frames are almost entirely hair, so a per-pixel decision
    at the edge has nothing stable to key on: `cut_boundary_sheen` there both
    left cream-coloured patches behind AND bit chunks out of the silhouette,
    giving a ragged outline nothing like the light frames'. Noah's own
    clipping is smooth — a drawn path that ignores individual wisps — so the
    way to match it is to smooth the CONTOUR rather than to keep judging
    pixels.

    Blurring the mask and re-thresholding does that symmetrically: bumps and
    notches of a similar scale to `sigma` both disappear, so the result is a
    clean closed curve. Thresholding slightly above 0.5 pulls it a touch
    inside the wall-contaminated fringe at the same time.
    """
    m = (alpha > 0.5).astype(np.float32)
    m = cv2.GaussianBlur(m, (0, 0), sigma)
    m = (m > shrink).astype(np.float32)
    # keep only the largest island - drops the stray specks matting leaves
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    if n > 1:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        m = (lab == keep).astype(np.float32)
    return np.clip(cv2.GaussianBlur(m, (0, 0), feather), 0, 1)


def tidy(alpha, lo=0.30, hi=0.75, shave=1.5):
    """Firm the edge up into a concise outline, the way the light frames are cut.

    Remapping alpha through [lo,hi] collapses the wide, fuzzy transition the
    matte produces into a short one, so the outline reads as a decided edge
    instead of a haze; `shave` then pulls it in by about a pixel so the last
    wall-contaminated sliver is outside the cut.
    """
    a = np.clip((alpha - lo) / (hi - lo), 0, 1)
    if shave > 0:
        a = cv2.erode(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
                      iterations=1) * 0.5 + a * 0.5
        a = cv2.GaussianBlur(a, (0, 0), shave * 0.5)
        a = np.clip((a - 0.12) / 0.88, 0, 1)
    return a


def remove_shirt(F, alpha, lum_max=60.0, warmth_max=4.0, min_y=0.50, min_area=20000):
    """Drop the black t-shirt. MUST run on un-exposed colour.

    The test is colour temperature: the tee is neutral (R-B about 0) while
    his hair is warm brown (R-B 13-22) even in shadow, so luminance alone
    cannot separate them. But the exposure transfer scales the channels
    unequally (R x1.19, B x1.27 plus offsets), which pushes even a pure black
    tee to a warmth of ~12 and would defeat the test entirely. Hence this
    runs before `expose`, on the original colours it was calibrated against.
    """
    rgb = F * 255.0
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    warmth = rgb[..., 0] - rgb[..., 2]
    h = alpha.shape[0]
    rows = np.arange(h)[:, None]
    cand = ((alpha > 0.25) & (lum < lum_max) & (warmth < warmth_max)
            & (rows > h * min_y)).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(cand, 8)
    shirt = np.zeros(cand.shape, bool)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            shirt |= (lab == i)
    if not shirt.any():
        return alpha
    shirt = cv2.morphologyEx(shirt.astype(np.uint8), cv2.MORPH_CLOSE,
                             np.ones((9, 9), np.uint8)).astype(bool)
    s = cv2.GaussianBlur(shirt.astype(np.float32), (0, 0), 2.0)
    return np.clip(alpha * (1.0 - np.clip(s * 1.5, 0, 1)), 0, 1)


def cutout(path, erode=14, dilate=14, do_expose=True, sheen=1.15, smooth=7.0,
           shirt=True, blowouts=True, cut_sheen=True):
    """matte -> drop shirt -> match exposure -> de-sheen -> smooth outline.

    `cut_boundary_sheen` is deliberately NOT in this chain any more. It works
    on the face-on frames but falls apart on the rear ones, where the whole
    top of the head is hair and there is no stable edge signal: it left cream
    patches in some places and bit chunks out in others. Recolouring the
    sheen (which cannot punch holes) plus a smoothed outline handles both
    cases, and matches how the light frames are cut.
    """
    src = load(path)
    F, alpha = matte(src, erode, dilate)
    if shirt:
        alpha = remove_shirt(F, alpha)   # before expose - see note above
    if do_expose:
        F = expose(F)
    if cut_sheen:
        alpha = cut_boundary_sheen(F, alpha)
    if sheen:
        F = desheen(F, sheen)
    if blowouts:
        F = tame_blowouts(F, alpha)
    if smooth:
        alpha = smooth_silhouette(alpha, sigma=smooth)
    return Image.fromarray(np.dstack([F * 255, alpha * 255]).astype(np.uint8))
