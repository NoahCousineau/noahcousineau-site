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
const PHONE_BOTTOM_VH = 3.5;
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
    : `calc(min(100vw, 1920px) / 1920 * ${DESKTOP_SIZE_UNITS})`;

  const place: React.CSSProperties = phone
    ? {
        left: "50%",
        bottom: `${PHONE_BOTTOM_VH}vh`,
        // Centring by margin, so the inner transforms stay free for the
        // bounce and the arrival.
        marginLeft: `calc(${width} / -2)`,
      }
    : {
        right: "calc(min(100vw, 1920px) / 40)",
        bottom: "calc(min(100vw, 1920px) / 40)",
      };

  return (
    /* One screen tall, pinned to the top of the page and as wide as the
       window, so its bottom-right corner IS the bottom-right of the first
       screen. `svh` rather than `dvh` so a phone showing its browser chrome
       still has the arrow on screen. The box only positions: it never paints
       and never catches anything. */
    <div
      aria-hidden
      className="absolute top-0 z-30 pointer-events-none"
      style={{
        left: "50%",
        transform: "translateX(-50%)",
        width: "100vw",
        height: "100svh",
      }}
    >
      <div
        data-scroll-cue
        className="absolute"
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
    </div>
  );
}
