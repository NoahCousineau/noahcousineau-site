"""Build a neck-less head cut-out from a full head+neck PNG.

The neck is removed with a superellipse cap: above `y0` the artwork's own
silhouette is kept untouched, and from `y0` down the allowed half-width
follows (1 - t**n)**(1/n), which holds the jaw near full width and then
rounds off — a plain ellipse (n=2) would start narrowing at the jaw and
carve into it. The edge is feathered so the cut doesn't read as a hard
horizontal chop.
"""
from PIL import Image
import numpy as np
import json
import sys


def build(src, y0, B, n=3.0, feather=1.5, alpha_threshold=40):
    im = Image.open(src).convert("RGBA")
    a = np.array(im).astype(np.float32)
    alpha = a[..., 3]
    H, W = alpha.shape
    op = alpha > alpha_threshold
    yy, xx = np.mgrid[0:H, 0:W]

    idx = np.where(op[y0])[0]
    cx = (idx.min() + idx.max()) / 2.0
    hw0 = (idx.max() - idx.min()) / 2.0

    t = np.clip((yy - y0) / B, 0, None)
    allowed = hw0 * np.clip(1 - t ** n, 0, 1) ** (1.0 / n)
    # Signed distance outside the cap, feathered to a soft edge.
    d = np.abs(xx - cx) - allowed
    fade = np.clip(0.5 - d / feather, 0, 1)
    factor = np.where(yy < y0, 1.0, fade)
    factor = np.where(yy >= y0 + B, 0.0, factor)

    a[..., 3] = alpha * factor
    out = Image.fromarray(a.astype(np.uint8))

    arr = np.array(out)
    ys, xs = np.where(arr[..., 3] > alpha_threshold)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    return out.crop(box), box


def measure_eyes(img, alpha_threshold=40):
    """Locate the two transparent eye sockets inside the head silhouette."""
    import cv2
    arr = np.array(img.convert("RGBA"))
    op = (arr[..., 3] > alpha_threshold).astype(np.uint8)
    H, W = op.shape
    # Holes = transparent pixels NOT connected to the outside border.
    inv = (1 - op).astype(np.uint8)
    nlab, lab = cv2.connectedComponents(inv, 4)
    border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    holes = []
    for i in range(1, nlab):
        if i in border:
            continue
        ys, xs = np.where(lab == i)
        if len(xs) < 200:
            continue
        holes.append({
            "area": int(len(xs)),
            "cx": float(xs.mean()), "cy": float(ys.mean()),
            "x0": int(xs.min()), "x1": int(xs.max()),
            "y0": int(ys.min()), "y1": int(ys.max()),
        })
    holes.sort(key=lambda h: h["cx"])
    return holes, (W, H)


if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2]
    y0, B, n = int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])
    img, box = build(src, y0, B, n)
    img.save(dst, optimize=True)
    holes, (W, H) = measure_eyes(img)
    info = {
        "src": src, "dst": dst, "cropBox": box,
        "size": [W, H], "aspect": f"{W}/{H}", "aspectVal": round(W / H, 5),
        "eyes": [
            {
                "cxFrac": round(h["cx"] / W, 4), "cyFrac": round(h["cy"] / H, 4),
                "widthPct": round((h["x1"] - h["x0"] + 1) / W * 100, 2),
                "bbox": [h["x0"], h["x1"], h["y0"], h["y1"]], "area": h["area"],
            } for h in holes
        ],
    }
    print(json.dumps(info, indent=1))
