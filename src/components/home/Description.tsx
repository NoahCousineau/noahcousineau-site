"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * DESCRIPTION — second homepage area.
 * The sketch: text + lines as drawn; a pointing hand that, as you scroll down,
 * first points UP, then rotates DOWN (with "resistance" to the rotation — i.e.
 * an eased, slightly springy turn rather than a linear spin).
 */
const LINES = [
  "Noah Cousineau is a graphic designer",
  "who uses wit, play, and humor to solve",
  "your visual problems.",
];

export default function Description() {
  const root = useRef<HTMLElement>(null);
  const handRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Hand starts pointing up (-90deg) and rotates down to 0 as we scroll
      // through the section. "Resistance" = ease that eases out hard at the end.
      gsap.fromTo(
        handRef.current,
        { rotate: -90 },
        {
          rotate: 0,
          ease: "power2.out",
          scrollTrigger: {
            trigger: root.current,
            start: "top 70%",
            end: "bottom 40%",
            scrub: 1,
          },
        }
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative min-h-[80svh] flex items-center px-[--gutter] max-w-[--maxw] mx-auto"
    >
      <div className="max-w-[40ch]">
        {LINES.map((line, i) => (
          <p
            key={i}
            className="font-bold uppercase leading-[1.05] tracking-tight"
            style={{ fontSize: "var(--text-heading)" }}
          >
            {line}
          </p>
        ))}

        <p
          className="uppercase tracking-widest mt-10 opacity-60"
          style={{ fontSize: "var(--text-caption)" }}
        >
          His work can be seen below
        </p>
      </div>

      {/* Pointing hand — rotates from up to down on scroll */}
      <div
        ref={handRef}
        className="absolute right-[--gutter] bottom-[10vh] w-[clamp(120px,18vw,220px)] [transform-origin:70%_30%]"
        aria-hidden
      >
        <Image
          src="/assets/home/pointing-hand.png"
          alt=""
          width={566}
          height={316}
          sizes="(max-width: 768px) 18vw, 220px"
          className="w-full h-auto"
        />
      </div>
    </section>
  );
}
