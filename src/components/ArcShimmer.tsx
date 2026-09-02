"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A LIGHT SWEEPING THROUGH ARCED TYPE (2026-09-02).
 *
 * Noah, on the clock screen: "I want to add a subtle animation to the 'Its
 * time to contact noah' text. I would like for a slight shimmer to appear
 * over the text. It will illuminate some of the letters. It will first
 * illuminate 'it's time to' and then when it sweeps through, it will then
 * illuminate 'contact noah'... The letters that it's illuminating will also
 * grow a bit, let's say a max of 15%. This sweeping animation will be
 * somewhat slow, taking about a second to get through 'it's time to'. It will
 * repeat every 8 seconds."
 *
 * WHY THIS EXISTS RATHER THAN A FEW LINES IN ArcText. The arcs are drawn with
 * a single SVG <textPath>, which lays every glyph out along the curve for
 * free — and gives no way to touch one glyph. Two cheaper routes were tried
 * and both fail:
 *
 *   - `transform` on a <tspan> inside a <textPath>. Chrome ignores it
 *     outright; measured, the tspan's box does not change at all.
 *   - `font-size` per tspan. That one works, and reflows every letter after
 *     it along the path, so a growing letter shoves its neighbours around the
 *     curve.
 *
 * So the glyphs are laid out as individual <text> elements, which CAN each
 * carry their own transform. The layout is not re-derived to do it: SVG
 * exposes the browser's own result through getStartPositionOfChar,
 * getEndPositionOfChar and getRotationOfChar, so the original <textPath> is
 * still what decides where every letter sits, and this only copies those
 * numbers out. The resting type is therefore identical to what it was, which
 * is the whole point — this is meant to be noticed as a shimmer, not as the
 * moment the headline changed shape.
 *
 * The measurement waits for `document.fonts.ready`. Taken before the webfont
 * lands, every position would be the fallback face's and the letters would
 * sit slightly wrong forever after.
 */

/** The whole loop, start of one sweep to the start of the next. */
const CYCLE_MS = 8000;
/** How long the light takes to cross one phrase. */
const SWEEP_MS = 1000;
/** How far the biggest letter grows. */
const MAX_GROW = 0.15;
/**
 * What the type sits at when the light is elsewhere. Not 1: the sweep has to
 * brighten INTO something, and on an arc that is already full-strength paper
 * on ink there is no brighter to go. A shade under is enough to read as
 * illumination passing through without the resting headline looking dimmed.
 */
const BASE_OPACITY = 0.84;
/** Half-width of the lit band, in letters. Wider reads as a wash, narrower as
 *  a blink; a couple of letters either side is a highlight travelling. */
const WINDOW = 2.4;

type Glyph = { c: string; x: number; y: number; rot: number };

export type ArcShimmerProps = {
  /** The <text> that the <textPath> already laid out; measured, never moved. */
  measureRef: React.RefObject<SVGTextElement | null>;
  /** Re-measure when this changes. */
  text: string;
  fontSize: number;
  color: string;
  /** Where this phrase sits in the 8s loop. The bottom arc follows the top. */
  phaseMs: number;
  /** Only runs while the screen it lives on is actually up. */
  active: boolean;
};

export default function ArcShimmer({
  measureRef,
  text,
  fontSize,
  color,
  phaseMs,
  active,
}: ArcShimmerProps) {
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);
  const nodes = useRef<(SVGTextElement | null)[]>([]);

  useLayoutEffect(() => {
    let raf = 0;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const el = measureRef.current;
      if (!el) {
        raf = requestAnimationFrame(measure);
        return;
      }
      try {
        const n = el.getNumberOfChars();
        const src = el.textContent ?? "";
        if (!n) {
          raf = requestAnimationFrame(measure);
          return;
        }
        const out: Glyph[] = [];
        for (let i = 0; i < n; i++) {
          const s = el.getStartPositionOfChar(i);
          const e = el.getEndPositionOfChar(i);
          out.push({
            c: src[i] ?? "",
            // The glyph's own centre on the baseline, so it can be scaled
            // about itself rather than about wherever it started.
            x: (s.x + e.x) / 2,
            y: (s.y + e.y) / 2,
            rot: el.getRotationOfChar(i),
          });
        }
        if (!cancelled) setGlyphs(out);
      } catch {
        // Not laid out yet (or detached); try again next frame.
        raf = requestAnimationFrame(measure);
      }
    };
    const start = () => {
      raf = requestAnimationFrame(measure);
    };
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(start).catch(start);
    } else {
      start();
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [measureRef, text, fontSize]);

  useEffect(() => {
    const count = glyphs.length;
    if (!count) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = (k: number[]) => {
      for (let i = 0; i < count; i++) {
        const el = nodes.current[i];
        if (!el) continue;
        const g = glyphs[i];
        const s = 1 + MAX_GROW * k[i];
        el.setAttribute(
          "transform",
          `translate(${g.x} ${g.y}) rotate(${g.rot}) scale(${s.toFixed(4)})`
        );
        el.setAttribute(
          "fill-opacity",
          (BASE_OPACITY + (1 - BASE_OPACITY) * k[i]).toFixed(3)
        );
      }
    };

    // Resting pose, so the letters are correct before the first sweep and
    // whenever the animation is not allowed to run.
    paint(new Array(count).fill(0));
    if (!active || reduced) return;

    let raf = 0;
    let wasLit = false;
    const step = () => {
      raf = requestAnimationFrame(step);
      /* One shared clock rather than per-arc timers: both arcs read the same
         `performance.now()`, so the bottom follows the top by exactly its
         phase without the two ever needing to talk. */
      const t = performance.now() % CYCLE_MS;
      const local = (t - phaseMs) / SWEEP_MS;
      if (local < 0 || local > 1) {
        // Paint the resting pose once on the way out, then do nothing until
        // the next sweep — this is idle for six of every eight seconds.
        if (wasLit) {
          paint(new Array(count).fill(0));
          wasLit = false;
        }
        return;
      }
      /* The light starts a window BEFORE the first letter and finishes a
         window AFTER the last, so the first and last letters get a whole
         rise and fall instead of opening or closing mid-glow. */
      const pos = -WINDOW + local * (count - 1 + 2 * WINDOW);
      const k = new Array(count);
      for (let i = 0; i < count; i++) {
        const d = Math.abs(i - pos) / WINDOW;
        // cos^2 falloff: no corners at the edges of the band, so a letter
        // eases in and out rather than switching on.
        k[i] = d >= 1 ? 0 : Math.cos((d * Math.PI) / 2) ** 2;
      }
      paint(k);
      wasLit = true;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [glyphs, phaseMs, active]);

  if (!glyphs.length) return null;

  return (
    /* aria-hidden: the original <textPath> is still in the DOM and still
       carries the sentence for a screen reader. This layer is decoration. */
    <g aria-hidden>
      {glyphs.map((g, i) => (
        <text
          key={`${i}-${g.c}`}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          fill={color}
          fontFamily="var(--font-sans)"
          fontSize={fontSize}
          /* Zero, deliberately. The measured centres already include the
             tracking the phrase is set with; letting each single-glyph text
             add its own would push every letter half a space off centre. */
          letterSpacing="0"
          textAnchor="middle"
          style={{ textTransform: "uppercase" }}
        >
          {g.c === " " ? " " : g.c}
        </text>
      ))}
    </g>
  );
}
