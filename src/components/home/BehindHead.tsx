"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { Place } from "./Stage";
import Parallax from "../Parallax";
import { useIsPhone } from "@/lib/useIsPhone";
import { HERO_DESKTOP, HERO_PHONE } from "./heroLayout";
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
/* Every position below is an offset from the head's own, applied as `shiftX`
 * and `dy` — see heroLayout.ts, which this file and Hero.tsx both read so the
 * head and the paper around it can never be moved independently. These are
 * absolute artboard positions, not nested inside the head's Place, so moving
 * the head alone would tear the composition apart. On a phone the head is
 * centred rather than sitting in the left column and the whole cluster comes
 * with it. */

/**
 * How far each layer drifts against the scroll, artboard units (2026-08-24).
 *
 * Noah: "add some parallax scrolling on the head spin animation. Not tons,
 * just enough to make the viewer realize they're on separate planes."
 *
 * Ordered by the depth this component already establishes with z-index —
 * red furthest back, then yellow, then the head (Hero.tsx, which uses
 * HEAD_PARALLAX and has to agree with these), then blue, then the pencil
 * marks in front. Back layers lag the scroll and front ones lead it, which
 * is the direction that reads as depth rather than as drift.
 *
 * Kept small on purpose. These are not independent objects: the yellow star
 * is positioned on the head's own measured ink centre, and the red and blue
 * sit tucked against the yellow's rim. Enough separation to notice is a few
 * units; enough to admire would visibly break the composition apart.
 *
 * 2026-08-25 — "let's make the parallax scroll effect on the homepage star
 * more apparent." Everything scaled by 1.8, keeping the depth ORDER and the
 * ratios between the planes exactly as they were: the effect reads as depth
 * because of how the layers move relative to EACH OTHER, so scaling them
 * together makes it more apparent without re-staging anything.
 *
 * The number that matters is the differential between neighbouring planes,
 * since that is the separation the eye actually picks up. Head-to-blue was
 * 17 units and is now 31; drift being 2x `units` (see Parallax.tsx), that is
 * 62 units of relative travel across the pass, ~49px at a 1512 viewport,
 * against 27px before. Hero.tsx's own units={4} for the head is part of this
 * ladder and moved to 7 with the rest — it has to stay between yellow and
 * blue or the head changes depth.
 */
const PARALLAX = { red: 47, yellow: 27, blue: -23, pencil: -43 };

