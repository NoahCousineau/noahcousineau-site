"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import { Place } from "./Stage";
import Parallax from "./Parallax";
import { RESUME_ARROWS, type ResumeArrow } from "@/lib/resumeArrows";

/*
 * CLAY ARROWS POINTING AT THE RÉSUMÉ (2026-08-23).
 *
 * Noah: "I want some arrows pointing at the resume... Two of these will be on
 * the left side of the browser pointing radially at the resume and two others
 * will be on the other side doing the same. The arrows will be slightly
 * moving forward and back, as to indicate 'here it is!' The animation
 * shouldn't be dramatic and should have easy ease to it. It would be
 * fantastic if the arrow selection was randomized each time the page loaded.
 * The user won't be able to click or drag these arrows."
 *
 * MOVED OFF THE FOOTER (2026-08-24) — Noah: "The clay arrows shouldn't be in
 * the footer at all. The only place it should appear is on the resume
 * section in the 'about me' area." `target` and `spots` used to be constants
 * fixed to the footer's résumé LINK; they're now props so the same component
 * can aim at whatever it's actually pointing at from wherever it's actually
 * mounted — see about/page.tsx for the current call, sized against the
 * résumé CARD per Noah's own sketch of the new placement.
 *
 * AIMING IS ONE SUBTRACTION, because every arrow is exported already pointing
 * right (see tools/resume-arrows/build_arrows.py). The bearing from an
 * arrow's own spot to the target IS its rotation, so moving either needs no
 * other change.
 *
 * THE NUDGE RUNS IN THE ARROW'S OWN FRAME. The wrapper carries the rotation
 * and an inner element carries a plain translateX, so "forward and back"
 * means along whatever direction that arrow happens to be aiming, without
 * any per-arrow vector maths. Four different durations and delays keep them
 * from pulsing in unison, which would read as one animation rather than four
 * things all pointing at the same spot.
 */

export type ResumeArrowSpot = { x: number; y: number; w: number };

/** How far each drifts against the scroll, artboard units — "the slightest
 *  amount of parallax" (2026-08-24). Deliberately unequal and deliberately
 *  tiny: four layers at the same rate would read as one sheet sliding, and
 *  anything past ~20u starts pulling the arrows off the card they are
 *  supposed to be aiming at by the time the section leaves the screen. */
const PARALLAX_UNITS = [14, -9, 11, -13];

/** How far each nudges along its own aim, in the caller's own units, and how
 *  long it takes. Deliberately small — "shouldn't be dramatic". Same four
 *  regardless of where the arrows are mounted; only position and aim change
 *  per caller. */
const NUDGE = [
  { px: 15, s: 2.3, delay: 0 },
  { px: 12, s: 2.9, delay: 0.45 },
  { px: 16, s: 2.6, delay: 0.2 },
  { px: 13, s: 3.2, delay: 0.75 },
];

/**
 * Four arrows including at least one of each colour.
 *
 * Takes one of each first and fills the last slot from whatever is left, so
 * the guarantee holds no matter how the shuffle falls — picking four at
 * random and re-rolling until the colours work would usually be fine and
 * occasionally loop for a while.
 */
function pickFour(rand: () => number): ResumeArrow[] {
  const byColour: Record<string, ResumeArrow[]> = {};
  for (const a of RESUME_ARROWS) (byColour[a.colour] ??= []).push(a);
  const take = (list: ResumeArrow[]) => list[Math.floor(rand() * list.length)];

  const chosen: ResumeArrow[] = [];
  for (const c of ["red", "blue", "yellow"]) {
    const list = byColour[c];
    if (list?.length) chosen.push(take(list));
  }
  const rest = RESUME_ARROWS.filter((a) => !chosen.includes(a));
  if (rest.length) chosen.push(take(rest));

  // Shuffle so the guaranteed red/blue/yellow don't always land in the same
  // three positions.
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen.slice(0, 4);
}

export default function ResumeArrows({
  target,
  spots,
}: {
  /** What the arrows aim at, in the caller's own artboard units. */
  target: { x: number; y: number };
  /** Where the four arrows sit, same units. Length 4, matching NUDGE. */
  spots: [ResumeArrowSpot, ResumeArrowSpot, ResumeArrowSpot, ResumeArrowSpot];
}) {
  /* Randomised once per page load, and hydration-safe by the same route the
   * project header's icon sizes use: React calls getServerSnapshot for BOTH
   * the server render and the client's pre-hydration render, so those agree
   * and there is nothing to diff; only afterwards does it swap to the real,
   * random pick. Calling Math.random() during render instead would print a
   * hydration mismatch on every single load. */
  const deterministic = useMemo(() => pickFour(() => 0.5), []);
  const randomRef = useRef<ResumeArrow[] | null>(null);
  const getServerSnapshot = useCallback(() => deterministic, [deterministic]);
  const getSnapshot = useCallback(() => {
    randomRef.current ??= pickFour(Math.random);
    return randomRef.current;
  }, []);
  const subscribe = useCallback(() => () => {}, []);
  const arrows = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <>
      <style>{`
        @keyframes resumeArrowNudge {
          0%, 100% { transform: translateX(0); }
          50%      { transform: translateX(var(--nudge)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .js-resume-arrow { animation: none !important; }
        }
      `}</style>
      {arrows.map((a, i) => {
        const spot = spots[i];
        const n = NUDGE[i];
        const h = spot.w * (a.height / a.width);
        // Bearing from this arrow to the link. Screen coords (y down), which
        // is the same convention CSS rotate() turns in, so no sign flip.
        // ROUNDED, and not just for tidiness: React's server render
        // serialised this to three decimals while the client wrote the full
        // double ("rotate(151.191deg)" against "rotate(151.1912222943067deg)"),
        // which is a hydration mismatch on every load even though the two are
        // the same angle. Fixing the precision makes both sides emit the same
        // string.
        const deg = (
          (Math.atan2(target.y - spot.y, target.x - spot.x) * 180) / Math.PI
        ).toFixed(2);
        return (
          <Place
            key={a.src}
            x={spot.x - spot.w / 2}
            y={spot.y - h / 2}
            w={spot.w}
            // Never interactive: "The user won't be able to click or drag
            // these arrows." Also keeps them from stealing a click meant for
            // the link columns they sit beside.
            className="pointer-events-none select-none z-10"
          >
            {/* Parallax OUTSIDE the rotation, so the drift is vertical on the
                page rather than along whichever way this arrow happens to be
                aiming — which is what makes four of them read as four depths
                rather than four arrows sliding along their own shafts. */}
            <Parallax units={PARALLAX_UNITS[i]}>
            <div style={{ transform: `rotate(${deg}deg)` }}>
              <div
                className="js-resume-arrow"
                style={{
                  ["--nudge" as string]: `calc(var(--u) * ${n.px})`,
                  animation: `resumeArrowNudge ${n.s}s ease-in-out ${n.delay}s infinite`,
                }}
              >
                <Image
                  src={a.src}
                  alt=""
                  width={a.width}
                  height={a.height}
                  sizes="12vw"
                  unoptimized
                  loading="eager"
                  draggable={false}
                  className="w-full h-auto select-none"
                />
              </div>
            </div>
            </Parallax>
          </Place>
        );
      })}
    </>
  );
}
