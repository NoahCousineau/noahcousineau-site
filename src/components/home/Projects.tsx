"use client";

import { useRef } from "react";
import Link from "next/link";
import { Stage, Place } from "./Stage";
import { FitText } from "./FitText";
import { HOVER_VIDEO } from "@/lib/projects";

/**
 * PROJECTS — master slice y2587–4162. Editorial TABLE grid:
 *  - thick black rules full-width, EVEN row heights (the original sketch had
 *    alternating heights — Noah flagged that as his own sketch error and
 *    asked for even rows here)
 *  - vertical divider down the center (x≈956)
 *  - each cell: title (2 lines) + italic-serif discipline tags, CENTERED both
 *    axes, sitting inside a consistent white box on EVERY tile (not just the
 *    ones with video) — benchmarked against "Video hover on - Sprouts.png"
 *  - HOVER: video fills the whole cell with a slow zoom-in; white box appears
 * Six tiles from the sketch; "other / work" links to the full index.
 */
type Cell = {
  slug: string;
  line1: string;
  line2: string;
  disciplines: string;
  isIndex?: boolean;
};

const CELLS: Cell[] = [
  { slug: "sprouts-farmers-market", line1: "sprouts", line2: "farmers market", disciplines: "print design · motion design · art direction" },
  { slug: "corita-art-center", line1: "corita", line2: "art center", disciplines: "print design · social media · art direction" },
  { slug: "socal-earth", line1: "socal", line2: "earth", disciplines: "visual identity · brand strategy · web design" },
  { slug: "valley-strong-credit-union", line1: "valley strong", line2: "credit union", disciplines: "visual identity · style guide · marketing" },
  { slug: "forced-perspective", line1: "forced", line2: "perspective", disciplines: "artwork · commentary · visual identity" },
  { slug: "other", line1: "other", line2: "work", disciplines: "posters · commentary · visual identity", isIndex: true },
];

// artboard coords — divider sits at x956; columns must stop short of it
const DIVIDER_X = 956;
const LEFT_X = 184;
const LEFT_W = DIVIDER_X - LEFT_X - 20; // leaves a gap before the divider
const RIGHT_X = 1010;
const RIGHT_W = 1877 - RIGHT_X - 20; // stops short of the artboard's right margin

// EVEN row heights: 3 rows. All y-values below are LOCAL to this Stage
// (start at 0), NOT the master artboard's absolute y — a Stage's <Place>
// children are positioned relative to its own top, so using the artboard's
// absolute y2587 directly here pushed the whole grid ~2600 units below its
// container and produced a huge blank gap. Keep it local; only x stays in
// artboard-absolute terms since Stage width tracks the full page width.
const GRID_LOCAL_HEIGHT = 1595; // same span the sketch's grid occupied
const ROW_H = GRID_LOCAL_HEIGHT / 3;
const RULES = [0, 1, 2, 3].map((i) => i * ROW_H);

function Cell({ cell, widthUnits }: { cell: Cell; widthUnits: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const vid = cell.isIndex ? null : HOVER_VIDEO[cell.slug];
  const href = cell.isIndex ? "/work" : `/work/${cell.slug}`;

  const play = () => vid && videoRef.current?.play().catch(() => {});
  const stop = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // Text must fit inside the white box's own horizontal padding
  const textMaxW = widthUnits * 0.7;

  return (
    <Link
      href={href}
      onMouseEnter={play}
      onMouseLeave={stop}
      className="group absolute inset-0 block"
    >
      {/* Video fills the cell on hover, with a slow zoom-in (Ken Burns) */}
      {vid && (
        <video
          ref={videoRef}
          src={vid}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover opacity-0 scale-100 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-700 ease-out"
        />
      )}
      {/* Title + disciplines — centered both axes, consistent white box on
          EVERY tile (matches the Sprouts hover-on benchmark treatment) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/95 group-hover:bg-white transition-colors duration-300 px-[calc(var(--u)*40)] py-[calc(var(--u)*32)] flex flex-col items-center text-center">
          <FitText maxWidthUnits={textMaxW} fontSizeUnits={110} className="lowercase leading-[0.9] text-center">
            {cell.line1}
            <br />
            {cell.line2}
          </FitText>
          <FitText
            maxWidthUnits={textMaxW}
            fontSizeUnits={34}
            className="italic lowercase mt-[calc(var(--u)*20)] text-center"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {cell.disciplines}
          </FitText>
        </div>
      </div>
    </Link>
  );
}

export default function Projects() {
  return (
    <Stage heightUnits={GRID_LOCAL_HEIGHT + 20} className="overflow-hidden">
      {/* red-note annotation is a NOTE and intentionally NOT rendered */}

      {/* Horizontal rules full width x36–1877, EVEN spacing */}
      {RULES.map((y) => (
        <Place key={y} x={36} y={y} w={1841} className="z-20">
          <div style={{ height: "calc(var(--u) * 6)", background: "var(--color-ink)" }} />
        </Place>
      ))}
      {/* Vertical center divider spanning the full grid */}
      <Place x={DIVIDER_X} y={0} w={6} h={GRID_LOCAL_HEIGHT} className="z-20">
        <div className="w-full h-full" style={{ background: "var(--color-ink)" }} />
      </Place>

      {/* Cells */}
      {CELLS.map((cell, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? LEFT_X : RIGHT_X;
        const w = col === 0 ? LEFT_W : RIGHT_W;
        const y = RULES[row] + 20;
        const h = ROW_H - 40;
        return (
          <Place key={cell.slug} x={x} y={y} w={w} h={h} className="z-10">
            <div className="relative w-full h-full overflow-hidden">
              <Cell cell={cell} widthUnits={w} />
            </div>
          </Place>
        );
      })}
    </Stage>
  );
}
