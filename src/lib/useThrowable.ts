"use client";

import { useCallback, useEffect, useRef } from "react";
import { defaultSilhouette, measureSilhouette, supportAt, type Silhouette } from "./silhouette";

/**
 * Grab it, drag it, throw it — inside a box.
 *
 * 2026-08-22, per Noah: "Critically, I want the icons I make to be able to be
 * throwable, like the head on the about me page."
 *
 * Same behaviour and the same collision maths as that head (see
 * silhouette.ts), packaged so the grid objects can share it. The head itself
 * still runs its own copy of the integrator; migrating it is a separate,
 * riskier change on something Noah has already tuned to his satisfaction, so
 * it is deliberately not bundled in with introducing this.
 *
 * TELLING A CLICK FROM A THROW is the interesting part here, because on the
 * grid these objects have to do both: a click plays the animation, a drag
 * picks the object up. A press only becomes a drag once the pointer travels
 * past a small threshold, so a click that wobbles by a pixel still counts as
 * a click, and the caller is told which happened on release.
 *
 * The object stays ASLEEP at its designed resting place until it is actually
 * grabbed. Without that, gravity would drag every object to the bottom of its
 * tile the moment the page loaded, which is not where they are meant to sit.
 */

const GRAVITY_PER_HEIGHT = 6.2; // of container heights per second squared
/* Noah, on the first pass: "The drag and throw is really stiff." It was —
 * every damping term had been set higher than the head's, so a throw lost its
 * energy almost immediately and the object stopped dead instead of tumbling
 * and settling. These now sit at or below the head's values: it keeps more of
 * a bounce, spins far longer (angular drag more than halved), skids further
 * before friction takes it, and has to get slower before it is allowed to
 * fall asleep. */
const RESTITUTION = 0.58;
const AIR_DRAG = 0.2;
const ANGULAR_DRAG = 0.22;
const FLOOR_FRICTION_PER_SEC = 1.0;
const ROLL_LOCK_RATE = 9;
const SLEEP_SPEED = 9;
const SLEEP_SPIN = 5;
const WALL_REST_SPEED = 18;
const MAX_THROW_SPEED = 2400;
/** Spin imparted by a throw, per px/s of horizontal release speed. */
const THROW_SPIN = 0.42;
/** How far the object leans into the direction it is being dragged. */
const DRAG_LEAN_DEG_PER_SPEED = 0.016;
const MAX_DRAG_LEAN_DEG = 22;
const DRAG_THRESHOLD_PX = 4;

