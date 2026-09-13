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
 * On iOS the ask is made on load, which a phone that has already answered
 * accepts without a gesture, and again on the reader's first tap, which is
 * the only way iOS will show its sheet to a phone that has not. Until then, and on any device that refuses or does
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

  /*
   * ON FROM THE START (2026-09-12). Noah: "What I would prefer is for the tilt
   * to be assumed on from the start. Can tilt being on on all mobile sites be
   * the default?"
   *
   * It is, as far as each phone allows:
   *
   *   Android, and anything else without a gate — listening begins on load.
   *   iPhone that has already said yes — asked on load, with no gesture.
   *     WebKit answers straight away when the site already has an answer and
   *     only needs a gesture in order to PROMPT, so this returns "granted"
   *     silently and the readings start before the reader touches anything.
   *   iPhone that has never been asked — iOS will not show its sheet outside a
   *     tap, and no site can change that. The first tap anywhere brings up the
   *     sheet; nothing else is put on screen to invite it.
   *
   * The on-screen "tap to tilt" offer is gone at Noah's request, and with it
   * the status and remembered-answer plumbing that only it used.
   */
  if (typeof DOE.requestPermission !== "function") {
    attach();
    return;
  }

  /* Captured after the guard above: `ask` is a hoisted function declaration,
     and TypeScript will not carry the narrowing of `DOE` into it. */
  const doe = DOE;
  let settled = false;
  const GESTURES = ["touchstart", "touchend", "pointerdown", "pointerup", "click"] as const;
  const detach = () => {
    GESTURES.forEach((g) => window.removeEventListener(g, ask, { capture: true }));
  };
  const settle = (r: "granted" | "denied") => {
    if (settled) return;
    settled = true;
    detach();
    if (r === "granted") attach();
  };

  // A phone that has already answered is told so here, without a gesture.
  // A phone that has not rejects this without it counting against anything.
  try {
    doe.requestPermission?.()?.then(settle).catch(() => {});
  } catch {
    // Older WebKit threw synchronously instead of rejecting. Same meaning.
  }

  /*
   * A TAP IS SEVERAL CHANCES, NOT ONE (2026-09-12).
   *
   * The previous version collapsed each tap to a single ask with a 700ms
   * window, and that meant a fresh iPhone could never grant. The first event
   * in a tap is pointerdown or touchstart, and the HTML spec's activation
   * rules give neither one a user activation. So the first ask was rejected,
   * and the window then threw away the pointerup, touchend and click behind
   * it, which DO carry activation. Measured with a stub that follows the
   * spec's rules: four taps, four rejected pointerdown asks, and not one
   * sheet shown. Returning phones never noticed, because their answer needs
   * no gesture.
   *
   * So a rejection hands the next event straight back its turn, and only an
   * ask that is genuinely open blocks the ones behind it, since that one IS
   * the sheet. A device that can never be satisfied is still bounded, but by
   * taps: every event in one tap counts as a single failed tap.
   */
  let inFlight = false;
  const MAX_FAILED_TAPS = 10;
  let failedTaps = 0;
  let lastFailAt = -Infinity;
  const fail = () => {
    inFlight = false;
    const now = Date.now();
    if (now - lastFailAt > 700) failedTaps += 1;
    lastFailAt = now;
    if (failedTaps >= MAX_FAILED_TAPS) detach();
  };
  function ask() {
    if (settled || inFlight) return;
    let pending: Promise<"granted" | "denied"> | undefined;
    try {
      inFlight = true;
      pending = doe.requestPermission?.();
    } catch {
      fail();
      return;
    }
    if (!pending) {
      fail();
      return;
    }
    pending
      .then((r) => {
        inFlight = false;
        settle(r);
      })
      .catch(fail);
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
