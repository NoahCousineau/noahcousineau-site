"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useThrowable, type Ground } from "@/lib/useThrowable";
import { useIsPhone } from "@/lib/useIsPhone";
import { AWAY_SCREEN_SHOWN } from "@/components/AwayOverlay";
import { isPageReady, pageReadyServerSnapshot, subscribePageReady } from "@/lib/pageReady";
import type { ProjectObject } from "@/lib/projectObjects";
import { FINALES, FLOURISHES, STEP_MS, burnPattern, poseTransform, type Move, type Pose } from "./objectFlourishes";

/**
 * A hand-shot object sitting in a project tile: it plays through its frames
 * on its own, and you can grab it and throw it around the tile.
 *
 * PLAYS BY ITSELF, ON A LOOP (2026-11-01). Noah: "Right now we have
 * animations of the icons playing when the user clicks on it. Instead, I
 * would like for these animations to start playing automatically... Let's
 * space out the time between each frame more. I want to make the pages seem
 * engaging but I don't want to overwhelm people."
 *
 * It used to be a 210ms flipbook that played once on a click and stopped on
 * its last frame. Now each frame holds at the object's own pace (`frameMs` in
 * projectObjects.ts — the apple is eaten in two seconds, the heart grows over
 * four) and lands with a small nudge (see objectFlourishes.ts), the finished
 * object rests for a good while, and then the frames run quickly backwards to
 * the start — a rewind, in whole steps like everything else here — to go
 * again. A click still does something: it plays the next frame now, rather
 * than waiting for it.
 *
 * IT STAYS WHERE IT WAS PUT. Changing frames never drops an object nobody has
 * moved — see `wakeIfMoved` in useThrowable. Noah: "let's not have the icons
 * drop unless they are touched or moved."
 *
 * DRAWN, NOT STAGED, where the artwork is a line (2026-11-01). Noah, of
 * Valley Strong's house: "Since these depend on being drawn out, let's have
 * these feel like they're being drawn out more instead of appearing in
 * stages." Objects with `strokes` uncover each new frame from the point its
 * new mark starts, and go straight on from one stroke to the next with only a
 * pen-lift between — the drawing is one continuous performance, then it
 * rests.
 *
 * STAGGERED, BY RULE AND NOT JUST BY LUCK. Noah: "the Sprouts apple and the
 * Corita Art Center heart shouldn't change frames at the exact same time."
 * Each tile starts at its own offset and draws its holds from a range, so
 * they drift apart anyway; on top of that every cut on the page books a slot
 * through `bookCut`, and one that would land within BEAT_GAP_MS of another
 * is moved to the nearest free moment after it. Two objects never cut
 * together, however their timers line up. A drawing books its first stroke; the rest follow it as one gesture.
 * An object quick enough to play all its frames as one run — the apple, the
 * ampersand — books the whole run at once, so nothing cuts in the middle.
 *
 * ONLY WHILE SOMEONE CAN SEE IT. The loop runs once the loading screen has
 * lifted, while the object is on screen, and while the tab is in front. Off
 * screen it is put back whole and where it started, as before — "When we see
 * the element, it should be in frame 1" — so arriving at a tile always finds
 * the beginning of its story. With reduced motion asked for, nothing plays by
 * itself: the object stands still on its finished frame, and a click steps
 * it on with plain cuts.
 *
 * THE FLOURISH is applied to a wrapper INSIDE the throwable element, never to
 * the throwable element itself. The physics owns that outer transform
 * completely and rewrites it every frame; animating the same node would have
 * the two fighting for the same property, and the flourish would simply
 * vanish the moment the object had ever been picked up. Separating them is
 * also what lets the loop carry on while the object is mid-throw.
 *
 * WHY EVERY FRAME IS IN THE DOM AT ONCE, stacked and all but one transparent:
 * the frames must be decoded before they are needed rather than at the
 * moment of the cut. Swapping a single img's src would fetch the next frame
 * just as it was due, and an animation that stalls reads as broken.
 */

/** Between frames, for an object that does not set its own `frameMs`. Was
 *  210 — Noah: "space out the time between each frame more." Each hold is
 *  drawn from ±HOLD_JITTER of an object's pace so the tiles drift.
 *
 *  Paces are set against the WHOLE GRID, not one tile. At 1600 with six
 *  tiles in view the page asked for about 2.4 cuts a second, and with no
 *  jitter on the queue something changed every ~460ms like a metronome —
 *  measured, and busier than "engaging but not overwhelming". See
 *  BEAT_GAP_MS for how the settings share the job. */
