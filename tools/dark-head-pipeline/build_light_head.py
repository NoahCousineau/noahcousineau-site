"""Build the light-mode rolling head: Noah's clipping, plus a short neck.

Noah's export — design/02-about-me/"AboutMeHead - Light Mode - No Eyes No
Neck.png" — is the best cut-out of this artwork that exists; his edges are
cleaner than anything automatic and its eye sockets are already correct. But
it ends in a rounded chin with no neck at all, and 2026-08-22 he asked for
some back: "let's add a bit of the neck back into the light mode head, my
head looks a bit fat without it. Just add a bit, not tons."

So this keeps his file everywhere it matters and rebuilds only the bottom:

- His shaping starts around y1420 — above that his outline and the original
  head.png agree to within ~13px, below that he curves in hard to close off
  the chin. So the two are blended across y1380-1460, his above, the
  original's neck below.
- The original is eroded by ~12px first. His clipping is that much tighter
  than head.png's all the way down, so borrowing the neck untouched would
  step outward at the seam.
- The neck is closed with the same superellipse cap the dark head uses, so
  the two variants end the same way. Length was chosen by comparing against
  the dark head: this lands at 0.735 w/h against the dark head's 0.753,
  which keeps the swap between them from lurching.

Re-run and update `aspect` plus the eye `y` fractions in
src/lib/headAssets.ts — the crop height changes, so every socket's fraction
of the box changes with it.
"""
import os
import numpy as np
import cv2
from PIL import Image

NOAH = '/Users/noahcousineau/Desktop/portfolio/design/02-about-me/AboutMeHead - Light Mode - No Eyes No Neck.png'
SITE = '/Users/noahcousineau/Desktop/portfolio/noahcousineau-site'
ORIG = f'{SITE}/public/assets/about/head.png'
DST = f'{SITE}/public/assets/about/head-noneck.png'

SEAM0, SEAM1 = 1380, 1460   # blend band between his shaping and the original
ERODE = 12                  # bring head.png's outline in to match his
CAP_Y, CAP_B, CAP_N = 1600, 130, 3.0


def main():
    n = np.array(Image.open(NOAH).convert('RGBA')).astype(np.float32)
    o = np.array(Image.open(ORIG).convert('RGBA')).astype(np.float32)
    H, W = n.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]

    oa = cv2.erode(o[..., 3], cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ERODE * 2 + 1,) * 2))
    op = oa > 40
    idx = np.where(op[CAP_Y])[0]
    cx = (idx.min() + idx.max()) / 2.0
    hw0 = (idx.max() - idx.min()) / 2.0
    t = np.clip((yy - CAP_Y) / CAP_B, 0, None)
    allowed = hw0 * np.clip(1 - t ** CAP_N, 0, 1) ** (1 / CAP_N)
    fade = np.clip(0.5 - (np.abs(xx - cx) - allowed) / 1.5, 0, 1)
    capped = oa * np.where(yy < CAP_Y, 1.0, fade) * np.where(yy >= CAP_Y + CAP_B, 0.0, 1.0)

    w = np.clip((yy - SEAM0) / (SEAM1 - SEAM0), 0, 1)
    alpha = n[..., 3] * (1 - w) + capped * w
    rgb = n[..., :3] * (1 - w[..., None]) + o[..., :3] * w[..., None]

    img = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8))
    arr = np.array(img)
    ys, xs = np.where(arr[..., 3] > 40)
    bx0, by0 = int(xs.min()), int(ys.min())
    crop = img.crop((bx0, by0, int(xs.max()) + 1, int(ys.max()) + 1))
    crop.save(DST, optimize=True)
    cw, ch = crop.size

    # eye sockets, re-measured in the new crop
    a2 = np.array(crop)
    inv = (a2[..., 3] <= 40).astype(np.uint8)
    ncc, lab = cv2.connectedComponents(inv, 4)
    border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    holes = []
    for i in range(1, ncc):
        if i in border:
            continue
        hy, hx = np.where(lab == i)
        if len(hx) < 200:
            continue
        holes.append((hx.mean() / cw, hy.mean() / ch, (hx.max() - hx.min() + 1) / cw * 100))
    holes.sort()
    print(f'head-noneck.png {cw}x{ch}  aspect {cw}/{ch} = {cw/ch:.4f}  '
          f'{os.path.getsize(DST)/1e6:.2f}MB')
    for (fx, fy, wp), side in zip(holes, ('left', 'right')):
        print(f'  {side}: x={fx:.4f} y={fy:.4f} widthPct={wp*1.145:.2f}')


if __name__ == '__main__':
    main()
