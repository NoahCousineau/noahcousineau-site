"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  discSilhouette,
  measureSilhouette,
  radiusAt,
  supportAt,
  type Silhouette,
} from "./silhouette";

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
 * of jittering itself apart. One deliberate DIVERGENCE from useThrowable:
 * there is no roll-lock (spin tied to floor-slide speed) here — see the note
 * at the floor-contact branch below for why it destabilises specifically
 * when several irregular shapes are touching each other, which a single
 * object never encounters.
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
/* 0.22 -> 1.5. Only diverges from useThrowable's own ANGULAR_DRAG because
 * removing the roll-lock (see the note at the floor-contact branch below)
 * traded a chaotic settle for a stable-but-slow one: a long trace on
 * cultural-olympiad-poster with roll-lock gone but drag left at 0.22 was
 * still genuinely converging at 147px->34px->28px->15px->12px->4px->3px
 * across 8s-32s — technically settled, but reads as restlessness on a page
 * that's supposed to be at rest. Raising drag alone (no other constant
 * touched) brings every project's pile under ~2px within about 11s, without
 * reintroducing the roll-lock instability, because it only damps spin that's
 * already there rather than driving new spin from floor-slide.
 */
const ANGULAR_DRAG = 1.5;
const FLOOR_FRICTION_PER_SEC = 1.4;
const SLEEP_SPEED = 9;
const SLEEP_SPIN = 5;
/** How long a body must stay continuously under the sleep thresholds before
 *  it's actually put to sleep. See the note at REST_TIME's use site for why
 *  sleep can't just be an instant floor-contact check. */
const REST_TIME = 0.15;
const WALL_REST_SPEED = 18;
const MAX_THROW_SPEED = 2400;
const THROW_SPIN = 0.42;
const DRAG_THRESHOLD_PX = 3;
/** How far a dragged object leans into the direction it's being hauled,
 *  matching useThrowable's feel — Noah, on these objects specifically:
 *  "please make sure these can rotate." They already tumble on release (see
 *  THROW_SPIN below) and roll on the floor; what was missing was that a
 *  drag itself never fed any rotation in, so an object mid-carry looked like
 *  a sticker sliding around rather than a thing with weight. Skipped for a
 *  spin:false body (the header's static hero icon), which must stay upright
 *  even while it's being moved. */
const DRAG_LEAN_DEG_PER_SPEED = 0.016;
const MAX_DRAG_LEAN_DEG = 22;

/** Bounce between two objects. Lower than against a wall: a pile should
 *  settle, and every bit of restitution here is energy fed back into a stack
 *  that is trying to come to rest. */
const PAIR_RESTITUTION = 0.2;
/** Below this relative approach speed, a body-body contact is fully
 *  inelastic instead of bouncing PAIR_RESTITUTION of it back — the
 *  body-body equivalent of WALL_REST_SPEED. See the note at its use site. */
const PAIR_REST_SPEED = 15;
/** How much of an overlap is pushed out per relaxation pass. Under 1 so the
 *  passes converge rather than overshooting and ringing. */
const SEPARATION = 0.7;
/** Relaxation passes per substep. Three is enough for the depth of pile this
 *  field ever builds; more only costs time. */
const PASSES = 3;
/** Physics substeps per animation frame. Two keeps a fast-falling object from
 *  tunnelling past a thin neighbour between frames. */
const SUBSTEPS = 2;

/* --- balance and toppling; see topple() for the whole argument --- */
/** How close to the lowest hull point still counts as touching the floor, in
 *  WIDTH FRACTIONS (every hull measurement here is). Small enough that a
 *  corner-stand is read as a corner-stand, big enough that a flat edge a
 *  fraction of a degree off level still reads as flat. */
const CONTACT_BAND = 0.012;
/** Moment arm below which a body is treated as balanced and given no torque
 *  at all. THE ANTI-JITTER TERM: without a deadband a settled pile keeps
 *  being nudged by an imperceptible imbalance forever, which is precisely
 *  the "still trying to move or adjust slightly" Noah reported. */
