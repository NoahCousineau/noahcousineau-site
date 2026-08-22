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
const RESTITUTION = 0.45;
const AIR_DRAG = 0.25;
const ANGULAR_DRAG = 0.5;
const FLOOR_FRICTION_PER_SEC = 1.6;
const ROLL_LOCK_RATE = 9;
const SLEEP_SPEED = 14;
const SLEEP_SPIN = 8;
const WALL_REST_SPEED = 18;
const MAX_THROW_SPEED = 2400;
/** Pointer travel (px) before a press stops being a click and becomes a drag. */
const DRAG_THRESHOLD_PX = 4;

export function useThrowable({
  elementRef,
  containerRef,
  imageSrc,
  onClick,
  enabled = true,
}: {
  /** The element that moves. Must be absolutely positioned in the container. */
  elementRef: React.RefObject<HTMLElement | null>;
  /** The box it is confined to. Must be the element's offsetParent. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Decoded to measure the true shape; falls back to a blob if unavailable. */
  imageSrc: string;
  /** Fired on release when the press never became a drag. */
  onClick?: () => void;
  enabled?: boolean;
}) {
  const shape = useRef<Silhouette>(defaultSilhouette());
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

  // Measure the real outline once the artwork has decoded.
  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.src = imageSrc;
    img.onload = () => {
      if (cancelled) return;
      const s = measureSilhouette(img);
      if (s) shape.current = s;
    };
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  useEffect(() => {
    const el = elementRef.current;
    const container = containerRef.current;
    if (!el || !container || !enabled) return;

    const apply = () => {
      el.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) rotate(${rot.current}deg)`;
    };

    /* The pivot's position in container space. offsetLeft/Top/Width/Height are
     * pure layout and ignore the element's own transform, so this is correct
     * at any rotation with no caching and no assumption that the rotation
     * origin is the box's centre. */
    const pivotPos = () => ({
      x: el.offsetLeft + shape.current.pivot.x * el.offsetWidth + pos.current.x,
      y: el.offsetTop + shape.current.pivot.y * el.offsetHeight + pos.current.y,
    });

    const step = (ts: number) => {
      raf.current = requestAnimationFrame(step);
      if (lastTs.current == null) lastTs.current = ts;
      const dt = Math.min((ts - lastTs.current) / 1000, 1 / 30);
      lastTs.current = ts;
      if (asleep.current && !dragging.current) return;

      const cr = container.getBoundingClientRect();
      const W = el.offsetWidth;

      if (!dragging.current) {
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
      const right = supportAt(shape.current.support, 0 - r) * W;
      const down = supportAt(shape.current.support, 90 - r) * W;
      const left = supportAt(shape.current.support, 180 - r) * W;
      const up = supportAt(shape.current.support, 270 - r) * W;

      if (p.x < left) {
        pos.current.x += left - p.x;
        if (Math.abs(vel.current.x) > WALL_REST_SPEED) {
          vel.current.x = Math.abs(vel.current.x) * RESTITUTION;
          spin.current -= vel.current.y * 0.05;
        } else vel.current.x = 0;
      } else if (p.x > cr.width - right) {
        pos.current.x -= p.x - (cr.width - right);
        if (Math.abs(vel.current.x) > WALL_REST_SPEED) {
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
        if (vel.current.y > WALL_REST_SPEED) vel.current.y = -vel.current.y * RESTITUTION;
        else vel.current.y = 0;

        if (!dragging.current) {
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

      apply();
    };

    const pointerPos = (e: PointerEvent) => {
      const cr = container.getBoundingClientRect();
      return { x: e.clientX - cr.left, y: e.clientY - cr.top };
    };

    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      movedEnough.current = false;
      el.setPointerCapture(e.pointerId);
      const p = pointerPos(e);
      const piv = pivotPos();
      grabOffset.current = { x: piv.x - p.x, y: piv.y - p.y };
      samples.current = [{ ...p, t: performance.now() }];
      vel.current = { x: 0, y: 0 };
      asleep.current = false;
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
          spin.current = vx * 0.25;
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
  }, [elementRef, containerRef, enabled]);

  return { reset, rotationRef: rot };
}
