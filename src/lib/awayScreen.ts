/**
 * A PAGE CAN HOLD THE AWAY SCREEN DOWN (2026-09-20).
 *
 * Noah: "On the 404 page, I would NOT like for the 'it's time to contact
 * Noah' page to come up over the 404 page if the user isn't interacting with
 * the site."
 *
 * The 404 page is now the clock lockup itself, so raising the away screen
 * over it would cover one clock with another, and the reader sitting still
 * reading a dead end is the likeliest reader there is.
 *
 * Route matching cannot answer this: a 404 keeps whatever URL was typed, so
 * there is no path to test for. The page says so itself instead, by mounting
 * SuppressAwayScreen for as long as it is on screen.
 *
 * A count rather than a flag, so two overlapping holders (a remount in
 * development's double-invoked effects, say) cannot have the first one to
 * leave release the screen for both. Read at check time by AwayOverlay's
 * idle poll and leave handlers, so nothing needs to re-render for it.
 */
let holders = 0;

/** Hold the away screen down. Call the returned function to release it. */
export function suppressAwayScreen(): () => void {
  holders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
  };
}

export function isAwayScreenSuppressed(): boolean {
  return holders > 0;
}
