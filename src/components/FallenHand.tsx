"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { uFont } from "./Stage";
import { THIRD_COLUMN_X } from "./footerLayout";

/*
 * FALLEN HAND + NEXT PROJECT (2026-08-20, per Noah: "Let's have the hand on
 * the bottom of the page. It's pointing to a link that says 'next project',
 * which brings the user to the next project. The hand should be rocking
 * just slightly when it's first in view as if it just fell from high up.")
 *
 * This is the landing of the drop that begins in ProjectStatement, where
 * the hand swings off its loose nail at the end of the paragraph and falls
 * out of the page. Here it has come to rest at the bottom of the footer,
 * pointing at the way onward.
 *
 * NO FALL, NO FADE (2026-08-20, per Noah: "I don't like how the hand fades
 * in as we scroll down. It should already be down at the bottom and
 * rocking to a standstill like it already fell.") The earlier build
 * animated the hand IN — dropping from -34vh and fading from opacity 0 —
 * which read as the hand arriving right then, tied to the reader's scroll
 * position. Noah's correction: the fall already happened, off-screen,
 * before the reader ever got here. So the hand's position and opacity
 * never animate at all; it sits at its landed spot from the moment the
 * component exists (invisible behind the footer curtain until scrolled
 * into view, same as everything else back there). The ONLY thing that
 * plays is a decaying rotational wobble, starting from a displaced tilt
 * and settling to rest — the tail end of a fall the reader didn't see,
 * not the fall itself.
 *
 * PIVOT = THE HAND'S OWN LOWEST PIXEL (2026-08-20, per Noah: "I just want
 * it brought down to the very bottom of the viewport. the bottom-most
 * point of the hand should be rocking on the footer bottom.") Measured off
 * pointing-hand-static-rotated.webp's alpha channel: the artwork's lowest
 * opaque pixel sits at 99.9% down the image (effectively its own bottom
 * edge — this asset carries almost no transparent margin) at 38.4% across.
 * The wrapper sits flush (`bottom: 0`) against the footer's bottom edge,
 * and `transformOrigin` is set to that exact point, so it is the one pixel
 * that never moves under rotation — rocking happens AROUND it, which is
 * what "rocking on the footer bottom" means literally, not just visually.
 * A centre-of-element pivot would instead swing the whole hand through the
 * floor on every downswing.
 *
 * WHY IT TRIGGERS OFF THE SPACER: the footer is `position: fixed` (see the
 * curtain note in Footer.tsx), so it never travels through the scrollport
 * and cannot drive a ScrollTrigger itself. The spacer that reserves the
 * uncovering distance does scroll, so it is the honest signal for "the
 * reader has reached the bottom" — which is also "the hand is first in
 * view", the moment Noah wants the rocking to start.
 *
 * The hand and label sit in one flex row so the finger always points at the
 * label regardless of viewport width, rather than the two being positioned
 * independently and drifting apart as the artboard scales.
 */

/** Where the hand comes to rest, in degrees. Slightly nose-up so the finger
 * reads as pointing at the label rather than lying flat. */
const REST_ROTATION = -6;

/** Hand width, artboard units — unchanged from the previous build. */
const HAND_W_UNITS = 330;
/** Gap between the hand and the label. */
const HAND_LABEL_GAP_UNITS = 30;
/** The label's left edge lands at THIRD_COLUMN_X (2026-08-20, per Noah:
 * "Have 'next project' in the same column as 'valley strong credit union'
 * and 'more work'. Shift the hand over as needed to keep it pointing to
 * it.") The row is `left + [hand][gap][label]`, so solving for the row's
 * own left edge is what shifts the hand along with the label — moving
 * either alone would separate the finger from what it's pointing at. */
const ROOT_LEFT_UNITS = THIRD_COLUMN_X - HAND_W_UNITS - HAND_LABEL_GAP_UNITS;

/** Pivot point, as a fraction of the hand image's own box — the artwork's
 * measured bottom-most opaque pixel (see the file header). */
const PIVOT = { xPct: 38.4, yPct: 99.9 };

/** Hand height, derived from its width and the asset's own aspect ratio
 * (2696x1490), for the fingertip math below. */
const HAND_H_UNITS = (HAND_W_UNITS * 1490) / 2696;
/** How far up from the row's bottom edge the label sits, so it lands at
 * fingertip height rather than at an eyeballed offset. The fingertip
 * (rightmost opaque pixel) measures 32.3% down the hand's own box, i.e.
 * HAND_H_UNITS * (1 - 0.323) above the bottom — trimmed by the label's own
 * ~10u bottom padding (its underline sits below the text baseline), since
 * what needs to land at fingertip height is the visible text, not the
 * link element's outer box. */