const TOPPLE_DEADBAND = 0.02;
/** Angular acceleration per unit moment arm, deg/s².
 *
 *  Scaled from the real thing rather than dialled in by eye: for a flat body
 *  of width w, alpha = g*d/k^2 with d the moment arm and k ~= 0.4w the radius
 *  of gyration. At this arena's gravity (~2500 px/s^2) and a typical icon
 *  around 100px wide that comes out near 900 deg/s^2 per unit of moment arm,
 *  where the arm is measured — as everything hull-derived here is — as a
 *  fraction of the body's own width.
 *
 *  The first attempt used 2600 with a lever ceiling of 6, i.e. up to 16x
 *  this, and it did not merely topple things: bodies span continuously,
 *  turning 160+ degrees between samples five seconds apart and never
 *  settling, because each frame added far more angular velocity than the
 *  drag could take out and the body sailed straight past the flat pose it
 *  was supposed to fall into. */
const TOPPLE_GAIN = 900;
/** Ceiling on the narrow-base amplification, so a body standing on a true
 *  point (where the foot's half-width tends to zero) gets a strong shove
 *  rather than an unbounded one. */
const MAX_TOPPLE_LEVER = 3;
/** Topple torque stops adding once the body is already turning this fast
 *  (deg/s). Gravity tipping something over is a release of stored height, not
 *  an engine — without a ceiling the torque kept accelerating a body that was
 *  already rotating freely, which is what turned a topple into a spin. */
const TOPPLE_MAX_SPIN = 80;
/** How close to the floor still counts as standing on it, in px. The wall
 *  pass clamps a resting body to exactly the floor, so this only has to
 *  absorb the sub-pixel drift between that clamp and this check. */
const CONTACT_EPS = 0.75;
/** Slack on the "is a neighbour holding me up?" test, in px — a body leaning
 *  on another rests a hair short of touching (SEPARATION never closes an
 *  overlap completely, and OVERLAP_SLOP deliberately leaves a little more).
 *  See propped(). */
const PROP_TOLERANCE = 3;

/** Penetration ignored outright, in px — the standard "linear slop". Contacts
 *  are never resolved to exactly zero overlap (SEPARATION is under 1 by
 *  design, so each pass only removes part of what is left), which means a
 *  settled pile always carries a sub-pixel residue. Correcting that residue
 *  every frame forever is motion with no visible cause: 2026-08-23, Noah:
 *  "usually this is when the items settle and it looks like some of the items
 *  are still trying to move or adjust slightly." Below this, a contact is
 *  simply considered resolved and left alone. Under half a device pixel, so
 *  nothing that is ignored here can be seen. */
