"use client";

import Link from "next/link";
import Image from "next/image";
import { Stage, Place, uFont } from "./Stage";

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

export default function Footer() {
  return (
    <footer className="bg-[color:var(--color-ink)] text-[color:var(--color-paper)] w-full relative">
      <div
        className="mx-auto max-w-[1920px]"
        style={{ containerType: "inline-size", ["--u" as string]: "calc(100cqw / 1920)" }}
      >
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
  );
}
