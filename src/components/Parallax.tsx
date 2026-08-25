"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/*
 * A layer that drifts against the scroll (2026-08-24).
 *
 * Noah, on the résumé arrows: "I'd also light so see the slightest amount of
 * parallax scroll on these." And on the hero: "add some parallax scrolling on
 * the head spin animation. Not tons, just enough to make the viewer realize
 * they're on separate planes."
 *
 * MEASURED IN ARTBOARD UNITS, not pixels or percent, because everything it is
 * drifting against is. A fixed pixel offset would be a different-sized drift
 * at every viewport width — conspicuous on a laptop, invisible on a large
 * display — and `yPercent` would scale with each layer's own height, so the
 * small pencil marks and the big yellow star would drift by different amounts
 * for the same setting. `units` is the same distance in the same coordinate
 * system as the positions it is offsetting.
 *
 * IT WRITES A CUSTOM PROPERTY, NOT A TRANSFORM. The element's transform is
 * declared once, statically, as translateY(calc(var(--u) * var(--plx))), and
 * the scrub only ever moves `--plx`. That keeps GSAP out of the `transform`
 * property entirely, which matters here because several of the things being
 * parallaxed already carry transforms of their own — the arrows have a
 * rotation and a nudge keyframe animation — and a tween that owned
 * `transform` would silently overwrite them.
 */
export default function Parallax({
  units,
  className = "",
  style,
  children,
}: {
  /** Total drift is 2x this: the layer runs from -units to +units as the
   *  viewport crosses it. Positive means it lags the scroll (reads as
   *  further back); negative leads it (nearer). */
  units: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Nothing to suppress on the reduced-motion path — the element simply
    // stays at its declared position, which is where it was designed to be.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const state = { v: -units };
    const apply = () => el.style.setProperty("--plx", String(state.v));
    apply();

    const tween = gsap.to(state, {
      v: units,
      ease: "none",
      onUpdate: apply,
      scrollTrigger: {
        trigger: el,
        // The whole time any part of the layer is on screen, so the drift is
        // spread across the entire pass rather than happening in a rush.
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      el.style.removeProperty("--plx");
    };
  }, [units]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: "translateY(calc(var(--u) * var(--plx, 0)))",
        willChange: "transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
