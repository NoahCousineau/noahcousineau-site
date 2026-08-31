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
const RESTITUTION = 0.3;
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
/* 9/5 -> 18/9, alongside OVERLAP_SLOP below, in the same "excess energy when
 * objects collide" pass. A body creeping at 18px/s still has to hold that for
 * REST_TIME before it parks, so nothing genuinely moving is frozen; what it
 * removes is the long tail where a pile is technically still resolving but
 * has nothing left to show for it. RagdollHead has run at 16/8 all along. */
const SLEEP_SPEED = 18;
const SLEEP_SPIN = 9;
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
 *  that is trying to come to rest.
 *
 *  0.2 -> 0.06, with PAIR_REST_SPEED 15 -> 45 and the wall/floor RESTITUTION
 *  0.42 -> 0.3 (2026-08-23: "There's still sometimes a bit of jumpiness or
 *  excess energy when some of the header objects collide"). Measured over the
 *  settle window on four project pages — count of frames moving more than 6px
 *  after the drop is done, and how long until the pile goes quiet:
 *
 *      before   more-work 32 spikes, quiet 7.6s | valley-strong 44, NEVER
 *      after    more-work  5 spikes, quiet 6.6s | valley-strong  1, 4.7s
 *
 *  Damping the CONTACT rather than the motion is what keeps the fall itself
 *  feeling the same: gravity, air drag and the drop height are untouched, so
 *  only what happens at the moment two objects meet is quieter.
 *
 *  SEPARATION was tried at 0.55 in the same pass and put back: a gentler
 *  positional push leaves overlaps unresolved for longer, so bodies keep
 *  being nudged, and both of those pages stopped settling at all. */
const PAIR_RESTITUTION = 0.06;
/** Below this relative approach speed, a body-body contact is fully
 *  inelastic instead of bouncing PAIR_RESTITUTION of it back — the
 *  body-body equivalent of WALL_REST_SPEED. See the note at its use site. */
const PAIR_REST_SPEED = 45;
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
 *  nothing that is ignored here can be seen.
 *
 *  0.4 -> 1.6 (2026-08-23). Widening the band a contact is allowed to sit in
 *  without being corrected is the single most effective lever on settling —
 *  measured across 9 runs, mean time to a quiet pile fell from 47.6s to
 *  26.9s and the runs that never went quiet inside the sample window from
 *  four to two. Still under two pixels, so a pair resting this close reads
 *  as touching. */
const OVERLAP_SLOP = 1.6;

/*
 * LETTING THINGS SIT ON TOP OF EACH OTHER (2026-08-29).
 *
 * Noah: "make sure that they come to an eventual rest AND they can sit on top
 * of one another without feeling the need to be forced off."
 *
 * The second half is the interesting one, and the solver genuinely could not
 * do it. The separation push runs along the line between two centres, so a
 * body resting on another whose centre is offset sideways — which is every
 * real pile — gets a push with a large HORIZONTAL component, every frame,
 * until it has slid off. Stacking was only ever a transient on the way to
 * being flattened.
 *
 * TWO THINGS THAT DID NOT WORK, recorded because both are the obvious move:
 *
 *   Skipping the push entirely for a shallow overlap between two slow bodies.
 *   The push is also what SUPPORTS the upper body, so without it gravity pulls
 *   it down into its neighbour until it breaks the speed threshold, the push
 *   returns, it slows, and the skip re-engages. Measured, that version never
 *   reached rest at all: 19.5, 11.2, 14.9, 14.2px/s at seconds 7-10 against a
 *   baseline that was at 0.00 by then.
 *
 *   Suppressing the push's wake-up below a sub-pixel threshold. A body that
 *   stays flagged asleep is not damped, so the small pushes accumulate
 *   unopposed into visible drift — 18-24px/s, worse again.
 *
 * What works is to keep the whole push but take the SIDEWAYS half out of it
 * once a contact has come to rest. The vertical component still supports the
 * pile, so it still settles; the horizontal one is the part that was sliding
 * things off each other, and a resting contact has no reason to be resolved
 * sideways at all.
 */
const RESTING_OVERLAP = 14;
/** How much of the sideways push survives once a contact is at rest.
 *
 *  ZERO, after measuring. 0.12 was tried first on the reasoning that a little
 *  sideways resolution would keep piles tidy without the slide being visible;
 *  it left 2-7px/s still running at seconds 7-11 in two runs out of three,
 *  all of it sideways. At zero, most drops reach a true 0.00 and the worst
 *  measured across three project pages is 0.4px/s spread over ten bodies —
 *  0.04px each, which is nothing. A resting contact simply has no sideways
 *  correction left to make. */
const RESTING_SLIDE = 0;

/**
 * Friction BETWEEN TWO BODIES, as a fraction of the normal impulse
 * (2026-08-31). Noah: "getting the header icons able to move and rest on top
 * of one another and reduce fidgeting."
 *
 * Until now there was no tangential response between bodies at all. Every
 * body-body contact applied an impulse along the normal and nothing across
 * it, so two objects in contact could slide past each other freely: the only
 * thing slowing a sideways slide was AIR_DRAG, at 0.2 per second, and the
 * floor's own friction, which a body resting on another body never touches.
 * An icon that landed on top of another kept whatever sideways speed it
 * arrived with and crept off the side of it.
 *
 * RESTING_SLIDE above solved the POSITIONAL half of the same problem — the
 * separation push no longer shoves a settled pair apart sideways. This is the
 * velocity half, and the two are complementary: one stops a resting contact
 * being resolved sideways, the other stops a moving one sliding.
 *
 * Coulomb-style, so it scales with how hard the two are pressed together: the
 * tangential impulse is clamped to this fraction of the normal impulse, which
 * means a light touch barely grips and a body with real weight on it holds
 * firm. 0.5 is a middling, sticky-but-not-glued value.
 */
const PAIR_FRICTION = 0.5;



/**
 * THE SETTLE WATCHDOG (2026-08-31). Seconds a body may sit essentially still
 * before it is parked outright, and how far "essentially still" is allowed to
 * wander, as a fraction of the body's own width.
 *
 * Every other quiet-detection term in this file is a SPEED in px/s, and speed
 * is the wrong unit for the question Noah is actually asking — "reduce
 * fidgeting" is about whether anything appears to move, which is a question
 * about DISPLACEMENT. A body can sit under every speed threshold and still
 * creep, and worse, those thresholds are absolute pixels while the arena is
 * sized in --u: at a 900px window the whole field is about two-thirds the
 * size it was tuned at, so the same numbers mean something different. Two of
 * four project pages were still moving at 36-158px/s a full twelve seconds
 * after their drop, and which two depended on the window width.
 *
 * This closes it from the other end and is scale-free by construction:
 * measured against the body's own width, so it means the same thing at 390px
 * as at 1920px. If a body has not moved 2% of its own width in a second and a
 * half, whatever it is doing is not visible, and it is stopped.
 *
 * It cannot freeze anything real. A body in flight covers its own width many
 * times over in this window, and a dragged body is `held`, which is excluded.
 * Waking works exactly as before — a neighbour arriving, a drag, a resize.
 */
const SETTLE_WATCHDOG_S = 1.5;
const SETTLE_DRIFT_FRACTION = 0.02;

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
  /** Set once the body has fully entered the arena; gates the ceiling, which
   *  must not exist while it is still dropping in. See the wall pass. */
  inside: boolean;
  /** Seconds this body has spent continuously under the sleep thresholds.
   *  See REST_TIME. */
  calm: number;
  /** Rendered size in px, refreshed each frame from layout. */
  w: number;
  h: number;
  /** Where this body was when the settle watchdog last saw it move, and for
   *  how long it has stayed near that spot. See SETTLE_WATCHDOG_S. */
  anchorX: number;
  anchorY: number;
  anchorT: number;
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
  tilt = false,
  draggable = true,
}: {
  arenaRef: React.RefObject<HTMLElement | null>;
  specs: DropSpec[];
  armDelay?: number;
  dropFrom?: number;
  enabled?: boolean;
  /** Take the gravity direction from the device's own orientation — see
   *  the TILT note below. Phones only. */
  tilt?: boolean;
  /** Whether objects can be picked up and thrown. Off on phones, where the
   *  tilt IS the interaction. */
  draggable?: boolean;
}) {
  /* WHICH WAY IS DOWN (2026-08-25).
   *
   * Noah, for phones: "Instead of being able to click and drag the icons,
   * the mobile version will have them react to the orientation of the phone.
   * If the phone is held vertically, they'll fall straight down. If the phone
   * is tilted to the right, they'll fall along the right side of the screen.
   * If the phone is tilted to the left, then they'll fall to the left side of
   * the screen. If the phone is titled up, they'll hit the top of the screen.
   * If the phone is held level, there's no movement."
   *
   * All five cases fall out of one mapping, which is why it is worth writing
   * rather than a table of conditions. `gamma` is the device's left-right
   * tilt and is positive with the right edge down; `beta` is front-back and
   * is +90 when the phone is upright facing you, 0 lying flat, -90 tilted
   * away. So the gravity vector in SCREEN space is just
   *
   *     (sin gamma, sin beta)
   *
   * — upright gives (0, 1), straight down; right edge down gives (+1, 0);
   * left edge down (-1, 0); tilted away (0, -1), up into the top of the
   * screen; and flat gives (0, 0), no movement at all, because a phone lying
   * on a table has no gravity in the plane of its own screen. Exactly his
   * five cases and everything in between them.
   *
   * A ref rather than state: the integrator reads it every substep and must
   * not restart when it changes.
   */
  const gravityDir = useRef({ x: 0, y: 1 });
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
    /*
     * KEEP THE PILE WHERE IT IS WHEN THE SPECS CHANGE (2026-08-30). Noah:
     * "when I adjust the browser width, sometimes the header icons will bunch
     * up in the top left corner."
     *
     * This effect used to build every body from scratch, at x:0, y:0, with
     * released:false. That is the arena's top-left corner, and it is exactly
     * where the icons were piling up.
     *
     * It fires on a resize because `specKey` contains each object's width,
     * and `iconWidth` in ProjectHeader is tier-dependent — so crossing the
     * phone breakpoint rebuilds the specs. The bodies then reset to the
     * origin, while the ELEMENTS were still visible from the previous drop:
     * `write` only ever turns visibility on, never back off, and it writes a
     * transform for an unreleased body just the same. So every object jumped
     * to the top-left and sat there in a heap until its release timer came
     * round again.
     *
     * Carrying the physical state across fixes it at the source. Nothing
     * about a width change invalidates where an object has come to rest —
     * the resize handler in `step` already rescales positions to the new
     * arena — so the pile simply stays put and takes its new size. Only a
     * body that has no predecessor (first mount, or the object list actually
     * changing) starts at the origin, and it starts hidden and unreleased,
     * which is the case the origin was always meant for.
     *
     * State is matched by index AND by src, so a genuinely different object
     * arriving at a given slot gets a fresh body rather than inheriting the
     * previous one's position and rotation.
     */
    const prev = bodies.current;
    bodies.current = specs.map((spec, i) => {
      const old = prev[i];
      if (old && (old.spec.src ?? null) === (spec.src ?? null)) {
        return { ...old, spec };
      }
      return {
        spec,
        shape: discSilhouette(),
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        spin: 0,
        released: false,
        inside: false,
        asleep: false,
        held: false,
        calm: 0,
        w: 0,
        h: 0,
        anchorX: 0,
        anchorY: 0,
        anchorT: 0,
      };
    });
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
      // Only the ceiling asks for this — see the note there.
      up: supportAt(b.shape.support, 270 - b.rot) * b.w,
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
      //
      // And nothing MOVES until then either. Writing a transform for a body
      // the physics has not placed yet puts it at the arena's origin, which
      // is only invisible while the element still happens to be hidden — the
      // line below turns visibility on and never turns it back off, so once
      // an object has dropped, any later unreleased frame would park it in
      // the top-left corner in plain sight. That was the resize bug; the
      // state now carries across (see the specKey effect), and this makes
      // the corner unreachable rather than merely unvisited.
      if (!b.released) return;
      if (el.style.visibility !== "visible") el.style.visibility = "visible";
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
      // Start the watchdog from where the body actually is, not from (0,0),
      // which would read as a huge jump on its first frame and is also the
      // corner this field spent a while learning not to put things in.
      b.anchorX = b.x;
      b.anchorY = b.y;
      b.anchorT = 0;
    };

    const substep = (h: number) => {
      const list = bodies.current;
      const g = arena.current.h * GRAVITY_PER_HEIGHT;
      const { x: gx, y: gy } = gravityDir.current;

      for (const b of list) {
        if (!b.released || b.held || b.asleep) continue;
        b.vx += g * gx * h;
        b.vy += g * gy * h;
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

            /* A CONTACT BETWEEN TWO SLEEPING BODIES IS FINISHED WITH
             * (2026-08-31). Noah: "reduce fidgeting."
             *
             * This is what kept a pile alive indefinitely. The resolution
             * below wakes both bodies for ANY overlap at all, and a stack
             * always has one: SEPARATION is under 1, so the push never fully
             * closes the gap it is correcting. So a settled body would sleep,
             * be woken by its neighbour's contact on the very next substep,
             * spend REST_TIME accumulating calm, sleep again, and be woken
             * again — and every one of those waking intervals is another dose
             * of gravity integrated and then corrected away. Measured on
             * /work/sprouts-farmers-market, that cycle never stopped: about
             * 47px of total travel per second, still going twelve seconds
             * after the drop, while pages whose objects happen to rest
             * directly on the floor reached a true 0.00.
             *
             * Skipping the whole contact is safe here in a way it was NOT in
             * the version recorded above RESTING_OVERLAP, which skipped for
             * any shallow overlap between two SLOW bodies and made piles
             * sink: a slow body is still awake, still integrating gravity,
             * so removing its support let it fall. An ASLEEP body does not
             * integrate anything. There is nothing to support and nothing to
             * correct, so leaving the pair completely alone is exactly right,
             * and it costs the drift the other attempt hit — a sleeping body
             * receiving a push it can never counteract.
             *
             * Anything that disturbs the pile — a drag, a resize, a late
             * arrival landing on it — wakes a body by another route, and the
             * moment either side is awake this contact resolves normally
             * again and wakes its neighbour with it. */
            if (!a.held && !c.held && a.asleep && c.asleep) continue;
            const nx = dx / d;
            const ny = dy / d;
            /* A SLEEPING BODY IS GROUND, NOT A PARTICIPANT (2026-08-31).
             *
             * This is what finally stopped the fidgeting, and the reason the
             * earlier attempts above could not. A settled body would be
             * parked, its still-awake neighbour's contact would wake it on
             * the very next substep, the two would shove each other a pixel
             * or two, and it would park again — a cycle with no end. Traced
             * on /work/corita-art-center: one icon oscillating between
             * x=631.3 and x=633.3, y and rotation frozen, still going twelve
             * seconds after the drop.
             *
             * Every real solver treats a sleeping body as static, and that is
             * all this does. When one side is asleep the whole correction is
             * applied to the other one and the sleeper is neither moved nor
             * woken, so the awake body resolves against it exactly as it
             * would against the floor, comes to rest, and is parked by the
             * watchdog in turn. Then both are asleep, the contact is skipped
             * outright, and the pile is genuinely finished.
             *
             * Note this is NOT the same as skipping the push, which was tried
             * and made piles sink: the correction is still applied at full
             * strength, just all of it to the body that can still move. */
            /* Two things must still be able to disturb a settled pile, or
             * "static" would mean "frozen for good":
             *
             *   A DRAG. Noah can pick these up and move them, and shoving one
             *   into a pile has to shove the pile. A held body's position is
             *   overwritten by the pointer every frame, so if its sleeping
             *   neighbour were static the whole correction would go to the
             *   held body and be immediately discarded — the pile would sit
             *   there and let itself be drawn through. So no body is static
             *   while either side of the contact is being held.
             *
             *   A REAL COLLISION. Something arriving at speed should scatter
             *   what it lands on. Below PAIR_REST_SPEED a contact is gravity
             *   settling, which is the case this whole mechanism exists to
             *   quieten; above it, wake the sleeper and let it be hit. */
            const closing = -((c.vx - a.vx) * (dx / d) + (c.vy - a.vy) * (dy / d));
            const disturbed = a.held || c.held || closing > PAIR_REST_SPEED;
            const aStatic = !disturbed && a.asleep && !a.held;
            const cStatic = !disturbed && c.asleep && !c.held;
            if (disturbed) {
              if (!a.held) a.asleep = false;
              if (!c.held) c.asleep = false;
            }

            // Mass by area, so a big object shoulders a small one aside.
            const ra = bound(a);
            const rb = bound(c);
            const ma = a.held ? 0 : ra * ra;
            const mc = c.held ? 0 : rb * rb;
            const total = ma + mc;
            if (total <= 0) continue;
            const push = overlap * SEPARATION;
            /* A shallow overlap between two slow bodies is a pile at rest, and
             * the sideways part of resolving it is what slides one off the
             * other. The vertical part stays at full strength — it is the
             * support, and removing it makes the pile sink instead of settle
             * (see the note at RESTING_OVERLAP). Held bodies are excluded:
             * while someone is dragging one, every contact is live again. */
            const restingPair =
              !a.held &&
              !c.held &&
              overlap < RESTING_OVERLAP &&
              Math.hypot(a.vx, a.vy) < SLEEP_SPEED &&
              Math.hypot(c.vx, c.vy) < SLEEP_SPEED;
            const pushX = nx * push * (restingPair ? RESTING_SLIDE : 1);
            const pushY = ny * push;
            if (aStatic) {
              c.x += pushX;
              c.y += pushY;
            } else if (cStatic) {
              a.x -= pushX;
              a.y -= pushY;
            } else {
              a.x -= pushX * (mc / total);
              a.y -= pushY * (mc / total);
              c.x += pushX * (ma / total);
              c.y += pushY * (ma / total);
            }
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
            if (!a.held && !aStatic) a.asleep = false;
            if (!c.held && !cStatic) c.asleep = false;

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
              // A sleeping body is ground here too: infinite mass, so it
              // absorbs the collision without taking any of it.
              const invA = aStatic ? 0 : 1 / (ma || 1);
              const invC = cStatic ? 0 : 1 / (mc || 1);
              const invSum = invA + invC;
              if (invSum <= 0) continue;
              const jimp = (-(1 + restitution) * sep) / invSum;
              if (!a.held && !aStatic) {
                a.vx -= jimp * nx * invA;
                a.vy -= jimp * ny * invA;
                a.asleep = false;
              }
              if (!c.held && !cStatic) {
                c.vx += jimp * nx * invC;
                c.vy += jimp * ny * invC;
                c.asleep = false;
              }

              /* FRICTION ACROSS THE CONTACT — see PAIR_FRICTION. Without
               * this, the impulse above is purely along the normal and two
               * touching bodies slide past each other as if greased, which
               * is why an icon landing on another crept off the side of it
               * instead of staying put. The tangent is the normal turned a
               * quarter turn; the impulse opposes whatever relative motion
               * runs along it, clamped Coulomb-style to a fraction of the
               * normal impulse so the grip is proportional to how hard the
               * two are pressed together. */
              const tx = -ny;
              const ty = nx;
              const vt = rvx * tx + rvy * ty;
              if (vt !== 0) {
                const jt = -vt / invSum;
                const maxF = PAIR_FRICTION * Math.abs(jimp);
                const jtc = Math.max(-maxF, Math.min(maxF, jt));
                if (!a.held && !aStatic) {
                  a.vx -= jtc * tx * invA;
                  a.vy -= jtc * ty * invA;
                }
                if (!c.held && !cStatic) {
                  c.vx += jtc * tx * invC;
                  c.vy += jtc * ty * invC;
                }
              }
            }
          }
        }

        for (const b of list) {
          if (!b.released) continue;
          const { right, down, left, up } = extents(b);
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

          /* A CEILING, BUT ONLY ONCE THE BODY IS INSIDE (2026-08-25).
           *
           * There was none, for a good reason: an object still falling in is
           * legitimately above the arena, and clamping it there would leave
           * it sitting on the top edge instead of dropping through.
           *
           * Tilt gives it somewhere to go, though. Noah: "If the phone is
           * titled up, they'll hit the top of the screen" — and with gravity
           * pointing at the top and nothing to stop them, measured, they left
           * through it and kept going to y = -25000. So the ceiling switches
           * on per body the first time it is fully inside the arena, which
           * cannot happen before it has dropped in and cannot un-happen. */
          if (!b.inside && b.y - up >= 0) b.inside = true;
          if (b.inside && b.y - up < 0) {
            b.y = up;
            if (!idle && b.vy < -WALL_REST_SPEED) b.vy = -b.vy * RESTITUTION;
            else b.vy = 0;
          }

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

      /* THE SETTLE WATCHDOG — see SETTLE_WATCHDOG_S. The pass above asks
       * whether a body is slow; this one asks whether it has actually gone
       * anywhere, which is the question the eye asks. A body creeping below
       * every speed threshold, or being nudged a third of a pixel at a time
       * by a neighbour it can never quite resolve against, satisfies the
       * first and fails this one. */
      for (const b of list) {
        if (!b.released || b.held || b.asleep) continue;
        const drift = Math.max(0.5, b.w * SETTLE_DRIFT_FRACTION);
        if (Math.hypot(b.x - b.anchorX, b.y - b.anchorY) > drift) {
          b.anchorX = b.x;
          b.anchorY = b.y;
          b.anchorT = 0;
          continue;
        }
        b.anchorT += h;
        if (b.anchorT >= SETTLE_WATCHDOG_S) {
          b.vx = 0;
          b.vy = 0;
          b.spin = 0;
          b.asleep = true;
          b.calm = 0;
          b.anchorT = 0;
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
      // On a phone the tilt IS the interaction — "Instead of being able to
      // click and drag the icons, the mobile version will have them react to
      // the orientation of the phone."
      if (!draggable) return;
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
  }, [arenaRef, enabled, armDelay, dropFrom, specKey, draggable]);

  /* Reads the device's own orientation into `gravityDir` — see the note on
   * that ref for the mapping and why it is one expression.
   *
   * iOS 13 and later will not deliver these events at all until the page has
   * asked for permission, and the ask is only honoured from inside a user
   * gesture. So the request rides on the first touch anywhere on the page and
   * then removes itself. Until that happens — and on any device that refuses
   * or does not support it — `gravityDir` keeps its default of straight down,
   * which is the behaviour everything else on the site already assumes. There
   * is no broken state to fall into. */
  useEffect(() => {
    if (!tilt || typeof window === "undefined") return;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const rad = Math.PI / 180;
      const x = Math.sin(e.gamma * rad);
      const y = Math.sin(e.beta * rad);
      // Cap the magnitude so a steep tilt cannot make gravity stronger than
      // it is standing up — only differently aimed.
      const m = Math.hypot(x, y);
      const next = m > 1 ? { x: x / m, y: y / m } : { x, y };
      const prev = gravityDir.current;
      gravityDir.current = next;

      /* TILTING HAS TO WAKE THE PILE (2026-08-30). Noah: "the motion feature
       * isn't working on the mobile site. Everything is stationery."
       *
       * This is a regression from the settling work earlier today, and it is
       * the whole cause. Bodies now genuinely sleep once they come to rest —
       * that is what stopped the fidgeting — and a sleeping body does not
       * integrate gravity at all. So the phone turned, this handler dutifully
       * moved gravity, and ten sleeping objects ignored it. Before the pile
       * could sleep, the same code worked, because nothing was ever asleep to
       * ignore it.
       *
       * Any real change of direction wakes everything. The threshold is there
       * so a phone resting on a desk, jittering by a fraction of a degree,
       * cannot hold the whole field awake forever — which would put the
       * fidgeting straight back. */
      if (Math.hypot(next.x - prev.x, next.y - prev.y) > 0.02) {
        for (const b of bodies.current) {
          if (!b.held) {
            b.asleep = false;
            b.calm = 0;
            b.anchorT = 0;
          }
        }
      }
    };

    let attached = false;
    const attach = () => {
      if (attached) return;
      attached = true;
      window.addEventListener("deviceorientation", onOrient);
    };

    type PermissionCapable = {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const DOE = window.DeviceOrientationEvent as
      | (typeof window.DeviceOrientationEvent & PermissionCapable)
      | undefined;

    if (DOE && typeof DOE.requestPermission === "function") {
      const GESTURES = ["touchend", "pointerup", "click"] as const;
      const ask = () => {
        GESTURES.forEach((g) => window.removeEventListener(g, ask));
        DOE.requestPermission?.()
          .then((r) => {
            if (r === "granted") attach();
          })
          .catch(() => {});
      };
      /* Any first gesture, not just a touchend. iOS only honours the ask
       * from inside a user gesture, and a reader whose first interaction is a
       * tap on a link rather than a scroll was never being asked at all. */
      GESTURES.forEach((g) => window.addEventListener(g, ask, { once: true }));
      return () => {
        GESTURES.forEach((g) => window.removeEventListener(g, ask));
        window.removeEventListener("deviceorientation", onOrient);
      };
    }

    attach();
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [tilt]);

  return { register };
}