export function useThrowable({
  elementRef,
  containerRef,
  imageSrcs,
  frameRef,
  onClick,
  enabled = true,
}: {
  /** The element that moves. Must be absolutely positioned in the container. */
  elementRef: React.RefObject<HTMLElement | null>;
  /** The box it is confined to. Must be the element's offsetParent. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Every frame, decoded to measure its own outline — see the note below. */
  imageSrcs: string[];
  /** Which frame is on screen right now; picks the outline to collide with. */
  frameRef?: React.RefObject<number>;
  /** Fired on release when the press never became a drag. */
  onClick?: () => void;
  enabled?: boolean;
}) {
  /* ONE OUTLINE PER FRAME, not one for the whole animation. Noah: "do a more
   * accurate job of capturing the silhouettes of the objects at all frames."
   * These shapes change a lot as they play — the apple loses most of its body
   * to a core, the sun grows from a dot — so colliding every frame against
   * frame 1's outline would have a fully eaten core resting on thin air where
   * the whole apple used to reach, and a tiny sun bouncing off a boundary the
   * size of its final self. */
  const shapes = useRef<Silhouette[]>([defaultSilhouette()]);
  /* Stable identity: the physics effect below reads this and must not be torn
   * down and re-subscribed on every render. Both refs it closes over are
   * themselves stable, so there is nothing for it to go stale against. */
  const shapeNow = useCallback(
    () =>
      shapes.current[Math.min(frameRef?.current ?? 0, shapes.current.length - 1)] ??
      shapes.current[0],
    [frameRef]
  );
  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const rot = useRef(0);
  const spin = useRef(0);
  const asleep = useRef(true);
  const dragging = useRef(false);
  const movedEnough = useRef(false);
  const grabOffset = useRef({ x: 0, y: 0 });
  const samples = useRef<{ x: number; y: number; t: number }[]>([]);
  const raf = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  /* The pointer listeners are attached once and must not be rebuilt every
   * time the caller passes a new closure, so the callback is reached through
   * a ref. Kept current in an effect rather than during render — writing a
   * ref while rendering is not safe under concurrent rendering, since a
   * render that gets thrown away would still have mutated it. */
  const onClickRef = useRef(onClick);
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  /** Put it back where it started, upright and still. */
  const reset = useCallback(() => {
    pos.current = { x: 0, y: 0 };
    vel.current = { x: 0, y: 0 };
    rot.current = 0;
    spin.current = 0;
    asleep.current = true;
    const el = elementRef.current;
    if (el) el.style.transform = "translate(0px, 0px) rotate(0deg)";
  }, [elementRef]);

  // Measure every frame's outline once its artwork has decoded.
  useEffect(() => {
    let cancelled = false;
    const measured: Silhouette[] = imageSrcs.map(() => defaultSilhouette());
    shapes.current = measured;
    imageSrcs.forEach((src, i) => {
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        if (cancelled) return;
        const s = measureSilhouette(img);
        if (s) measured[i] = s;
      };
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrcs.join("|")]);

  useEffect(() => {
    const el = elementRef.current;
    const container = containerRef.current;
    if (!el || !container || !enabled) return;

    /* Rotate about the SILHOUETTE's centre of area, not the element box's.
     *
     * The physics already treats that centroid as the pivot — every support
     * lookup is measured from it — but CSS `rotate()` spins about the box,
     * which defaults to 50% 50%. For most of these objects the artwork is
     * roughly centred in its canvas and the two agree within about 2%, so
     * nothing looked wrong. The flame is the exception and it is a big one:
     * its canvas is sized for the fully grown flame, so frame 1's ember sits
     * right at the bottom with its centroid at y=0.876 against a box centre
     * of 0.5. It spun around a point far above itself. Noah: "The flame is
     * acting odd when it's at it's first frame. It looks like the anchor
     * point that it's spinning around isn't matching its center point."
     *
     * Kept in step with the frame, since the centroid moves as these shapes
     * grow (the flame's offset runs 37.6% down to 8.6% across its five
     * frames), and only written when it actually changes — this runs every
     * animation frame and a needless style write is a needless recalc. */
    let lastOrigin = "";
    /* Runs EVERY frame, not just when the object moves. The outlines are
     * measured asynchronously as the frame images decode, so at the moment of
     * the first paint every shape is still the placeholder with its pivot at
     * dead centre. Folding this into `apply()` — which is skipped while the
     * object sits still — meant the real pivot was measured and then never
     * written, leaving the flame rotating about the box centre exactly as
     * before. It is guarded on the value, so a settled object costs one string
     * compare per frame and no style write. */
    const syncOrigin = () => {
      const piv = shapeNow().pivot;
      const origin = `${(piv.x * 100).toFixed(2)}% ${(piv.y * 100).toFixed(2)}%`;
      if (origin !== lastOrigin) {
        el.style.transformOrigin = origin;
        lastOrigin = origin;
      }
    };

    const apply = () => {
      el.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) rotate(${rot.current}deg)`;
    };

    /* The pivot's position in container space. offsetLeft/Top/Width/Height are
     * pure layout and ignore the element's own transform, so this is correct
     * at any rotation with no caching and no assumption that the rotation
     * origin is the box's centre. */
    const pivotPos = () => ({
      x: el.offsetLeft + shapeNow().pivot.x * el.offsetWidth + pos.current.x,
      y: el.offsetTop + shapeNow().pivot.y * el.offsetHeight + pos.current.y,
    });

    const step = (ts: number) => {
      raf.current = requestAnimationFrame(step);
      if (lastTs.current == null) lastTs.current = ts;
      const dt = Math.min((ts - lastTs.current) / 1000, 1 / 30);
      lastTs.current = ts;

      /* The containment test runs even while the object is ASLEEP, and that
       * is not defensive tidiness — it is a real bug fix. The outline changes
       * under the physics as the animation plays, and these animations mostly
       * GROW: throw the CAC heart so it settles against a border, then play
       * it, and the heart swells past the edge it was resting on. Noah:
       * "if the heart is thrown THEN the animation starts, the heart will go
       * outside the bounds of the grid area." Skipping collision whenever the
       * object was at rest meant nothing ever pushed the newly larger shape
       * back in. Clamping unconditionally guarantees the promise he actually
       * wants — "the icons never go outside the bounds of the grid square" —
       * no matter what changes the shape while it sits still. */
      syncOrigin();
      const idle = asleep.current && !dragging.current;
      const before = { x: pos.current.x, y: pos.current.y };

      const cr = container.getBoundingClientRect();
      const W = el.offsetWidth;

      if (!idle && !dragging.current) {
        vel.current.y += cr.height * GRAVITY_PER_HEIGHT * dt;
        const drag = Math.max(0, 1 - AIR_DRAG * dt);
        vel.current.x *= drag;
        vel.current.y *= drag;
        spin.current *= Math.max(0, 1 - ANGULAR_DRAG * dt);
        pos.current.x += vel.current.x * dt;
        pos.current.y += vel.current.y * dt;
        rot.current += spin.current * dt;
      }

      const p = pivotPos();
      const r = rot.current;
      const right = supportAt(shapeNow().support, 0 - r) * W;
      const down = supportAt(shapeNow().support, 90 - r) * W;
      const left = supportAt(shapeNow().support, 180 - r) * W;
      const up = supportAt(shapeNow().support, 270 - r) * W;

      if (p.x < left) {
        pos.current.x += left - p.x;
        if (!idle && Math.abs(vel.current.x) > WALL_REST_SPEED) {
          vel.current.x = Math.abs(vel.current.x) * RESTITUTION;
          spin.current -= vel.current.y * 0.05;
        } else vel.current.x = 0;
      } else if (p.x > cr.width - right) {
        pos.current.x -= p.x - (cr.width - right);
        if (!idle && Math.abs(vel.current.x) > WALL_REST_SPEED) {
          vel.current.x = -Math.abs(vel.current.x) * RESTITUTION;
          spin.current += vel.current.y * 0.05;
        } else vel.current.x = 0;
      }

      if (p.y < up) {
        pos.current.y += up - p.y;
        if (vel.current.y < 0) vel.current.y = Math.abs(vel.current.y) * RESTITUTION;
      } else if (p.y > cr.height - down) {
        pos.current.y -= p.y - (cr.height - down);
        // Below a small incoming speed a floor touch is a rest, not a bounce.
        // Without this, gravity's per-frame kick against an unconditional
        // bounce keeps the object chattering just above the sleep threshold
        // and it never settles.
        if (!idle && vel.current.y > WALL_REST_SPEED) vel.current.y = -vel.current.y * RESTITUTION;
        else vel.current.y = 0;

        if (!idle && !dragging.current) {
          // Ground contact ties spin to horizontal speed the way a wheel
          // rolls. `down` is the effective rolling radius, floored at a
          // fraction of the width so a small vel.x can't demand an enormous
          // spin at angles where the pivot sits close to the ground.
          const rEff = Math.max(down, W * 0.2);
          const rollSpin = (vel.current.x / rEff) * (180 / Math.PI);
          spin.current += (rollSpin - spin.current) * Math.min(1, ROLL_LOCK_RATE * dt);
          vel.current.x *= Math.max(0, 1 - FLOOR_FRICTION_PER_SEC * dt);
          if (
            Math.abs(vel.current.y) < SLEEP_SPEED &&
            Math.abs(vel.current.x) < SLEEP_SPEED &&
            Math.abs(spin.current) < SLEEP_SPIN
          ) {
            vel.current = { x: 0, y: 0 };
            spin.current = 0;
            asleep.current = true;
          }
        }
      }

      if (!idle || before.x !== pos.current.x || before.y !== pos.current.y) apply();
    };

    const pointerPos = (e: PointerEvent) => {
      const cr = container.getBoundingClientRect();
      return { x: e.clientX - cr.left, y: e.clientY - cr.top };
    };

    const onDown = (e: PointerEvent) => {
      // Record the grab BEFORE asking for capture. setPointerCapture throws
      // NotFoundError if the pointer is no longer active — a fast flick, or a
      // pointer that has already left the window — and doing it first meant
      // that throw aborted the handler with `dragging` already true and no
      // grab offset or samples recorded, leaving the object wedged in a
      // half-drag it could never complete. Capture is an enhancement (it keeps
      // the drag alive outside the element's bounds), so it must not be able
      // to take the drag down with it.
      dragging.current = true;
      movedEnough.current = false;
      const p = pointerPos(e);
      const piv = pivotPos();
      grabOffset.current = { x: piv.x - p.x, y: piv.y - p.y };
      samples.current = [{ ...p, t: performance.now() }];
      vel.current = { x: 0, y: 0 };
      asleep.current = false;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone; the window-level pointerup still ends it */
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const p = pointerPos(e);
      const start = samples.current[0];
      if (!movedEnough.current && start) {
        if (Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD_PX) {
          movedEnough.current = true;
        }
      }
      if (!movedEnough.current) return; // still might be a click; don't move it
      e.preventDefault();
      const piv = pivotPos();
      pos.current.x += p.x + grabOffset.current.x - piv.x;
      pos.current.y += p.y + grabOffset.current.y - piv.y;
      const now = performance.now();
      samples.current.push({ ...p, t: now });
      while (samples.current.length > 2 && now - samples.current[0].t > 90) {
        samples.current.shift();
      }
      /* Lean into the drag. Held perfectly upright while being hauled about,
       * the object reads as a sticker being slid rather than a thing with
       * weight — a good part of what made the first pass feel stiff. The lean
       * is eased toward rather than snapped to, so quick direction changes
       * swing instead of jumping, and it is what the release spin continues
       * from. */
      const prev = samples.current[samples.current.length - 2];
      if (prev) {
        const dtS = Math.max((now - prev.t) / 1000, 1 / 240);
        const vx = (p.x - prev.x) / dtS;
        const lean = Math.max(
          -MAX_DRAG_LEAN_DEG,
          Math.min(MAX_DRAG_LEAN_DEG, vx * DRAG_LEAN_DEG_PER_SPEED)
        );
        rot.current += (lean - rot.current) * 0.25;
      }
      apply();
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      if (!movedEnough.current) {
        // Never travelled far enough to be a drag, so it was a click.
        asleep.current = true;
        onClickRef.current?.();
        return;
      }
      const s = samples.current;
      if (s.length >= 2) {
        const first = s[0];
        const last = s[s.length - 1];
        const dtSec = (last.t - first.t) / 1000;
        if (dtSec > 0) {
          let vx = (last.x - first.x) / dtSec;
          let vy = (last.y - first.y) / dtSec;
          const sp = Math.hypot(vx, vy);
          if (sp > MAX_THROW_SPEED) {
            vx = (vx / sp) * MAX_THROW_SPEED;
            vy = (vy / sp) * MAX_THROW_SPEED;
          }
          vel.current = { x: vx, y: vy };
          spin.current = vx * THROW_SPIN;
        }
      }
      samples.current = [];
      asleep.current = false;
    };

    el.style.touchAction = "none";
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    window.addEventListener("pointerup", onUp);
    raf.current = requestAnimationFrame(step);
    apply();

    return () => {
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
    };
  }, [elementRef, containerRef, enabled, shapeNow]);

  /** Let gravity take over again — used when the artwork changes shape, so a
   *  newly grown object settles back onto a border instead of hanging where
   *  its smaller self happened to rest. */
  const wake = useCallback(() => {
    asleep.current = false;
  }, []);

  return { reset, wake, rotationRef: rot };
}
