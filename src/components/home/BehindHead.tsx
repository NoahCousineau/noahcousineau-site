"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { Place } from "./Stage";
import { BEHIND_SETS, PENCIL_MARKS } from "@/lib/behindHead";
import {
  getHeadTick,
  headTickServerSnapshot,
  pingPong,
  subscribeHeadTick,
} from "@/lib/headFrame";

/*
 * THE ARTWORK AROUND THE HOME PAGE'S ROTATING HEAD (2026-08-23).
 *
 * Noah: "I spent some time to finally replace the generic yellow shape
 * animation that we have behind the rotating head... There will now be four
 * new elements around the head. Furthest back is a red star, then a yellow
 * star, then my head, then the blue star, then the pencil marks."
 *
 * ONE PENCIL GROUPING IS BACK — 2026-08-23, after a round with them all
 * removed: "let's add one of the pencil groupings back on the homepage
 * animation. Let's have this just be the second grouping and have it in the
 * top right. Let's work on improving the speed and 'drawing' of each
 * individual line. I would love if each of the three lines were drawn
 * differently." See PENCIL below.
 *
 * ONE COMPONENT, FIVE LAYERS, AND THE HEAD IS NOT ONE OF THEM. Everything
 * here is absolutely positioned inside Hero's <Stage>, so paint order is
 * decided by z-index alone and not by where these sit in the DOM. That lets
 * the whole set live in one component while the head — rendered by Hero at
 * z-10, untouched, per "Please keep my head the same as it is" — slots
 * between the yellow star and the blue one.
 *
 * EVERYTHING RUNS OFF THE HEAD'S TICK: "please synch the frames of each
 * animation with the frames of the head rotation." One head frame advances
 * every element below by exactly one frame. See lib/headFrame.ts for why
 * that is a monotonic counter rather than the head's own wrapping index.
 *
 * EVERY FRAME OF EVERY SET IS IN THE DOM AT ONCE, with all but the current
 * one hidden, rather than one <img> whose `src` is swapped. Swapping a src
 * asks the browser to fetch-and-decode mid-animation, and at 130ms a frame
 * that shows as a blink of nothing the first time through each cycle.
 * Nineteen small images cost one layout each and then never change.
 */

/** Layout, in artboard units, keyed off the head's own measured position.
 *
 * The head's ink — not its element box, which is a 900x1350 canvas mostly
 * full of transparency — measures 392x505 units centred at (476, 524) on the
 * live page. Every position here was read off Noah's two sketches as an
 * offset from the head's centre in sketch space, then scaled by
 * (392 / head's width in that sketch) so the composition holds at the size
 * the head is actually drawn.
 *
 * `w` is the width of the registered CANVAS, not of the artwork in any one
 * frame: the growing sets are built with every frame centred on one shared
 * canvas (see tools/behind-head/build_behind.py), so a fixed canvas width is
 * what keeps them growing about a fixed point instead of drifting.
 */
// Centred on the head's own MEAN ink centre over a full rotation, measured
// live at (473.8, 524.6) — the per-frame centre only wanders 467..476 x and
// 521..528 y, so one fixed anchor holds for the whole turntable.
//
// 960 -> 720, 2026-08-23: "Let's reduce the side of the yellow star by 25%."
const YELLOW = { cx: 474, cy: 525, w: 720 };
// Both stars sit ON the yellow star's edge, half-tucked behind it, the way
// they do in Noah's sketches — 2026-08-23: "let's have the red star somewhat
// behind the yellow start like the sketches. Let's also move the blue star
// in, but make the size it grows smaller." Shrinking the yellow by a quarter
// had left them both stranded out in white space, since their coordinates
// were set against the bigger star. Each centre is now placed a little
// inside the yellow's own radius (360u from its centre at 474,525) along the
// direction it already sat in, so it overlaps rather than floats.
const RED = { cx: 260, cy: 274, w: 271 };
const BLUE = { cx: 744, cy: 778, w: 330 };

