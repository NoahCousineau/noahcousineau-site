"use client";

import Link from "next/link";
import Image from "next/image";
import { Stage, Place, uFont, uFontMin } from "./Stage";
import { useIsPhone, useIsCompact } from "@/lib/useIsPhone";
import FallenHand from "./FallenHand";
import FooterCLogo from "./FooterCLogo";
import { useRef } from "react";
import { usePathname } from "next/navigation";
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

/* FOUR NAMED SECTIONS (2026-11-10). Noah: "I want to add categories to the
   pages. There will now be text over sections called 'work', which contains
   the project links, 'more info' which has the about me page link and the
   resume, 'Hear from me' which will be links to my linkedin instagram AND a
   newsletter signup link... and then 'contact' which will just be my email."

   A group owns a heading and one or more sub-columns, which is what lets
   Work span three columns of two while the other three are a single column
   each. Items per column are no longer capped at two — Hear From Me needs
   three — so rows are computed from the index rather than written out.

   MORE INFO SITS BESIDE WORK, one column-pitch (220.77u) past the third
   project column, per "Move the new 'more info' column next to the 'work'
   section." Hear From Me and Contact stay on the right where they were, so
   the right-hand block does not drift. */
type Group = { heading: string; columns: { x: number; items: LinkItem[] }[] };

/** The pitch every column in the sketch sits on: 75.47 -> 296.24 -> 516.99. */
const COLUMN_PITCH = 220.77;

/* EVEN GAPS BETWEEN THE FOUR SECTIONS (2026-11-10). Noah: "On desktop,
   let's distribute the content evenly horizontally. There should be an even
   gap between each section."

   The two margins are the fixed points — Work still starts at 75.47 and
   Contact's rule still ends at 1834.31, exactly where the sketch put them.
   Between those, the only thing that varies is the gap, so it is solved for
   rather than guessed: take the span, subtract Work's three-column block and
   the three single-column blocks, and divide what is left by the three gaps.

   It lands on 166.81, which puts Contact back at 1630.09 — the x it already
   had. That is the arithmetic agreeing with the original design rather than a
   coincidence: the sketch's right-hand block was already evenly spaced, and
   all that was ever uneven was the hole left when More Info moved left. */
const WORK_X = 75.47;
const WORK_COLUMNS = 3;
/** Right edge of Work's block — its last column's x plus that column's rule. */
const WORK_END = WORK_X + (WORK_COLUMNS - 1) * COLUMN_PITCH + RULE_WIDTH;
/** Unchanged from the sketch, and the mirror of WORK_X against 1920. */
const CONTACT_RIGHT_EDGE = 1834.31;
const SECTION_GAP = (CONTACT_RIGHT_EDGE - WORK_END - 3 * RULE_WIDTH) / 3;

const MORE_INFO_X = WORK_END + SECTION_GAP;
const SOCIAL_X = MORE_INFO_X + RULE_WIDTH + SECTION_GAP;
const CONTACT_X = SOCIAL_X + RULE_WIDTH + SECTION_GAP;

const GROUPS: Group[] = [
  {
    heading: "Work",
    columns: [
      {
        x: WORK_X,
        items: [
          { label: "sprouts farmers market", href: "/sprouts-farmers-market" },
          { label: "corita art center", href: "/corita-art-center" },
        ],
      },
      {
        x: 296.24,
        items: [
          { label: "socal earth", href: "/socal-earth" },
          { label: "cultural olympiad poster", href: "/cultural-olympiad-poster" },
        ],
      },
      {
        x: THIRD_COLUMN_X,
        items: [
          { label: "valley strong credit union", href: "/valley-strong-credit-union" },
          { label: "more work", href: "/more-work" },
        ],
      },
    ],
  },
  {
    heading: "More Info",
    columns: [
      {
        x: MORE_INFO_X,
        items: [
          { label: "about me", href: "/about" },
          { label: "résumé", href: "/assets/_documents/noah-cousineau-resume.pdf" },
        ],
      },
    ],
  },
  {
    heading: "Social",
    columns: [
      {
        x: SOCIAL_X,
        items: [
          { label: "linkedin", href: "https://www.linkedin.com/in/noah-cousineau/" },
          { label: "instagram", href: "https://www.instagram.com/cousineau_design/" },
          /* "Cousineau's Irregular", the publication's own canonical URL —
             it has no custom domain yet, so this is the address beehiiv
             reports for it. Swap it here if one is added later. */
          { label: "newsletter", href: "https://noahs-newsletter-4eac34.beehiiv.com/" },
        ],
      },
    ],
  },
  {
    /* A single since the phone number came out (2026-11-09). Noah: "I also
       like the idea of removing my phone number" — an Awwwards listing
       brings scrapers as well as readers, and the email is the way in. */
    heading: "Contact",
    columns: [
      {
        x: CONTACT_X,
        items: [{ label: "noah@noahcousineau.com", href: "mailto:noah@noahcousineau.com" }],
      },
    ],
  },
];