// Centred on the head's own MEAN ink centre over a full rotation, measured
// live at (473.8, 524.6) — the per-frame centre only wanders 467..476 x and
// 521..528 y, so one fixed anchor holds for the whole turntable.
//
// 960 -> 720, 2026-08-23: "Let's reduce the side of the yellow star by 25%."
function geometry(shiftX: number, dy: number) {
  return {
    YELLOW: { cx: 474 + shiftX, cy: 525 + dy, w: 720 },
// Both stars sit ON the yellow star's edge, half-tucked behind it, the way
// they do in Noah's sketches — 2026-08-23: "let's have the red star somewhat
// behind the yellow start like the sketches. Let's also move the blue star
// in, but make the size it grows smaller." Shrinking the yellow by a quarter
// had left them both stranded out in white space, since their coordinates
// were set against the bigger star. Each centre is now placed a little
// inside the yellow's own radius (360u from its centre at 474,525) along the
// direction it already sat in, so it overlaps rather than floats.
    RED: { cx: 260 + shiftX, cy: 274 + dy, w: 271 },
// 330 -> 264, 2026-08-24: "Let's reduce the side of the blue star by 20%."
// `place()` centres each element on its own (cx, cy), so shrinking w alone
// keeps the centre fixed and only pulls the edges in.
    BLUE: { cx: 744 + shiftX, cy: 778 + dy, w: 264 },

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
// (902,168) -> (750,240), 2026-08-24 — Noah sent a screenshot of the live
// page with the marks circled in red at their new spot: closer in, touching
// the yellow star's rim the way the red/blue stars do, rather than floating
// past its edge. Measured off his screenshot as an offset from the star's
// own centre (474,525) in star-radii (star w=720, r=360): the marks moved
// from 1.19r/-0.99r out to about 1.10r at a slightly steeper angle
// (-46 deg against the old -40), i.e. dx=274,dy=-286 from the star's centre.
// 2026-08-24, second pass: "shrink the size of the pencil marks to half the
// size they are now. I also feel like it would be better if they were moved
// up and right by just a tad." Halving w alone shrinks about the group's own
// centre (see `place()`), so the nudge is applied on top of that rather than
// being an artefact of it.
    PENCIL: {
      mark: 1, // "just be the second grouping"
      // 2026-08-25: "nudge these a bit closer to the yellow star edge." As
      // an offset from the star's own centre (474, 525) they sat 432 units
      // out against its 360-unit radius — 72 units clear of the rim. Pulled
      // in along the same bearing to 382, so they just clear it.
      //
      // ...and then back out a little, same day: "move the pencil lines just
      // a smidge further away from the yellow star, just the smallest
      // amount." 382 -> 400 along that same bearing, which is 40 units of
      // clearance instead of 22 — about a third of what the pull-in took
      // away, so the marks still read as sitting against the star's rim
      // rather than floating off on their own. Moving along the bearing
      // rather than in x or y is what keeps "further from the star" from
      // also meaning "further around it".
      cx: 753 + shiftX,
      cy: 238 + dy,
      w: 54,
      rot: 34,
      /** per stroke: [draw frames, wait frames, hold frames] */
      strokes: [
        { draw: 5, delay: 0, hold: 6 },
        { draw: 8, delay: 3, hold: 4 },
        { draw: 11, delay: 7, hold: 9 },
      ],
    },
  };
}

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
}: {
  set: { frames: string[]; width: number; height: number };
  index: number;
}) {
  return (
    <div className="relative w-full" style={{ aspectRatio: `${set.width} / ${set.height}` }}>
      {set.frames.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          /* OPTIMISED AFTER ALL, because the premise turned out to be false
             on a phone (2026-08-30). Noah: "the page jumps and skitters as
             projects and content load in."
             
             The old note said these were already at exactly the size they
             are drawn — true at 1512, where 820px of source covers a 213px
             box on a retina screen. Measured at 390px, the same box is 106px
             wide, and 820px of source is 6.7 times the pixels needed. There
             are 37 of these frames and every one is mounted so no frame
             flashes empty, so that is ~23 of the 20.3 megapixels this page
             decodes on a 390x844 screen. The decoding lands while the reader
             is scrolling, which is exactly what "skitters" describes.
             
             What actually went wrong before was the `sizes` string, not the
             optimiser: with `fill` and a generous sizes, Next picked the
             3840px candidate and scaled a 1000px source UP to it. The fix is
             to tell it the truth. Measured, this box is 27vw on a phone and
             14vw at every larger size, so that is what it now says, and the
             candidate chosen lands just above what the box needs instead of
             nineteen times over. */
          /* Declared at twice the measured box (27vw on a phone, 14vw
             above it) rather than exactly it. A truthful `sizes` leaves the
             candidate choice entirely to the browser's device-pixel-ratio
             handling, and headless Chrome at dpr 3 was seen picking a 1x
             variant for a 3x screen — which on a real phone would be visibly
             soft artwork. Asking for double guarantees a sharp frame either
             way and still decodes about a quarter of the pixels the
             unoptimised 820px source did. */
          sizes="(max-width: 767px) 56vw, 30vw"
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

  const phone = useIsPhone();
  const L = phone ? HERO_PHONE : HERO_DESKTOP;
  const { YELLOW, RED, BLUE, PENCIL } = geometry(
    L.shiftX,
    L.headY - HERO_DESKTOP.headY
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
        <Parallax units={PARALLAX.red}>
          <FrameStack set={red} index={starFrame(tick, RED_GAIT)} />
        </Parallax>
      </Place>

      {/* The big shape the head sits on — what the old placeholder starburst
          stood in for. */}
      <Place x={yp.x} y={yp.y} w={yp.w} className="z-[1] pointer-events-none">
        <Parallax units={PARALLAX.yellow}>
          <FrameStack set={yellow} index={pingPong(tick, yellow.frames.length)} />
        </Parallax>
      </Place>

      {/* ...the head is here, at z-10, rendered by Hero... */}

      <Place x={bp.x} y={bp.y} w={bp.w} className="z-20 pointer-events-none">
        <Parallax units={PARALLAX.blue}>
          <FrameStack set={blue} index={starFrame(tick, BLUE_GAIT)} />
        </Parallax>
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
            <Parallax units={PARALLAX.pencil}>
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
            </Parallax>
          </Place>
        );
      })()}

    </>
  );
}