/**
 * How the two growing stars behave, 2026-08-23: "Let's make the blue star not
 * grow as much, same for the red star. Have the blue and red star go to their
 * next frame every other head rotation frame. Stagger the blue and red star
 * frames so they grow at different times."
 *
 * `range` trims the sequence rather than rescaling anything. The swing is the
 * ratio between the biggest and smallest frame Noah shot, and with these
 * assets the only honest way to shrink it is to use fewer of them: red's full
 * 1-5 runs 2.9x and blue's 1-6 runs 2.5x, against 2.1x and 1.9x for the
 * slices below. Rescaling frames to close the gap instead would fight the
 * photographs, which are the growth.
 *
 * `every` is the frames-per-step divisor and `phase` the stagger. Both stars
 * step at half the head's rate; the phase offset is what stops them peaking
 * together, which they otherwise would every time their periods lined up.
 */
/**
 * The one pencil cluster, top right, with its three strokes drawn as three
 * separate marks rather than one block wipe.
 *
 * Each stroke now has its OWN duration, its own pause before it starts, and
 * its own rest once it is down — which is what "each of the three lines were
 * drawn differently" needs, and what a single clip-path over the whole
 * cluster could never give: that wiped a straight edge across all three at
 * once, so they always grew in lockstep at the same rate. The strokes are
 * split out of the cluster at build time (see split_strokes in
 * build_behind.py), so each gets its own box to wipe.
 *
 * The numbers are deliberately uneven and not multiples of each other: three
 * lines drawn at 5, 8 and 11 frames, starting 0/3/7 frames apart, take 44
 * frames to return to the same relative state, so the group does not settle
 * into a visible pulse.
 */
const PENCIL = {
  mark: 1, // "just be the second grouping"
  cx: 902,
  cy: 168,
  w: 108,
  rot: 34,
  /** per stroke: [frames to draw, frames to wait first, frames held down] */
  strokes: [
    { draw: 5, delay: 0, hold: 6 },
    { draw: 8, delay: 3, hold: 4 },
    { draw: 11, delay: 7, hold: 9 },
  ],
};

/**
 * How much of one stroke is showing, 0..1 from its base.
 *
 * Draw, hold, then erase from the base and wait out the rest of the cycle —
 * the erase keeps Noah's original brief for these ("will also erase from base
 * outwards, repeating their animation when the entire line is cleared out").
 * Eased rather than linear: a hand-drawn line leaves the pencil quickly and
 * arrives slowly, and a constant-rate wipe is the main thing that made the
 * first version read as a mask sliding rather than a line being drawn.
 */
function strokeWindow(tick: number, sp: { draw: number; delay: number; hold: number }) {
  const period = sp.delay + sp.draw + sp.hold + sp.draw;
  let t = ((tick % period) + period) % period;
  const ease = (v: number) => 1 - Math.pow(1 - v, 2.2);
  if (t < sp.delay) return { from: 0, to: 0 };
  t -= sp.delay;
  if (t < sp.draw) return { from: 0, to: ease((t + 1) / sp.draw) };
  t -= sp.draw;
  if (t < sp.hold) return { from: 0, to: 1 };
  t -= sp.hold;
  return { from: ease((t + 1) / sp.draw), to: 1 };
}

const RED_GAIT = { range: [1, 4] as const, every: 2, phase: 0 };
// Blue trimmed again (0-4 -> 0-3): "make the size it grows smaller".
const BLUE_GAIT = { range: [0, 3] as const, every: 2, phase: 3 };

/** A set of registered frames, all mounted, one visible. */
function FrameStack({
  set,
  index,
  sizes,
}: {
  set: { frames: string[]; width: number; height: number };
  index: number;
  sizes: string;
}) {
  return (
    <div className="relative w-full" style={{ aspectRatio: `${set.width} / ${set.height}` }}>
      {set.frames.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes={sizes}
          // UNOPTIMIZED, and that is the point. These frames are already
          // WEBP at exactly the size they are drawn, written by our own
          // build step — handing them to next/image's optimizer re-encodes
          // them for nothing. Worse, measured: with `fill` it picked the
          // 3840px candidate off the device-size list and asked the server
          // to scale a 1000px source UP to 3840, nineteen times over. In dev
          // that stalled the page (9 of 55 images still pending after 12s,
          // so PageLoader never lifted); in production it would be the same
          // wasted bytes, just precomputed.
          unoptimized
          // eager, not `priority`: these must be decoded before the first
          // cycle so no frame flashes empty, but 19 preload hints in the
          // document head is noise for artwork this far from the LCP.
          loading="eager"
          draggable={false}
          className="object-contain select-none"
          style={{ visibility: i === index ? "visible" : "hidden" }}
        />
      ))}
    </div>
  );
}

