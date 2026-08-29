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
 * needs `--u` >= 0.615 — a 1180px window. Below that, five columns of legible
 * type do not fit at any size, so flooring the label alone just runs each one
 * into its neighbour (which is what the first attempt at this did).
 *
 * So below 1200 the footer uses the PHONE's two-column arrangement, which has
 * room, with the label size clamped rather than scaled — see Footer.tsx.
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