const HOLD_MS = 2000;
const HOLD_JITTER = 0.2;
/** An object whose `frameMs` is under this plays its frames as one run. */
const RUN_MS = 1000;
/** Frame 1, whole, before the first change of each loop. */
const FIRST_HOLD_MS = 3000;
/** The finished object, before it goes round again. */
const LAST_HOLD_MS = 5200;
/** From coming on screen to the first cut, plus this tile's place in the
 *  stagger: three offsets, so the two tiles in each desktop row differ and
 *  so do the rows. */
const ENTER_DELAY_MS = 1100;
const PHASE_STAGGER_MS = 650;
/** No two cuts anywhere on the page closer together than this.
 *
 *  It was 600, then 500, then 400, each time with the slot book below
 *  queueing tiles behind one another, which made it the real limit on the
 *  pace whenever many tiles were in view: with all six showing, the heart
 *  and the flame stepped every ~2.8-3s however short their own `frameMs` —
 *  measured, just after Noah asked for them "just slightly faster". The book
 *  now fits each cut into the nearest free moment instead, and with the
 *  nudges small and rigid the gap only needs to keep two cuts from reading
 *  as one. 300 did that, but left no room between the frames of a quick run
 *  (the flame's are 550ms apart, the apple's 620), so with both runs in view
 *  the heart and sun waited out whole runs and slowed to ~3s again. 250
 *  still separates two cuts plainly, and fits one between run frames. */
const BEAT_GAP_MS = 250;

/** How fast the pen travels, in the artwork's own canvas pixels (700 wide)
 *  per second, so a long stroke takes longer than a short one — the floor
 *  about a second, the smile a third of that. */
const PEN_PX_PER_S = 380;
const STROKE_MIN_MS = 330;
const STROKE_MAX_MS = 1200;
/** Between one stroke finishing and the next starting: the pen lifting and
 *  finding its place. ±30%, so the rhythm is a hand's and not a machine's. */
const PEN_LIFT_MS = 260;
/** A hand on a pencil: gets going, then slows to lift off. */
const PEN_EASE = "cubic-bezier(.4,0,.4,1)";
/** Corners on the disc a stroke is uncovered through. */
const DISC_SIDES = 28;

/* The slot book behind the stagger, shared by every tile on the page: every
 * cut that is coming, and whose it is.
 *
 * BOOKED AHEAD, INTO THE NEAREST GAP. A tile books its next cut the moment it
 * lands the last one, for when its hold will be over, and gets the first
 * moment at or after that which is BEAT_GAP_MS clear of every other booked
 * cut. Two earlier versions asked only when the hold was already over: the
 * first said "not yet, try again", and a tile could lose that race over and
 * over (Valley Strong's first stroke came 19 seconds late, measured); the
 * second queued it behind the latest booking. Either way a busy grid stacked
 * its tiles up one behind another and every hold came out long. Booking
 * ahead into gaps, a cut that clashes is nudged by a fraction of a second,
 * not sent to the back of a queue.
 *
 * `offsets` books several cuts as one — a rewind's quick steps back, or a
 * run's frames — so nothing lands among them. A drawing's strokes are not
 * booked one by one: they are one gesture, and each begins as a point
 * rather than arriving all at once. */
type Booking = { t: number; owner: object };
const bookings: Booking[] = [];
function bookCut(at: number, offsets: number[], owner: object): number {
  const now = performance.now();
  for (let i = bookings.length - 1; i >= 0; i--) {
    if (bookings[i].t < now - BEAT_GAP_MS) bookings.splice(i, 1);
  }
  const clear = (t: number) =>
    offsets.every((o) => bookings.every((b) => Math.abs(t + o - b.t) >= BEAT_GAP_MS));
  // The answer is `at` itself or sits just clear of some booking; the last of
  // these candidates is clear of everything, so there always is one.
  const candidates = [at, ...bookings.flatMap((b) => offsets.map((o) => b.t + BEAT_GAP_MS - o))]
    .filter((t) => t >= at)
    .sort((a, b) => a - b);
  const slot = candidates.find(clear) ?? at;
  for (const o of offsets) bookings.push({ t: slot + o, owner });
  return slot;
}
/** Give back a tile's cuts that have not happened yet. */
function releaseCuts(owner: object) {
  const now = performance.now();
  for (let i = bookings.length - 1; i >= 0; i--) {
    if (bookings[i].owner === owner && bookings[i].t > now) bookings.splice(i, 1);
  }
}