/** A PDF and an off-site address both want a new tab; a route never does.
    mailto: is deliberately NOT here — it hands off to a mail client, and
    target="_blank" would leave an empty tab sitting behind it. */
const isExternal = (href: string) =>
  href.startsWith("http") || href.endsWith(".pdf");

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

/* WHERE THE SECOND ROW OF THE 2x2 STARTS, in phone row-slots. The top row
   is as tall as its tallest cell — Work, with six project links — plus the
   heading above it and one blank slot between the rows. Derived rather than
   written down so adding a project cannot quietly push Work's last link
   into Hear From Me. */
const PHONE_ROW2_SLOT =
  1 +
  Math.max(...GROUPS.slice(0, 2).map((g) => g.columns.flatMap((c) => c.items).length)) +
  1;

/* HEADINGS TOOK THE LINKS' OLD TOP LINE (2026-11-10). The first row of
   links used to start at 353.5, just under the wordmark's box; the section
   names sit there now and the rows moved down by HEADING_DROP to make room.
   The pitch between rows is unchanged at 49, so the block reads exactly as
   designed — it is only lower, and one row taller where Hear From Me needs
   a third line. */
const HEADING_TEXT_Y = 353.5; // was ROW1_TEXT_Y — see LINK BLOCK note below
const HEADING_DROP = 42;
const ROW_PITCH = 49;
const ROW1_TEXT_Y = 353.5 + HEADING_DROP;
const ROW1_RULE_Y = 381.49 + HEADING_DROP;
/** Row n's label and the rule under it, counting from 0. */
const rowTextY = (n: number) => ROW1_TEXT_Y + n * ROW_PITCH;
const rowRuleY = (n: number) => ROW1_RULE_Y + n * ROW_PITCH;

/* Title case and the site's own sans, which is Akzidenz falling back to
   Helvetica — Noah asked for "title case helvetica", and the project keeps
   to exactly two faces (see CLAUDE.md), so this is that face rather than a
   third one. Larger than the 17.9u links so the names read as headings,
   with a floor for the same reason the links have one. */
