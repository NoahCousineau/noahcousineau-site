"""Defringe the LIGHT turntable frames the same way the dark ones are.

2026-08-23, Noah: "The hair fringe removal is better, let's see if we can
just refine further. Please also refine on the light mode head as well."

The light frames need no registration step — they ARE the reference the
dark frames are matched onto — so this is just defringe() (see
build_dark_frames_from_edit.py) applied directly to each already-aligned
LightMode{n}.png, written to a new directory. Originals are untouched.

Measured before running this: the light shoot's fringe is real but milder
than the dark shoot's was — a thin pale-white wisp around the crown, not the
wide grey band the flash-off dark shoot produced — because a properly lit
studio backdrop keys much more cleanly than a flash-off one. Still visible
enough to be worth the same treatment, and cheap to run since there's no
registration search involved.
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_dark_frames_from_edit import defringe  # noqa: E402

BASE = '/Users/noahcousineau/Desktop/portfolio/rotating-head-turntable/02-edited-frames'
SRC = f'{BASE}/light-mode'
OUT = f'{BASE}/light-mode-defringed'
FRAMES = [n for n in range(1, 33) if n != 28]


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    frames = [int(x) for x in sys.argv[1:]] or FRAMES
    for n in frames:
        rgba = np.array(Image.open(f'{SRC}/LightMode{n}.png').convert('RGBA'))
        out = defringe(rgba)
        Image.fromarray(out).save(f'{OUT}/LightMode{n}.png', optimize=True)
        print('defringed', n)
