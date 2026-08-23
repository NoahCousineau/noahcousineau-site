"use client";

import { useRef } from "react";
import Link from "next/link";
import { Stage, Place } from "./Stage";
import { HOVER_VIDEO } from "@/lib/projects";
import ProjectFrameAnimation from "./ProjectFrameAnimation";
import { PROJECT_OBJECTS } from "@/lib/projectObjects";

/* Placement inside the tile, in artboard units, matched to Noah's mockup:
 * the object sits low and right, its base landing on the row's bottom rule.
 *
 * heightFraction above is NOT eyeballed per object. Every animation is built
 * so its final frame matches the apple's size (see
 * tools/project-animations/align_frames.py), and the fraction is then derived
 * from each set's canvas height relative to the apple's. That is what makes a
 * tall flame and a round heart read as "about the size of the apple" — Noah's
 * words — instead of one axis agreeing while the other runs away. */
const OBJECT_RIGHT_UNITS = 34;
const OBJECT_BOTTOM_UNITS = 0;

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
  /** Explicit destination override. Needed for the "more work" tile, whose
   * `slug` ("other") is a display-only id that doesn't match its real
   * project route — see the href note on CELLS below. */
  href?: string;
};

const CELLS: Cell[] = [
  { slug: "sprouts-farmers-market", line1: "sprouts", line2: "farmers market", disciplines: "print design · motion design · art direction" },
  { slug: "corita-art-center", line1: "corita", line2: "art center", disciplines: "print design · social media · art direction" },
  { slug: "socal-earth", line1: "socal", line2: "earth", disciplines: "visual identity · brand strategy · web design" },
  { slug: "cultural-olympiad-poster", line1: "cultural", line2: "olympiad", disciplines: "poster · motion design · design contest" },
  { slug: "valley-strong-credit-union", line1: "valley strong", line2: "credit union", disciplines: "visual identity · style guide · marketing" },
  // BUGFIX (2026-08-20, per Noah: "make sure the 'more work' link on the
  // home page goes to the correct more work page"): this tile used to rely
  // on `isIndex` alone, which routed it to /work (the generic project
  // INDEX listing) rather than to the real "More Work" project page at
  // /work/more-work — a genuine page in projects.json with its own grid
  // content. `isIndex` is kept only for its non-routing behavior (it
  // suppresses the slug-based hover video lookup); the destination is now
  // stated explicitly here.
  { slug: "other", line1: "more", line2: "work", disciplines: "artwork · commentary · visual identity", isIndex: true, href: "/work/more-work" },
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
  // The object is thrown around inside the tile. The <Link> is absolutely
  // positioned, so it is the offsetParent the physics measures against.
  const tileRef = useRef<HTMLAnchorElement>(null);

  // An object animation replaces the hover video entirely on tiles that have
  // one; tiles still waiting on their frames keep the video.
  // "other" is the more-work tile's display id, not its route; the shared
  // map is keyed by real slug so a project page can find its own object.
  const objectAnimation = PROJECT_OBJECTS[cell.slug === "other" ? "more-work" : cell.slug];

  // Handle video for swapped projects
  // "cultural-olympiad" shows the ArtCenter video (forced perspective video)
  // "other" shows the Cultural Olympiad video
  let vid: string | null = null;

  if (objectAnimation) {
    vid = null;
  } else if (cell.slug === "cultural-olympiad-poster") {
    vid = "/videos/Image_FB_Cousineau_Noah_ArtCenter College of Design.mp4";  // Forced perspective video
  } else if (cell.slug === "other") {
    vid = "/videos/Final Thesis Video.mp4";  // Cultural Olympiad video
  } else if (!cell.isIndex) {
    vid = HOVER_VIDEO[cell.slug] || null;
  }
  const href = cell.href ?? (cell.isIndex ? "/work" : `/work/${cell.slug}`);
  
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
      ref={tileRef}
      href={href}
      // Anchors are natively draggable, and dragging one raises the browser's
      // own link ghost — the title-and-URL chip Noah caught in a screenshot
      // while dragging the apple. The object stops its own dragstart too, but
      // the gesture starts on the anchor, so it has to be refused here.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
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
        <div className="bg-[color:var(--color-paper)] flex flex-col items-start text-left justify-center" style={{ width: `calc(var(--u) * ${BOX_WIDTH})`, height: `calc(var(--u) * ${BOX_HEIGHT})`, padding: `calc(var(--u) * 30)` }}>
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
      {/* The object sits ABOVE the white title box so it reads as resting in
          front of it, and is the last child so it wins the hit test for its
          own clicks. */}
      {objectAnimation && (
        <ProjectFrameAnimation
          animation={objectAnimation}
          containerRef={tileRef}
          className="z-10 cursor-grab active:cursor-grabbing"
          style={{
            width: `calc(var(--u) * ${
              (heightUnits * objectAnimation.heightFraction * objectAnimation.width) /
              objectAnimation.height
            })`,
            right: `calc(var(--u) * ${OBJECT_RIGHT_UNITS})`,
            bottom: `calc(var(--u) * ${OBJECT_BOTTOM_UNITS})`,
          }}
        />
      )}
    </Link>
  );
}

export default function Projects() {
  return (
    <Stage heightUnits={GRID_LOCAL_HEIGHT} className="overflow-hidden">
      {/* red-note annotation is a NOTE and intentionally NOT rendered */}

      {/* Horizontal rules, FULL BLEED. Noah: "extend the horizontal grid
          lines to the edges of the browser window. This will make it feel as
          if the items are fully encased within each grid cell." They used to
          stop at the columns (38u..1880u), leaving the page's side gutters
          open and the rows reading as floating bands rather than as a table.
          The cells themselves are unchanged — only the rules run out to the
          artboard edge, which IS the window edge at every width up to the
          1920 cap the whole page shares. */}
      {RULES.map((y) => (
        <Place key={y} x={0} y={y} w={1920} className="z-20">
          <div style={{ height: "calc(var(--u) * 6)", background: "var(--color-ink)" }} />
        </Place>
      ))}
      {/* Vertical center divider spanning the full grid height — the grid's
          content (cells) fills the Stage exactly (GRID_LOCAL_HEIGHT), so
          this reaches the footer bar's top edge with zero gap. */}
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
