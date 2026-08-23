"use client";

/**
 * "Has the loading overlay actually got out of the way yet?"
 *
 * 2026-08-23, Noah: "Please also make sure we see the dropping down animation
 * each time."
 *
 * The project header's objects were armed from the moment the component
 * mounted, which is not the moment anyone can see them. PageLoader covers the
 * viewport with an opaque sheet until every image on the page has decoded, or
 * until its 8s cap — and a project page carries sixty-odd full-resolution
 * images, so the cap is what usually ends it. Measured on /work/more-work:
 * the overlay lifted at 8443ms, the first icon became visible at 4ms. The
 * entire fall — drop, bounce, settle — played out behind the curtain every
 * time, and the reader was shown the finished pile.
 *
 * So the drop is anchored to the REVEAL instead of to mount. This is a plain
 * module-level store rather than context: nothing renders differently because
 * of it except one hook's `enabled` flag, so a provider wrapped round the
 * whole tree would buy nothing.
 *
 * `markLoading()` is called from PageLoader's layout effect on every route
 * (it is keyed by pathname, so it remounts per navigation) and `markReady()`
 * from the same component the instant it starts fading out. Because
 * PageLoader always finishes — either everything decoded or the cap expired —
 * there is no path where this latches to `false` forever.
 */

let ready = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function markPageReady() {
  if (ready) return;
  ready = true;
  emit();
}

export function markPageLoading() {
  if (!ready) return;
  ready = false;
  emit();
}

export function subscribePageReady(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function isPageReady() {
  return ready;
}

/** Server render: nothing has been revealed yet, and this must be a stable
 *  value — useSyncExternalStore compares snapshots by identity. */
export function pageReadyServerSnapshot() {
  return false;
}