/** Eighteen-a-second steps across `ms`, for a move that should advance the way
 *  the frames do rather than glide. */
const stepped = (ms: number) => `steps(${Math.max(2, Math.round(ms / STEP_MS))}, end)`;

type Stroke = { x: number; y: number; r: number };

/** The corners of a disc of radius `r` about a stroke's start, as polygon
 *  points in percent of the canvas — which is the image's own box, since
 *  every frame fills an aspect box cut to the canvas's shape. */
function discPoints(s: Stroke, r: number, w: number, h: number) {
  return Array.from({ length: DISC_SIDES }, (_, i) => {
    const t = (i / DISC_SIDES) * Math.PI * 2;
    return `${(((s.x + r * Math.cos(t)) / w) * 100).toFixed(2)}% ${(((s.y + r * Math.sin(t)) / h) * 100).toFixed(2)}%`;
  });
}
const inside = (pts: string[]) => `polygon(${pts.join(", ")})`;
/* Everything BUT the disc: the whole box with the disc cut out of it, by the
 * even-odd rule. The two trips along the 0% 0% seam cancel out. Written as a
 * polygon with the same corners as `inside`, so the two animate in lockstep
 * and meet exactly at the disc's edge, with no sliver of overlap or gap. */
const outside = (pts: string[]) =>
  `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${pts.join(", ")}, ${pts[0]}, 0% 0%)`;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
const reducedMotionSnapshot = () => window.matchMedia(REDUCED_MOTION).matches;
const reducedMotionServerSnapshot = () => false;

