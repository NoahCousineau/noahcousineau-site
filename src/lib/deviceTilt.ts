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

  /* KEEP OFFERING UNTIL THERE IS AN ANSWER (2026-09-01).
   *
   * Noah: "I feel that sometimes I get on the site and I get permission asked
   * to do this and other times I don't. I want to make sure users have the
   * option to see the header icon tilt on mobile."
   *
   * This used to remove all three listeners on the FIRST gesture — before it
   * knew whether the ask had worked. iOS only honours requestPermission()
   * inside a live user activation, and there are several ordinary ways for
   * the first gesture not to carry one: the tap that lands while the loading
   * screen is still up and gets swallowed, a gesture whose activation has
   * already been spent, a `pointerup` that Safari does not treat as one. Any
   * of those left the promise rejecting into an empty catch with every
   * listener already gone, so that visit simply never asked again — the
   * reader gets a page whose icons cannot move and no way to find out why.
   *
   * So the listeners now stay until iOS actually answers. "granted" attaches
   * and stops; "denied" stops too, because that is an answer and pestering
   * someone who said no is worse than not asking. Anything else — a
   * rejection, a throw, no promise at all — leaves them in place so the next
   * tap tries again. Capped, so a device that can never satisfy the call is
   * not asked on every tap forever.
   *
   * Capture phase, so a handler that stops propagation on its own element
   * cannot quietly cost the reader the feature.
   */
  const GESTURES = ["touchend", "pointerup", "click"] as const;
  /* Captured after the guard above: `ask` is a hoisted function declaration,
     and TypeScript will not carry the narrowing of `DOE` into it. */
  const doe = DOE;
  const MAX_ASKS = 5;
  let asks = 0;
  const detach = () => {
    GESTURES.forEach((g) => window.removeEventListener(g, ask, { capture: true }));
  };
  function ask() {
    if (asks >= MAX_ASKS) {
      detach();
      return;
    }
    asks += 1;
    let pending: Promise<"granted" | "denied"> | undefined;
    try {
      pending = doe.requestPermission?.();
    } catch {
      return; // not a valid activation — leave the listeners for the next one
    }
    if (!pending) return;
    pending
      .then((r) => {
        if (r === "granted") {
          detach();
          attach();
        } else if (r === "denied") {
          detach();
        }
      })
      .catch(() => {
        /* Deliberately empty AND deliberately not detaching: the ask did not
           get through, so the next gesture should have another go. */
      });
  }
  GESTURES.forEach((g) => window.addEventListener(g, ask, { capture: true }));
}

/**
 * ASK FOR ORIENTATION WITHOUT WANTING THE READINGS (2026-09-03).
 *
 * Noah: "can we also always make sure the mobile user is prompted with motion
 * controls when they first open the site? Sometimes the site asks for mobile
 * controls, other times it doesn't. Let's just make sure it asks the mobile
 * user once each time they load any part of the overall website."
 *
 * The ask used to be a side effect of something SUBSCRIBING — the header's
 * icon pile, the home grid's objects, the footer head's eyes — so which pages
 * asked depended on which of those happened to be mounted. This makes it a
 * property of the site instead: mounted once in the root layout, every page
 * asks, and nothing has to want the readings for the reader to be offered
 * them. See TiltPrimer.
 *
 * WHAT THIS CANNOT DO, and it is worth being straight about: iOS remembers
 * the answer per site. Once granted it never shows the sheet again — the
 * readings simply start arriving — and once denied it will not re-ask at all,
 * from anywhere. So this guarantees the site always ASKS; whether a dialog
 * appears is the browser's to decide.
 */
export function primeTilt(): void {
  if (typeof window === "undefined") return;
  start();
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