const LABEL_MARGIN_BOTTOM_UNITS = HAND_H_UNITS * (1 - 0.32315) - 10;

export default function FallenHand({
  triggerRef,
  nextHref,
}: {
  /** The footer's scroll spacer; see above for why this and not the footer. */
  triggerRef: React.RefObject<HTMLDivElement | null>;
  /** Destination for the label — the next project in the running order. */
  nextHref: string;
}) {
  const handRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hand = handRef.current;
    const trigger = triggerRef.current;
    if (!hand || !trigger) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger,
          // FIX (2026-08-20, per Noah: "make it start to rock as soon as we
          // see it at the bottom") — this used to be "bottom bottom+=140",
          // which fires only once the SPACER's bottom clears the viewport
          // bottom by 140px more. Since the spacer is exactly one viewport
          // tall and immediately precedes the fixed footer in the document,
          // its bottom clearing the viewport doesn't happen until the
          // reveal is already fully finished — so the wobble was starting
          // well after the hand had been sitting there, fully visible, the
          // whole time.
          //
          // The footer doesn't slide in; it's already there, fixed, the
          // whole page long — what moves is .site-content sliding UP and
          // off, uncovering the (stationary) footer from the BOTTOM of the
          // viewport upward. The hand sits at the very bottom of the
          // footer, so it's the very FIRST sliver the reveal exposes — the
          // instant that happens is the spacer's TOP reaching the
          // viewport's bottom, i.e. "top bottom", not its bottom.
          start: "top bottom",
          once: true,
        },
      });

      // Rotation only — no y, no opacity. The "from" here is applied the
      // moment this tween is created (GSAP's default immediateRender for
      // fromTo), which is on mount, not on trigger — but the hand is
      // sitting behind the opaque footer curtain at that point (see the
      // full-page footer reveal in Footer.tsx), so the jump to a displaced
      // tilt is never actually seen. All the reader sees is: the curtain
      // slides away, the hand is already there, already a little tilted —
      // and immediately settles, exactly as if it landed moments before
      // they arrived.
      tl.fromTo(
        hand,
        { rotate: REST_ROTATION - 22 },
        {
          keyframes: [
            { rotate: REST_ROTATION + 11, duration: 0.3, ease: "sine.out" },
            { rotate: REST_ROTATION - 7.5, duration: 0.36, ease: "sine.inOut" },
            { rotate: REST_ROTATION + 4.5, duration: 0.32, ease: "sine.inOut" },
            { rotate: REST_ROTATION - 2.5, duration: 0.28, ease: "sine.inOut" },
            { rotate: REST_ROTATION + 1.2, duration: 0.24, ease: "sine.inOut" },
            { rotate: REST_ROTATION, duration: 0.22, ease: "sine.inOut" },
          ],
        }
      );
    }, rootRef);
    return () => ctx.revert();
  }, [triggerRef]);

  return (
    <div
      ref={rootRef}
      className="absolute flex items-end"
      style={{
        left: `calc(var(--u) * ${ROOT_LEFT_UNITS})`,
        bottom: 0,
        gap: `calc(var(--u) * ${HAND_LABEL_GAP_UNITS})`,
      }}
    >
      <div
        ref={handRef}
        aria-hidden
        className="pointer-events-none select-none shrink-0"
        style={{
          width: `calc(var(--u) * ${HAND_W_UNITS})`,
          transformOrigin: `${PIVOT.xPct}% ${PIVOT.yPct}%`,
          transform: `rotate(${REST_ROTATION}deg)`,
          willChange: "transform, opacity",
        }}
      >
        <Image
          src="/assets/shared/pointing-hand-static-rotated.webp"
          alt=""
          width={2696}
          height={1490}
          sizes="25vw"
          className="w-full h-auto"
        />
      </div>
      {/* Matches the footer's own link treatment — same face, same size,
          same underline — so it reads as part of the footer rather than a
          separate control. marginBottom lands it at fingertip height (see
          LABEL_MARGIN_BOTTOM_UNITS above), not an eyeballed offset. */}
      <Link
        href={nextHref}
        className="lowercase whitespace-nowrap hover:opacity-60 transition-opacity block"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: uFont(17.9),
          borderBottom: "2px solid currentColor",
          paddingBottom: "calc(var(--u) * 10)",
          marginBottom: `calc(var(--u) * ${LABEL_MARGIN_BOTTOM_UNITS})`,
        }}
      >
        next project
      </Link>
    </div>
  );
}
