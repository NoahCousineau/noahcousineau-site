"""Convert Noah's header-icon PNGs into the site's public/ assets.

Source: "Project Page Animations/Header Icons/Edited/By Project/<Folder>/",
six folders (one per project), each holding 9-10 PNGs named
"<Prefix><Kind><Name>.png" where Kind is Pencil, Clay, or Paper.

2026-08-23, Noah: "These pngs are meant to replace the placeholder circles
that are in the project header areas... By the end of this, there should no
longer be any placeholder circles."

Just a format conversion — PNG to WEBP, same as every other image asset on
the site, for size — plus reading each file's own alpha-cropped bounding box
so the component can lay them out by their actual drawn shape rather than a
generic square. No colour or matting work needed: Noah's cutouts are already
clean transparent PNGs.
"""
import os
import re
import json

from PIL import Image

SRC = '/Users/noahcousineau/Desktop/portfolio/Project Page Animations/Header Icons/Edited/By Project'
OUT = '/Users/noahcousineau/Desktop/portfolio/noahcousineau-site/public/assets/home/header-icons'

FOLDER_TO_SLUG = {
    'Corita Art Center': 'corita-art-center',
    'Cultural Olympiad': 'cultural-olympiad-poster',
    'More Work': 'more-work',
    'SoCal Earth': 'socal-earth',
    'Sprouts Farmers Market': 'sprouts-farmers-market',
    'Valley Strong Credit Union': 'valley-strong-credit-union',
}

KINDS = ('Pencil', 'Clay', 'Paper')


def parse_name(fname):
    """'SproutsPencilOnion.png' -> ('pencil', 'onion')."""
    stem = fname
    for ext in ('.jpeg.png', '.png'):
        if stem.endswith(ext):
            stem = stem[: -len(ext)]
            break
    for kind in KINDS:
        m = re.search(kind, stem)
        if m:
            name = stem[m.end():]
            return kind.lower(), re.sub(r'(?<!^)(?=[A-Z])', '-', name).lower()
    raise ValueError(f'no kind found in {fname!r}')


def main():
    manifest = {}
    for folder, slug in FOLDER_TO_SLUG.items():
        src_dir = os.path.join(SRC, folder)
        dst_dir = os.path.join(OUT, slug)
        os.makedirs(dst_dir, exist_ok=True)
        items = []
        for fname in sorted(os.listdir(src_dir)):
            if not fname.lower().endswith('.png'):
                continue
            kind, name = parse_name(fname)
            im = Image.open(os.path.join(src_dir, fname)).convert('RGBA')
            import numpy as np
            a = np.array(im)
            ys, xs = np.where(a[..., 3] > 10)
            x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
            crop = im.crop((x0, y0, x1 + 1, y1 + 1))
            out_name = f'{kind}-{name}.webp'
            crop.save(os.path.join(dst_dir, out_name), 'WEBP', quality=92, method=6)
            items.append({
                'kind': kind,
                'name': name,
                'file': out_name,
                'width': crop.size[0],
                'height': crop.size[1],
            })
        manifest[slug] = items
        print(slug, len(items), 'icons')
    with open(os.path.join(OUT, '_manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)


if __name__ == '__main__':
    main()
