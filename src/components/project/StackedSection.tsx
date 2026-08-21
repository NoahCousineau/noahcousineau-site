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
 * THREE PARTS, and the important one is CSS:
 *
 * 1. HOLDING — `position: sticky` with a NEGATIVE `top` equal to
 *    (viewportHeight - sectionHeight). The section scrolls normally until
 *    its bottom edge reaches the bottom of the screen — i.e. until you have
 *    seen its last image — and then holds there while the rest of the page
 *    keeps moving. That is "the old section stays in place".
 *
 *    WHY NOT `bottom: 0`, WHICH READS AS THE OBVIOUS SPELLING: a sticky box
 *    is confined to its containing block, and when the box is TALLER than
 *    the scrollport a bottom offset can never be satisfied — the browser
 *    clamps it against the top of the containing block instead, so every
 *    section pins to the top of the page from the very first frame and they
 *    all pile up over the hero. Tried exactly that on 2026-08-20 and it
 *    stacked all five sections at y=0. A negative `top` expresses the same
 *    intent in a form the constraint can actually satisfy.
 *
 *    The offset depends on both the section's height and the viewport, so
 *    it's written to the element directly (not through React state, which
 *    would mean a render per resize for a value only CSS consumes) and
 *    recomputed when either changes.
 *
 * 2. OVERLAP — each section is opaque and carries an increasing z-index
 *    (set by the caller), so the next one, still scrolling normally, rides
 *    up over the held one. No JS, nothing to keep in sync with Lenis.
 *
 * 3. RECEDE — a slight scale-down of the held section's contents while it
 *    is being covered: the "pulled back" read from the sketch. Subtle on
 *    purpose; the holding and overlap already communicate the stack.
 *
 * WHY THE SCALE IS ON AN INNER WRAPPER: a transform on the sticky element
 * itself would give it a containing block and fight its own positioning.
 *
 * WHY A SENTINEL DRIVES THE TRIGGER: once a section is holding, neither its
 * client rect nor its offsetTop describes where it sits in the document any
 * more, so a trigger derived from the section itself drifts. The sentinel is
 * a zero-height sibling immediately before it, always in normal flow, so it
 * always reports the section's true document position.
 */

/** How far the held section's contents shrink while being covered. */
const RECEDE_SCALE = 0.94;

/** Document-space top of a normal-flow element, via layout offsets. */
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Keep the sticky offset in step with the section's height and the
  // viewport. Written straight to the node: it's a style value, not
  // component state, and routing it through React would re-render the whole
  // section on every resize tick for no benefit.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const applyStickyTop = () => {
      // Sections are normally far taller than the viewport, making this
      // negative; clamped at 0 so an unusually short section just sticks to
      // the top rather than hanging below it.
      el.style.top = `${Math.min(0, window.innerHeight - el.offsetHeight)}px`;
    };

    applyStickyTop();
    window.addEventListener("resize", applyStickyTop);
    // Section height changes as images decode, so a resize listener alone
    // would leave the offset stale on first load.
    const ro = new ResizeObserver(() => {
      applyStickyTop();
      ScrollTrigger.refresh();
    });
    ro.observe(el);
    return () => {
      window.removeEventListener("resize", applyStickyTop);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = sectionRef.current;
    const inner = innerRef.current;
    const sentinel = sentinelRef.current;
    if (!el || !inner || !sentinel) return;
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
            // Numeric scroll positions off the sentinel — see the note
            // above on why the section can't measure itself here. Starts
            // the moment the section begins holding (its bottom meets the
            // viewport bottom) and runs for one screen of scrolling, which
            // is roughly how long the next section takes to cover it.
            start: () =>
              documentTop(sentinel) + el.offsetHeight - window.innerHeight,
            end: () => documentTop(sentinel) + el.offsetHeight,
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <>
      {/* Normal-flow marker for this section's true document position. */}
      <div ref={sentinelRef} aria-hidden style={{ height: 0 }} />
      <section
        ref={sectionRef}
        className="sticky"
        style={{
          // `top` is set imperatively above, once the height is known.
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
    </>
  );
}
