import type { Theme } from "@/components/ThemeProvider";

/**
 * The two cut-out heads used by the About page's throwable ragdoll and the
 * footer's peeking head, one per theme.
 *
 * SHORT NECK, NOT NONE. The shoulders came off on 2026-08-21 ("Let's also
 * try removing the neck... This might be easier to roll as well") and he was
 * right that it rolls better — the old silhouette's neck was a long
 * straight-sided stub that made the shape's support distance swing wildly
 * with rotation, which is what produced the "dip" at the header's bottom
 * edge. But cutting all the way to the jaw went too far: "my head looks a
 * bit fat without it. Just add a bit, not tons." Both heads now end in a
 * short neck closed with the same rounded cap.
 *
 * BOTH VARIANTS TRACK THE CURSOR. The dark head's sockets are cut through
 * the sunglass lenses rather than through eyelids, and it renders its own
 * lens-tinted pupils — see the note on HEAD_DARK.
 *
 * Both images are cropped tight to their own silhouette and exported at the
 * same pixel WIDTH, so they draw at the same on-screen size wherever they're
 * placed by width (which is how every caller places them). Their heights
 * differ because the two source photographs are different poses — hence
 * `aspect` travelling with each variant rather than being one constant.
 */

export type HeadAsset = {
  src: string;
  /** The image's own intrinsic aspect, for the box that hosts it. */
  aspect: string;
  /** Ratio form of `aspect`, for layout maths. */
  aspectVal: number;
  /** Cursor-tracking eyes, or null if a variant ever has none. */
  eyes: {
    left: { x: number; y: number; widthPct: number };
    right: { x: number; y: number; widthPct: number };
    /** Artwork for the pupils. Dark mode uses a lens-tinted pair. */
    srcLeft: string;
    srcRight: string;
    /** Fill behind the socket, so an extreme offset can't expose the hole. */
    backing: string;
  } | null;
};

/* The light head keeps Noah's OWN clipping — design/02-about-me/"AboutMeHead
 * - Light Mode - No Eyes No Neck.png", whose edges are cleaner than anything
 * derived automatically — with only its bottom rebuilt to put a short neck
 * back. See tools/dark-head-pipeline/build_light_head.py for how the two are
 * seamed. It lands at 0.735 w/h against the dark head's 0.753, close enough
 * that swapping between them doesn't lurch.
 *
 * Eye socket centres are the centroids of the transparent holes measured off
 * that file's alpha channel. The rendered pupil is ~1.145x the hole so the
 * socket edge is always covered — the ratio the original hand-tuned
 * constants used, carried over rather than re-guessed. */
export const HEAD_LIGHT: HeadAsset = {
  src: "/assets/about/head-noneck.png",
  aspect: "1227/1669",
  aspectVal: 1227 / 1669,
  eyes: {
    left: { x: 0.2937, y: 0.4559, widthPct: 11.85 },
    right: { x: 0.6272, y: 0.4499, widthPct: 12.22 },
    srcLeft: "/assets/about/eye-left.png",
    srcRight: "/assets/about/eye-right.png",
    backing: "#f3ddc9",
  },
};

/* Dark head — Noah's own cut-out, with the eyes cut clean through the
 * sunglass lenses. 2026-08-22: "I also included a version of the head to use
 * for the eye tracking in dark mode. I removed the eyes from this."
 *
 * The socket centres and widths below are MEASURED off the two transparent
 * holes in that file (tools/dark-head-pipeline/build_dark_roll_from_edit.py
 * prints them), not estimated from where the dark lens blobs appeared to be.
 * They move the pupils noticeably inward from the previous guess — the right
 * eye by 5% of the head's width.
 *
 * The holes are almonds, 144x43 and 146x50 source px. The pupil artwork is a
 * round disc rendered BEHIND the head, so the hole is what shapes it; the
 * width is the hole's own, plus the 1.145x oversize every socket on both
 * heads uses so the pupil's edge is always under the artwork.
 *
 * The pupils are lens-tinted, but far more gently than before. The old pair
 * was pushed hard (contrast 1.55, gain .82/.44/.41) to survive being seen
 * through a lens LEFT IN PLACE at 90% opacity — that lens is now cut away, so
 * the tint has to be the glass rather than compensate for it, and the old
 * artwork behind an open hole read as two dark smudges. The backing disc is
 * the lens's own colour sampled from the ring around each socket, so at full
 * pupil travel the sliver it covers is indistinguishable from the lens. */
/* CACHE-BUSTED BY FILENAME (2026-08-22). Noah, after this file changed
 * twice in one evening: "It looks like an old version of the head is being
 * used." Every verification I could run — the composited pixels, a real
 * Chrome screenshot of the live page — matched the current file, so the
 * likely explanation is the browser (or Next's own image-optimizer cache)
 * holding onto the PREVIOUS response for this exact URL, since nothing
 * about the path changes when only the file's bytes do.
 *
 * A `?v=` query string was the first attempt and had to be reverted — Next
 * 16's `next/image` 400s any LOCAL src with a query string unless it is
 * allowlisted in next.config's `images.localPatterns`, and that option is
 * an allowlist for ALL local images, not an addition to some default-open
 * set: turning it on for this one path 500'd every other image on the site
 * (the home page's pointing hand, the about page's parallax photos, all of
 * it) because none of THEM were listed either. Reverted immediately.
 *
 * The filename itself is the version instead — plain, and it's what
 * cache-busting means for a static asset absent a build pipeline that
 * fingerprints content hashes. Suffix bumps each time the pipeline
 * (build_dark_roll_from_edit.py) rewrites these three files.
 *
 * UNVERSIONED COPIES STILL SIT ALONGSIDE THESE (head-dark.png etc, same
 * bytes). Deleting them on the first bump broke exactly the failure mode
 * this was meant to fix: Noah's browser had a tab open against the OLD
 * unversioned path from before that commit, and once the underlying file
 * was gone that request 404'd outright — "Looks like the images aren't
 * loading" — worse than the stale-cache problem this exists to solve. Keep
 * a same-content copy at the unversioned name every time VERSION bumps, so
 * any lingering reference to an old path still resolves to CURRENT
 * content instead of nothing. */
export const HEAD_DARK: HeadAsset = {
  src: "/assets/about/head-dark.v2.png",
  aspect: "1227/1627",
  aspectVal: 1227 / 1627,
  eyes: {
    left: { x: 0.2929, y: 0.4979, widthPct: 13.21 },
    right: { x: 0.6094, y: 0.4918, widthPct: 13.4 },
    srcLeft: "/assets/about/eye-left-dark.v2.png",
    srcRight: "/assets/about/eye-right-dark.v2.png",
    backing: "#2c1812",
  },
};

export function headAsset(theme: Theme): HeadAsset {
  return theme === "dark" ? HEAD_DARK : HEAD_LIGHT;
}