/** Frame index for a star, ping-ponging within its own trimmed range at its
 *  own rate and phase. */
function starFrame(
  tick: number,
  gait: { range: readonly [number, number]; every: number; phase: number }
) {
  const [lo, hi] = gait.range;
  const n = hi - lo + 1;
  return lo + pingPong(Math.floor(tick / gait.every) + gait.phase, n);
}

export default function BehindHead() {
  const tick = useSyncExternalStore(
    subscribeHeadTick,
    getHeadTick,
    headTickServerSnapshot
  );

  const yellow = BEHIND_SETS.yellow;
  const red = BEHIND_SETS.red;
  const blue = BEHIND_SETS.blue;

  const place = (el: { cx: number; cy: number; w: number }, set: { width: number; height: number }) => ({
    x: el.cx - el.w / 2,
    y: el.cy - (el.w * (set.height / set.width)) / 2,
    w: el.w,
  });

  const yp = place(YELLOW, yellow);
  const rp = place(RED, red);
  const bp = place(BLUE, blue);

  return (
    <>
      {/* Furthest back, behind even the yellow star. */}
      <Place x={rp.x} y={rp.y} w={rp.w} className="z-0 pointer-events-none">
        <FrameStack set={red} index={starFrame(tick, RED_GAIT)} sizes="25vw" />
      </Place>

      {/* The big shape the head sits on — what the old placeholder starburst
          stood in for. */}
      <Place x={yp.x} y={yp.y} w={yp.w} className="z-[1] pointer-events-none">
        <FrameStack set={yellow} index={pingPong(tick, yellow.frames.length)} sizes="55vw" />
      </Place>

      {/* ...the head is here, at z-10, rendered by Hero... */}

      <Place x={bp.x} y={bp.y} w={bp.w} className="z-20 pointer-events-none">
        <FrameStack set={blue} index={starFrame(tick, BLUE_GAIT)} sizes="25vw" />
      </Place>

      {/* Frontmost: the pencil cluster, each stroke on its own clock. Black
          graphite on transparency, so dark mode flips it white through the
          shared .invert-on-dark utility rather than a second set of art. */}
      {(() => {
        const mark = PENCIL_MARKS[PENCIL.mark];
        const h = PENCIL.w * (mark.height / mark.width);
        return (
          <Place
            x={PENCIL.cx - PENCIL.w / 2}
            y={PENCIL.cy - h / 2}
            w={PENCIL.w}
            className="z-30 pointer-events-none"
          >
            <div
              className="relative w-full"
              style={{
                aspectRatio: `${mark.width} / ${mark.height}`,
                transform: `rotate(${PENCIL.rot}deg)`,
              }}
            >
              {mark.strokes.map((st, i) => {
                const sp = PENCIL.strokes[i % PENCIL.strokes.length];
                const { from, to } = strokeWindow(tick, sp);
                return (
                  <div
                    key={st.src}
                    className="absolute"
                    style={{
                      left: `${st.x * 100}%`,
                      top: `${st.y * 100}%`,
                      width: `${st.w * 100}%`,
                      height: `${st.h * 100}%`,
                      // inset(top right bottom left): the window runs from
                      // `from` to `to` measured off this stroke's own base.
                      clipPath: `inset(${(1 - to) * 100}% 0% ${from * 100}% 0%)`,
                    }}
                  >
                    <Image
                      src={st.src}
                      alt=""
                      fill
                      sizes="10vw"
                      unoptimized
                      loading="eager"
                      draggable={false}
                      className="object-fill select-none invert-on-dark"
                    />
                  </div>
                );
              })}
            </div>
          </Place>
        );
      })()}

    </>
  );
}
