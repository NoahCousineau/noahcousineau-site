"use client";

import { useEffect, useState } from "react";
import { useIsPhone, useIsCompact } from "@/lib/useIsPhone";
import {
  WORM_BAND,
  WORM_CYCLE_ADVANCE,
  WORM_STEPS,
  WORM_VIEWBOX,
} from "@/lib/loadingWorm";

/*
 * THE LOADING SCREEN'S WORM (2026-08-23).
 *
 * Noah: "The loading animation will now have a red worm slowly crawling
 * across with the word 'loading' on the worm... It will be moving the whole
 * time of the actual loading, it always keeps the same speed and never slows
 * if the loading is taking some time."
 *
 * SO IT SHOWS NOTHING ABOUT PROGRESS, deliberately. It replaced a percentage
 * bar, and the instruction above rules out putting that information back in
 * by another route — the crawl is a constant-rate sign of life, not a
 * measure of how far along the load is. Nothing here reads the loader's
 * state; it starts when it mounts and stops when it unmounts.
 *
 * EVERY POSE AND POSITION IS NOAH'S OWN, lifted out of the SVGs he drew
 * rather than modelled — including the gait, which is the part that would
 * have been hard to invent: "Notice how the worm doesn't move to the right
 * as much when it scrunches up, but then moves further when it scrunches
 * back down." See tools/loading-worm/build_worm.py.
 */

/** One pose per step. Matches the head's turntable cadence elsewhere on the
 *  site, which puts the crawl at about nine seconds to cross the screen. */
const STEP_MS = 130;

/* 2026-08-23: "It would be nice if he was a little smaller. Make him start
 * more from the left side of the screen, maybe about 25% from the left."
 *
 * The scale is taken about the worm's own footing on the floor, so shrinking
 * it doesn't lift it off the ground, and the travel is applied INSIDE that
 * scale so his stride shrinks with him rather than a smaller worm covering
 * the same distance per step. */
const SCALE = 0.8;
/* 2026-08-25, phones only: "Have the worm be double the size he is now."
 * Taken about his footing like the desktop scale, so he grows without
 * lifting off the floor, and his stride grows with him.
 *
 * ...and again the same day: "on mobile, let's increase the worm loading by
 * 1.5x." 1.6 -> 2.4. His stride grows with him, so he still crosses the
 * screen in the same number of steps — see the wrapper's `overflowX: clip`,
 * which is what keeps a wider swing from widening the document. */
const PHONE_SCALE = 1.6 * 1.5;
/** Where his middle starts, as a fraction across the frame. */
const START_CENTRE = 0.25;

