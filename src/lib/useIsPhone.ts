"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * "Is this a phone?" (2026-08-25).
 *
 * Noah: "I want phone layouts to be different, but the ipad size to stay
 * similar to the desktop site that we've been working in."
 *
 * So the line is drawn below the smallest iPad, not at some general
 * "tablet" idea: 768px is the iPad mini's portrait width and Tailwind's own
 * `md`, which means the CSS half of the mobile work can be written as
 * `max-md:` utilities and land on exactly the same side of exactly the same
 * line as this hook. One breakpoint, two spellings, no chance of them
 * disagreeing.
 *
 * WHY A HOOK AT ALL, when most responsive work is CSS: several of these
 * changes are structural rather than cosmetic — the project grid stacks to
 * one cell per row, the hero's head and lockup stack instead of sitting side
 * by side, the header's falling objects swap mouse dragging for device
 * orientation. Those are different element trees, not different values, and
 * a media query cannot express them.
 *
 * HYDRATION-SAFE BY CONSTRUCTION. React calls `getServerSnapshot` for the
 * server render AND for the client's first, pre-hydration render, so both
 * agree on `false` and there is nothing to diff; the real answer arrives
 * immediately afterwards. Reading `matchMedia` during render instead would
 * print a mismatch on every phone load, and a `useEffect` + `useState` pair
 * would do the same work with an extra render and more places to get the
 * subscription wrong.
 */

/* Moved to 1199 and back again on 2026-08-29 — see the tier note in
 * globals.css. The middle widths keep the DESKTOP layout, full-bleed; what
 * they needed was floors under the small labels, not a different layout. */
export const PHONE_MAX_WIDTH = 767;
const QUERY = `(max-width: ${PHONE_MAX_WIDTH}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** True on phone-width viewports. Always false on the server and on the
 *  first client render — see the note above. */
export function useIsPhone(): boolean {
  const getSnapshot = useCallback(() => window.matchMedia(QUERY).matches, []);
  // A plain `false` literal is a stable value, so this cannot loop.
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/*
 * THE MIDDLE TIER (2026-08-29).
 *
 * Noah, on the footer at an in-between width: "I don't like how the head is
 * interfering with the links... Please scale the head (and the teeter totter)
 * and the project links so it feels like a natural in-between of the desktop
 * size and the mobile size."
 *
 * WHY THE FOOTER NEEDS ITS OWN LINE AND THE REST OF THE SITE DOES NOT. Most
 * of the site is display type and images, which scale with `--u` perfectly
 * well at any width. The footer's link list does not, and the arithmetic says
 * so exactly: each column's rule is RULE_WIDTH = 204.22 units and its label is
 * 17.9 units, a ratio fixed by the design. Holding the label at a legible 11px
 * therefore needs the column to be at least 204.22/17.9 x 11 = 125.5px, which
 * needs `--u` >= 0.615 — a 1180px window. Below that, the desktop block's six
 * columns stop working at any legible size.
 *
 * THIS IS NO LONGER THE FOOTER'S LAYOUT LINE (2026-11-10). It still governs
 * AwayOverlay, FallenHand, LoadingWorm and the 404 lockup, but the footer's
 * links moved to FOOTER_SPREAD_MAX_WIDTH / FOOTER_STACK_MAX_WIDTH below —
 * a compressed desktop window gets a spread of the same four sections rather
 * than the phone's two columns. See the long note in Footer.tsx.
 */
export const MID_MAX_WIDTH = 1199;
const MID_QUERY = `(max-width: ${MID_MAX_WIDTH}px)`;

function subscribeMid(onChange: () => void) {
  const mql = window.matchMedia(MID_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** True below 1200px — phones included. Same hydration-safe shape as
 *  useIsPhone above: false for the server and the first client render. */
export function useIsCompact(): boolean {
  return useSyncExternalStore(
    subscribeMid,
    () => window.matchMedia(MID_QUERY).matches,
    () => false
  );
}

/* THE FOOTER'S THREE TIERS (2026-11-10). Noah, on a ~640px window: "It gets
 * a little awkward when I have to compress the browser window... Instead of
 * acting like the mobile in this situation, make the footer text smaller and
 * more like the desktop."
 *
 * So the footer no longer has one fallback. Below 1024 its four sections
 * spread out as single columns, and only a genuinely phone-sized window gets
 * the 2x2. Both numbers are measured rather than picked — the arithmetic,
 * and every label width it is based on, is in the note in Footer.tsx.
 *
 * These are the FOOTER'S lines, not the site's. useIsCompact above is still
 * the 1200 tier that AwayOverlay, FallenHand, LoadingWorm and the 404 lockup
 * key off, and it has not moved. */
export const FOOTER_STACK_MAX_WIDTH = 599;
export const FOOTER_SPREAD_MAX_WIDTH = 1179;

/* One MediaQueryList per width, cached: useSyncExternalStore resubscribes
 * whenever `subscribe` changes identity, and a fresh mql per render would
 * mean a fresh listener per render. */
const mqlCache = new Map<number, MediaQueryList>();
function mqlFor(maxWidth: number): MediaQueryList {
  let mql = mqlCache.get(maxWidth);
  if (!mql) {
    mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    mqlCache.set(maxWidth, mql);
  }
  return mql;
}

/** True at or below `maxWidth`. Same hydration-safe shape as the two hooks
 *  above: false on the server and on the first client render. */
export function useBelow(maxWidth: number): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = mqlFor(maxWidth);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [maxWidth]
  );
  const getSnapshot = useCallback(() => mqlFor(maxWidth).matches, [maxWidth]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
