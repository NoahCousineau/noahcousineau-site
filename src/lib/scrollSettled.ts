/**
 * Run something once the page has stopped scrolling.
 *
 * 2026-10-19. Both footer arrivals — the C mark's roll and the pointing
 * hand's fall — have a fallback for the reader who is ALREADY at the bottom
 * when the component mounts: a reload down there, or a browser restoring the
 * scroll position, never crosses a ScrollTrigger, so without it the mark
 * would simply be sitting there having never arrived.
 *
 * That fallback read the scroll position the instant it mounted, and on a
 * client-side navigation that instant is a lie: the new page mounts while
 * the window is still at the bottom of the OLD one, and Lenis then eases
 * back to the top. The trigger reported itself as passed, the roll set off
 * immediately, and by the time the reader scrolled down to the footer it had
 * long since arrived — which is exactly the "it's already loaded on the
 * page" this was meant to prevent.
 *
 * Waiting for the position to hold still for a few frames tells the two
 * apart: a real arrival at the bottom is stable at once, while a navigation
 * is on its way somewhere. If the reader is scrolling, it never settles and
 * the callback never runs — which is right, because the trigger itself will
 * do the honours.
 */
export function whenScrollSettles(run: () => void, framesStill = 12): () => void {
  let raf = 0;
  let lastY = Number.NaN;
  let still = 0;
  const tick = () => {
    const y = window.scrollY;
    still = y === lastY ? still + 1 : 0;
    lastY = y;
    if (still < framesStill) {
      raf = requestAnimationFrame(tick);
      return;
    }
    run();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
