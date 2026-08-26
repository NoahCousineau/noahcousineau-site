"""Resizing a cutout without dragging garbage colour out of its own shadow.

2026-08-23: after fixing the fringe's actual colour (see defringe() in
build_dark_frames_from_edit.py), Noah could still see a faint pale halo and
asked to refine further. Traced it to something upstream of that fix
entirely — resizing. PIL resizes RGB and alpha as independent channels, so a
FULLY TRANSPARENT pixel's stored RGB is never supposed to matter and often
isn't cleaned up: measured on a defringed frame, pixels at alpha=0 average
RGB (149,106,86) — a pale skin/background tone nobody chose, just whatever
was sitting there when the layer was masked. LANCZOS then blends that
"invisible" colour into its opaque neighbours anyway when it computes a
resized pixel near the edge, which repaints a soft halo that has nothing to
do with the cutout's actual colour — it reappears at EVERY resize
(registration's ~1.06x scale, then the sprite sheet's ~0.4x downsample),
compounding each time.

The fix is the standard one: premultiply RGB by alpha before resizing (so a
fully transparent pixel is genuinely (0,0,0,0), and a half-transparent one
contributes only half its colour), resize that and the alpha separately,
then divide back out. A transparent pixel can no longer bleed a colour into
the average because premultiplied, it doesn't have one.
"""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def premultiplied_resize(rgba: np.ndarray, size, resample=Image.LANCZOS) -> np.ndarray:
    """Resize an (H, W, 4) uint8 array to `size` (W, H) without edge haloing."""
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3].astype(np.float32)
    premul = rgb * (alpha[..., None] / 255.0)

    premul_img = Image.fromarray(np.clip(premul, 0, 255).astype(np.uint8), "RGB")
    alpha_img = Image.fromarray(rgba[..., 3], "L")

    premul_r = np.array(premul_img.resize(size, resample)).astype(np.float32)
    alpha_r = np.array(alpha_img.resize(size, resample)).astype(np.float32)

    safe = np.maximum(alpha_r, 1.0)
    rgb_r = premul_r / (safe[..., None] / 255.0)
    rgb_r = np.clip(rgb_r, 0, 255)

    out = np.dstack([rgb_r, alpha_r]).astype(np.uint8)
    return out


BLEED_BELOW = 8


def bleed_edges(rgba: np.ndarray, alpha_min: int = BLEED_BELOW) -> np.ndarray:
    """Give invisible pixels a plausible colour, so later filtering can't
    pull black out of them.

    2026-08-25, Noah: "Let's also work on removing the border line around the
    head."

    `premultiplied_resize` above divides the premultiplied colour back out by
    `max(alpha, 1)`, which is right for every pixel that has any coverage and
    leaves every pixel that has NONE at RGB (0,0,0). Measured on the shipped
    sheets, all 39 million fully transparent pixels are black. That is
    invisible in the file and stays invisible however it is composited — but
    it is not invisible to a RESIZE, and the sprite sheet is resized once more
    after it ships: the component draws each 960x1440 cell into a 900x1350
    canvas, and the browser's own filter averages those black neighbours into
    the silhouette's edge. Hence a dark rim that is nowhere in the asset and
    appears only on screen, which is why it survived the earlier fix to how
    the sheet is assembled.

    The standard remedy, and the one here: flood the nearest real colour
    outward into the transparent region. `distance_transform_edt` with
    `return_indices` gives, for every pixel, the coordinates of the closest
    solid one in a single pass. ALPHA IS NOT TOUCHED — nothing about what
    composites changes; only what a filter samples when it reaches past the
    edge.

    The threshold is a low alpha rather than exactly zero because the
    un-premultiply amplifies quantisation badly down there: at alpha 1 it
    multiplies a rounded 8-bit value by 255, so those pixels carry noise
    rather than colour. They contribute at most 3% coverage, so replacing them
    is imperceptible and removes the noise from the filter's input too.
    """
    solid = rgba[..., 3] >= alpha_min
    if not solid.any():
        return rgba
    _, (iy, ix) = ndi.distance_transform_edt(~solid, return_indices=True)
    out = rgba.copy()
    out[..., :3] = rgba[iy, ix, :3]
    return out
