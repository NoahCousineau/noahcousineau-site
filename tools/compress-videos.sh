#!/usr/bin/env bash
#
# Re-encode the site's videos for the web.
#
# ─── THE PROBLEM ────────────────────────────────────────────────────────────
#
# The ten videos the site plays are mastering exports, not web files:
#
#     289.7 MB  1920x1080  60s  40 Mbps  Final Thesis Video.mp4
#      38.4 MB  1080x1920  31s           Hallway Reel 051425.mp4
#      31.5 MB  1080x1920  25s           Corita Kent Evergreen Gif.mp4  (x2, identical)
#      26.5 MB  3840x2160  14s           Sprouts_013026_Video.mp4       (x2, identical)
#      23.4 MB  1920x1080  50s           SoCal Earth ... With/No Sound
#      18.4 MB  1080x1080  14s           Sprouts_EDLP ... 1080x1080 2.mp4
#       9.9 MB  1200x630    8s           Image_FB_Cousineau_Noah_ArtCenter ...
#
# 40 Mbps and 4K for clips that play inside a project-grid cell. That matters
# for two separate reasons:
#
#  1. /public/videos is gitignored, so none of them are in the repository and
#     a deploy from git serves a site with ten broken videos. They cannot
#     simply be committed as they are — "Final Thesis Video.mp4" is 289.7MB
#     and GitHub refuses anything over 100MB.
#  2. Even hosted perfectly, hovering a grid tile starts streaming a 289MB
#     file, and the hover handler seeks to the middle of it first.
#
# Compressing fixes both: the set lands small enough to live in the repo, and
# the site gets quick.
#
# ─── WHAT IT DOES ───────────────────────────────────────────────────────────
#
# Uses avconvert, which ships with macOS — no install needed. Originals are
# never touched: every source is copied to an ORIGINALS folder outside the
# repo first, and encoding writes to a staging folder. Nothing is swapped
# into public/videos until you run this with --install.
#
#     bash tools/compress-videos.sh            # encode + report, changes nothing
#     bash tools/compress-videos.sh --install  # then swap them in
#
# Fast-start is left ON (avconvert's default) so the browser can seek without
# downloading the whole file — the grid's hover reel jumps to the halfway
# point as soon as it plays.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SRC_DIR="public/videos"
STAGE="../noahcousineau-video-web"
ORIGINALS="../noahcousineau-video-originals"
INSTALL=0
[ "${1:-}" = "--install" ] && INSTALL=1

if ! command -v avconvert >/dev/null; then
  echo "avconvert not found — it normally ships with macOS. Nothing done."
  exit 1
fi

mkdir -p "$STAGE" "$ORIGINALS"

# The videos the site actually references, read straight out of the source so
# this cannot drift from what the site plays.
#
# A `while read` loop and not `mapfile`: macOS ships bash 3.2, where mapfile
# does not exist. It fails with "mapfile: command not found" and leaves the
# array empty, so the script would cheerfully report doing nothing to zero
# videos. IFS= and -r keep the spaces and parentheses in these filenames.
VIDEOS=()
while IFS= read -r line; do
  [ -n "$line" ] && VIDEOS+=("$line")
done < <(grep -rhoE '"/videos/[^"]*"' src/ | sed 's/"//g; s|^/videos/||' | sort -u)

if [ "${#VIDEOS[@]}" -eq 0 ]; then
  echo "No /videos/ references found in src/ — nothing to do, and that is suspicious."
  exit 1
fi
echo "==> ${#VIDEOS[@]} videos referenced by the site"
total_before=0
total_after=0

for name in "${VIDEOS[@]}"; do
  src="$SRC_DIR/$name"
  if [ ! -f "$src" ]; then
    echo "    MISSING, skipped: $name"
    continue
  fi

  # Keep an untouched copy of the original outside the repo before anything.
  [ -f "$ORIGINALS/$name" ] || cp -p "$src" "$ORIGINALS/$name"

  out="$STAGE/$name"
  before=$(stat -f "%z" "$src")
  total_before=$((total_before + before))

  if [ -f "$out" ]; then
    echo "    already encoded: $name"
  else
    echo "    encoding: $name"
    # Preset1920x1080 and NOT PresetAppleM4V1080pHD: the M4V presets refuse
    # an .mp4 output path ("file extension:mp4 not valid with preset"), and
    # writing .m4v and renaming produces a file the container still brands as
    # M4V. This one writes plain H.264 in .mp4.
    #
    # 1080p rather than the 720p the review-build packager uses: these play
    # inline in the project grids at up to full artboard width, not just as
    # small hover reels, so the resolution is worth keeping. It bounds the
    # long edge at 1920 and preserves aspect, so the vertical 1080x1920 reels
    # stay vertical and the 4K Sprouts clips come down to 1080p.
    if ! avconvert --preset Preset1920x1080 \
                   --source "$src" --output "$out" --replace >/dev/null 2>&1; then
      echo "      FAILED, leaving the original in place"
      rm -f "$out"
      continue
    fi
  fi

  after=$(stat -f "%z" "$out")
  # A clip that is already lean can come out bigger; keep whichever is smaller.
  if [ "$after" -ge "$before" ]; then
    echo "      re-encode was larger, keeping the original"
    cp -p "$src" "$out"
    after=$before
  fi
  total_after=$((total_after + after))
  printf "      %7.1f MB -> %6.1f MB  (%.0f%% smaller)\n" \
    "$(echo "$before/1048576" | bc -l)" \
    "$(echo "$after/1048576" | bc -l)" \
    "$(echo "(1 - $after/$before) * 100" | bc -l)"
done

echo
printf "==> total %.0f MB -> %.0f MB\n" \
  "$(echo "$total_before/1048576" | bc -l)" "$(echo "$total_after/1048576" | bc -l)"
echo "    originals kept in $ORIGINALS"
echo "    encoded files in  $STAGE"

if [ "$INSTALL" = "1" ]; then
  echo
  echo "==> Installing the encoded files into $SRC_DIR"
  for name in "${VIDEOS[@]}"; do
    [ -f "$STAGE/$name" ] && cp -p "$STAGE/$name" "$SRC_DIR/$name" && echo "    installed $name"
  done
  echo "    Done. Originals are still in $ORIGINALS."
else
  echo
  echo "    Nothing was changed. Re-run with --install to swap these in."
fi
