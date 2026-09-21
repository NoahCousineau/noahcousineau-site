import type { CSSProperties } from "react";

/**
 * ONE SET OF SIZES FOR THE CLOCK LOCKUP (2026-09-20).
 *
 * Noah, of the 404: "Just make sure it's the same size as the clock and text
 * in the 'It's time to contact noah' overlay."
 *
 * They were not. The away screen sizes its clock in artboard units per tier
 * while the 404 had been written in plain viewport units, so the two only
 * agreed by coincidence at around 1280 wide. Measured before this: on a
 * 390px phone the 404's disc was 203px against the away screen's 268px, and
 * its link was 22.4px against 14px at 1280.
 *
 * So the numbers live here and both screens read them. The expressions are
 * the away screen's own, unchanged — it is the one that was right.
 *
 * All of them are written against `--u`, the artboard unit, which only has a
 * value inside an element with the `artboard` class (`container-type:
 * inline-size`). Both callers set ARTBOARD_U on such an element.
 */

/** The artboard unit these sizes are written against. */
export const ARTBOARD_U = "calc(100cqw / 1920)";

/**
 * The clock's width, by tier.
 *
 * Phone: bigger as a share of the screen, since it is not sharing a row with
 * anything. In between: its own size, because the desktop expression at 900px
 * wide is only 244px — small in a window with nothing else in it.
 */
export function clockWidth(phone: boolean, compact: boolean): string {
  if (phone) return "min(calc(var(--u) * 1320), 34vh)";
  if (compact) return "min(calc(var(--u) * 720), 58vh)";
  return "min(calc(var(--u) * 520), 52vh)";
}

/**
 * The arcs are drawn in a box 140% of the disc, so they reach a fifth of it
 * past the edge, above and below. Anything laying out beneath the clock has
 * to reserve that, or it lands on the bottom arc.
 */
export function clockArcOverhang(phone: boolean, compact: boolean): string {
  return `calc((${clockWidth(phone, compact)}) * 0.2)`;
}

/** Type set beside the lockup: the away screen's contact links, the 404's way
 *  out. Roughly double on a phone, and not clamped as small. */
export function lockupLinkStyle(phone: boolean): CSSProperties {
  return {
    color: "var(--color-paper)",
    textDecoration: "none",
    display: "block",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-sans)",
    fontSize: phone
      ? "clamp(0.95rem, calc(var(--u) * 46), 1.5rem)"
      : "clamp(0.62rem, calc(var(--u) * 21), 1.1rem)",
    letterSpacing: "0.02em",
    borderBottom: "2px solid var(--color-paper)",
    paddingBottom: "0.32em",
  };
}