const OVERLAP_SLOP = 0.4;

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
  /** Flip pure-black artwork to white in dark mode — see .invert-on-dark
   *  in globals.css. For the header's pencil-drawing icons. Physics-neutral:
   *  read only by the caller's own rendering, not by this hook. */
  invertOnDark?: boolean;
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
  /** Seconds this body has spent continuously under the sleep thresholds.
   *  See REST_TIME. */
  calm: number;
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
      calm: 0,
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

    /* How far the body reaches toward ANOTHER BODY in a screen-space
     * direction, in px. This is the OUTLINE distance (radius), not the
     * support function — 2026-08-23, Noah: "it would be good if the bounding
     * area for each shape was closer to its actual perimeter." Support is
     * the convex hull's reach, so the empty middle of the ampersand and the
     * notch under the hammer's head both behaved as solid, holding every
     * neighbour off at arm's length. Deliberately NOT used against the floor
     * or the walls, which still ask `extents()` for the support function:
     * there, the extreme point is the whole question, and erring short would
     * drop an object through the rule. */
    const reach = (b: Body, deg: number) => radiusAt(b.shape.radius, deg - b.rot) * b.w;

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

    /**
     * GRAVITY ACTUALLY PULLS ON THE SHAPE NOW, not just on its position.
     *
     * 2026-08-23, Noah: "there isn't a proper sense of gravity or balance.
     * For example, some objects can stand straight up when real life physics
     * would dictate them to roll on their side."
     *
     * He was describing a real gap rather than a tuning problem: nothing in
     * this solver ever applied TORQUE. `rot` only ever integrated `spin`,
     * and `spin` only came from the random kick at release and whatever the
     * angular drag had not yet removed. So however a body happened to be
     * oriented when its downward motion stopped was simply how it stayed —
     * balanced on one corner of a hammer head, an exclamation mark stood on
     * end. Landing upright was as likely as landing any other way, which is
     * exactly what "no sense of gravity or balance" looks like.
     *
     * The physics of it is the support-polygon test, and it needs the
     * contact to be a REGION, not a distance — which is what the hull is
     * carried for (see silhouette.ts). Rotate the hull into screen space,
     * take the points sitting on the floor, and their horizontal span is
     * what the body is standing on. The centre of mass is the pivot, i.e.
     * the origin of this frame. If the CoM's x falls inside that span the
     * body is genuinely stable and gets NO torque — a hammer lying on its
     * side stays lying on its side. If it falls outside, gravity has a
     * moment arm about the nearest contact and the body tips that way,
     * which is the whole "roll onto its side" behaviour.
     *
     * `-nearest` is the signed moment arm: with the screen's y pointing down
     * a positive `rot` is clockwise, and a CoM to the LEFT of its support
     * (nearest > 0) has to fall counter-clockwise, hence the negation.
     *
     * NARROW BASES GIVE WAY FASTER (the `lever` term). A tall thing balanced
     * on a small foot is only technically stable — any disturbance at all
     * topples it, and a reader expects it to have fallen already. Scaling
     * the torque by how tall the CoM stands relative to the width of the
     * foot reproduces that without special-casing anything: a wide, flat
     * object barely responds, a tall one on a point goes over decisively.
     *
     * TOPPLE_DEADBAND is what keeps this from becoming the next source of
     * "some of the items are still trying to move or adjust slightly": below
     * a moment arm of a couple of percent of the body's width, the body is
     * balanced as far as anyone can see and the torque is simply not
     * applied, so a settled pile has nothing left driving it.
     */
    /**
     * Is something holding this body up on the side it wants to fall toward?
     *
     * `dirX` is where the TOP of the body is heading: -1 for a fall to the
     * left, +1 to the right. A neighbour it is already touching on that side
     * — or the arena wall — is carrying part of its weight, and the body is
     * genuinely stable leaning on it, exactly as a plank propped against a
     * crate is.
     *
     * This has to exist because topple() reads the support span off the
     * FLOOR contact alone, which is only the whole story for a body standing
     * by itself. Without it, anything resting against a neighbour has a
     * centre of mass sitting outside its own little footprint — correctly,
     * because the neighbour is holding the rest — and the torque drove it
     * into the thing propping it, forever: the contact pushed back, the
     * torque re-applied next frame, and the body could never sleep because
     * applying torque un-sleeps it. Measured on valley-strong before this
     * check existed: one body oscillated 2-5px and up to 2.9deg indefinitely,
     * still going at 46 seconds, while every other page had settled to
     * 0.00px. That is precisely Noah's "items are still trying to move or
     * adjust slightly."
     */
    const propped = (b: Body, dirX: number, list: Body[]) => {
      for (const c of list) {
        if (c === b || !c.released) continue;
        const dx = c.x - b.x;
        const dy = c.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 1e-4) continue;
        if (Math.sign(dx) !== dirX) continue; // not on the side it's falling
        if (dy < -b.h * 0.25) continue; // hanging above: not holding anything up
        const towards = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (d <= reach(b, towards) + reach(c, towards + 180) + PROP_TOLERANCE) return true;
      }
      const { left, right } = extents(b);
      if (dirX < 0 && b.x - left <= PROP_TOLERANCE) return true;
      if (dirX > 0 && b.x + right >= arena.current.w - PROP_TOLERANCE) return true;
      return false;
    };

    const topple = (b: Body, h: number, list: Body[]) => {
      if (b.spec.spin === false) return; // the hero icon stays upright
      const hull = b.shape.hull;
      if (hull.length < 6) return;
      const rad = (b.rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      let lowest = -Infinity;
      for (let i = 0; i < hull.length; i += 2) {
        const sy = hull[i] * sin + hull[i + 1] * cos;
        if (sy > lowest) lowest = sy;
      }
      // Everything within a hair of the lowest point is "on the floor".
      const band = CONTACT_BAND;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < hull.length; i += 2) {
        const sx = hull[i] * cos - hull[i + 1] * sin;
        const sy = hull[i] * sin + hull[i + 1] * cos;
        if (sy >= lowest - band) {
          if (sx < minX) minX = sx;
          if (sx > maxX) maxX = sx;
        }
      }
      if (!isFinite(minX)) return;

      // Nearest point of the support span to the centre of mass (at x=0).
      const nearest = minX > 0 ? minX : maxX < 0 ? maxX : 0;
      if (nearest === 0) return; // balanced: nothing to do
      if (Math.abs(nearest) < TOPPLE_DEADBAND) return;

      // Leaning on a neighbour or a wall is a stable pose, not an unbalanced
      // one — see propped(). `nearest > 0` means the centre of mass hangs off
      // to the LEFT of the foot, so that is the way it goes over.
      if (propped(b, nearest > 0 ? -1 : 1, list)) return;

      // How precarious the pose is: CoM height over half the foot's width.
      const half = Math.max((maxX - minX) / 2, TOPPLE_DEADBAND);
      const lever = Math.min(MAX_TOPPLE_LEVER, Math.max(lowest, 0) / half);
      const dir = -Math.sign(nearest);
      // Already going over fast enough — let it fall, don't drive it.
      if (b.spin * dir >= TOPPLE_MAX_SPIN) return;
      b.spin += -nearest * lever * TOPPLE_GAIN * h;
      b.asleep = false;
      b.calm = 0;
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
            // Once a PAIR has both settled, leave their positions alone.
            // Noah: "there can sometimes be a jittering or restlessness to
            // the icons in the header... ensure there's not a glitchy
            // jitter when the objects come to rest." The overlap push below
            // only removes SEPARATION (0.7) of an overlap per pass, by
            // design, so a resting pile — which always carries a residual
            // sub-pixel overlap the walk never quite zeroes — got that same
            // small correction reapplied forever, every frame, with nothing
            // ever damping it (the push writes straight to position, not
            // velocity). Two bodies that are each already asleep and not
            // being dragged have nothing left to resolve; skipping them is
            // what makes a settled pile actually stop, rather than
            // perpetually re-settling by an imperceptible amount forever. A
            // pair where EITHER side is still moving, newly landing, or
            // held is unaffected — it keeps pushing a sleeping neighbour
            // exactly as before.
            if (a.asleep && !a.held && c.asleep && !c.held) continue;
            let dx = c.x - a.x;
            let dy = c.y - a.y;
            let d = Math.hypot(dx, dy);
            if (d < 1e-4) {
              dx = 0;
              dy = -1;
              d = 1;
            }
            // Each shape's own outline toward the other, not a circle round
            // it — see reach().
            const towards = (Math.atan2(dy, dx) * 180) / Math.PI;
            const overlap = reach(a, towards) + reach(c, towards + 180) - d - OVERLAP_SLOP;
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
            // This is a REAL, currently-unresolved overlap being acted on —
            // a body whose position just moved because of it is not at
            // rest, whatever its stored velocity says. Missing this was the
            // actual cause of the "jittering or restlessness" Noah flagged:
            // an ASLEEP body sitting next to a still-active neighbour kept
            // getting silently repositioned by this push every pass — sep
            // (the two bodies' relative velocity) is often ~0 for a body
            // that's merely sitting in an overlapping pile rather than
            // approaching, so the velocity-impulse branch below, and its
            // `asleep = false`, never ran — while `write()` still applies
            // the new x/y every frame regardless of the asleep flag,
            // producing visible motion nothing marked as "still settling."
            if (!a.held) a.asleep = false;
            if (!c.held) c.asleep = false;

            const rvx = c.vx - a.vx;
            const rvy = c.vy - a.vy;
            const sep = rvx * nx + rvy * ny;
            if (sep < 0) {
              // PAIR_REST_SPEED, the body-body equivalent of WALL_REST_SPEED
              // below: without it, a body resting ON TOP OF ANOTHER (rather
              // than directly on the floor) never had anything to damp it.
              // Gravity adds a little velocity toward its support every
              // single substep, and PAIR_RESTITUTION bounced a fraction of
              // that straight back every time — a steady-state micro-bounce
              // that never converges to exactly zero, which is what Noah
              // saw as "jittering or restlessness... when the objects come
              // to rest." Below this speed the response is fully inelastic
              // (0 restitution) instead: gravity's tiny nudge is absorbed
              // outright rather than partially reflected, so a supported
              // body's relative velocity can actually reach zero and stay
              // there. Above it, a real collision still bounces normally.
              const restitution = Math.abs(sep) < PAIR_REST_SPEED ? 0 : PAIR_RESTITUTION;
              const jimp = (-(1 + restitution) * sep) / (1 / (ma || 1) + 1 / (mc || 1));
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
              // NO ROLL-LOCK HERE, unlike useThrowable's single-object floor
              // contact — tying spin to floor-slide speed (`rollSpin =
              // vx/rEff`) is what was behind "there can sometimes be a
              // jittering or restlessness to the icons in the header," and
              // it took a while to find because it wasn't a tuning problem:
              // it was a genuine feedback loop, specific to this hook's
              // MULTI-body, IRREGULAR-shape case. Rotating the body changes
              // its support function's reach in every direction, which
              // changes how much it overlaps its neighbours, which changes
              // the collision response's vx, which the roll-lock feeds
              // straight back into spin — for a concave, lopsided icon (an
              // onion outline, a spinach leaf) that loop has no reason to
              // settle at a fixed point the way it does for a smooth
              // silhouette. Confirmed directly: with roll-lock active, an
              // 11-body header pile could still swing 50+ degrees after 20+
              // seconds sitting still, occasionally past 100px, across
              // several timed trials; with it removed and nothing else
              // touched, every trial settled to sub-pixel, sub-degree
              // residue. useThrowable is untouched — one object with no
              // neighbours to feed the loop has never shown this.
              b.vx *= Math.max(0, 1 - FLOOR_FRICTION_PER_SEC * h);
            }
          }
        }
      }

      /* Gravity's TORQUE on whatever is resting on the floor — see topple().
       * Out here rather than in the pass loop above for the same reason the
       * sleep check is: this integrates into `spin`, and running it once per
       * PASS would apply three times the intended angular acceleration per
       * substep, against intermediate positions that the remaining passes
       * have not finished resolving yet. */
      for (const b of list) {
        if (!b.released || b.held || b.asleep) continue;
        const { down } = extents(b);
        if (b.y >= arena.current.h - down - CONTACT_EPS) topple(b, h, list);
      }

      /* SLEEP IS A FUNCTION OF THE BODY'S OWN SPEED, not of what it happens
       * to be touching. The check used to live only inside the floor-
       * contact branch above (inside the PASSES loop), which meant a body
       * resting on TOP OF ANOTHER BODY — the normal case partway up an
       * 11-icon pile, not touching the arena floor directly — could never
       * set `asleep` at all: gravity kept integrating into it every single
       * substep forever, each addition immediately soaked up by a fresh
       * body-body contact resolution, which is exactly the "jittering or
       * restlessness" Noah flagged, and it never stopped no matter how long
       * the pile sat still. Deliberately OUTSIDE the pass loop above and
       * run once per substep, not once per pass — inside it, `h` would
       * accumulate into `calm` three times too fast (PASSES=3) against
       * intermediate, not-yet-resolved velocities. A body genuinely in free
       * fall almost never trips this — gravity here is several thousand
       * px/s² at this arena's scale, so vy clears SLEEP_SPEED (9px/s)
       * within a couple of milliseconds of release — so this can't freeze
       * anything actually falling. REST_TIME requires the calm to hold for
       * a few consecutive substeps before sleeping, so one lucky near-zero
       * reading mid-motion doesn't false-positive it. */
      for (const b of list) {
        if (!b.released || b.held || b.asleep) continue;
        const calm =
          Math.abs(b.vx) < SLEEP_SPEED &&
          Math.abs(b.vy) < SLEEP_SPEED &&
          Math.abs(b.spin) < SLEEP_SPIN;
        if (!calm) {
          b.calm = 0;
          continue;
        }
        b.calm += h;
        if (b.calm >= REST_TIME) {
          b.vx = 0;
          b.vy = 0;
          b.spin = 0;
          b.asleep = true;
          b.calm = 0;
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
        // RESIZE_EPS: getBoundingClientRect can report a fractional-px
        // difference between two consecutive frames with nothing on the
        // page actually resizing — ordinary sub-pixel layout rounding, more
        // visible here because the arena's box is sized off container-query
        // `--u` units. Rescaling on every such flicker moved EVERY body,
        // asleep or not, by a fraction of a pixel every frame — read live as
        // exactly the "jittering or restlessness" Noah flagged. A real
        // resize is at minimum a device-pixel's worth of change; requiring
        // that before rescaling stops the false positives without missing
        // an actual one.
        const RESIZE_EPS = 0.5;
        if (
          arena.current.w > 0 &&
          (Math.abs(r.width - arena.current.w) > RESIZE_EPS ||
            Math.abs(r.height - arena.current.h) > RESIZE_EPS)
        ) {
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

      if (g.body.spec.spin !== false) {
        const prev = g.samples[g.samples.length - 2];
        if (prev) {
          const dtS = Math.max((now - prev.t) / 1000, 1 / 240);
          const vx = (p.x - prev.x) / dtS;
          const lean = Math.max(
            -MAX_DRAG_LEAN_DEG,
            Math.min(MAX_DRAG_LEAN_DEG, vx * DRAG_LEAN_DEG_PER_SPEED)
          );
          g.body.rot += (lean - g.body.rot) * 0.25;
        }
      }
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
      // Anything it was leaning on has to reconsider its footing — but ONLY
      // things actually near where it was picked up. This used to wake
      // EVERY body in the field on any pointerup, including a plain click
      // that never moved anything: a screen recording (2026-08-23, Noah:
      // "there's still a bit of jittering") showed an untouched icon on the
      // far side of the header suddenly sliding across the screen several
      // seconds after a click elsewhere, settling, and then handing the
      // same thing off to its own neighbour in turn — a slow domino, one
      // wake-all re-triggering real (if tiny) residual overlaps that the
      // sleeping-pair skip in the pairwise loop above exists specifically to
      // leave alone. Scoping the wake to bodies actually within reach of the
      // one just let go still covers the real case this existed for —
      // something resting ON the dragged body needs to reconsider whether
      // it's still supported — via the same reach-based `bound()` proximity
      // check the collision pass itself uses, without detonating the whole
      // settled pile over an unrelated tap on the other side of the header.
      const d = g.body;
      for (const b of bodies.current) {
        if (b === d || !b.released || b.held) continue;
        const dist = Math.hypot(b.x - d.x, b.y - d.y);
        if (dist < bound(d) + bound(b) + 4) b.asleep = false;
      }
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
