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

/* Dark head eye sockets sit BEHIND the sunglass lenses.
 *
 * The first attempt kept the socket at 58% alpha and reused the light-mode
 * pupils, reasoning that the real lens should do the tinting. It was
 * invisible in practice — the head renders about 212px wide, so each eye is
 * ~24px, and behind a lens whose own colour is (53,5,6) there was nothing
 * left to see. Noah: "I don't see any eye tracking on the dark mode."
 *
 * So the tint moved onto the ARTWORK: eye-*-dark.png are the same
 * photographs pushed for contrast and cast toward the lens's brown-red, and
 * the socket now keeps only a trace of the real lens over them. The pupils
 * read at render size while still looking like they are behind glass rather
 * than like two holes punched in the shades. The backing disc is lens-dark
 * for the same reason — the light head's skin-tone disc would have glowed
 * through as a pale ring. */
export const HEAD_DARK: HeadAsset = {
  src: "/assets/about/head-dark.png",
  aspect: "1227/1630",
  aspectVal: 1227 / 1630,
  eyes: {
    left: { x: 0.2572, y: 0.5044, widthPct: 11.46 },
    right: { x: 0.6602, y: 0.4895, widthPct: 11.46 },
    srcLeft: "/assets/about/eye-left-dark.png",
    srcRight: "/assets/about/eye-right-dark.png",
    backing: "#46121290",
  },
};

export function headAsset(theme: Theme): HeadAsset {
  return theme === "dark" ? HEAD_DARK : HEAD_LIGHT;
}