export default function LoadingWorm() {
  const phone = useIsPhone();
  const compact = useIsCompact();
  /* THREE SIZES, NOT TWO (2026-08-29). Noah: "the loading worm animation is
   * too large in the in-between, let's reduce the size to a natural
   * in-between of the mobile and desktop sizes."
   *
   * Most of what he saw was the phone scale reaching up to 1199 while the
   * breakpoint was temporarily moved; with that reverted the worm is already
   * proportionally identical to the desktop's (measured 15.5% of the viewport
   * at both 820 and 1512, against 46% on a phone). This trims it further on
   * top of that, since the middle band has a smaller window to fill and a
   * worm at the desktop's share of it reads heavier than it does at 1512. */
  const SCALE_NOW = phone ? PHONE_SCALE : compact ? SCALE * 0.8 : SCALE;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const n = WORM_STEPS.length;
  const step = WORM_STEPS[((tick % n) + n) % n];
  const cycles = Math.floor(tick / n);

  const bandH = WORM_BAND.y1 - WORM_BAND.y0;
  const first = WORM_STEPS[0];
  const centre0 = first.x + first.w / 2;
  const shift = START_CENTRE * WORM_VIEWBOX.w - centre0;
  const floor = WORM_BAND.y1;

  /* WRAPS RATHER THAN WALKING OFF, and the wrap is worked out in SCREEN
   * space (2026-08-24).
   *
   * Noah: "the worm on the loading screen doesn't make it all the way to the
   * right side of the page. It feels like the worm crawls 3/4 of the page and
   * then teleports to the left. Have this more of a seamless loop."
   *
   * Both halves of that are the same bug. The wrap used to be taken modulo
   * `viewBox + this step's width`, offset by `this step's width + x` — three
   * quantities that all change every single frame, because each of the ten
   * poses is a different size as the worm scrunches and stretches (w runs
   * 267..431, x runs 615..886). So the distance at which it wrapped was not a
   * property of the screen at all, and simulating it puts the jump at a left
   * edge of 1187 and a right edge of 1532 in a 1920-wide frame: three
   * quarters across, exactly as described, and visibly mid-stride.
   *
   * Wrapping is a question about where the worm is ON SCREEN, so it is asked
   * there. The transform chain below is a shift and a scale about the worm's
   * own footing, which composes to a plain screen-left = A·x + B; taking the
   * modulo of THAT, against a span fixed by the widest pose, makes the wrap
   * happen at one fixed place instead of ten. That place is chosen as "left
   * edge has reached the right side of the frame", which puts the worm fully
   * out of sight at the instant it moves — so it leaves as a shrinking sliver
   * on the right and returns as a growing one on the left, with no frame in
   * between where it is visible in two places or in neither. */
  const A = SCALE_NOW;
  const B = shift + centre0 * (1 - SCALE_NOW);
  const maxScreenW = A * Math.max(...WORM_STEPS.map((st) => st.w));
  const span = WORM_VIEWBOX.w + maxScreenW;

  const absLeft = A * (step.x + cycles * WORM_CYCLE_ADVANCE) + B;
  const wrappedLeft =
    (((absLeft + maxScreenW) % span) + span) % span - maxScreenW;
  /* THE WHOLE TRAVEL, NOT A CORRECTION TO IT — 2026-08-25, Noah: "The worm
   * isn't crawling from one side of the screen to the other. It's getting
   * stuck in the middle."
   *
   * This was `(wrappedLeft - absLeft) / A`, which reads as "the distance the
   * wrap moved him" and is wrong for one reason: the <g> below translates by
   * this ON TOP OF the pose's own `step.x`, so what actually renders is
   * A·(step.x + travel) + B. Substitute the old expression into that and the
   * cycle advance appears twice with opposite signs and cancels:
   *
   *     A·step.x + wrappedLeft − absLeft + B  =  wrappedLeft − A·cycles·ADV
   *
   * and since wrappedLeft is itself absLeft until it wraps, the whole thing
   * collapses to A·step.x + B. The worm was oscillating between the poses'
   * own x range — 615 to 886, so 308px to 524px on screen — and never
   * advancing at all. Stuck in the middle, exactly.
   *
   * Solving the render expression for the translation it needs, rather than
   * describing a delta, is what makes that impossible to get wrong:
   * `A·(step.x + travel) + B = wrappedLeft`. */
  const travel = (wrappedLeft - B) / A - step.x;

  return (
    <div
      aria-hidden
      className="absolute inset-x-0"
      style={{
        // Low, so it reads as crawling along the floor rather than
        // floating: "Please keep it lower to the base of the screen to look
        // like it's crawling on the floor as well". Measured against the
        // demo, where the worm's underside sits about 2% of the frame's
        // height off the bottom; the band carries roughly a further 1% of
        // its own padding below the worm, so 2% here lands it at ~3%.
        bottom: "2%",
        /* CLIPPED SIDEWAYS. The svg below is `overflow: visible` so the worm
         * can be drawn outside its own viewBox — that is what lets him walk
         * off one edge and back on the other. Visible overflow also COUNTS
         * toward the document's width, though, and at the phone's doubled
         * scale that pushed a 390px page out to 783 and triggered mobile
         * shrink-to-fit, which quietly rescales the entire site. Clipping
         * here cuts him at the window's edge, which is where he should
         * disappear anyway.
         *
         * `clip` rather than `hidden`: `overflow-x: hidden` forces the other
         * axis to `auto`, which would make this a scroll container and crop
         * the worm's own height. `clip` leaves the vertical axis alone. */
        overflowX: "clip",
      }}
    >
      <svg
        viewBox={`0 ${WORM_BAND.y0} ${WORM_VIEWBOX.w} ${bandH}`}
        width="100%"
        // The band is cropped to just the strip the worm and word occupy, so
        // the 16:9 frame Noah composed in doesn't have to be letterboxed into
        // whatever shape the window happens to be.
        style={{ display: "block", height: "auto", overflow: "visible" }}
      >
        <g transform={`translate(${shift} 0)`}>
        <g
          transform={`translate(${centre0} ${floor}) scale(${SCALE_NOW}) translate(${-centre0} ${-floor})`}
        >
        <g transform={`translate(${travel} 0)`}>
          <image
            href={step.src}
            x={step.x}
            y={step.y}
            width={step.w}
            height={step.h}
          />
          {/* The word, outlined and already warped along this pose's back.
              --color-ink rather than the demo's flat black: the loading
              screen sits on --color-paper, which is near-black in dark mode,
              and the type has to invert with it. */}
          <path d={step.letters} fill="var(--color-ink)" />
        </g>
        </g>
        </g>
      </svg>
    </div>
  );
}
