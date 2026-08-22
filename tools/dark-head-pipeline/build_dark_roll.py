"""Build the dark-mode ROLLING head (About page ragdoll / footer peek).

Source is the frame Noah attached on 2026-08-21 — the standalone
DarkMode1.JPG he left at the top level of 01-raw-photos, which is a
different shot from the turntable's originals/DarkMode1.JPG. Confirmed as
his attachment by matching the COLORUSH branding on the lens, the lens
reflections and the mark on his forehead.

Beyond the shared cut-out pipeline in matte.py this does two things:

NECK — the same superellipse cap as the light head, placed at the narrowest
row below the chin, because Noah asked for the two to match: "I like how the
neck is treated in dark mode. Please apply the same cropping to the light
mode head."

EYE SOCKETS — the sunglass lenses are found as the two dark blobs in the
face band, and a socket is opened just below each lens centre. The socket is
NOT punched fully transparent: at full transparency it reads as two holes
cut in the shades. Keeping partial alpha lets the tracked pupil behind show
through dimly, tinted by the lens still in front of it — "They'll be behind
sunglasses, but I still want eyes to track the cursor like how it is on
light mode."
"""
import sys, os, json
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import matte  # noqa: E402

RAW = '/Users/noahcousineau/Desktop/portfolio/rotating-head-turntable/01-raw-photos/DarkMode1.JPG'
DST = '/Users/noahcousineau/Desktop/portfolio/noahcousineau-site/public/assets/about/head-dark.png'
TARGET_W = 1227          # same rendered width as the light head
SOCKET = (62.0, 27.0)    # semi-axes, px at source scale

# Alpha left over the socket. This was 0.58, which looked right at full
# resolution and was invisible where it actually matters: the head renders
# about 212px wide on the About page, so each eye is ~24px, and behind a lens
# whose own colour is (53,5,6) at 58% opacity there was nothing left to see.
# Noah: "I don't see any eye tracking on the dark mode."
#
# Opening the socket up alone would read as two holes punched in the shades,
# so the lens tint moves onto the EYE artwork instead (see EYE_TINT): the
# pupils are drawn already lens-coloured, and the socket only keeps a trace
# of the real lens over them. Judged at 212px, not at full size.
LENS_KEEP = 0.10

# Applied to the light-mode eye photographs to make the dark-mode pair.
# Contrast first so the iris survives being darkened, then a cast toward the
# lens's own brown-red so the eye still belongs behind the glass.
EYE_TINT_GAIN = (0.82, 0.44, 0.41)
EYE_TINT_CONTRAST = 1.55
EYE_SRC_DIR = '/Users/noahcousineau/Desktop/portfolio/noahcousineau-site/public/assets/about'


def find_lenses(alpha, rgb, y0, y1):
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    band = np.zeros(lum.shape, bool)
    band[int(y0 + 0.33 * (y1 - y0)):int(y0 + 0.60 * (y1 - y0)), :] = True
    cand = ((alpha > 200) & (lum < 105) & band).astype(np.uint8)
    cand = cv2.morphologyEx(cand, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(cand, 8)
    rows = [(stats[i, cv2.CC_STAT_AREA], i) for i in range(1, n)
            if stats[i, cv2.CC_STAT_AREA] > 15000
            and stats[i, cv2.CC_STAT_WIDTH] / max(stats[i, cv2.CC_STAT_HEIGHT], 1) > 0.9]
    rows.sort(reverse=True)
    lens = sorted(rows[:2], key=lambda r: cent[r[1]][0])
    if len(lens) != 2:
        raise RuntimeError(f'expected 2 lenses, found {len(lens)}')
    out = []
    for _, i in lens:
        st = cent[i]
        out.append((float(st[0]), float(stats[i, cv2.CC_STAT_TOP] + stats[i, cv2.CC_STAT_HEIGHT] * 0.52)))
    return out


def build_dark_eyes():
    """Write the lens-tinted pair the dark head renders behind its sockets."""
    out = []
    for side in ('left', 'right'):
        src = os.path.join(EYE_SRC_DIR, f'eye-{side}.png')
        a = np.array(Image.open(src).convert('RGBA')).astype(np.float32)
        rgb = a[..., :3] / 255.0
        rgb = np.clip((rgb - 0.5) * EYE_TINT_CONTRAST + 0.5, 0, 1) * np.array(EYE_TINT_GAIN)
        a[..., :3] = np.clip(rgb, 0, 1) * 255
        dst = os.path.join(EYE_SRC_DIR, f'eye-{side}-dark.png')
        Image.fromarray(a.astype(np.uint8)).save(dst, optimize=True)
        out.append(dst)
    return out


def main():
    for p in build_dark_eyes():
        print('wrote', os.path.basename(p))
    cut = matte.cutout(RAW)
    a = np.array(cut).astype(np.float32)
    alpha = a[..., 3]
    op = alpha > 40
    H, W = alpha.shape
    ys, xs = np.where(op)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()

    eyes = find_lenses(alpha, a[..., :3], y0, y1)

    # --- neck cap at the narrowest row below the chin ---
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
    alpha = alpha * factor

    # --- semi-transparent eye sockets behind the lenses ---
    for (ex, ey) in eyes:
        e = ((xx - ex) / SOCKET[0]) ** 2 + ((yy - ey) / SOCKET[1]) ** 2
        soft = np.clip((1.15 - e) / 0.55, 0, 1)
        alpha = alpha * (1 - soft) + alpha * LENS_KEEP * soft

    a[..., 3] = alpha
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    arr = np.array(out)
    ys, xs = np.where(arr[..., 3] > 40)
    bx0, bx1, by0, by1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    crop = out.crop((bx0, by0, bx1 + 1, by1 + 1))
    cw, ch = crop.size
    crop = crop.resize((TARGET_W, int(round(ch * TARGET_W / cw))), Image.LANCZOS)
    crop.save(DST, optimize=True)

    info = {
        'size': list(crop.size),
        'aspect': f'{crop.size[0]}/{crop.size[1]}',
        'aspectVal': round(crop.size[0] / crop.size[1], 4),
        'waistRow': int(waist),
        'eyes': [{'x': round((ex - bx0) / (bx1 - bx0 + 1), 4),
                  'y': round((ey - by0) / (by1 - by0 + 1), 4),
                  'widthPct': round(SOCKET[0] * 2 / (bx1 - bx0 + 1) * 100 * 1.14, 2)}
                 for ex, ey in eyes],
        'mb': round(os.path.getsize(DST) / 1e6, 2),
    }
    print(json.dumps(info, indent=1))


if __name__ == '__main__':
    main()
