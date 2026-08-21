"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/*
 * STACKED SECTION — the <section> element for one project content group,
 * and the mechanism that makes the sections stack.
 *
 * Noah's sketch (four frames, 2026-08-20): a section reads flat and normal;
 * you reach its bottom; it goes back in Z "as if it was a piece of paper
 * being pulled back"; it shrinks a little; then the next section rises from
 * below, overlaps it, and the cycle repeats. Refined the same day: "When it
 * reaches the last image in a section, the old section should stay in place
 * while the new section goes on top of it" — and the earlier dark shade was
 * "a little confusing", so it's gone.
 *
 * THREE PARTS, and the important one is pure CSS:
 *
 * 1. PINNING — `position: sticky; bottom: 0`. This is the whole trick.
 *    Sticky with a BOTTOM offset on an element TALLER than the viewport
 *    scrolls normally until its bottom edge reaches the bottom of the
 *    screen — i.e. until you have seen the section's last image — and then
 *    holds, showing that final screenful, until its container runs out.
 *    That is literally "the old section stays in place". Note this only
 *    works because of the bottom offset: `top: 0` on an over-tall element
 *    pins its TOP and strands everything below the fold instead.
 *
 * 2. OVERLAP — each section is opaque and carries an increasing z-index
 *    (set by the caller), so the next one, still scrolling normally, rides
 *    up over the held one. No JS, nothing to keep in sync with Lenis.
 *
 * 3. RECEDE — a slight scale-down of the held section's contents while it
 *    is being covered, which is the "pulled back" read from the sketch.
 *    Subtle on purpose: the pinning and overlap already communicate the
 *    stack, and this only has to add depth, not announce itself.
 *
 * WHY THE SCALE IS ON AN INNER WRAPPER: a transform on the sticky element
 * itself would give it a containing block and fight its own pinning. The
 * section stays untransformed and its contents scale inside it.
 *
 * WHY THE TRIGGER USES LAYOUT OFFSETS, NOT getBoundingClientRect: once the
 * section is pinned, its client rect stops describing where it sits in the
 * document, so any start/end derived from it would drift. `offsetTop` is a
 * layout position and sticky does not affect layout, so walking the
 * offsetParent chain gives a stable answer whether pinned or not.
 */

/** How far the held section's contents shrink while being covered. */
const RECEDE_SCALE = 0.94;

/** Document-space top of an element, via layout offsets — see the note
 * above on why this can't use getBoundingClientRect here. */
function documentTop(node: HTMLElement | null): number {
  let y = 0;
  let el: HTMLElement | null = node;
  while (el) {
    y += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return y;
}

export default function StackedSection({
  stackIndex,
  surface,
  paddingXUnits,
  paddingBottomUnits,
  children,
}: {
  stackIndex: number;
  surface: string;
  paddingXUnits: number;
  paddingBottomUnits: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        inner,
        { scale: 1 },
        {
          scale: RECEDE_SCALE,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            // Numeric scroll positions rather than element-relative
            // keywords, for the pinning reason in the header comment.
            // Starts the moment the section pins (its bottom meets the
            // viewport bottom) and runs for one screen of scrolling, which
            // is roughly how long the next section takes to cover it.
            start: () =>
              documentTop(el) + el.offsetHeight - window.innerHeight,
            end: () => documentTop(el) + el.offsetHeight,
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      className="sticky bottom-0"
      style={{
        zIndex: stackIndex + 1,
        background: surface,
        paddingLeft: `calc(var(--u) * ${paddingXUnits})`,
        paddingRight: `calc(var(--u) * ${paddingXUnits})`,
        paddingBottom: `calc(var(--u) * ${paddingBottomUnits})`,
      }}
    >
      <div
        ref={innerRef}
        style={{ transformOrigin: "50% 100%", willChange: "transform" }}
      >
        {children}
      </div>
    </section>
  );
}
