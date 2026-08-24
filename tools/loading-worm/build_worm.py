"""Build the loading screen's crawling worm.

2026-08-23, Noah: "I also finished the loading animation. I would like for
this to replace the 'cousineau' type and the loading bar... The loading
animation will now have a red worm slowly crawling across with the word
'loading' on the worm."

TWO SOURCES, AND THE SVGs ARE THE AUTHORITY:

  Edited/Loading Worm/*.psd    six photographs of the clay worm, flat (1) to
                               arched (6). Used only for the artwork itself.
  Worm Animation Demo/*.svg    eleven frames of Noah's own composition, in a
                               1920x1080 frame, each holding the worm placed
                               where he wants it AND the word "loading"
                               already outlined and warped along its back.

He sent the PNGs of that demo first and the SVGs after — "I'm attaching the
worm frames as svgs since these have the word 'loading' in them" — and the
SVGs make almost all of the hard parts moot. Measuring the PNGs could
recover the gait, but the warped type would still have had to be rebuilt
with a <textPath> along a spine traced out of the alpha channel, matching
his font size and letter-fitting by eye. The SVGs carry the word as seven
outlined glyph paths per frame, already bent exactly the way he drew it, so
none of that reconstruction is needed or wanted.

WHAT THE SVGs ENCODE. Each file positions the worm with a transform on the
full PSD canvas, and the eleven of them ping-pong 1-2-3-4-5-6-5-4-3-2-1
while x runs 567.63 -> 842.43. That is Noah's own answer to the one thing
that would be hard to invent — "Notice how the worm doesn't move to the
right as much when it scrunches up, but then moves further when it scrunches
back down" — so the per-step offsets are read straight out of the files
rather than modelled. Frame 11 repeats frame 1's shape one cycle along,
which is what gives the distance a whole cycle covers.

ONION SKINS. Most of the SVGs contain a SECOND <image>: a leftover copy of
the previous frame's worm sitting underneath the current one. Only the
first is the live frame, so the rest are dropped.
"""
import os
import re
import glob

import numpy as np
from PIL import Image
from psd_tools import PSDImage

SRC = "/Users/noahcousineau/Desktop/portfolio/Home and About Animations/Edited/Loading Worm"
DEMO = "/Users/noahcousineau/Desktop/portfolio/Home and About Animations/Worm Animation Demo"
SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(SITE, "public/assets/home/loading-worm")
TS_OUT = os.path.join(SITE, "src/lib/loadingWorm.ts")

ALPHA = 10
# Width of the EXTENDED frame in the export. Every frame is scaled by this
# same factor, never fitted individually — the worm is one object and frame 6
# is genuinely shorter than frame 1, so normalising each would erase the
# scrunch.
EXTENDED_W = 900

key_svg = lambda p: int(re.search(r"-(\d+)\.svg", p).group(1))
key_psd = lambda p: int(re.search(r"(\d+)", os.path.basename(p)).group(1))

IMAGE_RE = re.compile(
    r'<image id="LoadingWorm(\d+)"[^>]*?width="([\d.]+)"[^>]*?height="([\d.]+)"'
    r'[^>]*?transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)"'
)


def export_frames():
    """Crop each PSD to its worm and write a WEBP; return the crop offsets."""
    os.makedirs(OUT, exist_ok=True)
    files = sorted(glob.glob(SRC + "/*.psd"), key=key_psd)
    raw = []
    for f in files:
        im = PSDImage.open(f).composite().convert("RGBA")
        a = np.array(im)
        ys, xs = np.where(a[..., 3] > ALPHA)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        raw.append((im.crop(box), box))

    scale = EXTENDED_W / max(c.width for c, _ in raw)
    crops = {}
    for i, (crop, box) in enumerate(raw, start=1):
        w = max(1, round(crop.width * scale))
        h = max(1, round(crop.height * scale))
        crop.resize((w, h), Image.LANCZOS).save(
            os.path.join(OUT, f"{i}.webp"), format="WEBP", quality=88, method=6
        )
        crops[i] = box
        print(f"  frame {i}: crop {box} -> {w}x{h}")
    return crops


