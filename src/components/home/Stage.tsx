/*
  Stage — faithful reproduction helper.

  Noah's homepage artboard is 1920 x 4832 pt. Every element's position and
  font size is derived from that canvas and expressed as a fraction of 1920
  (one "unit" = 1/1920 of the stage width). Children are positioned with
  left/top in artboard units; the stage width tracks the viewport (capped),
  so horizontal placement, alignment and type scale all follow the artboard
  at every screen size. Vertical rhythm matches each artboard slice's height.
*/
import React from "react";

export function Stage({
  heightUnits,
  children,
  className = "",
  id,
}: {
  heightUnits: number;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`relative w-full ${className}`}
      style={{ height: `calc(var(--u) * ${heightUnits})` }}
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
  h,
  className = "",
  style,
  children,
}: {
  x: number;
  y: number;
  w?: number;
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
        top: `calc(var(--u) * ${y})`,
        ...(w != null ? { width: `calc(var(--u) * ${w})` } : {}),
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
