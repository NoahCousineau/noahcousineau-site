"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { Place } from "./Stage";
import { BEHIND_SETS } from "@/lib/behindHead";
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
 * THE PENCIL MARKS ARE OUT for now — 2026-08-23: "Let's get rid of the pencil
 * lines for now." Their artwork and PENCIL_MARKS in lib/behindHead.ts are
 * deliberately left in place, since "for now" reads as a pause rather than a
 * deletion; bringing them back is re-adding the layer, not re-cutting assets.
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
const RED = { cx: 185, cy: 185, w: 271 };
const BLUE = { cx: 800, cy: 830, w: 404 };

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
const RED_GAIT = { range: [1, 4] as const, every: 2, phase: 0 };
const BLUE_GAIT = { range: [0, 4] as const, every: 2, phase: 3 };

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

    </>
  );
}
