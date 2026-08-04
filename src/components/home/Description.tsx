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
    }, root);
    return () => ctx.revert();
  }, []);

  const rule = (y: number) => (
    <Place x={36} y={y} w={1841} className="z-0">
      <div style={{ height: "calc(var(--u) * 4)", background: "var(--color-ink)" }} />
    </Place>
  );

  const LINE_MAX_W = 1841; // x36 -> x1877, the artboard's right margin
  const serif = { fontFamily: "var(--font-serif)" };

  return (
    <Stage heightUnits={2266} className="overflow-hidden">
      <div ref={root} className="absolute inset-0">
        {/* Line 1 y381 (was y81, moved down 300u) */}
        <Place x={36} y={381} className="z-10">
          <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
            Noah Cousineau is a <span className="italic" style={serif}>graphic designer</span>
          </FitText>
        </Place>
        {rule(522)}

        {/* Line 2 y565 (was y265, moved down 300u) */}
        <Place x={36} y={565} className="z-10">
          <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
            who uses wit, play, and humor to solve
          </FitText>
        </Place>
        {rule(706)}

        {/* Line 3 y741 (was y441, moved down 300u) */}
        <Place x={36} y={741} className="z-10">
          <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
            your <span className="italic" style={serif}>visual problems</span><span className="italic" style={serif}>.</span>
          </FitText>
        </Place>
        {rule(882)}

        {/* "His work can be seen below" y1387 (was y1187, moved down 300u) */}
        <Place x={45} y={1387} className="z-10">
          <FitText maxWidthUnits={1600} fontSizeUnits={105} className="leading-[1] tracking-tight">
            His work can be seen below
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

        {/* Rule line below text — 50u below "His work can be seen below" baseline at y1387 */}
        {rule(1500)}
      </div>
    </Stage>
  );
}
