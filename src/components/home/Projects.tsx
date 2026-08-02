"use client";

import { useRef } from "react";
import Link from "next/link";
import { Stage, Place } from "./Stage";
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

// artboard coords — make columns 918u wide, symmetrical around divider
const DIVIDER_X = 956;
const CELL_WIDTH = 918;
const LEFT_X = DIVIDER_X - CELL_WIDTH;  // 38 (positions left cell to end at divider)
const RIGHT_X = DIVIDER_X + 6;  // divider is 6u wide, right cell starts after it
const LEFT_W = CELL_WIDTH;  // 918u
const RIGHT_W = CELL_WIDTH;  // 918u (same width as left)

// EVEN row heights: 3 rows. All y-values below are LOCAL to this Stage
// (start at 0), NOT the master artboard's absolute y.
const GRID_LOCAL_HEIGHT = 1575; // same span the sketch's grid occupied (reduced to avoid the line above footer)
const ROW_H = GRID_LOCAL_HEIGHT / 3;
const RULES = [0, 1, 2].map((i) => i * ROW_H); // Only 3 rules (top of each row), not 4

function Cell({ cell, widthUnits, heightUnits }: { cell: Cell; widthUnits: number; heightUnits: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // "other" (index project) gets the ArtCenter video; regular projects use HOVER_VIDEO
  const vid = cell.slug === "other" 
    ? "/videos/Image_FB_Cousineau_Noah_ArtCenter College of Design.mp4"
    : (cell.isIndex ? null : HOVER_VIDEO[cell.slug]);
  const href = cell.isIndex ? "/work" : `/work/${cell.slug}`;
  
  // Sprouts gets extra zoom (2x = 220%)
  const isSpouts = cell.slug === "sprouts-farmers-market";

  const play = () => {
    if (vid && videoRef.current) {
      videoRef.current.currentTime = videoRef.current.duration * 0.5; // start halfway
      videoRef.current.play().catch((err) => console.error("Video play error:", err));
    }
  };
  const stop = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // Fixed white box size: 80% grid cell width, 60% grid cell height
  const BOX_WIDTH = widthUnits * 0.8;   // 80% of grid cell width
  const BOX_HEIGHT = heightUnits * 0.6;  // 60% of grid cell height

  return (
    <Link
      href={href}
      className="group absolute inset-0 block w-full h-full"
      onMouseEnter={play}
      onMouseLeave={stop}
    >
      {/* Video fills the entire grid cell width and height, edge-to-edge.
          object-cover maintains aspect ratio while filling the space. */}
      {vid && (
        <video
          ref={videoRef}
          src={vid}
          muted
          loop
          playsInline
          preload="metadata"
          className={`absolute inset-0 w-full h-full object-cover opacity-0 scale-100 group-hover:opacity-100 ${isSpouts ? "group-hover:scale-[2.2]" : "group-hover:scale-110"} transition-[opacity,transform] duration-700 ease-out`}
        />
      )}
      {/* Title + disciplines — centered inside white box, centered in grid cell.
          Box is 50% width × 70% height of the grid cell. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white flex flex-col items-start text-left justify-center" style={{ width: `calc(var(--u) * ${BOX_WIDTH})`, height: `calc(var(--u) * ${BOX_HEIGHT})`, padding: `calc(var(--u) * 30)` }}>
          {/* Title: fixed 75u font, no variation */}
          <div className="lowercase leading-[1.1] text-left" style={{ fontFamily: "var(--font-sans)", fontSize: `calc(var(--u) * 75)`, width: `calc(var(--u) * ${BOX_WIDTH - 60})` }}>
            {cell.line1}
            <br />
            {cell.line2}
          </div>
          {/* Subtitle: fixed 20u italic serif, no variation, single line */}
          <div className="italic lowercase mt-[calc(var(--u)*12)] text-left whitespace-nowrap" style={{ fontFamily: "var(--font-serif)", fontSize: `calc(var(--u) * 20)`, width: `calc(var(--u) * ${BOX_WIDTH - 60})` }}>
            {cell.disciplines}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Projects() {
  return (
    <Stage heightUnits={GRID_LOCAL_HEIGHT + 20} className="overflow-hidden">
      {/* red-note annotation is a NOTE and intentionally NOT rendered */}

      {/* Horizontal rules spanning left column to divider to right column edge */}
      {RULES.map((y) => (
        <Place key={y} x={LEFT_X} y={y} w={LEFT_W + 6 + RIGHT_W} className="z-20">
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
        const y = RULES[row];  // Start at the rule line, no offset
        const h = ROW_H;  // Full row height, no reduction
        return (
          <Place key={cell.slug} x={x} y={y} w={w} h={h} className="z-10">
            <div className="relative w-full h-full overflow-hidden">
              <Cell cell={cell} widthUnits={w} heightUnits={h} />
            </div>
          </Place>
        );
      })}
    </Stage>
  );
}
