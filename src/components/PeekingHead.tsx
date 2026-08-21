"use client";

import HeadWithEyes from "./HeadWithEyes";

/*
 * The footer's head, peeking up over the bottom edge of the browser window
 * (2026-08-20, per Noah: "at the bottom of the browser window, I want my
 * head to just peek out from the bottom. This will have the same eye
 * tracking as on the about me page, but the head can't be moved.")
 *
 * Same artwork and same tracking as the About page's head, minus the
 * physics — it shares HeadWithEyes so the socket coordinates can't drift
 * between the two.
 *
 * HOW MUCH SHOWS: the head is pushed below its container by a fraction of
 * its own height, so the cut is proportional and the same amount of face
 * shows at every viewport width. REVEAL_FRACTION is set just past the eye
 * line — the sockets sit at ~41.6% down the artwork, so revealing ~52%
 * clears them with room to spare and the tracking is actually visible,
 * which is the whole point of putting a tracking head down there.
 *
 * pointer-events are off: it's scenery, and it sits over the footer's link
 * columns' airspace, so it must never intercept a click meant for them.
 */

/** Share of the head's height left visible above the bottom edge. */
const REVEAL_FRACTION = 0.52;
/** Head width in artboard units. */
const HEAD_WIDTH_UNITS = 300;
/** Head height in the same units, from the artwork's 1297x1970 aspect. */
const HEAD_HEIGHT_UNITS = (HEAD_WIDTH_UNITS * 1970) / 1297;
const HIDDEN_UNITS = HEAD_HEIGHT_UNITS * (1 - REVEAL_FRACTION);

export default function PeekingHead({
  /** Horizontal centre, in artboard units. Defaults to the page centre; the
   * footer places it under its right-hand link columns instead (2026-08-20,
   * per Noah: "shift the head over so it's below the 'about me' and email
   * link"). */
  centerXUnits = 960,
}: {
  centerXUnits?: number;
}) {
  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        width: `calc(var(--u) * ${HEAD_WIDTH_UNITS})`,
        bottom: `calc(var(--u) * -${HIDDEN_UNITS})`,
        left: `calc(var(--u) * ${centerXUnits})`,
        transform: "translateX(-50%)",
      }}
      aria-hidden
    >
      <HeadWithEyes />
    </div>
  );
}
