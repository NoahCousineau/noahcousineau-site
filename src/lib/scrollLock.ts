import { getLenis } from "@/components/SmoothScroll";

/**
 * Hold scrolling still while a one-off interaction plays, then hand it back.
 *
 * Added 2026-08-22 for the project pages' falling hand, per Noah: "I would
 * like it so the user can't scroll until the hand falling animation is out of
 * the viewport. Let's have it so the interaction plays, then the user can
 * scroll down." He also flagged it as an experiment — "We can revert back if
 * this doesn't feel natural" — so this is deliberately a small, self-contained
 * module with one caller.
 *
 * TAKING SCROLLING AWAY FROM SOMEONE IS A LIABILITY, so the design here is
 * mostly about guaranteeing it comes back:
 *
 *  - Every lock carries its own failsafe timer. If the caller never releases
 *    — an animation that stalls, a thrown error, a tab backgrounded mid-play
 *    so rAF stops and the completion callback never runs — the lock expires
 *    on its own. Nothing can strand the reader on a page they can't leave.
 *  - `release()` is idempotent and safe to call after the failsafe already
 *    fired, so a late completion callback can't re-lock or double-unlock.
 *  - Locks don't nest. A second lock while one is active just replaces the
 *    first's deadline; there is no counter to leak.
 *
 * Under prefers-reduced-motion there is no Lenis instance at all (see
 * SmoothScroll), and the animations this exists for don't run either, so
 * every function here degrades to a no-op rather than falling back to some
 * other mechanism.
 */

/** Keys that scroll the page, which Lenis's own wheel/touch capture misses. */
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
  "Spacebar",
]);

/** Mirrored onto <html> while a lock is held. Exists so the state is
 *  inspectable from outside this module — CSS can react to it, and it is the
 *  only way to observe the lock window from the console, since a lock lasts
 *  under two seconds and a background tab throttles timers too coarsely to
 *  sample it reliably. */
const LOCK_ATTR = "data-scroll-locked";

let active = false;
let failsafe: number | null = null;

function onKeyDown(e: KeyboardEvent) {
  // Let people keep typing — only swallow the keys that would scroll, and
  // only when focus isn't in a field.
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (SCROLL_KEYS.has(e.key)) e.preventDefault();
}

/**
 * Freeze scrolling. Returns a release function; the same release is also
 * performed automatically after `failsafeMs` no matter what the caller does.
 */
/* 3s: the hand's swing-and-fall runs 1.69s, and gsap times animations off the
 * wall clock rather than off frames, so a slow machine still finishes in that
 * same 1.69s and the normal `onComplete` release always wins. The margin is
 * only there for the case where the clock stops advancing at all — a
 * backgrounded tab throttling rAF, which was observed doing exactly this:
 * the timeline froze mid-fall and the failsafe was what handed scrolling
 * back. Keeping it tight means that worst case is a 3s pause, not longer. */
export function lockScroll(failsafeMs = 3000): () => void {
  const lenis = getLenis();
  if (!lenis) return () => {};

  if (!active) {
    active = true;
    lenis.stop();
    document.documentElement.setAttribute(LOCK_ATTR, "");
    // Lenis calls preventDefault on the wheel and touch events it captures
    // while stopped, so those are already handled; the keyboard is not.
    window.addEventListener("keydown", onKeyDown, { passive: false });
  }

  if (failsafe !== null) window.clearTimeout(failsafe);
  failsafe = window.setTimeout(releaseScroll, failsafeMs);

  return releaseScroll;
}

/** Give scrolling back. Safe to call when nothing is locked. */
export function releaseScroll(): void {
  if (failsafe !== null) {
    window.clearTimeout(failsafe);
    failsafe = null;
  }
  if (!active) return;
  active = false;
  document.documentElement.removeAttribute(LOCK_ATTR);
  window.removeEventListener("keydown", onKeyDown);
  getLenis()?.start();
}

export function isScrollLocked(): boolean {
  return active;
}
