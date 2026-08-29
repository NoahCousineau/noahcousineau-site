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

/* 767 -> 1199 on 2026-08-29, together with the media queries in globals.css
 * that have to agree with it. See the narrow-tier note there for the
 * measurements: at 768 the desktop layout was being drawn at 40%, with 7.46px
 * footer links. The narrow layout now covers everything below 1200 and caps
 * its own growth at --narrow-max, so neither side of the line is drawn at a
 * size it was not designed for. */
export const PHONE_MAX_WIDTH = 1199;
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