export default function ProjectFrameAnimation({
  animation,
  phase = 0,
  containerRef,
  className = "",
  style,
}: {
  animation: ProjectObject;
  /** This tile's place in the grid, for the stagger. */
  phase?: number;
  /** The tile the object is thrown around inside. */
  containerRef: React.RefObject<HTMLElement | null>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { frames, width, height, style: motion = "rock", strokes, heroFrame } = animation;
  /** Drawn out stroke by stroke, rather than nudged frame by frame. */
  const drawn = !!strokes;
  const nudge = drawn || animation.flourish === "none" ? null : (animation.flourish ?? "rock");
  const flourish = nudge ? FLOURISHES[nudge] : null;
  const finale = nudge ? FINALES[nudge] : undefined;
  const frameMs = animation.frameMs ?? HOLD_MS;
  /** Quick enough to play all its frames as one run, on one booked slot. */
  const run = !drawn && frameMs < RUN_MS;
  /** The rendered frame images, so a stroke can be drawn straight to the DOM. */
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const phone = useIsPhone();
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    reducedMotionServerSnapshot
  );
  const revealed = useSyncExternalStore(subscribePageReady, isPageReady, pageReadyServerSnapshot);
  /** Where it sits when nothing is playing: frame 1, or, with motion reduced,
   *  the finished picture — the same frame the project page's header shows. */
  const rest = reduced ? heroFrame - 1 : 0;
  const [index, setIndex] = useState(0);
  /* Mirrors `index` for the physics, which reads it inside a rAF loop and must
   * not be re-subscribed on every frame change. */
  const frameRef = useRef(0);
  const holdTimer = useRef<number | null>(null);
  /** A rewind in progress, stepping back a frame at a time. */
  const cutTimer = useRef<number | null>(null);
  const flourishAnim = useRef<Animation | null>(null);
  /** Where a finale came to rest, so the rewind can turn it back from there. */
  const held = useRef<{ g: Ground; w: number; dir: number; pose: Pose } | null>(null);
  /** A finished flame's burn: its boil and its flares, until the rewind. */
  const burning = useRef<Animation[]>([]);
  /** Set when the cut about to render should be animated, for the effect
   *  that animates it. Unset for a cut that should simply happen: a rewind
   *  step, the reset when leaving view, or anything with motion reduced. */
  const pending = useRef(false);
  /** Restarts the hold after a click; set by the effect that owns the loop. */
  const rescheduleRef = useRef<((next: number) => void) | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rockRef = useRef<HTMLDivElement>(null);

  /* The physics reports presses through a callback it keeps in a ref, and
   * the thing a press does is defined below the hook, so it is reached the
   * same way here. */
  const pressRef = useRef<() => void>(() => {});
  const onPress = useCallback(() => pressRef.current(), []);

  /* NO DRAGGING ON A PHONE (2026-08-30). Noah: "could the issue be the
   * project icons at all? If so, make it so they don't have draggable
   * physics anymore, just still have the stop motion animation when clicked
   * on in mobile."
   *
   * Dragging is what forces `touch-action: none` onto the element, and that
   * claim over six tiles is what was stopping the page from scrolling when a
   * thumb landed on one. Dragging an icon is a pointer interaction that a
   * phone barely affords anyway.
   *
   * TILT ON THE HOME GRID (2026-08-31). Noah: "I got one of the projects to
   * work with the mobile tilt and it was great! If possible, let's have this
   * on the mobile home page as well. ONLY DO THIS IF IT WILL MEAN THERE
   * WON'T BE ANY ISSUES OR ERRORS ON THE HOME PAGE."
   *
   * The condition is the important half, and it is why this is `draggable:
   * !phone` rather than simply turning the physics back on. Tilt asks for no
   * touch at all, so the phone gets the motion and the page keeps every
   * gesture. Each object slides around inside its own tile as the phone
   * leans, and a tap still reaches it — see the click handler on the host
   * element below. */
  /* ONE OUTLINE FOR A DRAWING (2026-11-01). The physics normally collides
   * each frame with that frame's own outline — the apple really does lose
   * its sides. But the house is one sheet being drawn on, and its first
   * frame is a stick figure whose feet stand well above where the floor will
   * be drawn. Once the sheet had been moved (a throw, or a tilting phone,
   * which counts), every rewind left the figure hovering, so it fell the gap
   * and was shoved back up when the floor went in — measured on an emulated
   * phone, 20px down and up again on an 83px drawing, every loop. Noah: "make
   * sure the Valley strong credit union icon doesn't drop either." The
   * finished drawing's outline, for every frame, is the sheet's real shape. */
  const outlines = useMemo(() => (drawn ? [frames[heroFrame - 1]] : frames), [drawn, frames, heroFrame]);
  const { reset: resetThrow, wakeIfMoved, ground } = useThrowable({
    elementRef: hostRef,
    containerRef,
    imageSrcs: outlines,
    frameRef,
    onClick: onPress,
    enabled: true,
    tilt: phone,
    draggable: !phone,
  });

  /** How long the pen takes over frame `i`'s stroke. */
  const strokeMs = useCallback(
    (i: number) => {
      const s = strokes?.[i];
      if (!s) return 0;
      return Math.min(STROKE_MAX_MS, Math.max(STROKE_MIN_MS, (s.r / PEN_PX_PER_S) * 1000));
    },
    [strokes]
  );

  /** Play one move on the flourish wrapper, measured against wherever the
   *  object is resting right now. Written straight to the element, so it
   *  costs no React render. */
  const animateMove = useCallback(
    (move: Move, dir: number, hold = false) => {
      const el = rockRef.current;
      if (!el || typeof el.animate !== "function") return;
      const w = el.offsetWidth;
      if (!w) return;
      const g = ground();
      flourishAnim.current?.cancel();
      el.style.transformOrigin = `${g.contact.x}px ${g.contact.y}px`;
      held.current = hold ? { g, w, dir, pose: move.poses[move.poses.length - 1] } : null;
      flourishAnim.current = el.animate(
        move.poses.map((p) => ({
          transform: poseTransform(p, g, w, dir),
          offset: p.offset ?? null,
          easing: "ease-in-out",
        })),
        // A finale stays where it ends until the rewind turns it back.
        { duration: move.ms, easing: stepped(move.ms), fill: hold ? "forwards" : "none" }
      );
    },
    [ground]
  );

  /** Turn a finale back to rest over `ms`, in step with a rewind. Written
   *  with the same pose function as the finale, about the same point, so it
   *  is the same rigid turn played backwards. */
  const unwind = useCallback((ms: number) => {
    const h = held.current;
    const el = rockRef.current;
    held.current = null;
    if (!h || !el || typeof el.animate !== "function") return;
    flourishAnim.current?.cancel();
    flourishAnim.current = el.animate(
      [{ transform: poseTransform(h.pose, h.g, h.w, h.dir) }, { transform: poseTransform({}, h.g, h.w, h.dir) }],
      { duration: ms, easing: stepped(ms) }
    );
  }, []);

  /** Keep the finished frame alive until the rewind: see burnPattern. One
   *  pass of boil on the flourish wrapper and of flares on the last two
   *  frames, all three on one timing so they stay in step, repeating. Each
   *  is an animation with a keyframe per step and that many steps, so it
   *  lands exactly on each keyframe at eighteen a second and never glides
   *  between them. Starts after `delay`, once the landing nudge is done. */
  const burn = useCallback(
    (delay: number) => {
      const el = rockRef.current;
      const top = imgRefs.current[frames.length - 1];
      const under = imgRefs.current[frames.length - 2];
      if (!el || !top || typeof el.animate !== "function") return;
      const w = el.offsetWidth;
      if (!w) return;
      const g = ground();
      const { poses, flares } = burnPattern();
      const n = poses.length - 1;
      const timing = { duration: n * STEP_MS, delay, iterations: Infinity, easing: `steps(${n}, end)` };
      el.style.transformOrigin = `${g.contact.x}px ${g.contact.y}px`;
      burning.current = [
        el.animate(poses.map((p) => ({ transform: poseTransform(p, g, w, 1) })), timing),
        top.animate(flares.map((f) => ({ opacity: f ? 0 : 1 })), timing),
        ...(under ? [under.animate(flares.map((f) => ({ opacity: f ? 1 : 0 })), timing)] : []),
      ];
    },
    [ground, frames.length]
  );
  const stopBurning = useCallback(() => {
    burning.current.forEach((a) => a.cancel());
    burning.current = [];
  }, []);

  /** Anything still running on the frame images: a stroke being drawn. */
  const stopStrokes = useCallback(() => {
    for (const img of imgRefs.current) {
      if (img && typeof img.getAnimations === "function") img.getAnimations().forEach((a) => a.cancel());
    }
  }, []);

  /** One frame on — or, from the last, a rewind back to the first: the
   *  frames run backwards a step at a time, at the same eighteen a second as
   *  every move here. Replaced the first pass's shrink-away-and-pop-back,
   *  which was a scaling, and too cartoony. Returns the frame it is heading
   *  for, or null if a rewind is already under way. */
  const advance = useCallback(
    (animated: boolean) => {
      if (cutTimer.current !== null) return null;
      const cur = frameRef.current;
      if (cur < frames.length - 1) {
        pending.current = animated;
        setIndex(cur + 1);
        return cur + 1;
      }
      if (!animated) {
        pending.current = false;
        setIndex(0);
        return 0;
      }
      stopBurning();
      unwind(Math.max(cur - 1, 2) * STEP_MS);
      let i = cur;
      const back = () => {
        i -= 1;
        pending.current = false;
        setIndex(i);
        cutTimer.current = i > 0 ? window.setTimeout(back, STEP_MS) : null;
      };
      back();
      return 0;
    },
    [frames.length, unwind, stopBurning]
  );

  useEffect(() => {
    pressRef.current = () => {
      const next = advance(!reduced);
      if (next !== null) rescheduleRef.current?.(next);
    };
  }, [advance, reduced]);

  /* Animate the cut that just rendered.
   *
   * Strokes and nudges are both driven straight to the elements through the
   * Web Animations API rather than through React state: they are visual
   * details nothing else renders from, and a state round trip per frame of
   * motion would re-render every frame image.
   *
   * A LAYOUT effect, so it lands before the paint. A cut made from a timer
   * would otherwise paint once before a passive effect ran, and a stroke
   * would show whole for a frame before being drawn on. */
  useLayoutEffect(() => {
    frameRef.current = index;
    // The outline just changed, and these shapes mostly grow. Hand a thrown
    // object back to gravity so its bigger self settles onto a border rather
    // than hanging where its smaller self came to rest. One that has not been
    // moved stays put — it is where it was placed, and every frame fits there.
    wakeIfMoved();
    stopStrokes();
    const animated = pending.current;
    pending.current = false;
    if (!animated) return;

    if (!drawn) {
      const dir = index % 2 === 0 ? -1 : 1;
      const landing = index === frames.length - 1;
      if (landing && finale && finale !== "burn") animateMove(finale, dir, true);
      else if (flourish) animateMove(flourish, dir);
      if (landing && finale === "burn") burn(flourish?.ms ?? 0);
      return;
    }

    /* DRAW THE STROKE ON. The new frame is shown through a disc growing from
     * where its new mark begins, and the frame before it through everything
     * outside that disc — so inside, the line arrives; outside, nothing has
     * changed yet. Showing the old frame only outside the disc, rather than
     * whole underneath, matters for the tube: it is re-laid between shots, so
     * the old and new photographs disagree about where the tube already down
     * lies, and both at once would show it twice. Whatever the disc has not
     * reached when the stroke finishes moves into place in a single cut, as
     * it would in the stop motion it is.
     *
     * The previous frame's own opacity is 0 by the time this runs; the
     * animation lifts it back to 1 for exactly as long as the stroke takes,
     * and when the animation ends both images fall back to their plain state
     * — new frame whole, old one gone — whatever happened to the timing. */
    const s = strokes?.[index];
    const img = imgRefs.current[index];
    const under = imgRefs.current[index - 1];
    if (!s || !img || typeof img.animate !== "function") return;
    const ms = strokeMs(index);
    const from = discPoints(s, 0, width, height);
    const to = discPoints(s, s.r, width, height);
    const timing = { duration: ms, easing: stepped(ms) };
    img.animate([{ clipPath: inside(from), easing: PEN_EASE }, { clipPath: inside(to) }], timing);
    under?.animate(
      [
        { clipPath: outside(from), opacity: 1, easing: PEN_EASE },
        { clipPath: outside(to), opacity: 1 },
      ],
      timing
    );
  }, [index, wakeIfMoved, stopStrokes, drawn, flourish, finale, frames.length, animateMove, burn, strokes, strokeMs, width, height]);

  /** Drop a rewind under way, and whatever flourish is playing. */
  const cancelCut = useCallback(() => {
    if (cutTimer.current !== null) {
      window.clearTimeout(cutTimer.current);
      cutTimer.current = null;
    }
    flourishAnim.current?.cancel();
    flourishAnim.current = null;
    held.current = null;
    stopBurning();
  }, [stopBurning]);

  /** Whole again: at rest, upright, back where it started, nothing pending. */
  const restore = useCallback(() => {
    cancelCut();
    stopStrokes();
    pending.current = false;
    setIndex(rest);
    resetThrow();
  }, [cancelCut, stopStrokes, rest, resetThrow]);

  /* THE LOOP, and the conditions it runs under.
   *
   * Restores whenever the tile leaves the viewport — so returning to it finds
   * the object whole — and whenever the away screen covers the page, which is
   * the other moment nobody can see it happen. Noah: "It would also be good if
   * the animations reset when the clock screen comes on." */
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let onScreen = false;
    const live = () => onScreen && revealed && !reduced && !document.hidden;
    const last = frames.length - 1;

    /** This tile, in the slot book. */
    const owner = {};

    const clearTimer = () => {
      if (holdTimer.current !== null) {
        window.clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
    };
    const stop = () => {
      clearTimer();
      releaseCuts(owner);
    };
    const schedule = (ms: number, fn: () => void) => {
      clearTimer();
      holdTimer.current = window.setTimeout(fn, ms);
    };
    /** The cuts that the next cut from frame `from` starts: a rewind's steps
     *  back, the rest of a run, or just the one. */
    const offsetsFrom = (from: number) =>
      from >= last
        ? Array.from({ length: last }, (_, k) => k * STEP_MS)
        : run
          ? Array.from({ length: last - from }, (_, k) => k * frameMs)
          : [0];
    /** Book the next cut from frame `from` for `delay` from now, or the
     *  nearest free moment after, and play it then. Whatever this tile has
     *  booked already stays booked: in the normal run of things that is only
     *  the rest of a rewind or a run that is under way right now. */
    const book = (delay: number, from: number) => {
      const at = performance.now() + delay;
      const slot = bookCut(at, offsetsFrom(from), owner);
      schedule(slot - performance.now(), play);
    };
    /** Its moment has come: cut, and work out what follows. */
    const play = () => {
      holdTimer.current = null;
      if (!live()) return stop();
      const next = advance(true);
      if (next === null) book(HOLD_MS, frameRef.current);
      else after(next);
    };
    /** What comes after landing on frame `next`. Mid-drawing, the pen goes
     *  straight on to the next stroke, and mid-run the next frame follows on
     *  time — the run was booked whole, and a drawing is one gesture. */
    const after = (next: number) => {
      if (next > 0 && next < last) {
        if (drawn) return schedule(strokeMs(next) + PEN_LIFT_MS * (0.7 + Math.random() * 0.6), play);
        if (run) return schedule(frameMs, play);
        return book(frameMs * (1 - HOLD_JITTER + Math.random() * HOLD_JITTER * 2), next);
      }
      book(next === last ? LAST_HOLD_MS + strokeMs(next) : FIRST_HOLD_MS, next);
    };
    /* A click, or coming back into view, breaks into whatever was booked;
     * give it back before booking afresh. */
    rescheduleRef.current = (next) => {
      if (!live()) return;
      releaseCuts(owner);
      after(next);
    };
    const start = (ms: number) => {
      if (!live()) return stop();
      releaseCuts(owner);
      book(ms, frameRef.current);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (!onScreen || reduced) restore();
        start(ENTER_DELAY_MS + (phase % 3) * PHASE_STAGGER_MS + Math.random() * 300);
      },
      { threshold: 0 }
    );
    io.observe(el);
    const onVisibility = () => start(ENTER_DELAY_MS);
    const onAway = () => {
      restore();
      start(FIRST_HOLD_MS);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(AWAY_SCREEN_SHOWN, onAway);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(AWAY_SCREEN_SHOWN, onAway);
      rescheduleRef.current = null;
      stop();
    };
  }, [revealed, reduced, phase, frames.length, drawn, run, frameMs, strokeMs, advance, restore]);

  /* Nothing left running once the tile is gone. */
  useEffect(() => cancelCut, [cancelCut]);

  return (
    <div
      ref={hostRef}
      /* `touch-none` ONLY WHERE SOMETHING IS DRAGGABLE (2026-08-30).
         Noah: "scrolling at a fast speed seems to freeze the site."
         On a phone this element has nothing to drag — but it was still
         telling the browser not to scroll over it, across six ~95px squares
         spread down the grid. A thumb that started a flick on one got no
         scroll at all. The tap handler below is a click and needs no such
         claim. */
      className={`absolute select-none ${phone ? "" : "touch-none"} ${className}`}
      style={style}
      // The tile is a <Link>; these objects handle their own presses and must
      // not also navigate. Noah: "The apple should be it's own clickable
      // interaction. I'm hoping that the big grid square will indicate that
      // the user can click on this back area and get taken to a new page."
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // With dragging off on a phone the physics is not listening for the
        // press, so the tap is handled here.
        if (phone) onPress();
      }}
      onDragStart={(e) => e.preventDefault()}
      role="button"
      tabIndex={0}
      aria-label="Play the next frame"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onPress();
        }
      }}
    >
      <div ref={rockRef} className="w-full">
        <div className="relative w-full" style={{ aspectRatio: `${width}/${height}` }}>
          {frames.map((src, i) => (
            <Image
              key={src}
              ref={(el) => {
                imgRefs.current[i] = el;
              }}
              src={src}
              alt=""
              fill
              sizes="25vw"
              /* EAGER, ALL OF THEM (2026-08-30). Noah: "the grid isn't
                 already loaded when the mobile home page is loaded. I'll
                 scroll past it to the footer, only for it to appear and
                 make me get lost on my position on the page... When I
                 scroll, everything should be ready."

                 Only frame 0 was eager and the rest were lazy, so a tile
                 held one frame and fetched the others the moment it came
                 into view — which is the tile visibly assembling itself
                 under the reader's thumb. Eager means the loading screen
                 waits for them instead, which is the trade Noah asked for:
                 "I'm okay with the loading screen taking longer if it
                 equates to a smoother experience."

                 Affordable because these are small: measured, each frame
                 renders into a 97px box on a phone, so the optimiser is
                 serving thumbnails, not artwork. */
              priority={i === 0}
              loading="eager"
              draggable={false}
              /* PENCIL ARTWORK HAS TO FLIP IN DARK MODE (2026-08-30). Noah,
                 with a screenshot of the Valley Strong tile: "notice how the
                 pencil drawing isn't white."

                 The project PAGE header already does this — it sets
                 invertOnDark from `object.style === "draw"` — but the home
                 grid never did, so the same artwork read as ink on paper on
                 the page and as near-invisible dark lines on the black grid.
                 A "draw" animation is by definition line art on a
                 transparent ground, which is exactly what a plain invert is
                 safe on; photographic frames are not marked "draw" and are
                 left alone. */
              className={`object-contain pointer-events-none${
                motion === "draw" ? " invert-on-dark" : ""
              }`}
              style={{ opacity: i === index ? 1 : 0 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
