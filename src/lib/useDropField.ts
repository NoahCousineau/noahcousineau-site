"use client";

import { useCallback, useEffect, useRef } from "react";
import { defaultSilhouette, measureSilhouette, supportAt, type Silhouette } from "./silhouette";

/**
 * Several objects falling into a box, piling up, and staying draggable.
 *
 * 2026-08-22, per Noah, on the new project-page header: "A few seconds after
 * the page loads, several graphics will fall from above... The objects will
 * drop with real physics and will be able to be moved around."
 *
 * The single-object version of this is useThrowable, and the tuning constants
 * below are deliberately its constants — a heart thrown around a grid tile
 * and a circle dropped into a header should feel like the same world. What is
 * genuinely new is that the objects have to collide with EACH OTHER, which
 * changes the shape of the solver: one loop owning every body, fixed
 * substeps, and several relaxation passes per step so a stack settles instead
 * of jittering itself apart.
 *
 * EVERY CONTACT GOES THROUGH THE SUPPORT FUNCTION — the same one the head and
 * the grid objects use, see silhouette.ts. Against the floor and the sides
 * that is exact, so every object comes to rest with its lowest visible pixel
 * on the rule and none of them can cross it.
 *
 * Between two bodies it asks each shape how far it reaches TOWARD the other
 * and compares that against the distance between them. The obvious cheaper
 * thing — give each body the circle that encloses it — was what this did
 * first, and on the ampersand it left a hand's width of empty page on either
 * side, because the circle enclosing an ampersand is mostly not ampersand.
 * A directional reach costs one table lookup per pair and closes that gap.
 * It is exact for a disc in every direction, exact for a convex shape along
 * the line of centres, and generous for a concave one — the last of which
 * only ever means two objects stop a little short of touching, never that
 * they overlap.
 */

/* --- shared with useThrowable; see the note there on why these values --- */
const GRAVITY_PER_HEIGHT = 6.2; // arena heights per second squared
const RESTITUTION = 0.42;
const AIR_DRAG = 0.2;
const ANGULAR_DRAG = 0.22;
const FLOOR_FRICTION_PER_SEC = 1.4;
const ROLL_LOCK_RATE = 9;
const SLEEP_SPEED = 9;
const SLEEP_SPIN = 5;
const WALL_REST_SPEED = 18;
const MAX_THROW_SPEED = 2400;
const THROW_SPIN = 0.42;
const DRAG_THRESHOLD_PX = 3;

/** Bounce between two objects. Lower than against a wall: a pile should
 *  settle, and every bit of restitution here is energy fed back into a stack
 *  that is trying to come to rest. */
const PAIR_RESTITUTION = 0.2;
/** How much of an overlap is pushed out per relaxation pass. Under 1 so the
 *  passes converge rather than overshooting and ringing. */
const SEPARATION = 0.7;
/** Relaxation passes per substep. Three is enough for the depth of pile this
 *  field ever builds; more only costs time. */
const PASSES = 3;
/** Physics substeps per animation frame. Two keeps a fast-falling object from
 *  tunnelling past a thin neighbour between frames. */
const SUBSTEPS = 2;

export type DropSpec = {
  /** Rendered width, as a fraction of the ARENA's width. */
  width: number;
  /** Where it is dropped from, as a fraction of the arena's width. */
  x: number;
  /** ms after the field is armed before this one is let go. */
  delay: number;
  /** Artwork whose alpha channel is the collision outline. Omit for a disc. */
  src?: string;
  /** Aspect (w/h) of the rendered box. Discs are square. */
  aspect?: number;
  /** May it tumble as it falls? Off for the hero icon, which reads as the
   *  project's mark and has to stay the right way up. */
  spin?: boolean;
};

type Body = {
  spec: DropSpec;
  shape: Silhouette;
  /** Pivot position in arena px. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  released: boolean;
  asleep: boolean;
  held: boolean;
  /** Rendered size in px, refreshed each frame from layout. */
  w: number;
  h: number;
};

