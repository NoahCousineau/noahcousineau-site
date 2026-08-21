"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { uFont } from "./Stage";

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
 * THE ROCK, NOT A BOUNCE: what sells "it just fell from high up" is what
 * happens AFTER the landing, not the landing itself. So the drop is short
 * and the settle is a decaying rotational wobble about the wrist —
 * overshooting a little less each pass, the way a heavy object dropped on
 * its side rolls to a stop. The pivot is set near the wrist rather than the
 * element's centre; rocking about the middle would read as spinning.
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
          // The spacer's bottom clearing the viewport bottom means the page
          // has scrolled out and the footer — and this hand — are in view.
          start: "bottom bottom+=140",
          once: true,
        },
      });

      // A short arrival, then the settle. `power2.in` accelerates into the
      // landing so the drop reads as the tail of a longer fall.
      tl.fromTo(
        hand,
        { y: "-34vh", rotate: REST_ROTATION - 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power2.in" }
      ).to(hand, {
        keyframes: [
          { rotate: REST_ROTATION + 11, duration: 0.3, ease: "sine.out" },
          { rotate: REST_ROTATION - 7.5, duration: 0.36, ease: "sine.inOut" },
          { rotate: REST_ROTATION + 4.5, duration: 0.32, ease: "sine.inOut" },
          { rotate: REST_ROTATION - 2.5, duration: 0.28, ease: "sine.inOut" },
          { rotate: REST_ROTATION + 1.2, duration: 0.24, ease: "sine.inOut" },
          { rotate: REST_ROTATION, duration: 0.22, ease: "sine.inOut" },
        ],
      });
    }, rootRef);
    return () => ctx.revert();
  }, [triggerRef]);

  return (
    <div
      ref={rootRef}
      className="absolute flex items-center"
      style={{
        left: "calc(var(--u) * 96)",
        bottom: "calc(var(--u) * 54)",
        gap: "calc(var(--u) * 30)",
      }}
    >
      <div
        ref={handRef}
        aria-hidden
        className="pointer-events-none select-none shrink-0"
        style={{
          width: "calc(var(--u) * 330)",
          // Pivot at the wrist end, so the settle rocks rather than spins.
          transformOrigin: "18% 82%",
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
          separate control. Nudged up to meet the fingertip, which sits
          above the hand's vertical centre. */}
      <Link
        href={nextHref}
        className="lowercase whitespace-nowrap hover:opacity-60 transition-opacity block"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: uFont(17.9),
          borderBottom: "2px solid currentColor",
          paddingBottom: "calc(var(--u) * 10)",
          marginBottom: "calc(var(--u) * 96)",
        }}
      >
        next project
      </Link>
    </div>
  );
}
