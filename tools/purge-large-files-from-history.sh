#!/usr/bin/env bash
#
# Remove the two oversized files from the repository's HISTORY.
#
# ─── WHY YOU MIGHT NEED THIS ────────────────────────────────────────────────
#
# GitHub refuses any push containing a file over 100MB, and it checks every
# commit being pushed, not just the current state of the files. Two files
# were committed earlier in this project's history:
#
#     306.5 MB  public/assets/corita-art-center/Corita Kent Evergreen Gif.gif
#     183.6 MB  public/images/rotating-head/sprite-sheet-light-smoothed.png
#
# Neither is used by the site — the Corita page plays the .mp4 version, and
# the rotating head renders the "staggered" sprite sheet, not this one. Both
# have already been removed from the current commit and added to .gitignore,
# and both are still sitting on your disk, untouched. But they remain inside
# the old commits, so `git push` to GitHub will be rejected until they are
# taken out of history too. That is what this script does.
#
# ─── YOU MAY NOT NEED THIS AT ALL ───────────────────────────────────────────
#
# If you deploy with the Vercel CLI (`npx vercel --prod`) instead of
# connecting a GitHub repository, Vercel uploads your files directly and
# never sees your git history — the 100MB limit never comes up, and you can
# ignore this script completely. Rewriting history is only worth doing if you
# want your code on GitHub.
#
# ─── WHAT IT DOES TO YOUR REPOSITORY ────────────────────────────────────────
#
# It rewrites every commit, which means every commit gets a new ID. Your
# commit messages, dates, and the order of your work are all preserved — only
# the two files disappear from the past. Nothing has ever been pushed
# anywhere from this repository, so there is no one else's copy to conflict
# with; this is safe to do.
#
# It takes a full backup of .git first (into ../noahcousineau-site-git-backup)
# so the whole thing is undoable: delete .git and rename the backup back.
#
# ─── RUNNING IT ─────────────────────────────────────────────────────────────
#
#     bash tools/purge-large-files-from-history.sh
#
# Commit or stash any work in progress first — it refuses to run otherwise.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Paths removed from every past commit. Files or folders; nothing here is
# used by the site, and all of it stays on your disk.
BIG_FILES=(
  "public/assets/corita-art-center/Corita Kent Evergreen Gif.gif"
  "public/images/rotating-head/sprite-sheet-light-smoothed.png"
  # 144MB of screen recordings, .ai files and a PDF dragged into a chat
  # window. Never part of the site, and the only cheap moment to take them
  # out of the history is before the first push.
  ".hermes"
)

echo "==> Checking the working tree is clean"
if [ -n "$(git status --porcelain)" ]; then
  echo "    There are uncommitted changes. Commit or stash them first, then re-run."
  git status --short
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="../noahcousineau-site-git-backup-$STAMP"
echo "==> Backing up .git to $BACKUP"
cp -R .git "$BACKUP"
echo "    Done. If anything goes wrong: rm -rf .git && cp -R \"$BACKUP\" .git"

# SAVE THE ACTUAL ARTWORK FIRST.
#
# filter-branch resets the working tree to the rewritten HEAD when it
# finishes. If either file is still TRACKED at that point, the reset deletes
# it from disk — a 306MB original gone, with the only other copy inside the
# history this script is in the middle of destroying. Tested on a scratch
# repo, where exactly that happened.
#
# In this repository both files are already untracked and gitignored, so the
# reset should leave them alone. "Should" is not good enough for artwork that
# may not exist anywhere else, so they are copied out first and put back at
# the end regardless.
FILES_BACKUP="../noahcousineau-site-large-files-$STAMP"
echo "==> Copying the two large files somewhere safe"
mkdir -p "$FILES_BACKUP"
for f in "${BIG_FILES[@]}"; do
  if [ -e "$f" ]; then
    mkdir -p "$FILES_BACKUP/$(dirname "$f")"
    # -R so a folder is copied whole; -p to keep timestamps.
    cp -Rp "$f" "$FILES_BACKUP/$f"
    echo "    saved $f"
  else
    echo "    not on disk, nothing to save: $f"
  fi
done

echo "==> Rewriting history to drop the two files"
# index-filter edits each commit's file list directly, without checking any
# files out, which is why this is fast despite the repository's size.
# --ignore-unmatch so commits made before a file existed are not errors.
FILTER='git rm --cached --ignore-unmatch -r'
for f in "${BIG_FILES[@]}"; do
  FILTER="$FILTER \"$f\""
done
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force \
  --index-filter "$FILTER" \
  --prune-empty --tag-name-filter cat -- --all

echo "==> Putting the two large files back on disk"
# See the note above: the reset at the end of filter-branch can take them.
for f in "${BIG_FILES[@]}"; do
  if [ ! -e "$f" ] && [ -e "$FILES_BACKUP/$f" ]; then
    mkdir -p "$(dirname "$f")"
    cp -Rp "$FILES_BACKUP/$f" "$f"
    echo "    restored $f"
  fi
done

echo "==> Discarding the old history that git keeps as a safety net"
rm -rf .git/refs/original
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo
echo "==> Result"
REMAINING=$(git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | awk '$1=="blob" && $3 > 104857600' | wc -l | tr -d ' ')
echo "    files over 100MB left anywhere in history: $REMAINING"
git count-objects -vH | grep -E "^size-pack:" || true
if [ "$REMAINING" = "0" ]; then
  echo "    Ready to push to GitHub."
else
  echo "    Something is still oversized — do not delete the backup; ask before pushing."
fi
echo
for f in "${BIG_FILES[@]}"; do
  if [ -e "$f" ]; then
    echo "    still on disk: $f"
  else
    echo "    MISSING FROM DISK: $f"
    echo "      a copy is in $FILES_BACKUP — put it back before deleting anything"
  fi
done
echo
echo "    Two backups were made and neither is deleted automatically:"
echo "      $BACKUP        (the old git history)"
echo "      $FILES_BACKUP  (the two large files)"
echo "    Delete them once the push to GitHub has worked."
