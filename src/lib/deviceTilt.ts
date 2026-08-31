"use client";

/**
 * ONE PLACE THAT ASKS THE PHONE WHICH WAY IS DOWN (2026-08-30).
 *
 * Noah, twice: "the motion feature isn't working on the mobile site.
 * Everything is stationery" — and then "I'm still not seeing the header icons
 * move around when I tilt my phone."
 *
 * Two separate features read the device's orientation: the header's falling
 * icons (useDropField) and the head's eyes (HeadWithEyes). They each attached
 * their own `deviceorientation` listener, and only ONE of them — the drop
 * field — ever asked iOS for permission. iOS 13 and later deliver nothing at
 * all until that ask is granted, so:
 *
 *   - On the HOME page, which is where Noah was testing, the drop field is
 *     not mounted at all. Nothing asked. The eyes' listener was attached to
 *     an event that was never going to fire.
 *   - Even on a project page, the ask and the eyes lived in different
 *     components with no guarantee about which mounted first.
 *
 * So the ask belongs in one place that both read from. This module owns it:
 * the first subscriber triggers the permission flow, every subscriber gets
 * every reading, and the answer is shared rather than raced for.
 *
 * The ask itself has to happen inside a user gesture — that is an iOS rule,
 * not a choice — so it rides on the first touch, pointer-up or click
 * anywhere on the page. Until then, and on any device that refuses or does
 * not support orientation, subscribers simply never hear anything and keep
 * whatever default they already have. There is no broken state to land in.
 */

export type Tilt = {
  /** Left-right, positive with the right edge down. Range roughly -1..1. */
  x: number;
  /** Front-back, positive with the top edge away from you. Roughly -1..1. */
  y: number;
};

type Listener = (t: Tilt) => void;

const listeners = new Set<Listener>();
let started = false;
/** The most recent reading, handed to anyone who subscribes later. */
let latest: Tilt | null = null;

function onOrient(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  const rad = Math.PI / 180;
  // (sin gamma, sin beta) is the direction "down" points in the plane of the
  // screen — which is what both callers want, one as gravity and one as the
  // direction a pair of googly eyes would roll.
  const x = Math.sin(e.gamma * rad);
  const y = Math.sin(e.beta * rad);
  const m = Math.hypot(x, y);
  latest = m > 1 ? { x: x / m, y: y / m } : { x, y };
  for (const l of listeners) l(latest);
}

/** iOS-only: the permission gate. Elsewhere this resolves immediately. */
function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  const attach = () => window.addEventListener("deviceorientation", onOrient);

  type PermissionCapable = {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  const DOE = window.DeviceOrientationEvent as
    | (typeof window.DeviceOrientationEvent & PermissionCapable)
    | undefined;

  if (!DOE) return;

  if (typeof DOE.requestPermission !== "function") {
    // Android and desktop: no gate, just listen.
    attach();
    return;
  }

  /* Any first gesture, not only a touchend. A reader whose first interaction
   * is a tap on a link rather than a scroll was never being asked at all. */
  const GESTURES = ["touchend", "pointerup", "click"] as const;
  const ask = () => {
    GESTURES.forEach((g) => window.removeEventListener(g, ask));
    DOE.requestPermission?.()
      .then((r) => {
        if (r === "granted") attach();
      })
      .catch(() => {});
  };
  GESTURES.forEach((g) => window.addEventListener(g, ask, { once: true }));
}

/**
 * Hear about the device's tilt. Returns an unsubscribe function.
 *
 * Safe to call on the server and on a desktop: it simply never fires.
 */
export function subscribeTilt(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  start();
  // Someone subscribing after the first reading should not have to wait for
  // the phone to move again before they know which way is down.
  if (latest) listener(latest);
  return () => {
    listeners.delete(listener);
  };
}
