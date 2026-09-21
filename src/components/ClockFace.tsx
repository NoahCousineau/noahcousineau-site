"use client";

import MickeyWatch from "./MickeyWatch";
import { ArcText, BottomArcText } from "./ArcText";

/*
 * THE CLOCK LOCKUP: white disc, live watch, and a phrase arced above and
 * below it (2026-09-20).
 *
 * Lifted out of AwayOverlay when the 404 page asked for the same lockup with
 * different words — Noah: "I would like for the clock to have 'Oops! This is
 * the' above the clock and '404 page!' below the clock. The text should be
 * formatted and arced like how the 'It's time to' and 'contact Noah' text is.
 * It should have the same animation as well."
 *
 * The geometry below is exact and was arrived at by eye over several rounds,
 * so it lives in one place rather than being copied to the second caller —
 * the same reasoning as the note at the top of ArcText.
 *
 * The caller owns the box: this fills a square, position:relative parent and
 * paints in --color-paper, so it inverts with the theme wherever it is used.
 *
 * ARC GEOMETRY.
 *
 * The arcs are drawn in a 100x100 viewBox laid over a box sized 140% of the
 * white circle and offset -20%, so within that viewBox the circle is centred
 * at (50, 50) with radius 100/140 * 50 = 35.71. Text follows the circle's
 * curve only if its path is drawn on a CONCENTRIC circle.
 *
 * THE TWO ARCS NEED DIFFERENT RADII. SVG glyphs sit with their baseline ON
 * the path and their bodies extending toward the path's left-hand side:
 *
 *   - Top arc, travelling left-to-right over the top, puts that side OUTWARD,
 *     so the letters grow away from the circle. A baseline at circle + gap is
 *     already clear.
 *   - Bottom arc, travelling left-to-right under the bottom, puts that side
 *     INWARD, so the letters grow back toward the circle. A baseline at
 *     circle + gap therefore drops the letter TOPS inside the circle. Its
 *     baseline has to sit a cap-height further out.
 *
 * Expressing both from one TEXT_INNER_R means the two labels occupy the same
 * band, so the gap reads identically top and bottom and both stay concentric
 * with the circle. This is how a real seal is set.
 */
const CIRCLE_CENTRE = 50;
const CIRCLE_R = 35.71;
/** Clear space between the circle's edge and the nearest ink. */
const ARC_GAP = 3;
/** Cap height as a share of font size, for Akzidenz. */
const CAP_RATIO = 0.75;
/** Inner edge of the text band — the same for both labels. */
const TEXT_INNER_R = CIRCLE_R + ARC_GAP;
/** Top label: baseline is the inner edge; letters grow outward from it. */
const TOP_ARC_R = TEXT_INNER_R;
/** Bottom label: letters grow inward, so the baseline sits a cap-height
 *  beyond the inner edge to leave the same clear space. Derived from the
 *  phrase's own size, since the two callers set different ones. */
const bottomArcR = (fontSize: number) => TEXT_INNER_R + fontSize * CAP_RATIO;

/** The default arc size, as the away screen has always set it. */
export const ARC_FONT = 8.4;

/** The box the arcs are drawn in: 140% of the disc, centred on it. */
const ARC_BOX: React.CSSProperties = {
  width: "140%",
  height: "140%",
  left: "-20%",
  top: "-20%",
};

export default function ClockFace({
  idPrefix,
  top,
  bottom,
  active,
  live = true,
  topFontSize = ARC_FONT,
  bottomFontSize = ARC_FONT,
}: {
  /** Distinguishes the two arcs' SVG path ids from any other lockup's. */
  idPrefix: string;
  top: string;
  bottom: string;
  /** Run the shimmer. Only while the screen carrying it is actually up. */
  active: boolean;
  /** False keeps the watch itself unmounted — the away screen does not
   *  download 1.83MB of clock until the screen has been wanted once. */
  live?: boolean;
  /** A longer phrase needs a smaller size to fit its half of the circle. */
  topFontSize?: number;
  bottomFontSize?: number;
}) {
  return (
    <>
      {/* White circle backdrop, clipping the oversized watch to a clean edge */}
      <div className="absolute inset-0 rounded-full bg-[color:var(--color-paper)] overflow-hidden">
        <div
          className="absolute"
          style={{ width: "153%", height: "153%", left: "-26.5%", top: "-26.5%" }}
        >
          {live && <MickeyWatch />}
        </div>
      </div>

      {/* Top arc — letters grow outward from the baseline. */}
      <div className="absolute" style={ARC_BOX}>
        <ArcText
          id={`${idPrefix}-arc-top`}
          text={top}
          width={100}
          height={100}
          radius={TOP_ARC_R}
          centerY={CIRCLE_CENTRE}
          spanDeg={180}
          fontSize={topFontSize}
          flip={true}
          color="var(--color-paper)"
          /* The light crosses this phrase first, then the one below —
             clockwise along the top, which on screen is left to right. */
          shimmer
          shimmerPhaseMs={0}
          shimmerActive={active}
        />
      </div>

      {/* Bottom arc — letters grow inward, so this baseline sits a cap-height
          further out to keep the same clear space off the circle. */}
      <div className="absolute" style={ARC_BOX}>
        <BottomArcText
          id={`${idPrefix}-arc-bottom`}
          text={bottom}
          width={100}
          height={100}
          radius={bottomArcR(bottomFontSize)}
          centerY={CIRCLE_CENTRE}
          spanDeg={180}
          fontSize={bottomFontSize}
          color="var(--color-paper)"
          /* One second later, so it starts as the phrase above finishes.
             Counter-clockwise along the bottom — which, like the top, is left
             to right on screen, so the two read in order. */
          shimmer
          shimmerPhaseMs={1000}
          shimmerActive={active}
        />
      </div>
    </>
  );
}
