"use client";

import Link from "next/link";
import Image from "next/image";
import { Stage, Place, uFont } from "./Stage";
import PeekingHead from "./PeekingHead";
import FallenHand from "./FallenHand";
import { useRef } from "react";

/**
 * Global footer (on every page — rendered once in layout.tsx). Rebuilt per
 * Noah's "Revised footer.svg" (~/Desktop/portfolio/design/01-homepage/
 * exports/Revised footer.svg), which REPLACES the Mickey Watch clock
 * feature here — the clock is being moved to a larger, separate feature on
 * the About Me page instead (not built yet — future task).
 *
 * Every position below is read directly from the SVG's own coordinates
 * (1920 x 554.15 viewBox) and expressed in the site's artboard-unit system
 * (Stage/Place, 1 unit = 1/1920 of the container width) so it's pixel-exact
 * to the sketch at every viewport width, matching how every other section
 * of the site (Hero/Description/Projects) is already built.
 *
 * Layout:
 *   - Large "Cousineau" wordmark near the top, same asset as the old small
 *     footer logo, scaled to the sketch's exact bbox (x 72.68-1847.3,
 *     y 41.44-338.6 of the 1920x554.15 box).
 *   - Bottom-left: 3 project link columns (2 stacked links each), evenly
 *     spaced with the same gap as the right-side info columns (per
 *     Noah's feedback: "same as what's seen on the right side columns")
 *     — x = 75.47 / 296.24 / 516.99 (220.77u gap between each, matching
 *     the right columns' 1409.32→1630.09 gap).
 *   - Bottom-right: 2 info columns (about+résumé, then email+phone), at
 *     x = 1409.32 / 1630.09.
 *   - EVERY rule is the SAME length — the email link's rule length
 *     (204.22 units), per Noah's explicit request (the sketch itself had
 *     three different rule lengths across columns, which he flagged as an
 *     inconsistency to fix rather than reproduce).
 *
 * Project links map to real slugs in src/content/projects.json (see
 * src/lib/projects.ts).
 */

const STAGE_HEIGHT = 554.15;
const RULE_WIDTH = 204.22; // = the sketch's email-column rule length

type LinkItem = { label: string; href: string };

const COLUMNS: { x: number; items: [LinkItem, LinkItem] }[] = [
  {
    x: 75.47,
    items: [
      { label: "sprouts farmers market", href: "/work/sprouts-farmers-market" },
      { label: "corita art center", href: "/work/corita-art-center" },
    ],
  },
  {
    x: 296.24,
    items: [
      { label: "socal earth", href: "/work/socal-earth" },
      { label: "cultural olympiad", href: "/work/cultural-olympiad-poster" },
    ],
  },
  {
    x: 516.99,
    items: [
      { label: "valley strong credit union", href: "/work/valley-strong-credit-union" },
      { label: "more work", href: "/work/more-work" },
    ],
  },
  {
    x: 1409.32,
    items: [
      { label: "about me", href: "/about" },
      { label: "résumé", href: "/assets/_documents/noah-cousineau-resume.pdf" },
    ],
  },
  {
    x: 1630.09,
    items: [
      { label: "noah@noahcousineau.com", href: "mailto:noah@noahcousineau.com" },
      { label: "(862) 520-8040", href: "tel:+18625208040" },
    ],
  },
];

// Row y-positions (top of the text glyphs, i.e. baseline minus an ascender
// allowance) and rule y-positions, from the sketch's text baselines
// (449 / 497.95) and rule y's (459.49 / 507.4-507.08, unified to one value
// per row since Noah wants every rule visually consistent).
const ROW1_TEXT_Y = 431.5; // baseline 449 minus ~17.5u ascender allowance
const ROW1_RULE_Y = 459.49;
const ROW2_TEXT_Y = 480.5; // baseline 497.95 minus ~17.5u
const ROW2_RULE_Y = 507.4;

/*
 * FULL-PAGE FOOTER REVEAL (2026-08-20, per Noah: "I want an interaction
 * where the footer encompasses the whole page when you scroll down to it...
 * Keep the formatting of the footer the same.")
 *
 * Built as a curtain rather than an animation: the footer is FIXED to the
 * viewport at full height, sitting behind the page content, which carries
 * an opaque background and a higher z-index (see .site-content in
 * globals.css). Scrolling to the end slides the content up and off,
 * uncovering a footer that already fills the screen — so it "encompasses
 * the whole page" the moment it's reached, with no scaling, no pinning,
 * and nothing to keep in sync with Lenis. The spacer below reserves the
 * scroll distance that does the uncovering.
 *
 * The footer's own artboard block is untouched — same Stage, same
 * coordinates, same five link columns — just vertically centered inside
 * the taller black field, since its intrinsic height is width-driven
 * (554.15u) and can't fill a viewport on its own. That keeps the
 * formatting identical, as asked.
 *
 * Reduced-motion and very short viewports both degrade gracefully: this is
 * a static layout, so there's no motion to suppress — worst case the
 * footer simply shows as a tall black panel.
 */
