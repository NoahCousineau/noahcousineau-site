"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { Stage, Place, uFont } from "./Stage";

/**
 * HERO — faithful to master artboard (1920x4832), slice y100–1000.
 * Head image box x218–693 (left-of-center). Yellow paper shape x73–875 behind it.
 * "noah" / "cousineau" + "graphic designer" labels at right (x990–1703).
 * 3D rotating head = RESERVED ROTATION ZONE (placeholder yaw until photos exist).
 */
export default function Hero() {
  const headRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin();
    const ctx = gsap.context(() => {
      gsap.to(headRef.current, {
        rotateY: 16,
        duration: 3,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
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
    <Stage heightUnits={1000} className="overflow-hidden">
      {/* Yellow morphing paper shape, x73–875 y104–898 */}
      <Place x={73} y={104} w={802} h={794} className="z-0">
        <div
          ref={paperRef}
          aria-hidden
          className="w-full h-full"
          style={{
            background: "var(--color-yellow)",
            clipPath: "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
          }}
        />
      </Place>

      {/* Head — rotation zone, box x218–693 y202–800 */}
      <Place x={218} y={202} w={475} h={598} className="z-10">
        <div ref={headRef} className="w-full [transform-style:preserve-3d] [perspective:1000px]">
          <Image
            src="/assets/home/portrait.webp"
            alt="Noah Cousineau — rotating head (placeholder)"
            width={538}
            height={678}
            sizes="40vw"
            className="w-full h-auto"
            priority
          />
        </div>
      </Place>

      {/* "noah" x990 y378 fs179 */}
      <Place x={990} y={378} className="z-10">
        <span className="block font-bold uppercase leading-[0.85]" style={{ fontSize: uFont(179) }}>
          noah
        </span>
      </Place>
      {/* "cousineau" x1066 y463 fs179 */}
      <Place x={1066} y={463} className="z-10">
        <span className="block font-bold uppercase leading-[0.85]" style={{ fontSize: uFont(179) }}>
          cousineau
        </span>
      </Place>
      {/* "graphic designer" x997 y607 fs73 */}
      <Place x={997} y={607} className="z-10">
        <span className="block normal-case leading-[0.95]" style={{ fontSize: uFont(73) }}>
          graphic designer
        </span>
      </Place>
    </Stage>
  );
}
