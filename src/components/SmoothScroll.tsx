"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* The live Lenis instance, for the few places that need to take scrolling
 * away from the reader for a moment (see src/lib/scrollLock.ts, used by the
 * project pages' falling hand). Deliberately a module-level handle rather
 * than context: nothing RENDERS differently because of it, so making every
 * consumer a context subscriber would buy nothing and cost a provider around
 * the whole tree. Null under prefers-reduced-motion, where Lenis is never
 * constructed — callers must cope with that, and the scroll lock does. */
let lenisInstance: Lenis | null = null;
export function getLenis(): Lenis | null {
  return lenisInstance;
}

/**
 * Global smooth-scroll + GSAP ScrollTrigger sync.
 * Respects prefers-reduced-motion: bails out entirely and leaves native scroll.
 */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenisInstance = lenis;
    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisInstance = null;
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return <>{children}</>;
}
