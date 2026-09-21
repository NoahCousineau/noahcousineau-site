import NotFoundLockup from "@/components/NotFoundLockup";
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
 * SIZED EXACTLY LIKE THE AWAY SCREEN (2026-09-20). Noah: "Just make sure it's
 * the same size as the clock and text in the 'It's time to contact noah'
 * overlay." It had been written in plain viewport units, which agreed with the
 * away screen only around 1280 wide and left the disc a quarter smaller on a
 * phone. Both now read their sizes from lib/clockLockup. See NotFoundLockup.
 */

export const metadata = { title: "404 — Noah Cousineau" };

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
        /* VERTICAL ONLY. `--u` is 100cqw of the artboard inside, and the
           away screen's artboard spans the whole viewport — so any padding
           here makes this lockup smaller than that one at the same width.
           Measured with 1.5rem of it at 1280: a 333.7px disc against the away
           screen's 346.7px. The lockup is centred and sized as a fraction of
           --u, exactly as the away screen's is, so it needs no side padding
           to stay clear of the edges. */
        padding: "clamp(3rem, 10vh, 8rem) 0",
      }}
    >
      <SuppressAwayScreen />
      <NotFoundLockup />
    </main>
  );
}
