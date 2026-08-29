/*
  Stage — faithful reproduction helper (SHARED, site-wide).

  Originally built for the homepage's 1920-wide artboard: every element's
  position and font size is derived from that canvas and expressed as a
  fraction of 1920 (one "unit" = 1/1920 of the stage width). Children are
  positioned with left/top in artboard units; the stage width tracks the
  viewport (capped), so horizontal placement, alignment and type scale all
  follow the artboard at every screen size.

  Promoted out of components/home/ so project pages can reuse it too —
  e.g. the project-page "statement" block deliberately reuses the exact
  same unit math as the homepage Description block, per Noah's requirement
  that it match "the same text size, fonts, horizontal rule, and spacing
  as the home screen." components/home/Stage.tsx now just re-exports this.
*/
import React from "react";

export function Stage({
  heightUnits,
  children,
  className = "",
  id,
  onPointerDown,
}: {
  heightUnits: number;
  children?: React.ReactNode;
  className?: string;
  id?: string;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      id={id}
      className={`relative w-full ${className}`}
      style={{ height: `calc(var(--u) * ${heightUnits})` }}
      onPointerDown={onPointerDown}
    >
      {children}
    </div>
  );
}

/** Position a child at artboard (x,y) with optional (w,h) size, all in units. */
export function Place({
  x,
  y,
  w,
  wCss,
  yCss,
  h,
  className = "",
  style,
  children,
}: {
  x: number;
  y: number;
  w?: number;
  /** A raw CSS width, for the rare case where the width needs a clamp or a
   *  min() rather than a plain artboard multiple. Wins over `w`. */
  wCss?: string;
  /** The same escape hatch for the vertical position. Wins over `y`. */
  yCss?: string;
  h?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`absolute ${className}`}
      style={{
        left: `calc(var(--u) * ${x})`,
        top: yCss ?? `calc(var(--u) * ${y})`,
        ...(wCss != null
          ? { width: wCss }
          : w != null
            ? { width: `calc(var(--u) * ${w})` }
            : {}),
        ...(h != null ? { height: `calc(var(--u) * ${h})` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Font size in artboard units (pt/1920 of width). */
export function uFont(units: number): string {
  return `calc(var(--u) * ${units})`;
}

/**
 * The same artboard size, but with a floor (2026-08-29).
 *
 * `--u` is a pure linear zoom, so any size written in units keeps shrinking
 * for as long as the window does. That is right for display type, which is
 * meant to scale with the composition, and wrong for small labels, which
 * simply stop being readable: the footer's link list is 17.9 units, which is
 * 17.9px at the 1920 artboard and 7.46px at an 800px window. Noah, on that
 * screenshot: the middle widths should feel like "a natural in-between of the
 * desktop size and the mobile size", and 7px is not in between anything.
 *
 * The ceiling is the artboard value itself, so this is exactly the old
 * expression above 1920/units px and only ever engages below it — nothing at
 * desktop width moves.
 */
export function uFontMin(units: number, minPx: number): string {
  return `clamp(${minPx}px, calc(var(--u) * ${units}), ${units}px)`;
}
