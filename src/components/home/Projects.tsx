"use client";

import { useRef } from "react";
import { videoSrc } from "@/lib/videoSrc";
import Link from "next/link";
import { Stage, Place } from "./Stage";
import { useIsPhone } from "@/lib/useIsPhone";
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
// The rule y-positions are derived per layout in the component — three
// rows on a desktop, one per cell on a phone.

/*
 * ONE CELL PER ROW ON A PHONE (2026-08-25).
 *
 * Noah: "Have the grid content stacked vertically, so only one cell each.
 * Scale the content in the grids accordingly."
 *
 * A phone gets six rows instead of three, no centre divider, and cells that
 * run nearly the full artboard width. The row height is the part that has to
 * be chosen rather than derived: `--u` is the viewport width over 1920, so on
 * a 390px screen the whole artboard is 390px wide and a cell at 1844 units is
 * 375px across. 1300 units of height makes each tile 264px tall — a landscape
 * card at roughly 1.42:1, which is what "scale the content accordingly" needs
 * to mean when the artboard and the screen are the same width. Halving the
 * row height to keep the desktop proportion would give 66px tall tiles.
 */
/*
 * ...ON A NARROWER ARTBOARD, which is what makes "scale the content
 * accordingly" a single change rather than a dozen. Every size inside a tile
 * — the 75-unit title, the 20-unit disciplines line, the clay object, the
 * white box's 80%/60% — is in artboard units, so declaring the phone
 * artboard to be 1000 units instead of 1920 enlarges all of them together
 * and in proportion. Stacking the cells on the 1920 artboard and leaving it
 * there was tried first: the tiles were the right shape and the titles came
 * out at 15px in a 264px-tall cell, mostly empty.
 *
 * Matches the hero, which reaches for the same 1000 for the same reason —
 * see heroLayout.ts.
 */
const PHONE_ARTBOARD = 1000;
const PHONE_MARGIN = 20;
const PHONE_CELL_W = PHONE_ARTBOARD - PHONE_MARGIN * 2;
const PHONE_ROW_H = 680;
/* 2026-08-25, Noah: "on the home page project grid for mobile, let's increase
 * the size of the project titles and subtext by 1.5x. Scoot the project title
 * and subcopy up closer to the top left of the grid space as well."
 *
 * THE BOX HAS TO GROW WITH THE TYPE, and that is not cosmetic — it is what
 * stops the change breaking the titles. The white box is 80% of the cell with
 * 30 units of padding a side, so the text column is 708 units. Measured with
 * canvas at the new size, the widest title line ("farmers market") wants 709.
 * One unit short: every other title would have been fine and that one would
 * have silently wrapped to three lines. On a phone the box is invisible
 * anyway — white on white, and there is no hover video for it to sit over —
 * so it runs the full width of the cell here and the text column becomes 900.
 *
 * Widest at 1.5x, for whoever changes this next: title 709u, disciplines
 * 550u. */
const PHONE_TITLE_SCALE = 1.5;
/* The disciplines line gets a bit more than the title does (2026-08-29):
 * "on the mobile home screen in the project grid, let's increase the size of
 * the descriptive text by just a bit." Only the subtext, so the title is
 * untouched at 1.5x. 30 -> 37.5 units, 11.7px -> 14.6px at 390. Measured
 * against the column it has to fit: the widest disciplines line wants 550
 * units at 1.5x, so 687 at 1.875x, against the 900-unit text column -- it
 * stays on one line, which `whitespace-nowrap` would otherwise have forced
 * out of the box. */
const PHONE_SUB_SCALE = 1.5 * 1.25;
const PHONE_BOX_W_FRAC = 1;
/** A little more air under the rule that caps each cell than at the sides. */
const PHONE_BOX_PAD = 30;
const PHONE_BOX_PAD_TOP = 44;

