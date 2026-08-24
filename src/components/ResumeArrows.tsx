"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import { Place } from "./Stage";
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
 * AIMING IS ONE SUBTRACTION, because every arrow is exported already pointing
 * right (see tools/resume-arrows/build_arrows.py). The bearing from an
 * arrow's own spot to the résumé link IS its rotation, so moving either the
 * link or an arrow needs no other change.
 *
 * THE NUDGE RUNS IN THE ARROW'S OWN FRAME. The wrapper carries the rotation
 * and an inner element carries a plain translateX, so "forward and back"
 * means along whatever direction that arrow happens to be aiming, without
 * any per-arrow vector maths. Four different durations and delays keep them
 * from pulsing in unison, which would read as one animation rather than four
 * things all pointing at the same spot.
 */

/** The résumé link's middle, in the footer Stage's own units — the column at
 *  x1409.32 (RULE_WIDTH 204.22 wide), second row, text at y402.5. */
const TARGET = { x: 1409.32 + 204.22 / 2, y: 412 };

/** Where the four go, in footer units: two well to the left of the link and
 *  two out to its right, all clear of the wordmark above and the peeking head
 *  at the bottom. `w` varies a little so they don't read as four stamps of
 *  the same object. */
const SPOTS = [
  { x: 330, y: 452, w: 132 },
  { x: 700, y: 505, w: 108 },
  { x: 1806, y: 250, w: 116 },
  { x: 1772, y: 498, w: 124 },
];

/** How far each nudges along its own aim, in footer units, and how long it
 *  takes. Deliberately small — "shouldn't be dramatic". */
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

export default function ResumeArrows() {
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
        const spot = SPOTS[i];
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
          (Math.atan2(TARGET.y - spot.y, TARGET.x - spot.x) * 180) / Math.PI
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
          </Place>
        );
      })}
    </>
  );
}
