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