const HEADING_FONT = 28;

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
  /* ONE MARK PER PAGE (2026-10-18). The footer lives in the root layout, so
     clicking a link swaps the page beneath it and never remounts any of
     this — the mark kept whatever state and position it was left in.
     Reproduced: throw it on one page, click through to a second, and it sits
     where it landed before a single pixel of scrolling and never rolls
     again. That is "it's still preloaded", and also why it then seems
     undraggable: it is not in the corner anyone looks for it in. Keying it
     by pathname remounts it per page, the same trick PageLoaderInner uses
     for the same reason. */
  const pathname = usePathname();
  const artboardRef = useRef<HTMLDivElement>(null);
  const phone = useIsPhone();
  /* BELOW 1200 THE LINKS USE THE PHONE'S TWO COLUMNS, phones included — see
   * the note on useIsCompact for the arithmetic. Five columns of legible type
   * do not fit under a 1180px window at any size, so this is a reflow rather
   * than a resize. Everything else in the footer still keys off `phone`. */
  const compact = useIsCompact();
  // The fixed footer can't drive a ScrollTrigger of its own, so the spacer
  // — which does scroll — is what tells the fallen hand it has arrived.
  const spacerRef = useRef<HTMLDivElement>(null);
  /* The footer element, still handy for the fallen hand's own trigger. On
     desktop the footer is FIXED and never travels past the viewport, which is
     why the rise there keys off the spacer instead; on a phone each piece
     watches for its own arrival, a full screen later than the footer's top —
     see the note in PeekingHead. */
  const footerRef = useRef<HTMLElement>(null);
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
      {/* ON A PHONE THERE IS NO CURTAIN AND NO SPACER (2026-08-30).
          
          Noah, with two screenshots: "the grid will flash out of existence and
          then back in when I scroll down or up."
          
          It was not the grid disappearing. It was THIS footer showing through
          it. The desktop effect is a full-viewport panel fixed behind the page
          at z-0, with .site-content as an opaque curtain at z-10 sliding up to
          uncover it, and this spacer buying the scroll distance. On iOS that
          is the exact arrangement Safari is worst at: a position:fixed layer
          behind a tall, scrolling, composited layer. When it declines to
          repaint the curtain for a frame, what shows is the thing behind it —
          which is why Noah's screenshots have the black footer sitting in the
          middle of the project grid, above "socal earth" scrolling up and
          below "cultural olympiad" scrolling down.
          
          A phone gets an ordinary footer instead: in normal flow, at the end
          of the document, nothing fixed and nothing to uncover. It cannot
          flicker because there is nothing behind anything. The reveal is a
          desktop flourish and desktop keeps it. */}
      {!phone && (
        <div
          ref={spacerRef}
          aria-hidden
          className="w-full"
          style={{ height: "100vh", minHeight: "calc(100dvh + 15vh)" }}
        />
      )}
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
      <footer
        ref={footerRef}
        className={`bg-[color:var(--color-ink)] text-[color:var(--color-paper)] flex flex-col justify-start overflow-hidden ${
          phone ? "relative w-full" : "fixed inset-0 z-0"
        }`}
        /* A DEFINITE height, not a minimum (2026-08-30). Noah: "it looks like
           the head and finger got moved up too much on the mobile footer."
           
           The artboard inside this is `h-full`, and a percentage height only
           resolves against a parent with a definite height. `fixed inset-0`
           gave it one for free; `min-height` does not — so the artboard
           collapsed to its content and the head and the fallen hand, which
           are both placed with `bottom: <units>` against it, anchored to a
           much shorter box and rose up into the links. An exact height puts
           them back where they were drawn. */
        style={phone ? { height: "100dvh" } : undefined}
      >
      <div
        ref={artboardRef}
        className="artboard relative mx-auto w-full h-full"
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
        {/* DESKTOP GETS THE C MARK INSTEAD OF THE HEAD (2026-10-18). Noah:
            "removing my head on the footer... Instead, I would like for my
            secondary logo (the circular C logo), to take its place... roll in
            along the bottom of the browser window... This is only for
            desktop, I don't want to see this on mobile."

            So the two tiers now draw different things, and the phone and the
            in-between band keep the head on exactly the terms they had —
            including standing it down on a compact project page, where the
            teeter-totter needs the room. */}
        {/* ROLLING EVERYWHERE EXCEPT A PHONE (2026-10-18, third pass). Noah:
            "I'm still seeing it already loaded on some pages when I scroll
            down to the bottom on desktop AND I don't have the ability to
            drag and throw the C now."

            This was keyed on `compact`, which is the footer's LAYOUT line at
            1200 — so between 768 and 1199 the mark took the phone's
            behaviour: sitting there already placed on ordinary pages, and
            absent altogether on project pages, where the finger rule applied.
            Measured at 1100 and 1199: "/" showed the mark with no roll, and
            a project page showed no mark at all. That band is a desktop
            window to anyone using one, which is exactly what he was looking
            at. The roll belongs to every width that is not a phone. */}
        {!phone && (
          <FooterCLogo
            key={pathname}
            mode="roll"
            containerRef={artboardRef}
            triggerRef={spacerRef}
          />
        )}
        {/* THE HEAD IS GONE HERE TOO (2026-10-18). Noah: "On mobile, I would
            like for the head in the footer to also be removed. Let's add the
            C logo in the footer ONLY on pages where there is no finger."

            `nextProjectHref` is only passed on a project page, so it is
            exactly "is there a finger reaching for the next project" — and
            those footers now carry the finger alone. PeekingHead is no
            longer mounted anywhere; the component is left on disk so the
            head can be put back by restoring this one block. */}
        {phone && !nextProjectHref && (
          <FooterCLogo
            key={pathname}
            mode="loose"
            containerRef={artboardRef}
            /* No curtain on a phone — the footer is an ordinary element
               that scrolls, so it is its own trigger for the roll. */
            triggerRef={footerRef}
          />
        )}
        {nextProjectHref && (
          <FallenHand
            triggerRef={phone ? footerRef : spacerRef}
            nextHref={nextProjectHref}
            containerRef={artboardRef}
          />
        )}
        {/* CLEAR THE DROPPED CHROME (2026-08-31, the third place this bit).
            Between 768 and 1439 the C mark and the theme toggle are pushed
            down by `--chrome-drop` so they clear the rule under a sticky
            section title on a project page. The footer fills the viewport, so
            when it is uncovered the wordmark is right under those two fixed
            controls: at 1512 the C mark sits just left of the wordmark's own
            "C" and reads as a mark beside a logo, but anywhere from 1400 down
            it lands squarely on it, and the toggle lands on the "AU".

            Only the wordmark-and-links block moves. The peeking head is
            placed separately against the bottom edge and stays exactly where
            it is, so the composition keeps its top and bottom anchors and
            only the gap between them changes. Outside the band the variable
            is undefined and the fallback is 0. */}
        <div style={{ paddingTop: "var(--chrome-drop-compensate, 0px)" }}>
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

          {/* Four named sections. Work spans three columns of two; the
              other three are a single column each. Below 1200 the same four
              sections lay out as a 2x2 instead. */}
          {compact
            ? GROUPS.map((group, gi) => {
                /* 2x2 (2026-11-10). Noah: "On mobile have these four
                   sections laid out in a 2x2 configuration." Work and More
                   Info take the top row, Hear From Me and Contact the
                   bottom; the right-hand pair hangs off the right edge the
                   same way the old contact column did. */
                const right = gi % 2 === 1;
                const items = group.columns.flatMap((c) => c.items);
                const slotBase = gi < 2 ? 0 : PHONE_ROW2_SLOT;
                const ruleW = `min(calc(var(--u) * ${PHONE_RULE_W}), 200px)`;
                const xCss = right
                  ? `calc(100% - ${ruleW} - var(--u) * ${PHONE_COL_X[0]})`
                  : undefined;
                const x = PHONE_COL_X[right ? 1 : 0];
                return (
                  <div key={group.heading}>
                    <Place x={x} xCss={xCss} y={0} yCss={phoneRowY(slotBase)}>
                      <span
                        className="whitespace-nowrap block"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: `clamp(18px, calc(var(--u) * ${PHONE_FONT * 1.25}), 19px)`,
                        }}
                      >
                        {group.heading}
                      </span>
                    </Place>
                    {items.map((item, n) => {
                      const rowY = phoneRowY(slotBase + 1 + n);
                      /* The label-to-rule offset is capped for the same
                         reason the pitch is: 102 units is 20.7px on a phone
                         and would be 63.6 at 1199, floating each rule away
                         from type that is clamped at 15px. */
                      const ruleY = `calc(${rowY} + min(calc(var(--u) * ${PHONE_FONT + 30}), 24px))`;
                      return (
                        <div key={item.href}>
                          <Place x={x} xCss={xCss} y={0} yCss={rowY}>
                            <Link
                              /* NOT PREFETCHED (2026-08-30). Noah: "terribly
                                 clunky when in mobile." Next prefetches every
                                 Link it can see, and a project page's RSC
                                 payload carries preload hints for its own
                                 priority images — so a footer linking six
                                 projects made every page quietly download
                                 five other pages' artwork. Measured on a
                                 phone: 75MB of images that were never in this
                                 page's DOM at all. It also fixes a 404 on
                                 every page load: the résumé is a PDF rather
                                 than a route, and asking the server for one
                                 as an RSC payload can only ever fail. */
                              prefetch={false}
                              href={item.href}
                              target={isExternal(item.href) ? "_blank" : undefined}
                              rel={isExternal(item.href) ? "noreferrer" : undefined}
                              className="lowercase whitespace-nowrap hover:opacity-60 transition-opacity block"
                              /* CLAMPED, NOT SCALED, across the middle band.
                                 The phone value is 72 units, which is 14.6px
                                 on a 390 screen and would be 45px at 1199 —
                                 the linear zoom running away in the other
                                 direction. */
                              style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: `clamp(14.6px, calc(var(--u) * ${PHONE_FONT}), 15px)`,
                              }}
                            >
                              {item.label}
                            </Link>
                          </Place>
                          {/* The rule is capped in px for the same reason the
                              label is clamped: 820 units is 166px on a phone
                              and 512px at 1199, which would leave a 15px
                              label under a rule three times too long. */}
                          <Place x={x} xCss={xCss} y={0} yCss={ruleY} wCss={ruleW}>
                            <div
                              className="w-full bg-[color:var(--color-paper)]"
                              style={{ height: uFont(6) }}
                            />
                          </Place>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            : GROUPS.map((group) => (
                <div key={group.heading}>
                  <Place x={group.columns[0].x} y={HEADING_TEXT_Y}>
                    <span
                      className="whitespace-nowrap block"
                      style={{ fontFamily: "var(--font-sans)", fontSize: uFontMin(HEADING_FONT, 15) }}
                    >
                      {group.heading}
                    </span>
                  </Place>
                  {group.columns.map((col) => (
                    <div key={col.x}>
                      {col.items.map((item, n) => (
                        <div key={item.href}>
                          <Place x={col.x} y={rowTextY(n)}>
                            <Link
                              /* Never prefetched: a project link drags that
                                 page's priority images along, and the résumé
                                 is a PDF rather than a route. See the note on
                                 the phone columns above. */
                              prefetch={false}
                              href={item.href}
                              target={isExternal(item.href) ? "_blank" : undefined}
                              rel={isExternal(item.href) ? "noreferrer" : undefined}
                              className="lowercase whitespace-nowrap hover:opacity-60 transition-opacity block"
                              style={{ fontFamily: "var(--font-sans)", fontSize: uFontMin(17.9, 11) }}
                            >
                              {item.label}
                            </Link>
                          </Place>
                          <Place x={col.x} y={rowRuleY(n)} w={RULE_WIDTH}>
                            <div className="w-full bg-[color:var(--color-paper)]" style={{ height: uFont(2) }} />
                          </Place>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
        </Stage>
        </div>
      </div>
      </footer>
    </>
  );
}
