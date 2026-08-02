"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { Stage, Place, uFont } from "./Stage";

/**
 * DESCRIPTION — master slice y1000–2366.
 * Three left-aligned lines at x36 (fs~135). "His work can be seen below" x45 y2237.
 * Pointing hand image box x806–1114 y1655–2200, rotates up→down on scroll.
 */
const LINES = [
  "Noah Cousineau is a graphic designer",
  "who uses wit, play, and humor to solve",
  "your visual problems.",
];

export default function Description() {
  const root = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin();
    const ctx = gsap.context(() => {
      gsap.fromTo(
        handRef.current,
        { rotate: -90 },
        {
          rotate: 0,
          ease: "power2.out",
          scrollTrigger: {
            trigger: root.current,
            start: "top 75%",
            end: "bottom 45%",
            scrub: 1,
          },
        }
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <Stage heightUnits={2366} className="overflow-hidden" id="desc-root">
      <div ref={root} className="absolute inset-0">
        {LINES.map((line, i) => (
          <Place key={i} x={36} y={1081 + i * (1265 - 1081)} className="z-10">
            <span
              className="block font-bold uppercase leading-[0.95]"
              style={{ fontSize: uFont(135) }}
            >
              {line}
            </span>
          </Place>
        ))}

        {/* "His work can be seen below" x45 y2237 fs129 */}
        <Place x={45} y={2237} className="z-10">
          <span className="block uppercase leading-[0.95]" style={{ fontSize: uFont(90) }}>
            His work can be seen below
          </span>
        </Place>

        {/* Pointing hand — rotates up to down on scroll, box x806 y1655 w308 h523 */}
        <Place x={806} y={1655} w={308} h={523} className="z-20">
          <div ref={handRef} className="w-full [transform-origin:70%_30%]">
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