export function useDropField({
  arenaRef,
  specs,
  /** ms from mount before the first object is let go. */
  armDelay = 0,
  /** How far above the arena an object starts, in arena heights. Near zero
   *  makes everything appear essentially at rest — which is how the reduced-
   *  motion path keeps the objects without animating them in. */
  dropFrom = 0.45,
  enabled = true,
}: {
  arenaRef: React.RefObject<HTMLElement | null>;
  specs: DropSpec[];
  armDelay?: number;
  dropFrom?: number;
  enabled?: boolean;
}) {
  const els = useRef<(HTMLElement | null)[]>([]);
  const bodies = useRef<Body[]>([]);
  const arena = useRef({ w: 0, h: 0 });

  const register = useCallback((i: number, el: HTMLElement | null) => {
    els.current[i] = el;
  }, []);

  /* Outlines are measured off the decoded artwork, exactly as the grid
   * objects do it. A disc needs no measuring: its support is its radius in
   * every direction, which is what defaultSilhouette already describes once
   * the constant is set to half the box. */
  const specKey = specs.map((s) => `${s.src ?? "disc"}:${s.width}:${s.x}`).join("|");
  useEffect(() => {
    let cancelled = false;
    bodies.current = specs.map((spec) => ({
      spec,
      shape: discSilhouette(),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rot: 0,
      spin: 0,
      released: false,
      asleep: false,
      held: false,
      w: 0,
      h: 0,
    }));
    specs.forEach((spec, i) => {
      if (!spec.src) return;
      const img = new window.Image();
      img.src = spec.src;
      img.onload = () => {
        if (cancelled) return;
        const s = measureSilhouette(img);
        if (s && bodies.current[i]) bodies.current[i].shape = s;
      };
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  useEffect(() => {
    const box = arenaRef.current;
    if (!box || !enabled) return;

    const armedAt = performance.now() + armDelay;
    let raf: number | null = null;
    let lastTs: number | null = null;

    /** Layout-derived size of one body. Transform-independent. */
    const measure = (b: Body, i: number) => {
      const el = els.current[i];
      if (!el) return;
      b.w = el.offsetWidth;
      b.h = el.offsetHeight;
    };

    /* Screen-space extents from the pivot, in the silhouette's own frame.
     * There is no `up`: the arena has no ceiling, because an object still
     * falling in is legitimately above it. */
    const extents = (b: Body) => ({
      right: supportAt(b.shape.support, 0 - b.rot) * b.w,
      down: supportAt(b.shape.support, 90 - b.rot) * b.w,
      left: supportAt(b.shape.support, 180 - b.rot) * b.w,
    });

    /** How far the body reaches in a screen-space direction, in px. */
    const reach = (b: Body, deg: number) => supportAt(b.shape.support, deg - b.rot) * b.w;

    /** The circle that encloses the body. Used only to weigh one body against
     *  another, where all that matters is that a big thing outranks a small
     *  one — not for deciding whether they are touching. */
    const bound = (b: Body) => {
      let m = 0;
      for (let i = 0; i < b.shape.support.length; i++) {
        if (b.shape.support[i] > m) m = b.shape.support[i];
      }
      return m * b.w;
    };

    const write = (b: Body, i: number) => {
      const el = els.current[i];
      if (!el) return;
      // Nothing paints until the physics has placed it; the markup starts
      // hidden so an object can't flash at the arena's top-left corner for
      // the frame before its first step.
      if (b.released && el.style.visibility !== "visible") el.style.visibility = "visible";
      el.style.transformOrigin = `${(b.shape.pivot.x * 100).toFixed(2)}% ${(
        b.shape.pivot.y * 100
      ).toFixed(2)}%`;
      el.style.transform = `translate(${b.x - b.shape.pivot.x * b.w}px, ${
        b.y - b.shape.pivot.y * b.h
      }px) rotate(${b.rot}deg)`;
    };

    /* Start ABOVE the arena, high enough that the drop reads as a fall from
     * off-screen rather than as an object popping in just over the rule. */
    const release = (b: Body) => {
      b.released = true;
      b.asleep = false;
      b.x = b.spec.x * arena.current.w;
      b.y = -arena.current.h * dropFrom - Math.random() * arena.current.h * dropFrom * 0.45;
      b.vx = 0;
      b.vy = 0;
      b.rot = 0;
      b.spin = b.spec.spin === false ? 0 : (Math.random() - 0.5) * 90;
    };

    const substep = (h: number) => {
      const list = bodies.current;
      const g = arena.current.h * GRAVITY_PER_HEIGHT;

      for (const b of list) {
        if (!b.released || b.held || b.asleep) continue;
        b.vy += g * h;
        const drag = Math.max(0, 1 - AIR_DRAG * h);
        b.vx *= drag;
        b.vy *= drag;
        b.spin *= Math.max(0, 1 - ANGULAR_DRAG * h);
        b.x += b.vx * h;
        b.y += b.vy * h;
        if (b.spec.spin !== false) b.rot += b.spin * h;
      }

      for (let pass = 0; pass < PASSES; pass++) {
        /* Bodies first, then walls: the walls get the last word, so an
         * object shoved sideways by a neighbour can never be left resting
         * outside the arena at the end of a step. */
        for (let i = 0; i < list.length; i++) {
          const a = list[i];
          if (!a.released) continue;
          for (let j = i + 1; j < list.length; j++) {
            const c = list[j];
            if (!c.released) continue;
            let dx = c.x - a.x;
            let dy = c.y - a.y;
            let d = Math.hypot(dx, dy);
            if (d < 1e-4) {
              dx = 0;
              dy = -1;
              d = 1;
            }
            // Each shape's own reach toward the other, not a circle round it.
            const towards = (Math.atan2(dy, dx) * 180) / Math.PI;
            const overlap = reach(a, towards) + reach(c, towards + 180) - d;
            if (overlap <= 0) continue;
            const nx = dx / d;
            const ny = dy / d;
            // Mass by area, so a big object shoulders a small one aside.
            const ra = bound(a);
            const rb = bound(c);
            const ma = a.held ? 0 : ra * ra;
            const mc = c.held ? 0 : rb * rb;
            const total = ma + mc;
            if (total <= 0) continue;
            const push = overlap * SEPARATION;
            a.x -= nx * push * (mc / total);
            a.y -= ny * push * (mc / total);
            c.x += nx * push * (ma / total);
            c.y += ny * push * (ma / total);

            const rvx = c.vx - a.vx;
            const rvy = c.vy - a.vy;
            const sep = rvx * nx + rvy * ny;
            if (sep < 0) {
              const jimp = (-(1 + PAIR_RESTITUTION) * sep) / (1 / (ma || 1) + 1 / (mc || 1));
              if (!a.held) {
                a.vx -= (jimp * nx) / (ma || 1);
                a.vy -= (jimp * ny) / (ma || 1);
                a.asleep = false;
              }
              if (!c.held) {
                c.vx += (jimp * nx) / (mc || 1);
                c.vy += (jimp * ny) / (mc || 1);
                c.asleep = false;
              }
            }
          }
        }

        for (const b of list) {
          if (!b.released) continue;
          const { right, down, left } = extents(b);
          const idle = b.asleep && !b.held;

          if (b.x < left) {
            b.x = left;
            if (!idle && Math.abs(b.vx) > WALL_REST_SPEED) {
              b.vx = Math.abs(b.vx) * RESTITUTION;
            } else b.vx = 0;
          } else if (b.x > arena.current.w - right) {
            b.x = arena.current.w - right;
            if (!idle && Math.abs(b.vx) > WALL_REST_SPEED) {
              b.vx = -Math.abs(b.vx) * RESTITUTION;
            } else b.vx = 0;
          }

          /* No ceiling: an object still falling in is legitimately above the
           * arena, and clamping it there would leave it sitting on the top
           * edge instead of dropping through. */
          if (b.y > arena.current.h - down) {
            b.y = arena.current.h - down;
            if (!idle && b.vy > WALL_REST_SPEED) b.vy = -b.vy * RESTITUTION;
            else b.vy = 0;

            if (!idle) {
              const rEff = Math.max(down, b.w * 0.2);
              const rollSpin = (b.vx / rEff) * (180 / Math.PI);
              if (b.spec.spin !== false) {
                b.spin += (rollSpin - b.spin) * Math.min(1, ROLL_LOCK_RATE * h);
              }
              b.vx *= Math.max(0, 1 - FLOOR_FRICTION_PER_SEC * h);
              if (
                Math.abs(b.vy) < SLEEP_SPEED &&
                Math.abs(b.vx) < SLEEP_SPEED &&
                Math.abs(b.spin) < SLEEP_SPIN
              ) {
                b.vx = 0;
                b.vy = 0;
                b.spin = 0;
                b.asleep = true;
              }
            }
          }
        }
      }
    };

    const step = (ts: number) => {
      raf = requestAnimationFrame(step);
      if (lastTs == null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 1 / 30);
      lastTs = ts;

      const r = box.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        if (arena.current.w > 0 && (r.width !== arena.current.w || r.height !== arena.current.h)) {
          // Keep the pile where it looks like it is when the window resizes:
          // everything is stored in px, and the arena is sized in --u, so a
          // width change moves every wall out from under the objects.
          const kx = r.width / arena.current.w;
          const ky = r.height / arena.current.h;
          for (const b of bodies.current) {
            b.x *= kx;
            b.y *= ky;
          }
        }
        arena.current = { w: r.width, h: r.height };
      }

      bodies.current.forEach(measure);

      const now = performance.now();
      for (const b of bodies.current) {
        if (!b.released && arena.current.w > 0 && b.w > 0 && now >= armedAt + b.spec.delay) {
          release(b);
        }
      }

      const h = dt / SUBSTEPS;
      for (let s = 0; s < SUBSTEPS; s++) substep(h);

      bodies.current.forEach(write);
    };

    const pointerPos = (e: PointerEvent) => {
      const r = box.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const grabs = new Map<
      number,
      { body: Body; ox: number; oy: number; moved: boolean; samples: { x: number; y: number; t: number }[] }
    >();

    const onDown = (e: PointerEvent) => {
      const idx = els.current.findIndex((el) => el === e.currentTarget);
      const b = bodies.current[idx];
      if (!b || !b.released) return;
      const p = pointerPos(e);
      b.held = true;
      b.asleep = false;
      b.vx = 0;
      b.vy = 0;
      grabs.set(e.pointerId, {
        body: b,
        ox: b.x - p.x,
        oy: b.y - p.y,
        moved: false,
        samples: [{ ...p, t: performance.now() }],
      });
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone; the window-level pointerup still ends it */
      }
    };

    const onMove = (e: PointerEvent) => {
      const g = grabs.get(e.pointerId);
      if (!g) return;
      const p = pointerPos(e);
      const start = g.samples[0];
      if (!g.moved && Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD_PX) g.moved = true;
      if (!g.moved) return;
      e.preventDefault();
      g.body.x = p.x + g.ox;
      g.body.y = p.y + g.oy;
      const now = performance.now();
      g.samples.push({ ...p, t: now });
      while (g.samples.length > 2 && now - g.samples[0].t > 90) g.samples.shift();
    };

    const onUp = (e: PointerEvent) => {
      const g = grabs.get(e.pointerId);
      if (!g) return;
      grabs.delete(e.pointerId);
      g.body.held = false;
      g.body.asleep = false;
      const s = g.samples;
      if (g.moved && s.length >= 2) {
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
          g.body.vx = vx;
          g.body.vy = vy;
          if (g.body.spec.spin !== false) g.body.spin = vx * THROW_SPIN;
        }
      }
      // Anything it was leaning on has to reconsider its footing.
      for (const b of bodies.current) b.asleep = false;
    };

    const attached = els.current.slice();
    attached.forEach((el) => {
      if (!el) return;
      el.style.touchAction = "none";
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
    window.addEventListener("pointerup", onUp);
    raf = requestAnimationFrame(step);

    return () => {
      window.removeEventListener("pointerup", onUp);
      attached.forEach((el) => {
        if (!el) return;
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      });
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [arenaRef, enabled, armDelay, dropFrom, specKey]);

  return { register };
}

/** A disc's support is its radius in every direction — half its own box. */
function discSilhouette(): Silhouette {
  const s = defaultSilhouette();
  s.support.fill(0.5);
  return s;
}