function Cell({ cell, widthUnits, heightUnits, phone }: { cell: Cell; widthUnits: number; heightUnits: number; phone: boolean }) {
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
  const BOX_WIDTH = widthUnits * (phone ? PHONE_BOX_W_FRAC : 0.8);
  const BOX_HEIGHT = heightUnits * 0.6;  // 60% of grid cell height
  const BOX_PAD = phone ? PHONE_BOX_PAD : 30;
  const BOX_PAD_TOP = phone ? PHONE_BOX_PAD_TOP : 30;
  const TITLE_UNITS = 75 * (phone ? PHONE_TITLE_SCALE : 1);
  const SUB_UNITS = 20 * (phone ? PHONE_SUB_SCALE : 1);
  const TEXT_W = BOX_WIDTH - BOX_PAD * 2;

  return (
    <Link
      /* Not prefetched — see the note in Footer.tsx: a project's RSC payload
         drags its priority images along, and the gate makes it useless. */
      prefetch={false}
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
          src={videoSrc(vid)}
          muted
          loop
          playsInline
          preload="metadata"
          className={`absolute inset-0 w-full h-full object-cover opacity-0 scale-100 group-hover:opacity-100 ${isSpouts ? "group-hover:scale-[2.2]" : "group-hover:scale-110"} transition-[opacity,transform] duration-700 ease-out`}
        />
      )}
      {/* Title + disciplines — centered inside white box, centered in grid cell.
          Box is 50% width × 70% height of the grid cell. */}
      {/* TOP-LEFT ON A PHONE, centred everywhere else — "scoot the project
          title and subcopy up closer to the top left of the grid space".
          Both axes move: the flex container stops centring the box in the
          cell, and the box stops centring the type in itself. */}
      <div className={`absolute inset-0 flex ${phone ? "items-start justify-start" : "items-center justify-center"}`}>
        <div
          className={`bg-[color:var(--color-paper)] flex flex-col items-start text-left ${phone ? "justify-start" : "justify-center"}`}
          style={{
            width: `calc(var(--u) * ${BOX_WIDTH})`,
            height: `calc(var(--u) * ${BOX_HEIGHT})`,
            padding: `calc(var(--u) * ${BOX_PAD_TOP}) calc(var(--u) * ${BOX_PAD}) calc(var(--u) * ${BOX_PAD})`,
          }}
        >
          {/* Title: 75u, x1.5 on a phone */}
          <div className="lowercase leading-[1.1] text-left" style={{ fontFamily: "var(--font-sans)", fontSize: `calc(var(--u) * ${TITLE_UNITS})`, width: `calc(var(--u) * ${TEXT_W})` }}>
            {cell.line1}
            <br />
            {cell.line2}
          </div>
          {/* Subtitle: 20u italic serif, single line, x1.5 on a phone */}
          <div className="italic lowercase mt-[calc(var(--u)*12)] text-left whitespace-nowrap" style={{ fontFamily: "var(--font-serif)", fontSize: `clamp(10px, calc(var(--u) * ${SUB_UNITS}), ${SUB_UNITS}px)`, width: `calc(var(--u) * ${TEXT_W})` }}>
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
  const phone = useIsPhone();
  const rowH = phone ? PHONE_ROW_H : ROW_H;
  const rowCount = phone ? CELLS.length : 3;
  const gridHeight = phone ? rowH * rowCount : GRID_LOCAL_HEIGHT;
  // A rule at the top of every row, as on desktop — six of them now, not
  // three — plus one at the very bottom so the last cell is closed off
  // rather than running into the footer.
  const rules = Array.from({ length: rowCount }, (_, i) => i * rowH);

  const stage = (
    <Stage heightUnits={gridHeight} className="overflow-hidden">
      {/* red-note annotation is a NOTE and intentionally NOT rendered */}

      {/* Horizontal rules, FULL BLEED. Noah: "extend the horizontal grid
          lines to the edges of the browser window. This will make it feel as
          if the items are fully encased within each grid cell." They used to
          stop at the columns (38u..1880u), leaving the page's side gutters
          open and the rows reading as floating bands rather than as a table.
          The cells themselves are unchanged — only the rules run out to the
          edge.

          TO THE WINDOW'S EDGE, NOT THE ARTBOARD'S (2026-09-01). Noah, on a
          monitor wider than 1920: "there were large gaps on the sides of the
          main content... this should go all the way across." Those are the
          same thing below the 1920 cap and differ by 320px each side at 2560,
          which is exactly the gap he saw. Placed directly rather than through
          <Place>, because Place writes an inline left/width that a class
          cannot override — see .rule-bleed in globals.css. */}
      {rules.map((y) => (
        <div
          key={y}
          className="absolute rule-bleed z-20"
          style={{
            top: `calc(var(--u) * ${y})`,
            height: "calc(var(--u) * 6)",
            background: "var(--color-ink)",
          }}
        />
      ))}
      {/* Vertical center divider spanning the full grid height — the grid's
          content (cells) fills the Stage exactly (GRID_LOCAL_HEIGHT), so
          this reaches the footer bar's top edge with zero gap. */}
      {/* No centre divider on a phone — there is only one column to divide. */}
      {!phone && (
        <Place x={DIVIDER_X} y={0} w={6} h={GRID_LOCAL_HEIGHT} className="z-20">
          <div className="w-full h-full" style={{ background: "var(--color-ink)" }} />
        </Place>
      )}

      {/* Cells */}
      {CELLS.map((cell, i) => {
        const col = phone ? 0 : i % 2;
        const row = phone ? i : Math.floor(i / 2);
        const x = phone ? PHONE_MARGIN : col === 0 ? LEFT_X : RIGHT_X;
        const w = phone ? PHONE_CELL_W : col === 0 ? LEFT_W : RIGHT_W;
        const y = rules[row];  // Start at the rule line, no offset
        const h = phone ? PHONE_ROW_H : ROW_H;  // Full row height, no reduction
        return (
          <Place key={cell.slug} x={x} y={y} w={w} h={h} className="z-10">
            <div className="relative w-full h-full overflow-hidden">
              <Cell cell={cell} widthUnits={w} heightUnits={h} phone={phone} />
            </div>
          </Place>
        );
      })}
    </Stage>
  );

  if (!phone) return stage;
  // Redeclaring `--u` on a wrapper keeps it local: the Description section
  // above and the footer below still inherit main's own 1920-based unit,
  // which is what their coordinates expect.
  return (
    <div style={{ ["--u" as string]: `calc(100cqw / ${PHONE_ARTBOARD})` }}>
      {stage}
    </div>
  );
}
