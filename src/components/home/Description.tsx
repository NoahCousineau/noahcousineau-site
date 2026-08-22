"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Stage, Place } from "./Stage";
import { FitText } from "./FitText";

/**
 * DESCRIPTION — master slice y1000–2366.
 * Editorial: three big single lines at x36 (Akzidenz Regular, no bold — per
 * spec), with Quinn Text Italic emphasis on "graphic designer" and "visual
 * problems"; thin horizontal RULES sit in the gaps between lines, PLUS one
 * more rule directly under "His work can be seen below" (previously missing).
 * Pointing finger (drop shadow) rotates on scroll: "resistance at first,
 * then swings down fast with easy ease." FitText caps every line at the
 * artboard's right margin (x1877, i.e. 1841 units from x36).
 */
export default function Description() {
  const root = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  // The element ScrollTrigger pins while the three lines reveal.
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        handRef.current,
        { rotate: 0 },  // Start pointing straight up
        {
          rotate: 180,  // End pointing straight down
          ease: "back.in(1.6)",
          scrollTrigger: {
            trigger: root.current,
            start: "70% center",  // Start later (was 50%)
            end: "80% center",    // Complete later (was 60%)
            scrub: 1.2,
          },
        }
      );

      /* LINE REVEAL, HELD (2026-08-20, per Noah: "I also want the site to
       * feel like it's holding on this more. As we [scroll] down to this
       * section, the site should feel as if its still. Have the first line
       * appear and then hold for a bit of scrolling. Then the same for the
       * next line, then the last. We can then scroll down into the project
       * areas.")
       *
       * The section PINS: for the length of the sequence the page stops
       * travelling and the reader's scrolling is spent revealing lines
       * instead. That is what produces "feel as if it's still" — a plain
       * scrubbed reveal would still be sliding the whole section up the
       * screen while the lines arrived.
       *
       * The holds are empty tweens between the reveals. Scrub maps scroll
       * distance onto timeline time, so a stretch of timeline where nothing
       * animates becomes a stretch of scrolling where nothing moves — which
       * is exactly the beat Noah asked for after each line.
       *
       * Each line rises out from behind its own rule: line 1 sits above the
       * rule at y522, line 2 above y706, line 3 above y882, and each is
       * wrapped in an overflow-hidden mask whose bottom edge is that rule.
       * Translating the type down by more than its own height parks it
       * entirely behind the rule; animating back to 0 makes it rise out.
       *
       * yPercent (not a pixel offset) because these lines are set in
       * artboard units and rescale with the viewport — a fixed pixel offset
       * would under- or over-hide the type at other widths. 135 rather than
       * a bare 100 covers the mask's descender padding too (see the masks
       * in the markup below), so nothing peeks above the rule at rest. */
      const lines = gsap.utils.toArray<HTMLElement>(".js-desc-line");
      gsap.set(lines, { yPercent: 135 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          start: "top top",
          // Roughly two screens of scrolling spent on the three reveals and
          // their holds, then the page resumes.
          end: "+=200%",
          pin: true,
          anticipatePin: 1,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      const REVEAL = 1;
      const HOLD = 0.85;
      lines.forEach((line, i) => {
        tl.to(line, { yPercent: 0, duration: REVEAL, ease: "power3.out" });
        // A hold after every line, including the last, so the third line
        // gets a beat to land before the page starts moving again.
        tl.to({}, { duration: i === lines.length - 1 ? HOLD * 0.7 : HOLD });
      });

      /* LINE 4 — "His work can be seen below." (2026-08-21, per Noah:
       * "Let's also have the 'his work can be seen below' on the home page
       * animate upwards like the rest of the text.")
       *
       * Same rise-from-behind-its-rule move as lines 1–3, but on its own
       * trigger rather than in the pinned timeline: it sits at y1387,
       * roughly a full screen below the three lines, so while the section
       * is pinned it is still below the fold. Given a slot in that
       * sequence it would play its whole reveal unseen and be sitting
       * there fully revealed by the time the reader scrolled to it.
       *
       * Scrubbed against its own approach so it still reads as part of the
       * same scroll-driven language rather than a canned entrance: it
       * rises as it comes up the screen, finishing before it reaches the
       * middle. */
      const line4 = root.current?.querySelector<HTMLElement>(".js-desc-line-4");
      if (line4) {
        gsap.fromTo(
          line4,
          { yPercent: 135 },
          {
            yPercent: 0,
            ease: "power3.out",
            scrollTrigger: {
              // The mask, not the type: the type is the thing being moved,
              // so its own box is a moving target to measure against.
              trigger: line4.parentElement,
              // REQUIRED, not optional: this line lives INSIDE the section
              // the timeline above pins. Pinning inserts spacing that
              // pushes everything after it down the document, so a trigger
              // inside the pinned subtree resolves to a scroll position
              // that is wrong by the length of the pin — measured here as
              // the reveal simply never firing across the entire range
              // where the line crosses the screen. `pinnedContainer` tells
              // ScrollTrigger to account for that displacement.
              pinnedContainer: pinRef.current,
              start: "top 90%",
              end: "top 55%",
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          }
        );
      }
    }, root);
    return () => ctx.revert();
  }, []);

  const rule = (y: number) => (
    <Place x={36} y={y} w={1841} className="z-0">
      <div style={{ height: "calc(var(--u) * 6)", background: "var(--color-ink)" }} />
    </Place>
  );

  const LINE_MAX_W = 1841; // x36 -> x1877, the artboard's right margin
  const serif = { fontFamily: "var(--font-serif)" };

  return (
    // Stage height 2266 -> 2460 (2026-08-20): part of Noah's site-wide "add
    // more vertical space between sections of copy and images". Adding it to
    // the Stage rather than to the individual <Place> coordinates keeps every
    // element's artboard position — and therefore the composition — exactly
    // as designed, and just lengthens the run-out before the projects grid.
    <div ref={pinRef}>
    <Stage heightUnits={2460} className="overflow-hidden">
      <div ref={root} className="absolute inset-0">
        {/* Lines 1–3. Each is wrapped in an overflow-hidden mask so it can
            rise out from behind its own rule on scroll — see the LINE
            REVEAL note in the effect above. The mask must clip, so it
            can't be merged into <Place> (which positions but doesn't
            clip), and the animated element is the inner div, leaving the
            mask itself untransformed as a fixed window. */}
        {/* Line 1 y381 (was y81, moved down 300u) */}
        <Place x={36} y={381} className="z-10">
          <div className="overflow-hidden" style={{ paddingBottom: "calc(var(--u) * 26)" }}>
            <div className="js-desc-line">
              <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
                Noah Cousineau is a <span className="italic" style={serif}>graphic designer</span>
              </FitText>
            </div>
          </div>
        </Place>
        {rule(522)}

        {/* Line 2 y565 (was y265, moved down 300u) */}
        <Place x={36} y={565} className="z-10">
          <div className="overflow-hidden" style={{ paddingBottom: "calc(var(--u) * 26)" }}>
            <div className="js-desc-line">
              <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
                who uses wit, play, and humor to solve
              </FitText>
            </div>
          </div>
        </Place>
        {rule(706)}

        {/* Line 3 y741 (was y441, moved down 300u) */}
        <Place x={36} y={741} className="z-10">
          <div className="overflow-hidden" style={{ paddingBottom: "calc(var(--u) * 26)" }}>
            <div className="js-desc-line">
              <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
                your <span className="italic" style={serif}>visual problems</span><span className="italic" style={serif}>.</span>
              </FitText>
            </div>
          </div>
        </Place>
        {rule(882)}

        {/* "His work can be seen below." y1387 (was y1187, moved down 300u).
            "work" set in Quinn Text italic (serif) per spec, matching the
            emphasis treatment used elsewhere ("graphic designer", "visual
            problems"). Trailing period added per feedback.

            Rises out from behind its own rule (y1528) exactly like lines
            1–3 — same mask, same 135 yPercent, same ease (2026-08-21, per
            Noah: "Let's also have the 'his work can be seen below' on the
            home page animate upwards like the rest of the text"). Its rule
            sits 141u below it, the identical gap lines 1–3 use, so the
            same masking geometry works unchanged.

            It is deliberately NOT part of the pinned timeline above: at
            y1387 it is far below the fold for the whole time the section
            is pinned, so a slot in that sequence would spend its reveal
            off-screen and the line would already be standing by the time
            it scrolled into view. It gets its own trigger instead — see
            the LINE 4 note in the effect. */}
        <Place x={45} y={1387} className="z-10">
          <div className="overflow-hidden" style={{ paddingBottom: "calc(var(--u) * 26)" }}>
            <div className="js-desc-line-4">
              <FitText maxWidthUnits={1600} fontSizeUnits={105} className="leading-[1] tracking-tight">
                His <span className="italic" style={serif}>work</span> can be seen below.
              </FitText>
            </div>
          </div>
        </Place>

        {/* Pointing finger at y1600 — centered closer to text, away from projects grid.
            At the top of the page: points upward. As user scrolls down
            through the Description section, smoothly rotates to point downward.
            Transform origin is centered. */}
        <Place x={806} y={1600} w={308} h={523} className="z-20">
          <div
            ref={handRef}
            className="w-full [transform-origin:50%_50%] scale-75"
          >
            <Image
              src="/assets/home/pointing-hand.png"
              alt=""
              width={566}
              height={316}
              sizes="20vw"
              className="w-full h-auto"
            />
          </div>
        </Place>

        {/* Rule line below text — 36u gap after "His work can be seen below"
            baseline (y1387 + ~105 line height + 36u), matching the same
            36u text-to-rule gap used after lines 1–3 above. */}
        {rule(1528)}
      </div>
    </Stage>
    </div>
  );
}
