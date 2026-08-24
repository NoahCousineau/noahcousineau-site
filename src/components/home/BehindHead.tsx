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
// 521..528 y, so one fixed anchor holds for the whole turntable. Sized so
// the head's height is ~59% of the star's, which is the proportion in Noah's
// sketches (970 of 1620); the first pass at 848 put it at 67% and the neck
// ran out past the star's lower edge.
const YELLOW = { cx: 474, cy: 525, w: 960 };
const RED = { cx: 185, cy: 185, w: 271 };
const BLUE = { cx: 800, cy: 830, w: 404 };

/**
 * The three pencil clusters. Noah: "There are three clusters of pencil lines.
 * Have each of them take different times to get to their final height. One
 * should be after 8 frames, another 10, and another 12."
 *
 * `rot` does double duty. It sets the slant — the strokes were photographed
 * hanging vertically and the sketches show them radiating away from the head
 * — and it also decides which end is the BASE, because the wipe below always
 * runs along the artwork's own bottom-to-top axis. A line looks identical
 * rotated by r or r+180, but its "bottom" ends up at opposite ends, so the
 * cluster below and left of the head is turned through 212° rather than 32°:
 * same slant on screen, base pointing back at the head, which is what makes
 * all three draw outwards from the centre.
 *
 * `mark` indexes PENCIL_MARKS. Four clusters were shot and three are used —
 * the fourth (index 2, a squarer set of shorter strokes) is left in the
 * manifest for swapping in, since which three read best is a design call.
 */
const PENCILS = [
  { mark: 0, cx: 633, cy: 112, w: 92, rot: 32, draw: 8 },
  { mark: 1, cx: 917, cy: 278, w: 85, rot: 38, draw: 10 },
  { mark: 3, cx: 100, cy: 878, w: 122, rot: 212, draw: 12 },
];

/**
 * How much of a pencil cluster is showing, as two fractions of its length
 * measured FROM THE BASE.
 *
 * Noah: "These will animate from their base outwards and will also erase
 * from base outwards, repeating their animation when the entire line is
 * cleared out." So the visible run is a window between the erase front and
 * the draw front: the draw front travels base→tip over `draw` frames, then
 * the erase front follows it over the same span, eating the line from the
 * base until nothing is left, and the cycle restarts. Erasing at the drawing
 * speed is the one thing Noah didn't specify; matching them keeps the
 * three clusters' cycles at a clean 2x their stated draw time.
 */
function pencilWindow(tick: number, draw: number) {
  const period = draw * 2;
  let t = tick % period;
  if (t < 0) t += period;
  if (t < draw) return { from: 0, to: (t + 1) / draw };
  return { from: (t - draw + 1) / draw, to: 1 };
}

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
        <FrameStack set={red} index={pingPong(tick, red.frames.length)} sizes="25vw" />
      </Place>

      {/* The big shape the head sits on — what the old placeholder starburst
          stood in for. */}
      <Place x={yp.x} y={yp.y} w={yp.w} className="z-[1] pointer-events-none">
        <FrameStack set={yellow} index={pingPong(tick, yellow.frames.length)} sizes="55vw" />
      </Place>

      {/* ...the head is here, at z-10, rendered by Hero... */}

      <Place x={bp.x} y={bp.y} w={bp.w} className="z-20 pointer-events-none">
        <FrameStack set={blue} index={pingPong(tick, blue.frames.length)} sizes="25vw" />
      </Place>

      {/* Frontmost. The strokes are photographed graphite — black art on
          transparency — so dark mode flips them white through the shared
          .invert-on-dark utility rather than needing a second set of
          artwork. Noah: "The only difference when we switch to dark mode is
          that the pencil lines will be white." */}
      {PENCILS.map((p) => {
        const mark = PENCIL_MARKS[p.mark];
        const h = p.w * (mark.height / mark.width);
        const { from, to } = pencilWindow(tick, p.draw);
        return (
          <Place
            key={p.mark}
            x={p.cx - p.w / 2}
            y={p.cy - h / 2}
            w={p.w}
            className="z-30 pointer-events-none"
          >
            <div style={{ transform: `rotate(${p.rot}deg)` }}>
              <div
                style={{
                  // inset(top right bottom left): the visible window runs
                  // from `from` to `to` measured off the bottom, so the top
                  // inset is what the draw front has not reached yet and the
                  // bottom inset is what the erase front has taken.
                  clipPath: `inset(${(1 - to) * 100}% 0% ${from * 100}% 0%)`,
                }}
              >
                <Image
                  src={mark.src}
                  alt=""
                  width={mark.width}
                  height={mark.height}
                  sizes="10vw"
                  unoptimized
                  loading="eager"
                  draggable={false}
                  className="w-full h-auto select-none invert-on-dark"
                />
              </div>
            </div>
          </Place>
        );
      })}
    </>
  );
}
