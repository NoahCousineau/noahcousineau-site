"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * HERO — top homepage area.
 * 1. PORTRAIT = RESERVED ROTATION ZONE (Bill-Nye turntable, later phase).
 *    For now a gentle auto-rotate placeholder stands in; swapped for a
 *    HeadTurntable component when frames exist.
 * 2. YELLOW PAPER SHAPE behind the head — morphing placeholder (CSS clip-path
 *    keyframes). Real morphing/3D comes later; this holds the zone + palette.
 */
export default function Hero() {
  const headRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // head placeholder: slow yaw to suggest 3D rotation
      gsap.to(headRef.current, {
        rotateY: 18,
        duration: 3,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      // yellow paper: endless morph between blob shapes
      if (paperRef.current) {
        const states = [
          "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
          "polygon(20% 0%,100% 20%,80% 100%,0% 82%,12% 40%)",
          "polygon(50% 8%,92% 50%,60% 100%,8% 78%,30% 18%)",
        ];
        let i = 0;
        const step = () => {
          i = (i + 1) % states.length;
          gsap.to(paperRef.current, {
            clipPath: states[i],
            duration: 4,
            ease: "sine.inOut",
            onComplete: step,
          });
        };
        step();
      }
    });
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative min-h-[88svh] flex flex-col items-center justify-center px-[--gutter] overflow-hidden">
      {/* Morphing yellow paper shape — sits behind the head */}
      <div
        ref={paperRef}
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[clamp(280px,70vw,720px)] aspect-square"
        style={{
          background: "var(--color-yellow)",
          clipPath:
            "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
          zIndex: 0,
        }}
      />

      {/* Rotation zone: head placeholder */}
      <div
        ref={headRef}
        className="relative w-[clamp(200px,42vw,360px)] [transform-style:preserve-3d] [perspective:1000px]"
        style={{ zIndex: 1 }}
      >
        <Image
          src="/assets/home/portrait.webp"
          alt="Noah Cousineau — rotating head (placeholder)"
          width={538}
          height={678}
          sizes="(max-width: 768px) 42vw, 360px"
          className="w-full h-auto"
          priority
        />
      </div>

      {/* Label as drawn */}
      <p
        className="relative mt-8 uppercase tracking-[0.35em]"
        style={{ fontSize: "var(--text-caption)", color: "var(--color-ink)", zIndex: 1 }}
      >
        portfolio
      </p>

      <h1
        className="relative uppercase font-bold leading-[0.9] tracking-tight text-center mt-2"
        style={{ fontSize: "var(--text-title)", zIndex: 1 }}
      >
        noah cousineau
        <span className="block font-normal normal-case">graphic designer</span>
      </h1>
    </section>
  );
}
