"""Pack registered turntable frames into the sprite sheet RotatingHead reads.

6x6 grid of 960x1440 cells (the frames are 2400x3600, downsampled 0.4x for
the web), filled in the order [1..27, 29..32] — 31 frames. Frame 28 is
missing from the light set and the two sheets must stay index-aligned,
because the component addresses a cell by index and then applies the
per-frame correction keyed by index+1.

Resized with premultiplied alpha (imgutil.premultiplied_resize), not a plain
PIL resize — this is a 0.4x DOWNSAMPLE, which averages many more neighbouring
pixels per output pixel than the ~1.06x registration resize does, so it is
the bigger of the two places a transparent pixel's leftover, meaningless RGB
gets blended into real hair colour and repaints a soft halo along the edge.
See imgutil.py.
"""
import sys
import os
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imgutil import premultiplied_resize  # noqa: E402

COLS = 6
CW, CH = 960, 1440
# Light keeps all 31 turntable photos (1-32, skipping the missing 28). Dark
# also drops 32 — the near-duplicate "stuck looking forward" frame, see
# build_dark_frames_from_edit.py's docstring — so the two variants no longer
# share one FRAMES list; the caller passes which set it's assembling.
LIGHT_FRAMES = [n for n in range(1, 33) if n != 28]
DARK_FRAMES = [n for n in range(1, 33) if n not in (28, 32)]


def assemble(src_dir, out_path, prefix, frames):
    rows = -(-len(frames) // COLS)  # ceil
    sheet = Image.new('RGBA', (COLS * CW, rows * CH), (0, 0, 0, 0))
    for i, n in enumerate(frames):
        f = np.array(Image.open(os.path.join(src_dir, f'{prefix}{n}.png')).convert('RGBA'))
        resized = Image.fromarray(premultiplied_resize(f, (CW, CH)), 'RGBA')
        sheet.paste(resized, ((i % COLS) * CW, (i // COLS) * CH), resized)
    sheet.save(out_path, 'WEBP', quality=88, method=6)
    return sheet.size, len(frames), round(os.path.getsize(out_path) / 1024)


if __name__ == '__main__':
    src, out, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
    frames = DARK_FRAMES if prefix == 'DarkMode' else LIGHT_FRAMES
    print(assemble(src, out, prefix, frames))
