"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/*
 * APPROACH-ON-SCROLL (2026-08-20, per Noah: "I also want the 'download my
 * resume' and the spinning resume to feel like it's coming forward as we
 * scroll down. This should feel like a natural conclusion to the about me
 * type.")
 *
 * Wraps the résumé block and walks it toward the viewer as it enters:
 * starts set back and slightly hazy, arrives at full size and clarity as it
 * reaches reading position. Real perspective — the wrapper carries
 * `perspective` and the child moves on translateZ — rather than a bare
 * scale, so the movement has the foreshortening of something approaching
 * instead of a poster being resized.
 *
 * The travel is scrubbed to scroll, which is what ties "coming forward" to
 * the reader's own movement; a played tween would arrive on its own
 * schedule and lose the connection.
 *
 * Deliberately ends slightly BEFORE the block is centred, so it settles and
 * holds rather than still creeping while you read it — the "conclusion"
 * feeling Noah asked for depends on it coming to rest.
 */
export default function ApproachOnScroll({
  children,
  /** How far back it starts, in px of Z. */
  fromZ = -560,
  /** Opacity at the far end of the approach. */
  fromOpacity = 0.25,
}: {
  children: React.ReactNode;
  fromZ?: number;
  fromOpacity?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!root.current || !inner.current) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        inner.current,
        { z: fromZ, opacity: fromOpacity },
        {
          z: 0,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            // Begins as the block's top clears the fold and finishes while
            // there's still a comfortable margin below the viewport centre.
            start: "top bottom",
            end: "center 62%",
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        }
      );
    }, root);
    return () => ctx.revert();
  }, [fromZ, fromOpacity]);

  return (
    <div ref={root} style={{ perspective: "1200px", perspectiveOrigin: "50% 50%" }}>
      <div ref={inner} style={{ transformStyle: "preserve-3d", willChange: "transform, opacity" }}>
        {children}
      </div>
    </div>
  );
}
