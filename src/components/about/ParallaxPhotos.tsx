"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/*
 * PARALLAX PHOTO BED (2026-08-20, per Noah: "In the about me text section
 * below, I want this to be a parallax scroll. I'm going to rewrite the
 * paragraph so that it's more of a life story. As we go down the paragraph,
 * photos of me and my work will scroll with parallax further in the
 * distance. These will be slightly transparent. Use placeholder images to
 * test this for now.")
 *
 * PLACEHOLDERS: the images below are borrowed from existing project folders
 * purely so the effect can be judged with real artwork in place — they are
 * NOT the final selects. Swap the `src` values in PHOTOS for the real
 * life-story photos; nothing else needs to change, since position, depth
 * and size are all per-entry data.
 *
 * DEPTH MODEL: `depth` (0..1) is how far "back" a photo sits, and it drives
 * three things at once so they can't disagree — travel distance (further
 * back = moves less, the actual parallax cue), opacity (further back =
 * fainter) and blur (further back = softer). Tying all three to one number
 * is what makes the bed read as distance rather than as three unrelated
 * effects.
 *
 * Photos are positioned in the same `--u` artboard units as the rest of the
 * site and sit behind the copy (the text layer owns a higher z-index), so
 * the paragraph stays fully legible as it passes over them.
 */

type Photo = {
  src: string;
  /** Left edge, artboard units (0-1920). */
  x: number;
  /** Top, as a percentage of the section's height — keeps photos
   * distributed down however long the final life-story copy runs. */
  yPct: number;
  /** Width, artboard units. */
  w: number;
  /** 0 = near (moves a lot, most visible), 1 = far (barely moves, faintest). */
  depth: number;
  /** Resting tilt, degrees. */
  rotate: number;
};

const PHOTOS: Photo[] = [
  { src: "/assets/01-about/01-about_02_mgl6437-copy.webp", x: 60, yPct: 4, w: 430, depth: 0.15, rotate: -5 },
  { src: "/assets/forced-perspective/forced-perspective_02_11x17-poster.webp", x: 1420, yPct: 14, w: 380, depth: 0.7, rotate: 6 },
  { src: "/assets/big-tech-art/big-tech-art_02_big-tech-art-display-spreads-01-copy.webp", x: 150, yPct: 34, w: 400, depth: 0.85, rotate: 4 },
  { src: "/assets/corita-art-center/Corita Art Center Custom Graphics Pennant.png", x: 1370, yPct: 46, w: 460, depth: 0.3, rotate: -7 },
  { src: "/assets/forced-perspective/forced-perspective_03_shoes-2-no-background-copy.webp", x: 90, yPct: 64, w: 420, depth: 0.5, rotate: 8 },
  { src: "/assets/big-tech-art/big-tech-art_03_big-tech-art-display-spreads-08.webp", x: 1400, yPct: 76, w: 390, depth: 0.9, rotate: -4 },
  { src: "/assets/01-about/01-about_01_webclip.webp", x: 210, yPct: 88, w: 350, depth: 0.25, rotate: -9 },
];

/** Vertical travel of the NEAREST photo across the whole section, in
 * artboard units. Far photos scale down from this by their depth. */
const MAX_TRAVEL_UNITS = 420;

export default function ParallaxPhotos() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // No parallax when the OS asks for reduced motion — the photos stay
    // put at their resting positions, which is a perfectly good static
    // composition rather than a broken one.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const els = gsap.utils.toArray<HTMLElement>(".js-parallax-photo");
      els.forEach((el) => {
        const depth = Number(el.dataset.depth ?? 0.5);
        // Nearer photos travel further: classic parallax, where apparent
        // motion falls off with distance.
        const travel = MAX_TRAVEL_UNITS * (1 - depth);
        gsap.fromTo(
          el,
          { yPercent: 0 },
          {
            // Expressed as a share of the element's own height so it stays
            // proportional across viewport widths, matching how the rest
            // of the site scales.
            // Guarded, not `.current!` — a StackedSection resize on
            // whatever page the reader has since navigated to calls
            // `ScrollTrigger.refresh()` globally (see the note on the same
            // fix in ProjectStatement.tsx), which can re-invoke this after
            // this component has unmounted and cleared the ref. Throwing
            // here would abort that refresh partway through and leave
            // OTHER pages' triggers stale.
            y: () => (root.current ? -travel * (root.current.clientWidth / 1920) : 0),
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          }
        );
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {PHOTOS.map((p, i) => (
        <div
          key={i}
          className="js-parallax-photo absolute"
          data-depth={p.depth}
          style={{
            left: `calc(var(--u) * ${p.x})`,
            top: `${p.yPct}%`,
            width: `calc(var(--u) * ${p.w})`,
            transform: `rotate(${p.rotate}deg)`,
            // All three depth cues from the same number — see DEPTH MODEL.
            opacity: 0.42 - p.depth * 0.22,
            filter: `blur(${p.depth * 2.6}px)`,
            willChange: "transform",
          }}
        >
          <Image
            src={p.src}
            alt=""
            width={800}
            height={1000}
            sizes="30vw"
            className="w-full h-auto"
          />
        </div>
      ))}
    </div>
  );
}
