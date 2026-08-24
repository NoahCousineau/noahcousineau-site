"use client";

/**
 * The rotating head's frame counter, published so the artwork around it can
 * move on the same beat.
 *
 * 2026-08-23, Noah, on the four new elements behind and in front of the head:
 * "For all of these, please synch the frames of each animation with the
 * frames of the head rotation."
 *
 * A MONOTONIC TICK, NOT THE HEAD'S FRAME INDEX. The head's own `currentFrame`
 * wraps at 31 (30 in dark), and every animation hung off it has its own
 * period — 14 for the yellow star's eight-frame ping-pong, 8 for the red's
 * five, 16/20/24 for the pencil clusters. None of those divide 31, so reading
 * the wrapped index directly would jump each animation to an unrelated point
 * in its cycle once per revolution of the head: a visible hitch, once every
 * four seconds, forever. Accumulating the SIGNED step instead means one head
 * frame always advances every dependent animation by exactly one frame, which
 * is what "synched to the head" actually means.
 *
 * Signed, because the head can also be dragged, and dragged backwards — the
 * step is taken the short way round the loop so the wrap from the last frame
 * to the first reads as +1 rather than -30.
 *
 * A module-level store rather than a prop or context: only one component
 * subscribes, and routing it through React state would re-render Hero (and so
 * the head, and so the whole composition) on every one of these ticks.
 */

let tick = 0;
const listeners = new Set<() => void>();

export function setHeadTick(next: number) {
  if (next === tick) return;
  tick = next;
  for (const l of listeners) l();
}

export function subscribeHeadTick(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getHeadTick() {
  return tick;
}

/** Server render: frame zero, and a stable value — useSyncExternalStore
 *  compares snapshots by identity. */
export function headTickServerSnapshot() {
  return 0;
}

/**
 * Where a ping-ponging sequence of `n` frames sits at this tick: 0..n-1 and
 * back down, so an eight-frame set runs 1-8 then 8-1 without repeating either
 * end. Noah: "We start with frame 1 then reach frame 8. When we reach 8, we
 * then reverse back to one, and so on."
 */
export function pingPong(t: number, n: number) {
  if (n <= 1) return 0;
  const period = 2 * n - 2;
  let p = t % period;
  if (p < 0) p += period;
  return p < n ? p : period - p;
}
