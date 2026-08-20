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

      /* LINE REVEAL (2026-08-20, per Noah: "I want the 'Noah Cousineau is a
       * graphic...' text to rise up from the black line as we scroll up. It
       * should be in order, so the first line appears first, then the
       * second, then the third.")
       *
       * Each of the three statement lines sits directly ABOVE its own rule
       * (line 1 y381 / rule y522, line 2 y565 / rule y706, line 3 y741 /
       * rule y882). Each line is wrapped in an overflow-hidden mask whose
       * bottom edge is that rule, so translating the type down by its own
       * height parks it entirely behind the rule; animating back to 0
       * makes it rise out of the line, which is the gesture described.
       *
       * yPercent (not a pixel y) because these lines are set in artboard
       * units and rescale with the viewport — a fixed pixel offset would
       * under- or over-hide the type at other widths, letting descenders
       * peek out below the rule on wide screens.
       *
       * stagger sequences them 1 -> 2 -> 3. `once: true` because this is an
       * entrance: replaying it every time the reader scrolls back up the
       * homepage would turn a flourish into a tic. */
      gsap.fromTo(
        ".js-desc-line",
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: 1.05,
          ease: "power3.out",
          stagger: 0.16,
          scrollTrigger: {
            trigger: root.current,
            start: "top 72%",
            once: true,
          },
        }
      );
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
          <div className="overflow-hidden">
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
          <div className="overflow-hidden">
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
          <div className="overflow-hidden">
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
            problems"). Trailing period added per feedback. */}
        <Place x={45} y={1387} className="z-10">
          <FitText maxWidthUnits={1600} fontSizeUnits={105} className="leading-[1] tracking-tight">
            His <span className="italic" style={serif}>work</span> can be seen below.
          </FitText>
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
  );
}
