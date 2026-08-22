"use client";

import Link from "next/link";
import HeadWithEyes from "./HeadWithEyes";
import { useTheme } from "./ThemeProvider";
import { headAsset } from "@/lib/headAssets";

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
 * LINKS TO ABOUT ME (2026-08-20, second pass — Noah: "Let's also make the
 * head on the footer a link to the 'about me' page.") The OUTER wrapper
 * stays `pointer-events-none` — it's still scenery first, and sits over
 * the footer's link columns' airspace, so it must never intercept a click
 * meant for THEM. Only the <Link> immediately around the head re-enables
 * pointer events, so the clickable area is scoped to exactly the head's
 * own box (which sits well clear of the link columns above it), not the
 * empty space around it.
 */

/** Share of the head's height left visible above the bottom edge.
 *
 * Recomputed 2026-08-21 when the neck came off the artwork. The number that
 * matters is where the EYE LINE sits, since the whole point of a tracking
 * head down here is that you can see it tracking. On the old head+neck
 * image the sockets were ~41.6% down the box; on the neck-less crops they
 * sit at ~47% (light) and ~50% (dark, behind the shades), because the box
 * lost height from the bottom so every feature's fraction grew. 0.66
 * clears both with room to spare while keeping it a peek rather than a
 * whole head. */
const REVEAL_FRACTION = 0.66;
/** Head width in artboard units. */
const HEAD_WIDTH_UNITS = 300;

export default function PeekingHead({
  /** Horizontal centre, in artboard units. Defaults to the page centre; the
   * footer places it under its right-hand link columns instead (2026-08-20,
   * per Noah: "shift the head over so it's below the 'about me' and email
   * link"). */
  centerXUnits = 960,
}: {
  centerXUnits?: number;
}) {
  /* Sized from the CURRENT theme's own aspect rather than one fixed number.
   * With a single hardcoded height the shorter dark head was letterboxed
   * inside a box shaped for the light one, so the same `bottom` offset hid
   * more of it and it sat visibly lower — Noah: "I would like the dark mode
   * head to be moved up a bit." Deriving the height per variant means both
   * heads reveal the same FRACTION OF THEMSELVES, which is what the reveal
   * was always meant to control. */
  const { theme } = useTheme();
  const heightUnits = HEAD_WIDTH_UNITS / headAsset(theme).aspectVal;
  const hiddenUnits = heightUnits * (1 - REVEAL_FRACTION);

  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        width: `calc(var(--u) * ${HEAD_WIDTH_UNITS})`,
        bottom: `calc(var(--u) * -${hiddenUnits})`,
        left: `calc(var(--u) * ${centerXUnits})`,
        transform: "translateX(-50%)",
      }}
    >
      <Link
        href="/about"
        aria-label="About me"
        className="block pointer-events-auto hover:opacity-80 transition-opacity"
      >
        <HeadWithEyes />
      </Link>
    </div>
  );
}
