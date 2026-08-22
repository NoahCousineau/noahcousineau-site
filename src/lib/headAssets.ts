import type { Theme } from "@/components/ThemeProvider";

/**
 * The two cut-out heads used by the About page's throwable ragdoll and the
 * footer's peeking head, one per theme.
 *
 * NO NECK (2026-08-21, per Noah: "Let's also try removing the neck with the
 * attached image... This might be easier to roll as well.") Both heads are
 * cut off at the jaw with a rounded chin rather than running down into a
 * neck and shoulders. He's right that it rolls better: the old silhouette's
 * neck was a long straight-sided stub that made the shape's support
 * distance swing wildly with rotation, which is what produced the "dip"
 * he kept seeing at the header's bottom edge.
 *
 * NO EYE TRACKING IN DARK MODE, on purpose. The dark head is wearing
 * sunglasses, so there are no visible eyes to track — the light head's
 * effect works by punching transparent sockets through the artwork and
 * sliding pupil images behind them, and there is simply nothing to look
 * through here. That's the joke landing correctly rather than a feature
 * being dropped: in dark mode he's wearing shades, so you can't see where
 * he's looking.
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
  /** Cursor-tracking eyes, or null when the head is wearing sunglasses. */
  eyes: {
    left: { x: number; y: number; widthPct: number };
    right: { x: number; y: number; widthPct: number };
  } | null;
};

/* Eye socket centres are the centroids of the transparent holes in
 * head-noneck.png, measured off its alpha channel (holes at x298-424/y742-777
 * and x706-836/y730-769 on the 1227x1749 canvas). The rendered pupil is ~1.15x
 * the hole so the socket edge is always covered — the same ratio the previous
 * hand-tuned constants used, carried over rather than re-guessed. */
export const HEAD_LIGHT: HeadAsset = {
  src: "/assets/about/head-noneck.png",
  aspect: "1227/1749",
  aspectVal: 1227 / 1749,
  eyes: {
    left: { x: 0.2937, y: 0.435, widthPct: 11.84 },
    right: { x: 0.6272, y: 0.4293, widthPct: 12.26 },
  },
};

export const HEAD_DARK: HeadAsset = {
  src: "/assets/about/head-dark.png",
  aspect: "1227/1561",
  aspectVal: 1227 / 1561,
  eyes: null,
};

export function headAsset(theme: Theme): HeadAsset {
  return theme === "dark" ? HEAD_DARK : HEAD_LIGHT;
}
