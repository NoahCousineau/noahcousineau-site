"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useIsPhone } from "@/lib/useIsPhone";

/**
 * THE ARROW THAT SAYS THERE IS MORE (2026-09-01).
 *
 * Noah, relaying what people told him: "it wasn't obvious to scroll down on
 * the homepage. As a solution, I want you to add the downwards pointing red
 * arrow to the bottom right corner of the homepage screen. This arrow will
 * appear fifteen seconds after the homepage is loaded. It will look like it's
 * coming from far back and then quickly reach it's max size. It will then
 * slowly bounce up and down slightly with ease... Make sure the arrow is only
 * visible after fifteen seconds and is only visible when we're looking at the
 * top of the page."
 *
 * Fifteen seconds is a long time to wait, and deliberately so: it is meant for
 * the reader who has run out of things to look at, not for the one who is
 * already scrolling. Both conditions are live rather than one-shot — going
 * back to the top brings it back, because at that moment the hint is true
 * again.
 *
 * The artwork is one of the clay arrows from the résumé card. Those are all
 * normalised to point RIGHT in their own files (see lib/resumeArrows), so
 * aiming this one down is a quarter turn and nothing else.
 *
 * It never takes a click: `pointer-events: none` throughout, so it cannot
 * intercept a tap meant for the head or a project tile underneath it, and it
 * is `position: fixed` so it adds no height to the document and cannot shift
 * anything. Under `prefers-reduced-motion` it simply fades in and holds
 * still — the arrow is the message, the bouncing is only emphasis.
 */

/** How long the reader is left alone before the page offers a hint. */
const DELAY_MS = 15000;

/*
 * Sizes and placement, read off Noah's "Downward Homepage Arrow Sizing"
 * sketch, which draws the same arrow at three widths.
 *
 * Desktop and in-between put it in the bottom-right corner, inset by the same
 * amount the C mark and the theme toggle use for their own corners
 * (min(100vw, 1920px) / 40) so all three sit on one margin. The size is capped
 * at the 1920 artboard scale for the same reason the rest of the chrome is: a
 * wider monitor should not get a bigger arrow.
 *
 * The phone frame in the sketch is different, and not a corner at all — the
 * lockup there is a vertical stack and the arrow sits centred underneath it,
 * pointing at the fold. Cramming it into the corner instead would put it
 * beside the name rather than below it, which is not what the sketch draws.
 */
const DESKTOP_SIZE_UNITS = 96;
const PHONE_SIZE_PCT = 13;
/* Up from the foot of the screen, as a share of the viewport height.
 *
 * 18 -> 7, measured rather than guessed: at 18 the arrow landed on top of
 * "graphic design", which the sketch clearly draws it BELOW. The phone lockup
 * ends around 660px down an 844px screen, so this leaves a clear gap under it
 * at the tall end and still keeps a sensible margin on a 667px iPhone SE. */
const PHONE_BOTTOM_PCT = 7;

/** Below this much scroll we still count as "looking at the top". */
const TOP_BAND = 0.35;

export default function ScrollCue() {
  /* Only the phone tier differs. The in-between band shares the desktop
     corner, which is what the sketch draws for it. */
  const phone = useIsPhone();
  const [waited, setWaited] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    /* One passive listener, coalesced into a frame. It reads scrollY and
     * compares it — deliberately nothing else, because this runs on the same
     * phone scroll that the rest of the site has been kept clear for. */
    const read = () => {
      rafRef.current = null;
      setAtTop(window.scrollY < window.innerHeight * TOP_BAND);
    };
    const onScroll = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const shown = waited && atTop;

  /* THE ARRIVAL HAS TO START WHEN IT IS SEEN, NOT WHEN IT MOUNTS.
   *
   * A CSS animation begins the moment its class applies, so leaving the
   * classes on from the first render meant the "coming from far back" ran and
   * finished during the first second of the page and the arrow simply faded in
   * at full size fifteen seconds later. The element is mounted from the start
   * anyway, so the image has fifteen seconds to decode and nothing has to load
   * at the moment it appears — only the animation waits. Latched, so scrolling
   * away and back fades rather than re-popping. */
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (shown) setEntered(true);
  }, [shown]);

  const size = phone
    ? `${PHONE_SIZE_PCT}vw`
    : `calc(min(100vw, 1920px) / 1920 * ${DESKTOP_SIZE_UNITS})`;

  const place: React.CSSProperties = phone
    ? {
        left: "50%",
        bottom: `${PHONE_BOTTOM_PCT}vh`,
        // The scale/bounce transforms live on the inner elements, so this one
        // is free to do the centring and cannot be overwritten by them.
        transform: "translateX(-50%)",
      }
    : {
        right: "calc(min(100vw, 1920px) / 40)",
        bottom: "calc(min(100vw, 1920px) / 40)",
      };

  return (
    <div
      aria-hidden
      data-scroll-cue
      className="fixed z-30 pointer-events-none"
      style={{
        ...place,
        width: size,
        height: size,
        opacity: shown ? 1 : 0,
        // Before the first arrival there is nothing to show at all; after it,
        // opacity alone carries the fade so the bounce can keep running.
        visibility: entered ? "visible" : "hidden",
        /* Fading out on scroll rather than unmounting: the reader who scrolls
           a little and comes back should meet it again without it popping. */
        transition: "opacity 420ms ease",
      }}
    >
      {/* Outer: the slow bounce. Inner: the arrival. Two elements because both
          are transforms and one would otherwise overwrite the other. */}
      <div className={`w-full h-full ${entered ? "nc-cue-bounce" : ""}`}>
        <div className={`w-full h-full ${entered ? "nc-cue-pop" : ""}`}>
          <Image
            src="/assets/home/resume-arrows/1.webp"
            alt=""
            width={420}
            height={382}
            /* A quarter turn: the clay arrows all point right in their own
               artwork, so this is the only per-use orientation needed. */
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: "rotate(90deg)",
            }}
            priority={false}
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
