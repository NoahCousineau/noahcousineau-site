"use client";

import Link from "next/link";
import Image from "next/image";
import { Stage, Place, uFont, uFontMin } from "./Stage";
import PeekingHead, { PHONE_HEAD_WIDTH_UNITS } from "./PeekingHead";
import { useIsPhone, useIsCompact } from "@/lib/useIsPhone";
import FallenHand from "./FallenHand";
import { useRef } from "react";
import { THIRD_COLUMN_X } from "./footerLayout";

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
    x: THIRD_COLUMN_X,
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
// Shifted up another 20u on 2026-08-20 (Noah, second pass: "shift the links
// up a bit closer to the COUSINEAU logo as well") — all four by the same
// amount again, for the same reason as the LINK BLOCK move below: it
// preserves the two rows' internal spacing and their rules exactly as
// designed. Gap from the logo's own box bottom (318.6u, per the LINK BLOCK
// note) to the first link row is now ~34.9u, down from ~54.9u.
/*
 * PHONE (2026-08-25). Noah: "Have the links larger and left aligned in two
 * columns (one column for the content on the left, one column for the
 * content on the right)."
 *
 * The desktop footer is five columns of two — three of project links on the
 * left, two of contact details on the right. His two columns are that same
 * split, so nothing is regrouped: the three project columns stack into one
 * left-hand column of six links, and the two contact columns stack into one
 * right-hand column of four. Six rows and four rows down the same two x
 * positions, which is why this needs only a row index rather than a second
 * layout.
 *
 * The type more than doubles, 17.9 -> 40 units, and the rules widen to match.
 */
const PHONE_COL_X = [90, 1010];
const PHONE_ROW_H = 180;
/*
 * CEILINGS ON THE LINK BLOCK'S VERTICAL RUN (2026-08-29).
 *
 * The two-column arrangement now covers 390 up to 1199, and its row pitch and
 * top offset are artboard units — so the block grows three times as tall
 * across that band while the window does not. Audited at 1024 and 1199, the
 * sixth row had run down past the teeter-totter and "next project" was sitting
 * on top of the phone number.
 *
 * Capping both in px keeps the phone exactly as drawn (at 390 the unit terms
 * are 138px and 36.5px, well under these) and stops the block reaching the
 * bottom of the footer, which the see-saw owns. Chosen so the last row's rule
 * lands around 550px at 1199, against a plank that starts at 604.
 */
const PHONE_TOP_MAX_PX = 220;
const PHONE_ROW_MAX_PX = 58;
/** The row's y as a CSS expression rather than a unit count, so the ceilings
 *  above can apply. `row` is 0-5 down each column. */
const phoneRowY = (row: number) =>
  `calc(min(calc(var(--u) * ${PHONE_TOP_Y}), ${PHONE_TOP_MAX_PX}px)` +
  ` + ${row} * min(calc(var(--u) * ${PHONE_ROW_H}), ${PHONE_ROW_MAX_PX}px))`;
/* Below the wordmark, which itself starts clear of the corner controls —
 * 2026-08-25: "add enough space above the 'cousineau' logo so the toggle
 * switch doesn't conflict with the toggle switch." The toggle's box occupies
 * roughly y12-44px, and the footer's unit is 1/1920 of a 390px screen, so
 * 0.203px per unit: the wordmark's old y of 21.44 put it 4px from the top,
 * straight underneath. 320 units is 65px, below the control entirely. */
const PHONE_LOGO_Y = 320;
const PHONE_TOP_Y = 680;
/* 2026-08-25: "increase the size of the type. The longest piece of type
 * should be as wide as the column width." It was 40 units — 8px on a 390px
 * screen, which is where this started.
 *
 * The size is set FROM the longest label rather than estimated. Guessing
 * 0.42em per character put it at 90, and measuring the rendered result gave
 * "noah@noahcousineau.com" a width of 1020 units, running 110 past the
 * artboard's edge — an @ and a couple of dots carry more width than an
 * average taken over ordinary words predicts. At 90 it measures 1020, so the
 * size that makes it exactly one column wide is 90 x 820/1020 = 72. */
