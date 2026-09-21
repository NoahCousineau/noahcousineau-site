import Link from "next/link";

import ClockFace from "@/components/ClockFace";
import SuppressAwayScreen from "@/components/SuppressAwayScreen";

/*
 * THE 404 (added 2026-08-30, rebuilt around the clock the same day, given the
 * clock's own words on 2026-09-20).
 *
 * Without this file Next serves its own built-in 404: unstyled white, black
 * system type, no way back. That page matters more than usual here — the site
 * is moving off Webflow, so every old Webflow URL anyone has bookmarked or
 * linked lands on it the moment the DNS flips.
 *
 * Noah, first: "For a 404 page, generate a page that has the clock animation.
 * Don't have the 'it's time to contact noah' text... Just have the clock and
 * below have 404 text." Then, once he had seen it: "I would like for the
 * clock to have 'Oops! This is the' above the clock and '404 page!' below the
 * clock. The text should be formatted and arced like how the 'It's time to'
 * and 'contact Noah' text is. It should have the same animation as well.
 * Below the '404 page!' there should be some text that says 'return to
 * safety'. This is not on the clock, but just below it."
 *
 * So it is the away screen's lockup, wearing this page's words — the same
 * ClockFace, so the arcs can never drift from the ones on the contact screen.
 * The standalone "404" numeral this page used to carry is gone: the bottom
 * arc says it now, and two of them read as a mistake. The shimmer runs the
 * whole time, because here the lockup is the page rather than something that
 * appears over it.
 *
 * AND THE AWAY SCREEN STAYS DOWN, per Noah: "On the 404 page, I would NOT
 * like for the 'it's time to contact Noah' page to come up over the 404 page
 * if the user isn't interacting with the site." It is the same lockup, so it
 * would cover one clock with another. See SuppressAwayScreen.
 *
 * COLOUR follows the away screen's rule exactly: the panel is --color-ink and
 * every mark on it is --color-paper, so the whole thing inverts as one — ink
 * panel with a white disc in light mode, white panel with a black disc in
 * dark. The watch artwork inside the disc is photographic and is left alone,
 * which is what the away screen does too.
 *
 * SIZED IN VIEWPORT UNITS, not the artboard `--u`. Everything else on the
 * site scales with viewport WIDTH, which on a phone would put this page's
 * type around 4px (see CLAUDE.md). A dead end is the one screen that has to
 * stay readable at every size.
 */

export const metadata = { title: "404 — Noah Cousineau" };

/* Both phrases sit at the lockup's own size, the way the contact screen's
 * pair do — Noah asked for this text "formatted and arced like how the 'It's
 * time to' and 'contact Noah' text is". "OOPS! THIS IS THE" is the longest
 * phrase either lockup carries and it was set smaller at first out of
 * caution; measured, it fills 60% of its half circle at the full size against
 * 47% for "CONTACT NOAH", so it is denser than its neighbours and nowhere
 * near the ends. Smaller only made it look like a different piece of type. */

/** The lockup's size, named so the room its arcs need follows from it. */
const CLOCK_SIZE = "min(52vw, 40vh)";
/* The arcs are drawn in a box 140% of the disc, so they reach a fifth of the
 * disc past it above and below. That has to be RESERVED, not left to the
 * gap below: measured at 1280x860, the gap alone put "RETURN TO SAFETY" five
 * pixels on top of the lowest letter of "404 PAGE!". */
const ARC_OVERHANG = `calc(${CLOCK_SIZE} * 0.2)`;

export default function NotFound() {
  return (
    <main
      data-not-found
      style={{
        minHeight: "100dvh",
        background: "var(--color-ink)",
        color: "var(--color-paper)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(2rem, 6vh, 4.5rem)",
        padding: "clamp(3rem, 10vh, 8rem) 1.5rem",
      }}
    >
      <SuppressAwayScreen />

      {/* The square is the disc; the arcs overflow it by ARC_OVERHANG, which
          the margin reserves so nothing can be laid out on top of them. */}
      <div
        style={{
          position: "relative",
          width: CLOCK_SIZE,
          aspectRatio: "1 / 1",
          marginBlock: ARC_OVERHANG,
          flexShrink: 0,
        }}
      >
        <ClockFace
          idPrefix="not-found-clock"
          top="Oops! This is the"
          bottom="404 page!"
          /* The page IS the lockup here, so the light never stops sweeping. */
          active
        />
      </div>

      {/* Below the clock, not on it — and the way out. */}
      <Link
        href="/"
        data-return-home
        style={{
          fontFamily: "var(--font-sans)",
          color: "var(--color-paper)",
          textDecoration: "none",
          textTransform: "uppercase",
          fontSize: "clamp(0.95rem, 2.4vw, 1.4rem)",
          letterSpacing: "0.02em",
          borderBottom: "2px solid var(--color-paper)",
          paddingBottom: "0.32em",
          whiteSpace: "nowrap",
        }}
      >
        Return to safety
      </Link>
    </main>
  );
}
