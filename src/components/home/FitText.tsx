"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * FitText — renders text that can NEVER bleed past a max width, regardless
 * of which font is active (fallback vs. the real licensed face). Measures
 * the rendered width at the target font-size and shrinks the font-size
 * (never distorts/scales the glyphs) if it would overflow.
 *
 * Two gotchas that bit us here, left as comments so they don't recur:
 *
 * 1. getComputedStyle(el).getPropertyValue('--u') returns the literal
 *    unresolved "calc(100cqw / 1920)" STRING, not a resolved pixel number —
 *    parseFloat() on it silently yields NaN. To get --u in real px, size a
 *    PROBE element to `width: calc(var(--u) * 1000)` and read its rendered
 *    getBoundingClientRect().width / 1000.
 * 2. Never imperatively mutate the LIVE (visible) element's fontSize to
 *    measure overflow — an offscreen ResizeObserver firing its mandatory
 *    initial callback after mount will re-run the measurement and stomp the
 *    React-applied scaled value with the raw unscaled one, since the last
 *    imperative write wins until the next render. Measure on a detached
 *    hidden CLONE instead so the visible element is only ever touched by
 *    the declarative JSX style (driven by React state).
 */
export function FitText({
  children,
  maxWidthUnits,
  fontSizeUnits,
  className = "",
  style,
}: {
  children: React.ReactNode;
  maxWidthUnits: number;
  fontSizeUnits: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontScale, setFontScale] = useState(1);

  useLayoutEffect(() => {
    const probe = probeRef.current;
    const measure = measureRef.current;
    if (!probe || !measure) return;

    const fit = () => {
      const uPx = probe.getBoundingClientRect().width / 1000; // probe is 1000 units wide
      // measure is a hidden, unscaled clone — never touched by React state,
      // so it always reflects the true un-shrunk width at fontSizeUnits.
      measure.style.fontSize = `${fontSizeUnits * uPx}px`;
      const maxPx = uPx * maxWidthUnits;
      const w = measure.scrollWidth;
      if (maxPx > 0 && w > maxPx) {
        setFontScale(maxPx / w);
      } else {
        setFontScale(1);
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [children, maxWidthUnits, fontSizeUnits]);

  return (
    <span ref={outerRef} className={className} style={{ display: "inline-block", position: "relative" }}>
      {/* invisible probe: exactly 1000 artboard units wide, used to read --u in real px */}
      <span
        ref={probeRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", width: "calc(var(--u) * 1000)", height: 0, pointerEvents: "none" }}
      />
      {/* invisible unscaled measurer — a plain, un-styled twin, never mutated by React */}
      <span
        ref={measureRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", whiteSpace: "nowrap", top: 0, left: 0, pointerEvents: "none", ...style }}
      >
        {children}
      </span>
      {/* the VISIBLE text — font-size is entirely React/JSX driven, never imperatively touched */}
      <span
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          fontSize: `calc(var(--u) * ${fontSizeUnits * fontScale})`,
          ...style,
        }}
      >
        {children}
      </span>
    </span>
  );
}
