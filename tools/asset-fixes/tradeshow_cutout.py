"""Cut the white background off the Trade Show cover photo.

2026-08-23, Noah: "In more work, please remove the background on the first
image for 'The Trade Show!' It has a white background right now." The cover
itself is ALSO white — a plain colour-key would eat the book along with its
backdrop — so this uses rembg's u2net (semantic foreground segmentation,
already in this repo's dark-head pipeline) rather than a threshold.

Alpha matting was tried and made it worse: it left a visible pale halo along
the bottom edge of the book, worse than the plain segmentation mask. Plain
`remove()` is what ships.

Canvas size is kept UNCHANGED (not cropped to the book's own bounding box) —
the row's `scale: 140` in projects.json is tuned against this image's
original 1500x1692 frame, and preserving the frame means that tuning stays
correct; only the background pixels inside it become transparent instead of
white.
"""
from rembg import remove, new_session
from PIL import Image

SRC = "/Users/noahcousineau/Desktop/portfolio/noahcousineau-site/public/assets/the-trade-show/the-trade-show_02_the-trade-show-cover.webp"
DST = SRC  # overwrite in place; same filename, same reference in projects.json

if __name__ == "__main__":
    im = Image.open(SRC).convert("RGB")
    out = remove(im, session=new_session("u2net"))
    out.save(DST, "WEBP", quality=95, method=6)
    print("saved", DST, out.size)