const PHONE_FONT = 72;
const PHONE_RULE_W = 820;

const ROW1_TEXT_Y = 353.5; // was 373.5, was 391.5, was 431.5 — see LINK BLOCK note below
const ROW1_RULE_Y = 381.49;
const ROW2_TEXT_Y = 402.5;
const ROW2_RULE_Y = 429.4;

/* LINK BLOCK (2026-08-20, per Noah: "Move the Cousineau logo up more so it
 * sits just below the top of the browser. Move all the links upwards with
 * it. Have the links just a little closer to the logo.")
 *
 * The logo rises because the footer's top padding drops to zero, leaving
 * only the wordmark's own 41.44u artboard offset between it and the top of
 * the window. Everything in the Stage travels with it.
 *
 * The links then close up independently: all four y-values moved up 40u,
 * which narrows the gap below the wordmark (its box ends at 338.6u) from
 * ~93u to ~53u. Moving all four by the same amount keeps the two rows'
 * internal spacing and their rules exactly as designed. */

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
export default function Footer({ nextProjectHref }: { nextProjectHref?: string }) {
  const phone = useIsPhone();
  /* BELOW 1200 THE LINKS USE THE PHONE'S TWO COLUMNS, phones included — see
   * the note on useIsCompact for the arithmetic. Five columns of legible type
   * do not fit under a 1180px window at any size, so this is a reflow rather
   * than a resize. Everything else in the footer still keys off `phone`. */
  const compact = useIsCompact();
  // The fixed footer can't drive a ScrollTrigger of its own, so the spacer
  // — which does scroll — is what tells the fallen hand it has arrived.
  const spacerRef = useRef<HTMLDivElement>(null);
  return (
    <>
      {/* Reserves the scroll distance through which the content uncovers
          the fixed footer beneath it. `dvh` (dynamic viewport height)
          rather than `svh` — see the NO GAP AT THE TOP note below; this
          just keeps the reserved scroll distance matched to the footer's
          own sizing so the reveal still completes at the right point.

          WITH A MARGIN OF SAFETY (2026-08-30). Noah: "the footer isn't
          showing on some pages."

          I could not reproduce it — the footer was checked on all nine
          routes at 390/900/1512, on 404s, through client-side navigation,
          across a live width sweep, at viewport heights from 400 to 1200, on
          displays up to 3440x1440, under reduced motion, and in both dev and
          a production build. It appeared every time. So this is hardening
          against the one failure mode the mechanism actually has rather than
          a fix for a diagnosed bug.

          That mode is `dvh` itself. On a phone the dynamic viewport CHANGES
          as the URL bar hides and shows, and this spacer is what buys the
          exact distance the curtain needs to travel. If the viewport is
          larger at the moment of measuring than when you arrive at the
          bottom, the reserved distance comes up short and the curtain's last
          rows stay parked over the top of the footer — which looks exactly
          like "the footer isn't showing".

          An extra 15vh costs nothing: past the point where the curtain has
          cleared, every further pixel of scroll is already fully-revealed
          footer, so the surplus is invisible. The plain `100vh` line before
          it is the fallback for anything that does not know `dvh`. The
          spacer's TOP is unmoved, so the fallen hand's trigger is unaffected. */}
      <div
        ref={spacerRef}
        aria-hidden
        className="w-full"
        style={{ height: "100vh", minHeight: "calc(100dvh + 15vh)" }}
      />
      {/* LAYOUT (2026-08-20, per Noah: "Make it so the 'Cousineau' logo is
          near the top with the page information below the logo. Then at the
          bottom of the browser window, I want my head to just peek out from
          the bottom.")
          The wordmark + link columns are one artboard block, now anchored
          near the TOP of the viewport instead of vertically centred in it,
          with the head occupying the bottom edge. Achieved by aligning the
          block to the start and giving it a top inset — the block's own
          internal coordinates are untouched, so the footer's formatting
          stays exactly as designed.

          NO GAP AT THE TOP (2026-08-20, second pass — Noah: "there's the
          slightest bit of white space at the very top of the footer").
          This used to be sized with `bottom-0` + `height: 100svh` — on any
          browser whose current viewport is taller than its OWN `svh` unit
          (Safari/Chrome's dynamic address bar: `svh` is measured with the
          toolbar SHOWN, i.e. the shortest state), the footer's height
          could fall short of the real viewport, and since only its BOTTOM
          edge was anchored, the shortfall opened up as a sliver at the
          TOP — showing the white page background behind it. `inset-0`
          anchors all four edges directly to the actual current viewport
          instead of computing a height from any vh-flavoured unit at all,
          so there's no unit to fall short regardless of toolbar state. */}
      <footer className="fixed inset-0 bg-[color:var(--color-ink)] text-[color:var(--color-paper)] flex flex-col justify-start z-0 overflow-hidden">
      <div
        className="artboard relative mx-auto max-w-[1920px] w-full h-full"
        style={{ containerType: "inline-size", ["--u" as string]: "calc(100cqw / 1920)" }}
      >
        {/* Scenery at the bottom edge; pointer-events off so it can never
            steal a click from the link columns above it. */}
        {/* Centred under the two right-hand link columns ("about me" /
            "résumé" at x1409.32 and email / phone at x1630.09, each
            RULE_WIDTH wide), i.e. the midpoint of 1409.32 and
            1630.09 + 204.22. */}
        {/* 2026-08-25, phones: "Have the head now at the bottom center of
            the phone. Have it larger than it currently is." Dead centre of
            the artboard rather than under the two right-hand link columns,
            and nearly twice the width. */}
        {/* On a PHONE PROJECT PAGE the hand takes the head's place — 2026-08-25:
            "On the mobile project page footers, let's remove the head. Have
            the hand replace the head." `nextProjectHref` is only ever passed
            on a project page, so it doubles as "is this a project footer",
            which is exactly the distinction being drawn. */}
        {/* THE HEAD STANDS DOWN WHEREVER THE TEETER-TOTTER STANDS UP
            (2026-08-29). Noah: "make sure the head or the hand isn't so large
            that it conflicts with the footer content."
            This was keyed on `phone`, so between 768 and 1199 a project page
            drew BOTH -- the head at the bottom right and the fallen hand
            reaching for a 'next project' that was 37px wide. Two focal points
            and neither at its intended size. `compact` is the same line the
            links reflow on, so the footer now has one composition per tier
            rather than two halves of different ones. */}
        {!(compact && nextProjectHref) && (
          <PeekingHead
            centerXUnits={phone ? 960 : (1409.32 + 1630.09 + RULE_WIDTH) / 2}
            widthUnits={phone ? PHONE_HEAD_WIDTH_UNITS : undefined}
          />
        )}
        {nextProjectHref && (
          <FallenHand triggerRef={spacerRef} nextHref={nextProjectHref} />
        )}
        {/* Taller on a phone: six stacked link rows instead of two, plus
            the wordmark above them. PHONE_TOP_Y + 6 rows + a rule. */}
        <Stage heightUnits={phone ? PHONE_TOP_Y + PHONE_ROW_H * 6 + 120 : STAGE_HEIGHT}>
          {/* Large Cousineau wordmark — same asset as the old small footer
              logo, scaled to the sketch's exact bbox. y nudged 41.44 ->
              21.44 on 2026-08-20 (Noah: "Shift the 'cousineau' logo up just
              a tad"). */}
          <Place x={72.68} y={phone ? PHONE_LOGO_Y : 21.44} w={1774.62}>
            <Link href="/" className="block">
              {/* The wordmark asset is a single #fff fill, so in dark mode —
                  where the footer's own background flips to white — it would
                  vanish into it. Inverting is enough precisely BECAUSE it is
                  one flat colour: white becomes black and there is nothing
                  else in the file to disturb. Cheaper and less brittle than
                  shipping and keeping in sync a second, black copy of the
                  same artwork. Noah: "What I would like is for the
                  'Cousineau' logo to be black now when in dark mode." */}
              <Image
                src="/assets/home/cousineau-logo-white.svg"
                alt="Cousineau"
                width={711}
                height={119}
                loading="eager"
                className="w-full h-auto footer-wordmark"
              />
            </Link>
          </Place>

          {/* Five link columns, each 2 stacked links + rule, positioned at
              their exact sketch x-coordinates. */}
          {compact
            ? COLUMNS.flatMap((col, ci) =>
                col.items.map((item, ii) => ({ item, ci, ii }))
              ).map(({ item, ci, ii }, flatIndex) => {
                // Columns 0-2 are the project links (left), 3-4 the contact
                // details (right); the running index within each side is what
                // gives the row.
                const right = ci >= 3;
                const row = right
                  ? (ci - 3) * 2 + ii
                  : ci * 2 + ii;
                /* THE RIGHT COLUMN HANGS OFF THE RIGHT EDGE (2026-08-29).
                   Noah: "for the in-between footers, make sure the column on
                   the right side is always on the right side of the browser
                   window."

                   Its x was 1010 artboard units, which is 205px on a 390
                   phone and 630px at 1199 — so as the band widened the column
                   drifted toward the middle and left a third of the window
                   empty beside it. Anchoring its RIGHT edge to the same inset
                   the left column uses for its LEFT edge makes the pair
                   symmetrical at every width, which is what "always on the
                   right side" means. The rule's own capped width is what the
                   column is offset by (see PHONE_RULE_W below). */
                const ruleW = `min(calc(var(--u) * ${PHONE_RULE_W}), 200px)`;
                const xCss = right
                  ? `calc(100% - ${ruleW} - var(--u) * ${PHONE_COL_X[0]})`
                  : undefined;
                const x = PHONE_COL_X[right ? 1 : 0];
                const rowY = phoneRowY(row);
                /* The label-to-rule offset is capped for the same reason the
                   pitch is: 102 units is 20.7px on a phone and would be 63.6
                   at 1199, floating each rule away from type that is clamped
                   at 15px. */
                const ruleY = `calc(${rowY} + min(calc(var(--u) * ${PHONE_FONT + 30}), 24px))`;
                const external =
                  item.href.startsWith("http") || item.href.endsWith(".pdf");
                return (
                  <div key={`${flatIndex}-${item.href}`}>
                    <Place x={x} xCss={xCss} y={0} yCss={rowY}>
                      <Link
                        href={item.href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noreferrer" : undefined}
                        className="lowercase whitespace-nowrap hover:opacity-60 transition-opacity block"
                        /* CLAMPED, NOT SCALED, across the middle band. The
                           phone value is 72 units, which is 14.6px on a 390
                           screen and would be 45px at 1199 — the linear zoom
                           running away in the other direction. The floor keeps
                           it legible at the narrow end and the ceiling stops it
                           overtaking the desktop's own 17.9px at the wide end;
                           in between it tracks the artboard as usual. */
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: `clamp(14.6px, calc(var(--u) * ${PHONE_FONT}), 15px)`,
                        }}
                      >
                        {item.label}
                      </Link>
                    </Place>
                    {/* The rule is capped in px for the same reason the
                        label is clamped: 820 units is 166px on a phone and
                        512px at 1199, which would leave a 15px label sitting
                        under a rule three times too long for it. 200px holds
                        the phone's own label-to-rule proportion across the
                        band, and is below 820 units at every phone width so
                        nothing there moves. */}
                    <Place x={x} xCss={xCss} y={0} yCss={ruleY} wCss={ruleW}>
                      <div
                        className="w-full bg-[color:var(--color-paper)]"
                        style={{ height: uFont(6) }}
                      />
                    </Place>
                  </div>
                );
              })
            : COLUMNS.map((col) => (
            <div key={col.x}>
              <Place x={col.x} y={ROW1_TEXT_Y}>
                <Link
                  href={col.items[0].href}
                  target={col.items[0].href.startsWith("http") ? "_blank" : undefined}
                  rel={col.items[0].href.startsWith("http") ? "noreferrer" : undefined}
                  className="lowercase whitespace-nowrap hover:opacity-60 transition-opacity block"
                  style={{ fontFamily: "var(--font-sans)", fontSize: uFontMin(17.9, 11) }}
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
                  style={{ fontFamily: "var(--font-sans)", fontSize: uFontMin(17.9, 11) }}
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
