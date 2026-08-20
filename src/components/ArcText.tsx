"use client";

/*
 * Arced type on a circle, via a plain SVG <textPath> — the cheapest correct
 * way to do this on the web, no extra libraries.
 *
 * Extracted from src/app/about/page.tsx on 2026-08-20 (unchanged behavior)
 * so the clock lockup could move to the site-wide away screen
 * (components/AwayOverlay.tsx) while the About page keeps using the same
 * component for its "DOWNLOAD MY RÉSUMÉ" headline. Two copies of this
 * geometry would have been a standing invitation for the two to drift.
 */

/** Rounds a computed path coordinate to a fixed precision.
 *
 * HYDRATION FIX (2026-08-20): the trig below can land on results that
 * differ in the last bit or two between the server's JS engine and the
 * browser's (e.g. 25.753321222267655 vs ...658). Interpolated raw into the
 * path's `d` string, that produced two different strings for the same arc
 * and React reported a hydration mismatch on every page carrying an arc.
 * Rounding to 4dp is far finer than a subpixel at any viewport size, so it
 * costs nothing visually and makes the markup deterministic. */
const r = (n: number) => Number(n.toFixed(4));

/** Arced text via SVG textPath. `flip` reverses the arc to open upward
 * (concave-down "smile") vs. downward; `startOffset` nudges start point.
 *
 * DECOUPLED CURVATURE VS POSITION (2026-08-18, round 9) — Noah on the
 * clock section: "arched too much" AND "not close to the edge of the
 * white circle" at the same time. Two separate bugs fixed here:
 * 1. `cy` (vertical position) was hardcoded to equal `radius`
 *    (curvature) — turning one dial always moved the other. Added an
 *    optional `baselineY` prop so they're independent.
 * 2. The path's start/end X were always `cx -/+ radius`, i.e. a FULL
 *    semicircle chord (= the circle's own diameter) no matter how big
 *    `radius` got — so the arc's bulge height was always exactly
 *    `radius` regardless of scale, and cranking radius up just pushed
 *    the whole semicircle (and the text riding at its apex) miles off
 *    screen instead of flattening anything. Added an optional
 *    `spanDeg` prop (degrees of the circle actually traced, default
 *    180 = old full-semicircle behavior) so a LARGE radius can trace a
 *    SMALL angular slice under the text — that's what actually produces
 *    a gentle, nearly-flat arch: same text width, much bigger circle,
 *    much less curvature per pixel of text. */
