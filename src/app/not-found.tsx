import MickeyWatch from "@/components/MickeyWatch";

/*
 * THE 404 (added 2026-08-30, rebuilt around the clock the same day).
 *
 * Without this file Next serves its own built-in 404: unstyled white, black
 * system type, no way back. That page matters more than usual here — the
 * site is moving off Webflow, so every old Webflow URL anyone has bookmarked
 * or linked lands on it the moment the DNS flips.
 *
 * Noah: "For a 404 page, generate a page that has the clock animation. Don't
 * have the 'it's time to contact noah' text, or the contact info. Just have
 * the clock and below have 404 text."
 *
 * So this is the away screen's lockup with everything but the watch taken
 * off it: no arc type around the disc, no contact columns flanking it. The
 * watch itself is the same live component the away screen uses, hands set
 * from the current time, so there is only one clock in the codebase.
 *
 * COLOUR follows the away screen's rule exactly: the panel is --color-ink
 * and every mark on it is --color-paper, so the whole thing inverts as one
 * — ink panel with a white disc in light mode, white panel with a black disc
 * in dark. The watch artwork inside the disc is photographic and is left
 * alone, which is what the away screen does too.
 *
 * SIZED IN VIEWPORT UNITS, not the artboard `--u`. Everything else on the
 * site scales with viewport WIDTH, which on a phone would put this page's
 * type around 4px (see CLAUDE.md). A dead end is the one screen that has to
 * stay readable at every size.
 *
 * There is no "go home" link here on purpose — Noah asked for the clock and
 * the number, nothing else. The C mark in the corner and the site footer
 * below both still lead out, so the page is not a trap.
 */

export const metadata = { title: "404 — Noah Cousineau" };

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--color-ink)",
        color: "var(--color-paper)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(1.5rem, 4vh, 3.5rem)",
        padding: "clamp(3rem, 10vh, 8rem) 1.5rem",
      }}
    >
      {/* The clock. The disc is the paper token so it inverts with the theme;
          the watch is drawn oversized inside it and clipped to the circle,
          which is how the away screen crops it to a clean edge. */}
      <div
        style={{
          position: "relative",
          width: "min(60vw, 46vh)",
          aspectRatio: "1 / 1",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            background: "var(--color-paper)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "153%",
              height: "153%",
              left: "-26.5%",
              top: "-26.5%",
            }}
          >
            <MickeyWatch />
          </div>
        </div>
      </div>

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(2.5rem, 9vw, 7rem)",
          lineHeight: 1,
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        404
      </p>
    </main>
  );
}
