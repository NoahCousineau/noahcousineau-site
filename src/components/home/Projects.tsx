"use client";

import { useRef } from "react";
import Link from "next/link";
import { Stage, Place, uFont } from "./Stage";
import { HOVER_VIDEO } from "@/lib/projects";

/**
 * PROJECTS — master slice y2587–3738+. Editorial TABLE grid:
 *  - thick black rules full-width at y2587 / 3192 / 3738 (row separators)
 *  - vertical divider down the center (x≈956)
 *  - each cell: big bold lowercase title (two lines) + italic-serif discipline tags
 *  - HOVER: video fills the whole cell; title+tags get a white box for legibility
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

// artboard coords
const LEFT_X = 184;
const RIGHT_X = 1010;
const CELL_W = 780;
const RULES = [2587, 3192, 3738, 4160]; // horizontal rules (4th closes 3rd row)

function Cell({ cell }: { cell: Cell }) {
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

  return (
    <Link
      href={href}
      onMouseEnter={play}
      onMouseLeave={stop}
      className="group absolute inset-0 block"
    >
      {/* Video fills the cell on hover */}
      {vid && (
        <video
          ref={videoRef}
          src={vid}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        />
      )}
      {/* Title + disciplines — get a white box on hover for legibility */}
      <div className="absolute left-0 top-[8%] max-w-[92%] group-hover:bg-white transition-colors duration-300 px-[calc(var(--u)*10)] py-[calc(var(--u)*8)]">
        <span className="block font-bold lowercase leading-[0.9]" style={{ fontSize: uFont(120) }}>
          {cell.line1}
          <br />
          {cell.line2}
        </span>
        <span
          className="block italic lowercase mt-[calc(var(--u)*20)]"
          style={{ fontSize: uFont(37), fontFamily: "var(--font-serif)" }}
        >
          {cell.disciplines}
        </span>
      </div>
    </Link>
  );
}

export default function Projects() {
  return (
    <Stage heightUnits={4220} className="overflow-hidden">
      {/* red-note annotation is a NOTE and intentionally NOT rendered */}

      {/* Horizontal rules full width x36–1877 */}
      {RULES.map((y) => (
        <Place key={y} x={36} y={y} w={1841} className="z-20">
          <div style={{ height: "calc(var(--u) * 6)", background: "var(--color-ink)" }} />
        </Place>
      ))}
      {/* Vertical center divider spanning the full grid (first→last rule) */}
      <Place x={956} y={2587} w={6} h={4160 - 2587} className="z-20">
        <div className="w-full h-full" style={{ background: "var(--color-ink)" }} />
      </Place>

      {/* Cells */}
      {CELLS.map((cell, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? LEFT_X : RIGHT_X;
        const y = RULES[row] + 20;
        const h = (RULES[row + 1] ?? 3738 + 400) - RULES[row] - 40;
        return (
          <Place key={cell.slug} x={x} y={y} w={CELL_W} h={h} className="z-10">
            <div className="relative w-full h-full overflow-hidden">
              <Cell cell={cell} />
            </div>
          </Place>
        );
      })}
    </Stage>
  );
}
