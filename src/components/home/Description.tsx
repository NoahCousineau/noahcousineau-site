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
        { rotate: -45 },
        {
          rotate: 45,
          ease: "back.in(1.6)",
          scrollTrigger: {
            trigger: root.current,
            start: "top 75%",
            end: "bottom 40%",
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
    <Stage heightUnits={2340} className="overflow-hidden">
      <div ref={root} className="absolute inset-0">
        {/* Line 1 y1081 */}
        <Place x={36} y={1081} className="z-10">
          <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
            Noah Cousineau is a <span className="italic" style={serif}>graphic designer</span>
          </FitText>
        </Place>
        {rule(1240)}

        {/* Line 2 y1265 */}
        <Place x={36} y={1265} className="z-10">
          <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
            who uses wit, play, and humor to solve
          </FitText>
        </Place>
        {rule(1424)}

        {/* Line 3 y1441 */}
        <Place x={36} y={1441} className="z-10">
          <FitText maxWidthUnits={LINE_MAX_W} fontSizeUnits={105} className="leading-[1] tracking-tight">
            your <span className="italic" style={serif}>visual problems</span>.
          </FitText>
        </Place>

        {/* "His work can be seen below" y2237 */}
        <Place x={45} y={2237} className="z-10">
          <FitText maxWidthUnits={1600} fontSizeUnits={96} className="leading-[1] tracking-tight">
            His work can be seen below
          </FitText>
        </Place>
        {/* Rule line sits BELOW the text, not through it */}
        {rule(2300)}

        {/* Pointing finger — animates based on scroll position.
            At the top of the page: points upward (-45°). As user scrolls down
            through the Description section, smoothly rotates to point downward
            (45°). No drop shadow. Transform origin is the hand's wrist so it
            pivots naturally. */}
        <Place x={806} y={1655} w={308} h={523} className="z-20">
          <div
            ref={handRef}
            className="w-full [transform-origin:70%_30%]"
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
      </div>
    </Stage>
  );
}