export function ArcText({
  text,
  radius,
  width,
  height,
  fontSize,
  flip = false,
  color = "#fff",
  id,
  baselineY,
  spanDeg = 180,
  centerY: centerYProp,
}: {
  text: string;
  radius: number;
  width: number;
  height: number;
  fontSize: number;
  flip?: boolean;
  color?: string;
  id: string;
  baselineY?: number;
  spanDeg?: number;
  centerY?: number;
}) {
  const cx = width / 2;
  // Downward-opening arc (smile shape, used for résumé headline): path
  // goes from left to right along the TOP of a circle whose center sits
  // below the visible area, so the visible slice curves upward at the
  // ends and dips at center — matches the "rainbow" arc in the design.
  const cy = baselineY ?? (flip ? radius : height - radius);
  // Circle center sits `radius` above (flip) or below (!flip) the
  // baseline; start/end points are at +/-(spanDeg/2) from the very
  // top/bottom of that circle, NOT at the full +/-90deg (diameter).
  //
  // TRUE-CONCENTRIC FIX (2026-08-18, round 10) — Noah: "text still too
  // far from the circle" even after matching radius exactly. Root
  // cause: `centerY` here was DERIVED from cy+/-radius, an independent
  // number from the actual visible white circle's own center — so
  // "same radius" did NOT guarantee "same circle", just same curvature
  // at a possibly different, non-concentric center. Added an optional
  // `centerY` override so the arc can be pinned to literally the same
  // center point as the real circle, making them truly concentric
  // (same circle, different radius) instead of two same-curvature but
  // offset arcs that only coincidentally look close.
  const centerY = centerYProp ?? (flip ? cy + radius : cy - radius);
  const halfSpanRad = (spanDeg / 2) * (Math.PI / 180);
  const startX = flip ? cx - radius * Math.sin(halfSpanRad) : cx - radius * Math.sin(halfSpanRad);
  const endX = cx + radius * Math.sin(halfSpanRad);
  const arcPointY = flip
    ? centerY - radius * Math.cos(halfSpanRad)
    : centerY + radius * Math.cos(halfSpanRad);
  const sweep = flip ? 1 : 0;
  const d = `M ${r(startX)} ${r(arcPointY)} A ${r(radius)} ${r(radius)} 0 0 ${sweep} ${r(endX)} ${r(arcPointY)}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: "visible" }}>
      <path id={id} d={d} fill="none" />
      <text
        fill={color}
        fontFamily="var(--font-sans)"
        fontSize={fontSize}
        letterSpacing="0.02em"
        style={{ textTransform: "uppercase" }}
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </svg>
  );
}

/** Text that traces the BOTTOM of a circle with letters kept upright
 * (readable normally, not upside-down) — matches Noah's clock-section
 * reference, where "CONTACT NOAH" sits along the lower curve right-side
 * up. Plain ArcText can't do this: SVG textPath always keeps a glyph's
 * "up" pointing toward the path's left-hand side as it travels forward,
 * so tracing the BOTTOM of a circle left-to-right (the natural reading
 * order) puts letters upside-down. The fix is to trace the arc
 * RIGHT-TO-LEFT along the same bottom curve instead — that flips which
 * side is "up" without flipping the glyphs themselves — and then reverse
 * the character order in the string so the visible reading order comes
 * out correct again. */
export function BottomArcText({
  text,
  radius,
  width,
  height,
  fontSize,
  color = "#fff",
  id,
  baselineY,
  spanDeg = 180,
  centerY: centerYProp,
}: {
  text: string;
  radius: number;
  width: number;
  height: number;
  fontSize: number;
  color?: string;
  id: string;
  baselineY?: number;
  spanDeg?: number;
  centerY?: number;
}) {
  const cx = width / 2;
  const cy = baselineY ?? (height - radius);
  // Same span-decoupling fix as ArcText above: circle center sits
  // `radius` ABOVE the baseline for a bottom-opening bowl, and the
  // visible arc only traces +/-(spanDeg/2) around the very BOTTOM of
  // that circle rather than the full +/-90deg diameter — so a big
  // radius flattens the arch instead of just relocating it. Optional
  // `centerY` override (round 10) pins this to the SAME center point as
  // the real white circle for true concentricity — see ArcText's fuller
  // comment on why same-radius alone didn't guarantee that.
  const centerY = centerYProp ?? (cy - radius);
  const halfSpanRad = (spanDeg / 2) * (Math.PI / 180);
  const arcPointY = centerY + radius * Math.cos(halfSpanRad);
  // sweep=0 tracing left-to-right along the bottom of the circle keeps
  // each glyph's "up" pointing outward/downward-away-from-center, i.e.
  // upright as seen by the viewer. (2026-08-18 round 9 fix — the
  // previous right-to-left/sweep=1 combo was rendering upside-down;
  // verified by direct on-screen inspection, not just geometry theory.)
  const d = `M ${r(cx - radius * Math.sin(halfSpanRad))} ${r(arcPointY)} A ${r(radius)} ${r(radius)} 0 0 0 ${r(cx + radius * Math.sin(halfSpanRad))} ${r(arcPointY)}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: "visible" }}>
      <path id={id} d={d} fill="none" />
      <text
        fill={color}
        fontFamily="var(--font-sans)"
        fontSize={fontSize}
        letterSpacing="0.06em"
        style={{ textTransform: "uppercase" }}
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </svg>
  );
}
