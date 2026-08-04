"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { Stage, Place } from "./Stage";
import HeroLockup from "./HeroLockup";
import RotatingHead from "../RotatingHead";

const STARBURST =
  "M50.00,0.00 L54.44,16.29 L62.94,1.70 L63.01,18.59 L75.00,6.70 L70.70,23.03 L85.36,14.64 L76.97,29.30 L93.30,25.00 L81.41,36.99 L98.30,37.06 L83.71,45.56 L100.00,50.00 L83.71,54.44 L98.30,62.94 L81.41,63.01 L93.30,75.00 L76.97,70.70 L85.36,85.36 L70.70,76.97 L75.00,93.30 L63.01,81.41 L62.94,98.30 L54.44,83.71 L50.00,100.00 L45.56,83.71 L37.06,98.30 L36.99,81.41 L25.00,93.30 L29.30,76.97 L14.64,85.36 L23.03,70.70 L6.70,75.00 L18.59,63.01 L1.70,62.94 L16.29,54.44 L0.00,50.00 L16.29,45.56 L1.70,37.06 L18.59,36.99 L6.70,25.00 L23.03,29.30 L14.64,14.64 L29.30,23.03 L25.00,6.70 L36.99,18.59 L37.06,1.70 L45.56,16.29 Z";

/**
 * HERO — master slice y100–1000.
 * B&W cut-out head (RESERVED ROTATION ZONE) on a spiky yellow STARBURST
 * (annotated "animation of changing paper shapes" — placeholder slow spin/scale
 * until the real shape system). "noah cousineau" — Akzidenz Regular (no bold,
 * per spec) — right of head; "graphic design" in Quinn Text Italic beneath.
 * FitText caps the name+label block at 830 units so it can NEVER bleed past
 * the artboard's right margin (x1877 = the same margin the description uses),
 * regardless of which font is currently active.
 */
export default function Hero() {
  const burstRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.to(burstRef.current, {
        rotate: 360,
        duration: 40,
        ease: "none",
        repeat: -1,
        transformOrigin: "50% 50%",
      });
      gsap.to(burstRef.current, {
        scale: 1.06,
        duration: 5,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        transformOrigin: "50% 50%",
      });
    });
    return () => ctx.revert();
  }, []);

  // Right column caps at the artboard margin (x1877), starting at x990 -> 887 units max
  const RIGHT_MAX_W = 887;

  return (
    <Stage heightUnits={900} className="overflow-hidden">
      {/* Spiky yellow starburst behind head, x73–875 y104–898 */}
      <Place x={73} y={104} w={802} h={794} className="z-0">
        <svg ref={burstRef} viewBox="0 0 100 100" className="w-full h-full">
          <path d={STARBURST} fill="var(--color-yellow)" />
        </svg>
      </Place>

      {/* Rotating head animation — interactive drag-to-spin */}
      <Place x={150} y={50} w={650} h={950} className="z-10 flex items-center justify-center overflow-hidden">
        <RotatingHead 
          isDarkMode={false}
          variant="staggered"
          autoRotateSpeed={130}
          containerClassName="w-auto h-auto"
        />
      </Place>

      {/* "noah cousineau / graphic design" lockup — embedded from Noah's exact
          SVG (hand-kerned, not reproducible via CSS letter-spacing). Right
          column, capped at the artboard's right margin (x1877) so it can
          never bleed off-screen; aspect ratio locked to the source SVG.
          Sized ~15% smaller per feedback. */}
      <Place x={990} y={360} w={RIGHT_MAX_W * 0.85} className="z-10">
        <HeroLockup />
      </Place>
    </Stage>
  );
}