export default function Footer({ showFallenHand = false }: { showFallenHand?: boolean }) {
  // The fixed footer can't drive a ScrollTrigger of its own, so the spacer
  // — which does scroll — is what tells the fallen hand it has arrived.
  const spacerRef = useRef<HTMLDivElement>(null);
  return (
    <>
      {/* Reserves the scroll distance through which the content uncovers
          the fixed footer beneath it. */}
      <div ref={spacerRef} aria-hidden className="w-full" style={{ height: "100svh" }} />
      {/* LAYOUT (2026-08-20, per Noah: "Make it so the 'Cousineau' logo is
          near the top with the page information below the logo. Then at the
          bottom of the browser window, I want my head to just peek out from
          the bottom.")
          The wordmark + link columns are one artboard block, now anchored
          near the TOP of the viewport instead of vertically centred in it,
          with the head occupying the bottom edge. Achieved by aligning the
          block to the start and giving it a top inset — the block's own
          internal coordinates are untouched, so the footer's formatting
          stays exactly as designed. */}
      <footer className="fixed bottom-0 left-0 w-full bg-[color:var(--color-ink)] text-[color:var(--color-paper)] flex flex-col justify-start z-0 overflow-hidden" style={{ height: "100svh" }}>
      <div
        className="relative mx-auto max-w-[1920px] w-full h-full"
        style={{ containerType: "inline-size", ["--u" as string]: "calc(100cqw / 1920)", paddingTop: "calc(var(--u) * 70)" }}
      >
        {/* Scenery at the bottom edge; pointer-events off so it can never
            steal a click from the link columns above it. */}
        <PeekingHead />
        {showFallenHand && <FallenHand triggerRef={spacerRef} />}
        <Stage heightUnits={STAGE_HEIGHT}>
          {/* Large Cousineau wordmark — same asset as the old small footer
              logo, scaled to the sketch's exact bbox. */}
          <Place x={72.68} y={41.44} w={1774.62}>
            <Link href="/" className="block">
              <Image
                src="/assets/home/cousineau-logo-white.svg"
                alt="Cousineau"
                width={711}
                height={119}
                loading="eager"
                className="w-full h-auto"
              />
            </Link>
          </Place>

          {/* Five link columns, each 2 stacked links + rule, positioned at
              their exact sketch x-coordinates. */}
          {COLUMNS.map((col) => (
            <div key={col.x}>
              <Place x={col.x} y={ROW1_TEXT_Y}>
                <Link
                  href={col.items[0].href}
                  target={col.items[0].href.startsWith("http") ? "_blank" : undefined}
                  rel={col.items[0].href.startsWith("http") ? "noreferrer" : undefined}
                  className="lowercase whitespace-nowrap hover:opacity-60 transition-opacity block"
                  style={{ fontFamily: "var(--font-sans)", fontSize: uFont(17.9) }}
                >
                  {col.items[0].label}
                </Link>
              </Place>
              <Place x={col.x} y={ROW1_RULE_Y} w={RULE_WIDTH}>
                <div className="w-full bg-[color:var(--color-paper)]" style={{ height: uFont(2) }} />
              </Place>

              <Place x={col.x} y={ROW2_TEXT_Y}>
                <Link
                  href={col.items[1].href}
                  target={col.items[1].href.startsWith("http") || col.items[1].href.endsWith(".pdf") ? "_blank" : undefined}
                  rel={col.items[1].href.startsWith("http") || col.items[1].href.endsWith(".pdf") ? "noreferrer" : undefined}
                  className="lowercase whitespace-nowrap hover:opacity-60 transition-opacity block"
                  style={{ fontFamily: "var(--font-sans)", fontSize: uFont(17.9) }}
                >
                  {col.items[1].label}
                </Link>
              </Place>
              <Place x={col.x} y={ROW2_RULE_Y} w={RULE_WIDTH}>
                <div className="w-full bg-[color:var(--color-paper)]" style={{ height: uFont(2) }} />
              </Place>
            </div>
          ))}
        </Stage>
      </div>
      </footer>
    </>
  );
}
