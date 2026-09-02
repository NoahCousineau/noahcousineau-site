"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useIsPhone } from "@/lib/useIsPhone";

/**
 * THE ARROW THAT SAYS THERE IS MORE (2026-09-01).
 *
 * Noah, relaying what people told him: "it wasn't obvious to scroll down on
 * the homepage... This arrow will appear fifteen seconds after the homepage is
 * loaded. It will look like it's coming from far back and then quickly reach
 * it's max size. It will then slowly bounce up and down slightly with ease."
 *
 * Fifteen seconds is a long time to wait, and deliberately so: it is meant for
 * the reader who has run out of things to look at, not for the one who is
 * already scrolling.
 *
 * IT BELONGS TO THE PAGE, NOT THE WINDOW (second pass). Noah: "when we scroll
 * down its a bit sticky and stays in the same relative position to the
 * monitor. This should just stay in the same location on the home screen."
 * It was `position: fixed`, so it rode along with the viewport and needed a
 * scroll listener to hide itself again. Now it is a box one screen tall pinned
 * to the top of the document with the arrow in its corner — so it sits on the
 * first screen, scrolls away with everything else, and no longer watches the
 * scroll at all. That listener is gone, which is one less thing running on a
 * phone mid-scroll.
 *
 * The artwork is Noah's own clay arrow, cut from the same photograph as the
 * résumé arrows and exported already pointing down — see
 * tools/resume-arrows/build_arrows.py for the cutout and de-fringing method.
 * That script deliberately SKIPS this arrow for the résumé, because its
 * direction cannot be read automatically from the shape; that does not matter
 * here, where the direction is chosen rather than inferred.
 *
 * It never takes a click: `pointer-events: none` throughout. Under
 * `prefers-reduced-motion` it simply appears and holds still — the arrow is
 * the message, the movement is only emphasis.
 */

/** How long the reader is left alone before the page offers a hint. */
const DELAY_MS = 15000;

/*
 * Placement, from Noah's "Downward Homepage Arrow Sizing" sketch.
 *
 * Desktop and in-between put it in the bottom-right corner of the first
 * screen, inset by the same amount the C mark and the theme toggle use for
 * their own corners, so all three sit on one margin. The size is capped at the
 * 1920 artboard scale for the same reason the rest of the chrome is: a wider
 * monitor should not get a bigger arrow.
 *
 * The phone frame in the sketch is not a corner at all — the lockup there is a
 * vertical stack and the arrow sits underneath it, pointing at the fold.
 *
 * 13vw/7vh -> 10vw/3.5vh. Noah: "The mobile version is conflicting with the
 * 'graphic design' text a bit. Let's nudge the arrow down and shrink it a bit."
 */
const DESKTOP_SIZE_UNITS = 96;
const PHONE_SIZE_VW = 10;

/*
 * IT HAS TO MOVE WITH THE LOCKUP, NOT WITH THE WINDOW (2026-09-01).
 *
 * Noah: "On mobile, I noticed that the arrow 'jumps' up a bit when we scroll
 * down." Scrolling on iOS collapses the URL bar and the viewport grows — and
 * the two things move at DIFFERENT RATES. Measured at 390 wide, growing the
 * viewport from 760 to 844: the lockup moved down 42px, the arrow moved down
 * 81px, and the gap between them swung from 76px to 115px. The hero is
 * `min-height: 100dvh` with its Stage centred inside, so the lockup travels
 * at HALF the rate the viewport changes, while an arrow pinned to the bottom
 * travels at the full rate.
 *
 * So the arrow is pinned to the hero's CENTRE instead, plus a fixed offset in
 * artboard units. The centre is what the lockup is centred on, so the two now
 * move together and the gap is constant at every URL-bar state — which is the
 * jump, gone at its cause rather than damped.
 *
 * The offset is chosen from the SHORT state rather than the tall one: at 390
 * wide it leaves the arrow 20px clear of the foot with the URL bar showing,
 * and 70px clear with it hidden. `min()` against the hero's own bottom is the
 * safety net for genuinely small phones, where there is not enough room below
 * a centred lockup for any constant gap to fit.
 */
const PHONE_TRACK_UNITS = 805;
/** Never closer than this to the foot of the hero, whatever the tracking says. */
const PHONE_FLOOR_UNITS = 52;
/** The exported artwork's aspect, so the box matches the picture exactly. */
const ART_W = 387;
const ART_H = 380;

export default function ScrollCue() {
  /* Only the phone tier differs. The in-between band shares the desktop
     corner, which is what the sketch draws for it. */
  const phone = useIsPhone();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const width = phone
    ? `${PHONE_SIZE_VW}vw`
    : `calc(100vw / 1920 * ${DESKTOP_SIZE_UNITS})`;

  /* The picture's height, needed by the floor clamp below. */
  const height = `calc(${width} * ${ART_H} / ${ART_W})`;

  const place: React.CSSProperties = phone
    ? {
        left: "50%",
        // Centring by margin, so the inner transforms stay free for the
        // bounce and the arrival.
        marginLeft: `calc(${width} / -2)`,
        top: `min(calc(50% + var(--u) * ${PHONE_TRACK_UNITS}), calc(100% - ${height} - var(--u) * ${PHONE_FLOOR_UNITS}))`,
      }
    : {
        right: "calc(100vw / 40)",
        bottom: "calc(100vw / 40)",
      };

  return (
    /* Rendered INSIDE the hero (see Hero.tsx), so `50%` and `100%` here are
       the hero's own box — the same box the lockup is centred in, and the
       whole point of the anchoring note above. It also inherits the hero's
       `--u`, which is the phone artboard unit on a phone. */
    <>
      <div
        data-scroll-cue
        aria-hidden
        className="absolute z-30 pointer-events-none"
        style={{
          ...place,
          width,
          aspectRatio: `${ART_W} / ${ART_H}`,
          opacity: entered ? 1 : 0,
          visibility: entered ? "visible" : "hidden",
        }}
      >
        {/* Outer: the slow bounce. Inner: the arrival. Two elements because
            both are transforms and one would otherwise overwrite the other. */}
        <div className={`w-full h-full ${entered ? "nc-cue-bounce" : ""}`}>
          <div className={`w-full h-full ${entered ? "nc-cue-pop" : ""}`}>
            <Image
              src="/assets/home/scroll-cue-arrow.webp"
              alt=""
              width={ART_W}
              height={ART_H}
              /* Decoded long before it is ever shown. It is 22KB, and the
                 alternative is the browser fetching and decoding it at the
                 moment the animation starts, which is exactly when it must
                 not — that is half of why the growth looked choppy. */
              loading="eager"
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