def content_band():
    """The vertical strip the worm and its word actually occupy, in frame
    units, measured off the demo PNGs (red worm plus black type) across every
    frame. The 1920x1080 frame is 16:9 and the loading screen is whatever the
    window is, so the SVG is cropped to this band and parked near the floor
    rather than letterboxed — which is also what Noah means by "keep it lower
    to the base of the screen to look like it's crawling on the floor."
    """
    y0, y1 = 1e9, -1e9
    for f in sorted(glob.glob(DEMO + "/*.png"), key=lambda p: int(re.search(r"-(\d+)\.png", p).group(1))):
        a = np.array(Image.open(f).convert("RGB")).astype(int)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        ink = ((r > 120) & (g < 110) & (b < 110)) | ((r < 110) & (g < 110) & (b < 110))
        ys, _ = np.where(ink)
        k = WORM_VIEWBOX_H / a.shape[0]
        y0 = min(y0, ys.min() * k)
        y1 = max(y1, ys.max() * k)
    return round(y0 - 8, 2), round(y1 + 8, 2)


def read_steps(crops):
    """One entry per demo frame: worm placement in the 1920x1080 frame, and
    the outlined word for that frame."""
    steps = []
    for f in sorted(glob.glob(DEMO + "/*.svg"), key=key_svg):
        s = open(f).read()
        m = IMAGE_RE.search(s)  # the FIRST image is the live frame
        if not m:
            raise SystemExit(f"no worm image found in {f}")
        n = int(m.group(1))
        tx, ty, sc = float(m.group(4)), float(m.group(5)), float(m.group(6))
        x0, y0, x1, y1 = crops[n]
        layer2 = re.search(r'<g id="Layer_2".*?>(.*?)</g>', s, re.S)
        letters = " ".join(re.findall(r'd="([^"]+)"', layer2.group(1)))
        steps.append(
            dict(
                frame=n,
                x=round(tx + x0 * sc, 2),
                y=round(ty + y0 * sc, 2),
                w=round((x1 - x0) * sc, 2),
                h=round((y1 - y0) * sc, 2),
                letters=letters,
            )
        )
    return steps


TS_HEADER = '''/**
 * The loading screen's crawling worm — Noah's clay worm, and his own
 * composition of it.
 *
 * GENERATED by tools/loading-worm/build_worm.py — do not edit by hand.
 *
 * Each step places the worm inside a 1920x1080 frame and carries the word
 * "loading" as it is warped along that frame's back, taken from the SVGs
 * Noah exported rather than rebuilt. The ten steps are one full ping-pong
 * (1-2-3-4-5-6-5-4-3-2); the eleventh demo frame repeats the first one
 * CYCLE_ADVANCE further along, which is where that number comes from, so
 * replaying the ten and adding the advance each time walks the worm on
 * forever at the gait Noah drew.
 */

export type WormStep = {
  /** Worm artwork for this step. */
  src: string;
  /** Where it sits in the 1920x1080 frame. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** "loading", outlined and warped for this step, in the same frame. */
  letters: string;
};

export const WORM_VIEWBOX = { w: 1920, h: 1080 };

'''


def main():
    crops = export_frames()
    steps = read_steps(crops)
    order = [s["frame"] for s in steps]
    print(f"  demo order: {order}")
    advance = round(steps[-1]["x"] - steps[0]["x"], 2)
    print(f"  cycle advance: {advance} of {WORM_VIEWBOX_W} frame units")
    by0, by1 = content_band()
    print(f"  content band: y {by0}..{by1} (of {WORM_VIEWBOX_H})")

    cycle = steps[:-1]  # drop frame 11: it is frame 1 of the next cycle
    lines = [TS_HEADER, "export const WORM_STEPS: WormStep[] = ["]
    for s in cycle:
        lines.append(
            f'  {{ src: "/assets/home/loading-worm/{s["frame"]}.webp", '
            f'x: {s["x"]}, y: {s["y"]}, w: {s["w"]}, h: {s["h"]},'
        )
        lines.append(f'    letters: "{s["letters"]}" }},')
    lines.append("];")
    lines.append("")
    lines.append("/** How far one whole cycle carries the worm, in frame units. */")
    lines.append(f"export const WORM_CYCLE_ADVANCE = {advance};")
    lines.append("")
    lines.append("/** The strip the worm and word occupy — see content_band(). */")
    lines.append(f"export const WORM_BAND = {{ y0: {by0}, y1: {by1} }};")
    lines.append("")
    with open(TS_OUT, "w") as f:
        f.write("\n".join(lines))
    kb = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024
    ts_kb = os.path.getsize(TS_OUT) // 1024
    print(f"  wrote {TS_OUT} ({ts_kb}kB) and {kb}kB of frames")


WORM_VIEWBOX_W = 1920
WORM_VIEWBOX_H = 1080

if __name__ == "__main__":
    main()
