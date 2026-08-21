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
 *
 * BUGFIX (2026-08-20, per Noah: "make sure that during the transition parts
 * between sections that the old images we already saw don't reappear at the
 * top of the window") — ProjectGroup's own inner title header is ALSO
 * `position: sticky; top: 0`, by design: that's what keeps it pinned while
 * THIS section's own rows scroll underneath it. Its containing block is
 * this outer <section>, whose old design comment claimed the header
 * "releases exactly at the end of its own section" — true before this
 * outer sticky/hold mechanic existed, but wrong now: once the outer
 * section starts HOLDING (frozen, bottom pinned to the viewport bottom),
 * its own box still spans from far above y=0 down to y=800, so y=0 is
 * still comfortably inside it — meaning the inner header keeps re-sticking
 * to the top of the screen for the ENTIRE ~800px scroll it takes the next
 * section to rise up and cover it. The reader would see the OLD section's
 * title (and, since it's the same containing block, whatever else is
 * anchored near the top) sitting at the top of the window through the
 * whole transition, well after they'd moved on to the next section's
 * content below it. Verified directly: 400px into the transition, the
 * pixel at the top of the viewport still belonged to the section that was
 * supposed to be finished.
 *
 * Fixed via a callback rather than a ref reaching into the caller's DOM
 * node: `onHoldChange(held)` fires the instant holding starts or ends
 * (same threshold the recede scale uses), and ProjectGroup — which owns
 * the header element — reacts by flipping ITS OWN ref's `position` between
 * `static` (tucked away at its natural in-flow position deep inside the
 * now-frozen box, off-screen with the rest of the section's already-seen
 * content) and `sticky` (restored if the reader scrolls back up past the
 * hold point, so scrolling back into a section still re-pins its title as
 * designed). Keeping the mutation inside the component that owns the ref
 * is also what the React Compiler's lint rules expect — reaching into a
 * ref received through another component's props to mutate its node is
 * flagged even though DOM refs are normally the sanctioned escape hatch.
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
  onHoldChange,
  children,
}: {
  stackIndex: number;
  surface: string;
  paddingXUnits: number;
  paddingBottomUnits: number;
  /** Fires the instant this section starts (true) or stops (false) holding
   * — see the BUGFIX note above. Called once synchronously on mount too,
   * with whatever's actually true for the current scroll position. */
  onHoldChange?: (held: boolean) => void;
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
    const el = sectionRef.current;
    const inner = innerRef.current;
    const sentinel = sentinelRef.current;
    if (!el || !inner || !sentinel) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Shared by both effects below (recede-scale and header un-stick), so
    // moved out of the scrollTrigger config where it'd otherwise be defined
    // twice and risk drifting apart.
    const holdStartY = () =>
      documentTop(sentinel) + el.offsetHeight - window.innerHeight;

    // Correct the caller's header state immediately for a page that loads
    // already scrolled past this section's hold point (a deep link, a
    // restored scroll position, forward/back navigation) — onEnter/
    // onLeaveBack below only fire on an actual crossing, not on the state
    // already in effect when this runs.
    onHoldChange?.(window.scrollY >= holdStartY());

    const ctx = gsap.context(() => {
      gsap.fromTo(
        inner,
        { scale: 1 },
        {
          // No visible recede under reduced motion, but the trigger itself
          // still needs to exist — it's what drives the header un-stick.
          scale: reduced ? 1 : RECEDE_SCALE,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            // Numeric scroll positions off the sentinel — see the note
            // above on why the section can't measure itself here. Starts
            // the moment the section begins holding (its bottom meets the
            // viewport bottom) and runs for one screen of scrolling, which
            // is roughly how long the next section takes to cover it.
            start: holdStartY,
            end: () => documentTop(sentinel) + el.offsetHeight,
            scrub: reduced ? false : true,
            invalidateOnRefresh: true,
            // See the BUGFIX note above: the header re-sticks to the top of
            // the screen for as long as it's `position: sticky` and its
            // containing block (this section) spans y=0, which is true for
            // the section's entire held duration — not just its own
            // content's normal scroll-through. onEnter/onLeaveBack bracket
            // exactly the held region: unstick the moment holding starts,
            // restick only if the reader scrolls back up past that point.
            onEnter: () => onHoldChange?.(true),
            onLeaveBack: () => onHoldChange?.(false),
          },
        }
      );
    }, el);
    return () => ctx.revert();
  }, [onHoldChange]);

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
