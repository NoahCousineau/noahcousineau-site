import type { Ground } from "@/lib/useThrowable";

/**
 * What each home-grid object does as one frame gives way to the next.
 *
 * 2026-11-01, Noah: "They should all move a bit slower between frames and
 * have more charming and dynamic animations between frames. For example,
 * when the Sprouts apple is bitten, there should be a little bit of a shake."
 *
 * Then, of the first pass, which squashed, stretched and sheared: "there's a
 * bit too much wiggle to things. I don't want any shearing or stretching of
 * the items. Right now it's a little too cartoony. I still want a bit of a
 * stop motion feel."
 *
 * SO EVERY MOVE IS RIGID. A pose can shift the object and turn it, and that
 * is all — what a hand nudging a real cut-out between exposures could do to
 * it. Nothing changes its size or shape; the frames already do that, as the
 * photographs they are. And each move is small, a few degrees and a few
 * percent of the object's width, settling in two or three swings at most.
 *
 * STEPPED, LIKE THE FRAMES THEMSELVES. Played as a smooth 60fps tween, even a
 * small rock reads as a digital effect laid over stop motion. So every move
 * advances in whole steps at STEP_MS and reads as more exposures of the same
 * object rather than as software moving it. Twelve a second at first, "on
 * twos"; then Noah: "Let's make the 12fps feel more like 18fps."
 *
 * POSES ARE WRITTEN AGAINST THE GROUND, not the box. `y` is along gravity and
 * `x` across it, and a rock turns the object about the point it is resting
 * on, so it rocks on its base whether it is sitting where it was placed,
 * lying on its side after a throw, or leaning into a wall on a tilted phone.
 * `spin` is the one exception, about the centre of mass, because a sun turned
 * about its bottom edge would swing across the tile instead.
 */

/** One step of a move: eighteen a second. */
export const STEP_MS = 56;

export type Pose = {
  /** Shove: across gravity / along it (down is +), in object widths. */
  x?: number;
  y?: number;
  /** Rock about the resting point, degrees. Mirrored on alternate frames. */
  r?: number;
  /** Turn about the centre of mass, degrees. Mirrored. */
  spin?: number;
  offset?: number;
};

export type Move = { ms: number; poses: Pose[] };

export const FLOURISHES: Record<"rock" | "bite" | "beat" | "burst" | "flicker", Move> = {
  /* The fallback: a small rock that settles. */
  rock: {
    ms: 420,
    poses: [{ r: 2.5 }, { r: -1.2, offset: 0.45 }, {}],
  },

  /* The apple. Bitten — the cut — and shakes it off: a jolt to the side,
     back past where it was, and settled, rocking a little on its base. */
  bite: {
    ms: 500,
    poses: [{ r: 3, x: 0.012 }, { r: -2.2, x: -0.009, offset: 0.33 }, { r: 1, x: 0.004, offset: 0.66 }, {}],
  },

  /* The heart. A beat as a small double hop, lub-dub, landing where it was. */
  beat: {
    ms: 500,
    poses: [{ y: -0.03 }, { offset: 0.33 }, { y: -0.014, offset: 0.55 }, {}],
  },

  /* The sun. Turned a little as the rays go on, and back. */
  burst: {
    ms: 500,
    poses: [{ spin: -8 }, { spin: 3.5, offset: 0.45 }, {}],
  },

  /* The flame. Sways on its base, one way and then the other. */
  flicker: {
    ms: 500,
    poses: [{ r: -2.5 }, { r: 2, offset: 0.4 }, { r: -0.8, offset: 0.75 }, {}],
  },
};

/**
 * In place of the nudge on the LAST frame: a move that ends somewhere other
 * than where it started, and stays there through the rest — until the rewind
 * turns it back, along with the frames.
 *
 * The sun, 2026-11-01, Noah: "Have the final sun icon rotate slightly." It
 * turns slowly through twenty degrees as the finished rays settle, the way a
 * hand might give a paper sun a last twist, and rests there.
 *
 * "burn" is the flame's, and is not a move but a state: see burnPattern.
 */
export const FINALES: Partial<Record<keyof typeof FLOURISHES, Move | "burn">> = {
  burst: { ms: 1800, poses: [{ spin: -8 }, { spin: 12 }] },
  flicker: "burn",
};

/** One pass of a burn, in steps; it repeats until the rewind. ~3.6s. */
export const BURN_STEPS = 64;

/**
 * The finished flame, kept burning — Noah, 2026-11-01: "See if there's any
 * way to make the final image feel like it's flickering while having a stop
 * motion feel."
 *
 * Two stop-motion tricks, and no others, since the flame may not stretch or
 * shear any more than the other objects may:
 *
 *   BOIL     a paper cut-out never lands in quite the same place between
 *            exposures. Every two or three steps the flame takes a new small
 *            lean about its base and a hair of drift — under two degrees and
 *            half a percent of its width — and holds it.
 *   FLARE    replacement animation, the way stop-motion flames are usually
 *            done: every second or so the slightly shorter flame of the frame
 *            before is swapped in for a step or two, and back. Real
 *            photographs, so the flicker is the material's own.
 *
 * Returned one entry per step, starting and ending at rest and unflared so
 * that the pass repeats without a seam.
 */
export function burnPattern(): { poses: Pose[]; flares: boolean[] } {
  const poses: Pose[] = [];
  const flares: boolean[] = [];
  let pose: Pose = {};
  let holdFor = 0;
  let flaring = 0;
  let nextFlare = 8 + Math.floor(Math.random() * 10);
  for (let k = 0; k <= BURN_STEPS; k++) {
    const edge = k === 0 || k >= BURN_STEPS - 1;
    if (edge) pose = {};
    else if (holdFor <= 0) {
      pose = { r: (Math.random() * 2 - 1) * 1.4, x: (Math.random() * 2 - 1) * 0.005 };
      holdFor = 2 + Math.floor(Math.random() * 2);
    }
    holdFor--;
    if (!edge && k < BURN_STEPS - 3 && k >= nextFlare && flaring === 0) {
      flaring = 1 + Math.floor(Math.random() * 2);
      nextFlare = k + 12 + Math.floor(Math.random() * 14);
    }
    flares.push(!edge && flaring > 0);
    if (flaring > 0) flaring--;
    poses.push(pose);
  }
  return { poses, flares };
}

/**
 * One pose as a CSS transform, to be used with `transform-origin` at
 * `ground.contact`.
 *
 * Reads right to left: turn the box so gravity points straight down, spin
 * about the centre of mass, rock about the resting point, shove, then turn
 * back. Every pose produces the same list of functions, so the Web
 * Animations API interpolates them number by number.
 */
export function poseTransform(p: Pose, g: Ground, width: number, dir: number): string {
  const a = g.downDeg - 90;
  const t = (-a * Math.PI) / 180;
  const vx = g.pivot.x - g.contact.x;
  const vy = g.pivot.y - g.contact.y;
  const dx = vx * Math.cos(t) - vy * Math.sin(t);
  const dy = vx * Math.sin(t) + vy * Math.cos(t);
  return (
    `rotate(${a}deg) ` +
    `translate(${(p.x ?? 0) * dir * width}px, ${(p.y ?? 0) * width}px) ` +
    `rotate(${(p.r ?? 0) * dir}deg) ` +
    `translate(${dx}px, ${dy}px) rotate(${(p.spin ?? 0) * dir}deg) translate(${-dx}px, ${-dy}px) ` +
    `rotate(${-a}deg)`
  );
}
