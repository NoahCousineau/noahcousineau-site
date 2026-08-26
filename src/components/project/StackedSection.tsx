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
 *    up over the held one. No JS, nothing to keep in sync with Lenis. This
 *    is ALSO what covers the previous section's sticky title header once
 *    the next section's box visually arrives — see HEADER PLACEMENT below.
 *
 * 3. RECEDE — a slight scale-down of the held section's own ROWS (not its
 *    header — see HEADER PLACEMENT) while it's being covered: the "pulled
 *    back" read from the sketch. Subtle on purpose; the holding and overlap
 *    already communicate the stack.
 *
 * WHY THE SCALE IS ON AN INNER WRAPPER: a transform on the sticky element
 * itself would give it a containing block and fight its own positioning.
 *
 * HEADER PLACEMENT (2026-08-20, two rounds of feedback the same day):
 *
 * ProjectGroup's title header is `position: sticky; top: 0` inside this
 * section — that's what keeps it pinned while THIS section's own rows
 * scroll underneath it. The caller passes it as `header`, kept separate
 * from `children` and rendered as a SIBLING of the scaled wrapper, not
 * nested inside it. That placement is load-bearing, not cosmetic:
 *
 * A CSS `transform` on an ancestor — even `scale(1)`, numerically a no-op
 * — establishes a new containing block for its descendants, sticky
 * positioning included. Nesting the header inside the scaled wrapper (the
 * first version of this fix did) meant the header's sticky containing
 * block was that wrapper's OWN box, not the outer section's — and since
 * the recede scale is anchored at the bottom (`50% 100%`), shrinking it
 * pulls the wrapper's TOP edge DOWN, dragging the header's sticky ceiling
 * down with it as the recede animates. The header's visible lifetime ended
 * up governed by how far the scale tween had progressed, not by whether
 * the next section had actually arrived on screen — which could make it
 * vanish before the next section covered it, or persist in odd
 * partial-recede states depending on scroll speed and whether that
 * frame's tween value had actually updated yet.
 *
 * First fix (2026-08-20, per Noah: "make sure that during the transition
 * parts between sections that the old images we already saw don't
 * reappear at the top of the window") tried explicitly un-sticking the
 * header via JS the instant holding began. That overcorrected — per
 * Noah's very next message, "I don't like how the section title disappears
 * towards the bottom. Make it so it's visible until the next section
 * covers it" — because it hid the header immediately at hold-start,
 * regardless of whether the next section had actually risen far enough to
 * cover that point yet.
 *
 * Moving the header outside the transform's reach fixes the root cause
 * directly: with nothing between it and the (untransformed) outer
 * section, the header's sticky containing block is simply that section's
 * own box, which spans y=0 for its entire held duration. So it stays
 * correctly pinned at the top the WHOLE time this section is the topmost
 * visible thing — exactly "visible until the next section covers it" —
 * and disappears the instant (and only the instant) the next section's
 * own stacking context, opaque and at a strictly higher z-index, actually
 * paints over that pixel. No scroll math, no JS toggle: ordinary z-index
 * stacking already does this correctly once nothing is fighting it.
 *
 * WHY A SENTINEL DRIVES THE RECEDE TRIGGER: once a section is holding,
 * neither its client rect nor its offsetTop describes where it sits in the
 * document any more, so a trigger derived from the section itself drifts.
 * The sentinel is a zero-height sibling immediately before it, always in
 * normal flow, so it always reports the section's true document position.
 */

/** How far the held section's rows shrink while being covered. */
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
  header,
  children,
}: {
  stackIndex: number;
  surface: string;
  /** Artboard units, or a CSS expression that resolves to them. Passed
   *  through into `calc(var(--u) * ...)`, so `var(--grid-margin)` is a valid
   *  value and is what ProjectGroup sends — the phone widens that margin with
   *  a media query and the padding has to follow it. */
  paddingXUnits: number | string;
  paddingBottomUnits: number;
  /** The section's sticky title header — rendered OUTSIDE the recede
   * scale's transform on purpose. See HEADER PLACEMENT above. */
  header: React.ReactNode;
  /** The section's rows — these get the recede-scale treatment. */
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
        {header}
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
