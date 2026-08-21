"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/*
 * FALLEN HAND (2026-08-20, per Noah: "The hand then appears back at the
 * footer when the user scrolls all the way to the bottom of a project page.
 * It should feel as if it fell off and went all the way to the bottom of
 * the page.")
 *
 * The other end of the drop that starts in ProjectStatement, where the hand
 * swings off its loose nail and falls out of the top of the page. This
 * catches it: as the footer is uncovered, the hand drops in from above and
 * lands, with a bounce settle so it reads as having hit the bottom rather
 * than having been placed there.
 *
 * WHY IT TRIGGERS OFF THE SPACER: the footer is `position: fixed` (see the
 * curtain note in Footer.tsx), so it never moves through the scrollport and
 * cannot itself drive a ScrollTrigger. The spacer that reserves the
 * uncovering distance DOES scroll, so it is the honest trigger for "the
 * reader has reached the bottom".
 *
 * Project pages only — the fall it completes only happens there.
 */
export default function FallenHand({
  triggerRef,
}: {
  /** The footer's scroll spacer; see above for why this and not the footer. */
  triggerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    const trigger = triggerRef.current;
    if (!el || !trigger) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger,
          // The spacer's own bottom reaching the viewport bottom means the
          // page is scrolled out and the footer is fully uncovered.
          start: "bottom bottom+=120",
          once: true,
        },
      });
      // Vertical travel and rotation run on their own eases: the drop
      // bounces on landing, while the turn keeps decelerating smoothly
      // through it. Sharing one ease would make the hand pivot in time with
      // the bounces, which reads as a wind-up toy rather than a falling
      // object.
      tl.fromTo(
        el,
        { y: "-62vh", rotate: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.15, ease: "bounce.out" }
      ).fromTo(
        el,
        { rotate: 26 },
        { rotate: 98, duration: 1.15, ease: "power2.out" },
        0
      );
    }, ref);
    return () => ctx.revert();
  }, [triggerRef]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="absolute pointer-events-none select-none"
      style={{
        left: "calc(var(--u) * 96)",
        bottom: "calc(var(--u) * 70)",
        width: "calc(var(--u) * 300)",
        transformOrigin: "22% 50%",
        opacity: 0,
        willChange: "transform, opacity",
      }}
    >
      <Image
        src="/assets/shared/pointing-hand-static-rotated.webp"
        alt=""
        width={2696}
        height={1490}
        sizes="20vw"
        className="w-full h-auto"
      />
    </div>
  );
}
