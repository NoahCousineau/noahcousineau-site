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

/* The light head is Noah's OWN export — design/02-about-me/"AboutMeHead -
 * Light Mode - No Eyes No Neck.png" — cropped to its opaque bounds, not a
 * neck cut synthesised here. His clipping is tighter and cleaner than
 * anything derived automatically, and his neck line (y1665 on the original
 * 1297x1970 canvas) lands the crop at 0.765 w/h, close enough to the dark
 * head's 0.786 that swapping between them doesn't lurch — which is exactly
 * what he asked for: "I like how the neck is treated in dark mode. Please
 * apply the same cropping to the light mode head."
 *
 * Eye socket centres are the centroids of the transparent holes measured off
 * that file's alpha channel. The rendered pupil is ~1.145x the hole so the
 * socket edge is always covered — the ratio the original hand-tuned
 * constants used, carried over rather than re-guessed. */
export const HEAD_LIGHT: HeadAsset = {
  src: "/assets/about/head-noneck.png",
  aspect: "1227/1605",
  aspectVal: 1227 / 1605,
  eyes: {
    left: { x: 0.2937, y: 0.474, widthPct: 11.85 },
    right: { x: 0.6272, y: 0.4679, widthPct: 12.22 },
  },
};

/* Dark head eye sockets sit BEHIND the sunglass lenses. Rather than punching
 * them fully transparent — which would read as two holes cut in the shades —
 * the artwork keeps partial alpha over each socket, so the tracked pupil
 * behind shows through dimly, tinted by the lens still in front of it. Noah:
 * "They'll be behind sunglasses, but I still want eyes to track the cursor
 * like how it is on light mode." */
export const HEAD_DARK: HeadAsset = {
  src: "/assets/about/head-dark.png",
  aspect: "1227/1665",
  aspectVal: 1227 / 1665,
  eyes: {
    left: { x: 0.2538, y: 0.5046, widthPct: 11.3 },
    right: { x: 0.6549, y: 0.499, widthPct: 11.3 },
  },
};

export function headAsset(theme: Theme): HeadAsset {
  return theme === "dark" ? HEAD_DARK : HEAD_LIGHT;
}
