#!/usr/bin/env python3
"""Turn the static export in out/ into a zip small enough to send someone.

2026-08-25, Noah: "I'd also like a zip version of the site so I can share the
site with friends before it goes live" -- and, this round, "update the zip
accordingly, let me know where I can find this on my laptop as well."

WHY THE EXPORT IS HUGE TO BEGIN WITH, since that is the thing this script
exists to undo. `public/` is 2.1GB. In the ordinary build nobody ever
downloads it, because next/image serves resized derivatives on demand and the
originals stay on the server. A static export has no server, so `unoptimized`
is forced on and every original ships. The weight was always there; the export
is just the first thing that makes it visible.

Three passes, in this order, because each one makes the next cheaper:

  1. PRUNE what no page references. Measured at 515MB the first time, including
     a 183MB sprite-sheet-light-smoothed.png that nothing loads (the component
     asks for the `-verified` one) and two 306MB copies of the same GIF.

  2. TRANSCODE video to 720p with avconvert. These are portfolio reels playing
     in a grid cell, not a cinema.

  3. DOWNSCALE images past 2400px. 100 of them the first time, 325MB, some
     8000x4500 -- print resolution being handed to a browser.

PRUNING MATCHES BASENAMES, NOT URLS, and that is a bug fix rather than a
style. The first version built URLs with a regex that stops at whitespace, so
any file whose name contains a space looked unreferenced and was deleted --
three project images 404'd. Basenames are also matched WITH their extension,
which is the other half: "Corita Kent Evergreen Gif" appears inside an .mp4's
own filename, so matching without the extension made two 306MB GIFs look
referenced and kept them.

Being wrong in the conservative direction here means shipping a file nobody
needs, which costs megabytes. Being wrong the other way means a broken image
in front of Noah's friends. Hence --verify, which serves the finished export
and loads every page looking for images that failed to decode.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

SITE = Path(__file__).resolve().parents[2]
OUT = SITE / "out"
# Where the heavy media lives. Everything else in the export is HTML/JS/CSS
# and is already small.
MEDIA_DIRS = ["assets", "images", "videos"]
# Dropped from the review copy outright, before anything else looks at it.
#
# `tools/` is the standalone grid editor and a snapshot of projects.json that
# `public/` happens to carry; `dev/` is the mobile bench and the clock stand,
# which call notFound() in a production build and export as 404 pages anyway.
# Neither belongs in a copy going to Noah's friends.
#
# Dropping `tools/` FIRST is also load-bearing for the prune below, and this is
# the third distinct way that pass has been wrong. The snapshot is a stale copy
# of the content model naming "Corita Kent Evergreen Gif.gif" -- a file no page
# loads; the grid uses the .mp4 beside it. Leaving it in the search made both
# 306MB copies of that GIF look referenced, 613MB of the export, which is the
# single biggest thing in here. A data file that ships is not evidence that a
# page uses what it names.
DROP_PATHS = ["tools", "dev"]
# Files whose text is searched for references.
TEXT_SUFFIXES = {".html", ".js", ".css", ".json", ".txt", ".xml", ".map"}
MAX_IMAGE_PX = 2400
# The exact name avconvert lists under "Supported presets" -- NOT "Preset720p",
# which is what this said first and is not a preset at all. avconvert exits
# non-zero for an unknown preset, the script counted that as "skip", and every
# one of the eleven videos sailed past untouched: the zip came out 795MB with a
# line saying "transcoded 11 videos, saving 0B", which is a sentence that
# should have been impossible. `avconvert --help` prints the real list.
VIDEO_PRESET = "Preset1280x720"


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:,.1f}{unit}"
        n /= 1024.0
    return f"{n}B"


def tree_size(root: Path) -> int:
    return sum(f.stat().st_size for f in root.rglob("*") if f.is_file())


def drop_dev_artifacts(out: Path, dry: bool) -> int:
    freed = 0
    for rel in DROP_PATHS:
        d = out / rel
        if not d.is_dir():
            continue
        size = tree_size(d)
        freed += size
        print(f"    drop {human(size):>9}  {rel}/")
        if not dry:
            shutil.rmtree(d)
    return freed


def load_reference_blob(out: Path) -> str:
    """Every byte of markup and code in the export, as one searchable string.

    DROP_PATHS are excluded here as well as deleted, rather than relying on the
    deletion having happened. It keeps --dry-run honest, and more importantly it
    states the actual rule: those directories are not evidence of anything, so
    nothing they say should keep a file alive.
    """
    parts = []
    for f in out.rglob("*"):
        if any(f.is_relative_to(out / d) for d in DROP_PATHS):
            continue
        if f.is_file() and f.suffix.lower() in TEXT_SUFFIXES:
            try:
                parts.append(f.read_text(encoding="utf-8", errors="ignore"))
            except OSError:
                pass
    return "\n".join(parts)


def is_referenced(path: Path, blob: str) -> bool:
    """Does anything in the export name this file?

    Checked as a BASENAME WITH ITS EXTENSION, in both raw and percent-encoded
    form, because markup writes "a%20b.webp" where the filesystem says "a b.webp".
    See the note at the top for what each of those two details cost.
    """
    name = path.name
    needles = {name, urllib.parse.quote(name), name.replace(" ", "%20")}
    return any(n in blob for n in needles)


def prune(out: Path, blob: str, dry: bool) -> int:
    freed = 0
    kept = dropped = 0
    for d in MEDIA_DIRS:
        root = out / d
        if not root.is_dir():
            continue
        for f in sorted(root.rglob("*")):
            if not f.is_file():
                continue
            if is_referenced(f, blob):
                kept += 1
                continue
            size = f.stat().st_size
            freed += size
            dropped += 1
            if size > 20 * 1024 * 1024:
                print(f"    drop {human(size):>9}  {f.relative_to(out)}")
            if not dry:
                f.unlink()
    print(f"  kept {kept} media files, dropped {dropped}, freeing {human(freed)}")
    return freed


def transcode_videos(out: Path, dry: bool) -> int:
    saved = 0
    failures: list[Path] = []
    vids = [f for f in sorted(out.rglob("*")) if f.suffix.lower() in {".mp4", ".mov", ".m4v"}]
    for f in vids:
        before = f.stat().st_size
        tmp = f.with_suffix(f.suffix + ".tmp.mp4")
        if dry:
            continue
        r = subprocess.run(
            # Fast-start is deliberately LEFT ON (it is the default): it puts the
            # moov atom at the front so a browser can start playing before the
            # whole file has arrived, which is exactly what these need to do.
            ["avconvert", "--preset", VIDEO_PRESET, "--source", str(f),
             "--output", str(tmp), "--replace"],
            capture_output=True, text=True,
        )
        if r.returncode != 0 or not tmp.exists():
            # Printing the reason, because the silent version of this cost a
            # whole release of the zip -- see VIDEO_PRESET above.
            why = (r.stderr or r.stdout or "").strip().splitlines()
            print(f"    FAILED {f.relative_to(out)}: {why[-1] if why else 'no output'}")
            failures.append(f)
            tmp.unlink(missing_ok=True)
            continue
        after = tmp.stat().st_size
        # Only take the re-encode if it actually helped; a short clip that is
        # already small can come out bigger.
        if after < before:
            tmp.replace(f)
            saved += before - after
            print(f"    {human(before):>9} -> {human(after):>9}  {f.name}")
        else:
            tmp.unlink()
    print(f"  transcoded {len(vids) - len(failures)}/{len(vids)} videos, saving {human(saved)}")
    if failures:
        print(f"  WARNING: {len(failures)} video(s) could not be transcoded and ship at full size")
    return saved


def downscale_images(out: Path, dry: bool) -> int:
    from PIL import Image

    # These are Noah's own print-resolution exports, not untrusted uploads,
    # and the biggest of them is precisely what this pass exists to shrink.
    Image.MAX_IMAGE_PIXELS = None

    saved = 0
    n = 0
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    for f in sorted(out.rglob("*")):
        if f.suffix.lower() not in exts or not f.is_file():
            continue
        try:
            with Image.open(f) as im:
                w, h = im.size
                if max(w, h) <= MAX_IMAGE_PX:
                    continue
                if dry:
                    n += 1
                    continue
                scale = MAX_IMAGE_PX / max(w, h)
                new = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
                new = new.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
                before = f.stat().st_size
                if f.suffix.lower() in {".jpg", ".jpeg"}:
                    new.convert("RGB").save(f, quality=88, optimize=True)
                elif f.suffix.lower() == ".png":
                    new.save(f, optimize=True)
                else:
                    new.save(f, quality=90, method=6)
                saved += before - f.stat().st_size
                n += 1
        except Exception as e:  # a corrupt or exotic file is not worth failing over
            print(f"    skip {f.relative_to(out)}: {e}")
    print(f"  downscaled {n} images past {MAX_IMAGE_PX}px, saving {human(saved)}")
    return saved


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", default=str(Path.home() / "Desktop" / "noahcousineau-review.zip"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-video", action="store_true")
    args = ap.parse_args()

    if not OUT.is_dir():
        print("out/ not found. Run the export first:", file=sys.stderr)
        print("  NEXT_PUBLIC_REVIEW_BUILD=1 NEXT_PUBLIC_REVIEW_PASSWORD=... npm run build",
              file=sys.stderr)
        return 1

    print(f"export starts at {human(tree_size(OUT))}")
    print("dropping dev-only artifacts...")
    drop_dev_artifacts(OUT, args.dry_run)
    print("pruning unreferenced media...")
    blob = load_reference_blob(OUT)
    prune(OUT, blob, args.dry_run)
    if not args.skip_video:
        print("transcoding video to 720p...")
        transcode_videos(OUT, args.dry_run)
    print("downscaling oversized images...")
    downscale_images(OUT, args.dry_run)
    print(f"export now {human(tree_size(OUT))}")

    if args.dry_run:
        print("dry run: no zip written")
        return 0

    dest = Path(args.dest)
    if dest.exists():
        dest.unlink()
    # The zip's top-level folder is named for the project rather than "out",
    # so unzipping gives a sensible thing on someone's Desktop. That needs a
    # directory of that name to archive.
    #
    # STAGED OUTSIDE THE REPO, in a temp dir. It used to be staged next to
    # out/ -- i.e. inside the project -- which put a half-gigabyte copy of the
    # site where `next build` scans, and left an empty `noahcousineau-review/`
    # behind in the working tree when it was done. A tempfile directory is
    # cleaned up even if this raises partway through.
    with tempfile.TemporaryDirectory(prefix="review-zip-") as tmpdir:
        staging = Path(tmpdir) / "noahcousineau-review"
        print("staging...")
        shutil.copytree(OUT, staging)
        print(f"zipping to {dest} ...")
        shutil.make_archive(str(dest.with_suffix("")), "zip", root_dir=tmpdir,
                            base_dir=staging.name)
    print(f"wrote {dest}  ({human(dest.stat().st_size)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
