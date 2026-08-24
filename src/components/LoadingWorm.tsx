"use client";

import { useEffect, useState } from "react";
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
/** Where his middle starts, as a fraction across the frame. */
const START_CENTRE = 0.25;

export default function LoadingWorm() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const n = WORM_STEPS.length;
  const step = WORM_STEPS[((tick % n) + n) % n];
  const cycles = Math.floor(tick / n);

  /* WRAPS RATHER THAN WALKING OFF. The load is capped at 8s but can finish
   * in a fraction of that, and the worm covers about a seventh of the frame
   * per cycle, so a slow load would otherwise leave an empty screen with the
   * worm somewhere off to the right. It re-enters from the left instead:
   * the travel is taken modulo the frame plus one worm length, offset so
   * the FIRST pass still begins exactly where Noah placed it — "The worm
   * will start slightly left of middle" — and only later laps wrap. */
  const wormW = step.w;
  const span = WORM_VIEWBOX.w + wormW;
  const behind = wormW + step.x; // distance from fully-off-left to the start
  const travel = ((cycles * WORM_CYCLE_ADVANCE + behind) % span) - behind;

  const bandH = WORM_BAND.y1 - WORM_BAND.y0;
  const first = WORM_STEPS[0];
  const centre0 = first.x + first.w / 2;
  const shift = START_CENTRE * WORM_VIEWBOX.w - centre0;
  const floor = WORM_BAND.y1;

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
          transform={`translate(${centre0} ${floor}) scale(${SCALE}) translate(${-centre0} ${-floor})`}
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
