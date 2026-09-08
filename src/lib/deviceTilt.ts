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

/**
 * WHAT THE ASK CURRENTLY AMOUNTS TO, for anything that wants to offer the
 * reader a way in (see MotionPrompt).
 *
 *   unsupported — no orientation events here at all, or no gate to pass.
 *   gated       — iOS, and nothing has come through yet. Either not asked
 *                 yet, or asked and refused; iOS gives no way to tell those
 *                 apart without asking, and asking is the thing being gated.
 *   live        — readings are arriving. Nothing more to do.
 *   denied      — iOS said no out loud. It will not ask again from here.
 */
export type TiltStatus = "unsupported" | "gated" | "live" | "denied";
let status: TiltStatus = "unsupported";

/**
 * WHAT THIS PHONE SAID LAST TIME.
 *
 * iOS gives no way to read the current permission without asking, and asking
 * needs a gesture — so on every fresh load a phone that granted access months
 * ago looks exactly like one that has never been asked. Both sit at "gated"
 * until the reader touches something. That is fine for the ask itself, which
 * resolves silently in the granted case, but it is not fine for anything
 * deciding whether to put a prompt on screen: it would offer a returning
 * reader a button they already pressed, and offer a reader who said no a
 * button that cannot work.
 *
 * So the answer is remembered when iOS gives one. Only ever a hint — the
 * reader can change their mind in Settings and this would not know — which is
 * why nothing behind the gate depends on it. The ask still runs on every
 * load regardless; this only informs what is worth SHOWING.
 */
const ANSWER_KEY = "nc-tilt-answer";
export function lastTiltAnswer(): "granted" | "denied" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(ANSWER_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}
function rememberAnswer(v: "granted" | "denied") {
  try {
    localStorage.setItem(ANSWER_KEY, v);
  } catch {
    // Storage refused. The site works the same, it just re-offers.
  }
}
const watchers = new Set<(s: TiltStatus) => void>();
function setStatus(next: TiltStatus) {
  if (status === next) return;
  status = next;
  for (const w of watchers) w(next);
}
/** The most recent reading, handed to anyone who subscribes later. */
let latest: Tilt | null = null;

function onOrient(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  // A reading is the only proof that the whole chain works. Permission can be
  // granted on a device whose sensors still report nothing, which from the
  // reader's side is identical to being blocked.
  setStatus("live");
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
    // Android and desktop: no gate, just listen. Status stays "unsupported"
    // until a reading actually lands, which is the honest reading of it —
    // plenty of desktops have no sensor behind the event.
    attach();
    return;
  }

  setStatus("gated");

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
  /* `touchstart` first, deliberately. Noah: "I would like for the mobile user
   * to be prompted with the motion control request screen right when they
   * first load the site." iOS will not let anything ask outside a user
   * gesture, so the earliest possible moment is the reader's first touch —
   * and waiting for `touchend` means a reader who lands and immediately
   * scrolls may not be asked for a while, or at all, since a scroll's touchend
   * does not always carry an activation. If touchstart turns out not to carry
   * one either, nothing is lost: the ask fails, the listeners stay, and the
   * touchend or click a moment later tries again. */
  const GESTURES = ["touchstart", "touchend", "pointerdown", "pointerup", "click"] as const;
  /* Captured after the guard above: `ask` is a hoisted function declaration,
     and TypeScript will not carry the narrowing of `DOE` into it. */
  const doe = DOE;
  /*
   * ONE TAP IS ONE ASK (2026-09-04).
   *
   * Noah, for the third time: "there's still a few issues when it comes to
   * permissions for motion."
   *
   * Widening the gesture list is what broke it. A single tap fires all five —
   * touchstart, pointerdown, pointerup, touchend, click — and each one called
   * requestPermission, so one tap spent the entire budget of five. Measured
   * against a Safari-like stub where the ask rejects without a live
   * activation: tap 1 made five asks, taps 2, 3 and 4 made none at all. On
   * iOS the early events in that cascade carry no activation, so the reader's
   * FIRST tap exhausted the budget on calls that could never succeed, the
   * listeners detached, and nothing asked again for the rest of the visit.
   *
   * Two things fix it. The budget now counts ATTEMPTS that got an answer and
   * failed, rather than events. And a gesture is collapsed to a single ask by
   * a short time window.
   *
   * The window is doing the real work, and an in-flight flag alone is not
   * enough — that was tried and measured first. The five events are five
   * separate TASKS, so the rejected promise's catch runs in the gap between
   * them and clears the flag before the next one arrives: still five asks per
   * tap. A window survives that because it does not depend on when the answer
   * comes back. 700ms is far longer than the cascade, which is a few
   * milliseconds wide, and shorter than any second tap a reader means as a
   * second tap. The flag stays as well, for the case the window cannot see:
   * an ask that is genuinely still open when the window expires.
   */
  let inFlight = false;
  const GESTURE_WINDOW_MS = 700;
  let lastAsk = 0;
  /** Failed ATTEMPTS, not events. A device that can never satisfy the call
   *  stops being asked; a reader whose first taps land badly does not. */
  const MAX_FAILED = 10;
  let failed = 0;
  const detach = () => {
    GESTURES.forEach((g) => window.removeEventListener(g, ask, { capture: true }));
  };
  function ask() {
    const now = Date.now();
    // One gesture, one ask — however many events that gesture fires.
    if (inFlight || now - lastAsk < GESTURE_WINDOW_MS) return;
    lastAsk = now;
    if (failed >= MAX_FAILED) {
      detach();
      return;
    }
    let pending: Promise<"granted" | "denied"> | undefined;
    try {
      inFlight = true;
      pending = doe.requestPermission?.();
    } catch {
      // Not a valid activation. Costs one attempt, and the listeners stay for
      // the next gesture.
      inFlight = false;
      failed += 1;
      return;
    }
    if (!pending) {
      inFlight = false;
      failed += 1;
      return;
    }
    pending
      .then((r) => {
        inFlight = false;
        if (r === "granted") {
          detach();
          attach();
          rememberAnswer("granted");
        } else if (r === "denied") {
          detach();
          setStatus("denied");
          rememberAnswer("denied");
        }
      })
      .catch(() => {
        /* The ask did not get through, so the next gesture should have another
           go — deliberately not detaching. */
        inFlight = false;
        failed += 1;
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
/** The state of the ask right now. */
export function tiltStatus(): TiltStatus {
  return status;
}

/**
 * Hear when that state changes. Fires immediately with the current value, so
 * a caller mounting late does not miss the transition it was waiting for.
 */
export function watchTiltStatus(cb: (s: TiltStatus) => void): () => void {
  if (typeof window === "undefined") return () => {};
  watchers.add(cb);
  cb(status);
  return () => {
    watchers.delete(cb);
  };
}

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
