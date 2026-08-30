import Image from "next/image";
import { InViewVideo } from "./InViewVideo";
import { Stage } from "@/components/Stage";
import StackedSection from "./StackedSection";

/*
 * ProjectGroup — one repeating "chunk" of project content: an italic
 * descriptor at the top, then one or more rows of media divided by black
 * lines, repeating down the page. This is the piece that repeats for
 * every project ("Times Square Advertisement", "Southern California
 * Campaign", etc. on Sprouts) and is the reusable heart of the template.
 *
 * WIDTH: the grid matches the homepage's project grid width exactly —
 * both use the shared px-(--gutter) + mx-auto max-w-(--maxw) container
 * (see components/home/Projects.tsx), so the two grids line up.
 *
 * GAP TREATMENT (measured directly off the artboard, refined per Noah's
 * feedback): rows whose cells are meant to look like individual "posters"
 * sitting side-by-side (e.g. the 4-up Garden Grove/Newport/etc. row) get
 * a real gap between cells — ~48u white space with a thin ~9u black
 * hairline centered in it. The same 48u is also used as padding above,
 * below, and on both outer sides of the whole row (matting it like a
 * framed strip) — per Noah's ask for equal space above/below the row;
 * the posters shrink slightly as a natural consequence of that inset.
 * Rows that are meant to read as one continuous strip (e.g. the wide
 * "NOWHERE ELSE" banner, which is a single image) just pass one cell and
 * get no internal gap by construction. Opt in per-row via `gapped`.
 *
 * SECTION SPACING (round: fixed the "unexpected gap" bug): this used to
 * use `py-[8vh]` (viewport-height-relative) above/below each group's
 * <section>. That's a moving target — on tall monitors 8vh is a much
 * bigger gap in real pixels than what the grid-editor tool's fixed-height
 * preview showed, so what looked snug in the editor could show up as a
 * big empty-looking gap on the real site. Switched to a fixed `--u`-unit
 * value (SECTION_PADDING_UNITS) so the gap scales with the page's own
 * artboard unit system exactly like everything else, and the editor tool
 * was updated to render that same padding in its preview so what Noah
 * builds there matches production 1:1.
 *
 * TITLE CASE (round): descriptors now render exactly as typed — no more
 * forced lowercase via CSS. Write section titles in Title Case in the
 * content data going forward (e.g. "Times Square Advertisement").
 *
 * IMAGE QUALITY (round): bumped Next/Image `quality` from the default 75
 * to 90 for grid cells — a "happy medium" per Noah's request. Not full
 * source resolution (would bloat page weight for web delivery) but
 * noticeably crisper than the default, since some images were reading as
 * fuzzy/pixelated at default compression.
 *
 * SHRINK / SCALE (round): cells can now carry an optional `scale`
 * (10–100, percent) to shrink the media within its cell's bounding box
 * without changing the row's grid footprint — the image/video renders
 * smaller and centered, with the cell's own background color filling the
 * rest, instead of being forced to fill 100% of the box via object-cover.
 */
export type MediaCell =
  | {
      type: "image";
      file: string;
      alt?: string;
      w?: number;
      h?: number;
      scale?: number;
      /** Ignore `scale` on phones, rendering the media at the cell's full
       *  width. 2026-08-29, Noah, on the Cultural Olympiad poster section:
       *  "let's scale the first image to be as wide as the second image" —
       *  a 94% inset that frames the poster on a desktop just reads as a
       *  misaligned edge once the row is one column wide. */
      phoneUnscaled?: boolean;
      colWidth?: number;
      fit?: boolean;
      cropAspect?: string;
      objectFit?: "cover" | "contain";
      shadow?: boolean;
      /** Flip pure-black artwork to white in dark mode — see the
       *  `.invert-on-dark` note in globals.css. Only for flat black-on-
       *  transparent marks (a logo, a wordmark); real photography has its
       *  own background and would invert into something broken. */
      invertOnDark?: boolean;
      /** Per-cell background override, for a cell whose own transparency
       *  needs to stay one fixed colour rather than following the group's
       *  `bgColor` (which is usually --color-paper, and flips with theme).
       *  2026-08-23, Noah, on a cutout brain photo with real transparent
       *  margin: "In dark mode it has a black background and it makes it
       *  stand out too much... add a white background." A literal colour,
       *  not a token — it must NOT flip to black in dark mode, which is
       *  the entire problem being fixed. */
      bgColor?: string;
    }
  | { type: "video"; src: string; aspect?: string; scale?: number; colWidth?: number; fit?: boolean; objectFit?: "cover" | "contain"; phoneUnscaled?: boolean }
  | { type: "youtube"; id: string; aspect?: string; scale?: number; colWidth?: number; phoneUnscaled?: boolean };

export type MediaRow = {
  cells: MediaCell[];
  /** Aspect ratio applied to every cell in the row, e.g. "3/4", "16/9". */
  aspect?: string;
  /** True for rows of separate "poster" cells that need a visible gap +
   * hairline between them, per the artboard (e.g. the 4-up campaign row). */
  gapped?: boolean;
  /** Reclaim most of the phone grid margin for this row, so its media runs
   *  nearer the edges of the screen. 2026-08-29, Noah, on the Cultural
   *  Olympiad: "work to increase the poster size on the mobile version."
   *
   *  A row flag rather than a wider `--grid-margin`, because that margin is
   *  load-bearing: it is what keeps grid content out from under the fixed C
   *  and toggle in the top corners. Widening one row well down the page costs
   *  nothing there. */
  phoneWide?: boolean;
};

const GAP_UNITS = 48; // measured off the artboard's poster-row seam
// Divider-line thickness: fixed at 8 --u artboard units everywhere on
// project pages (2026-08-16l, per Noah's explicit ask: "Ensure that
// EVERY grid line that is used on the projects are all the same exact
// thickness. Let's assign a thickness of 8u for now.")
// BUGFIX (2026-08-16j, superseded 2026-08-16l): this hairline used to be
// sized via `calc(var(--u) * 9)`, a container-query-based unit, while
// every other divider line on the page (Rule(), borderLeft) used
// `var(--rule-weight)`, a viewport-width-based clamp. Those are two
// different reference frames (--u tracks this component's own container
// width; --rule-weight tracks the browser's viewport width) that only
// happen to match at one specific width and diverge everywhere else —
// causing "gapped" rows (e.g. Corita's 3-up Instagram card row) to
// render a visibly different line thickness than every other row on the
// same page, and the mismatch amount to shift as the window is resized.
// 2026-08-16l unifies this further: ALL grid lines (Rule(), the gapped-row
// hairline, and the non-gapped row's borderLeft) now use the exact same
// `calc(var(--u) * RULE_WEIGHT_UNITS)` formula — no separate CSS token at
// all, so there is no possibility of two different reference frames ever
// diverging again. Every line on every project page is driven by one
// single number in one single place.
export const RULE_WEIGHT_UNITS = 8;
export const RULE_WEIGHT_CSS = `calc(var(--u) * ${RULE_WEIGHT_UNITS})`;
// Grid width — the --u-unit left/right margin on the project-page grid
// section, which lives in globals.css as `--grid-margin` so a media query can
// widen it for phones. THE VALUE IS NOT DUPLICATED HERE: it was, as a
// `GRID_MARGIN_UNITS = 178` constant that this file passed to the section's
// padding while the full-bleed rule under each section title read the
// variable, and on 2026-08-25 those two silently disagreed on a phone (178
// against 250) and pushed 15px of horizontal overflow into the document. One
// name, one place.
//
// Where 178 came from: originally 40u, to match the homepage project grid's
// width exactly (see components/home/Projects.tsx). Per Noah (2026-08-20):
// "decrease the width of the grid by 15%, keeping all of the grid contents
// the same" — margin increased so the grid's content width (previously
// 1920 - 2*40 = 1840u) shrinks by exactly 15% to 1564u, still centered in
// the same 1920u page: new margin = (1920 - 1564) / 2 = 178u. This grid no
// longer matches the homepage grid's width 1:1.
/*
 * PHONE (2026-08-25). Noah: "For the project grid, stack any images/videos
 * that are side by side vertically. Decrease the margin around the sides of
 * the grid to a much smaller size."
 *
 * BOTH DONE IN CSS, in globals.css, rather than through the `useIsPhone`
 * hook every other part of this pass uses. This component is a SERVER
 * component — calling a hook here fails the build outright, which is how
 * that was found — and neither change actually needs one: a column count and
 * a margin are values, not structure. The margin is a custom property this
 * file reads as `var(--grid-margin)`, and the single column is a class the
 * media query can reach (`js-project-row`).
 *
 * For the record, since the numbers live over there now: 178 units is 9.3% of
 * the width a side, which is a generous editorial margin on a desktop and
 * 36px of a 390px screen — leaving the images barely over half the phone.
 */
// Fixed vertical padding above/below every group's section — replaces the
// old viewport-relative py-[8vh], which produced gap sizes that didn't
// match the grid-editor tool's preview. See SECTION SPACING note above.
// Was 75 (= 150u total between sections). Raised to 150 on 2026-08-20 per
// Noah: "add more vertical space between sections of copy and images...
// make this more of an experience that someone scrolls through" — so the
// gap between two adjacent sections is now 300u. Flagged by Noah as
// possibly-revertible ("I might want to revert this later"), which is why
// it stays a single named constant rather than being inlined.
const SECTION_PADDING_UNITS = 150;
// Small space carried ABOVE the descriptor inside the sticky header, per
// Noah: "I want a small space above the title, the title itself, and the
// bar immediately below it to be sticky." This is intentionally much
// smaller than SECTION_PADDING_UNITS — it's the breathing room that stays
// glued to the title once pinned, not the between-sections gap.
// Roughly halved (34 -> 16) on 2026-08-20, second pass — Noah: "make the
// top gap white bar that hosts the project title name thinner. This will
// allow more room for the images below." See DESCRIPTOR_GAP_UNITS below
// for the matching cut to the space under the title.
const STICKY_TOP_SPACE_UNITS = 16;

/* SECTION TITLE (2026-08-20, per Noah: "change the section titles to the
 * Akzidenz-Grotesk type that we've been using. I also want it smaller. the
 * titles should be sized where a 16:9 video can fully and comfortably sit
 * inside the viewport of the browser.")
 *
 * Akzidenz = --font-sans, and the italic serif treatment is dropped.
 *
 * The size was originally derived from that 16:9 constraint: with the grid
 * inset at GRID_MARGIN_UNITS a side, its content spans 1564/1920 = 0.8146
 * of the viewport width, so a 16:9 row inside it stands 0.8146 * 9/16 =
 * 0.4582 viewport-widths tall — against a 16:9 display's own 0.5625,
 * leaving ~200 artboard units of headroom for the pinned header.
 *
 * SHRUNK A FURTHER THIRD (same day, second pass — Noah: "shrink the section
 * titles down by a third"). Every term of the size clamp scaled by 2/3
 * (40 -> 26.67, 0.95rem -> 0.63rem, 3rem -> 2rem) so the reduction holds at
 * every viewport width, not just where one clamp term happens to win — the
 * same technique used for the home page's --text-descriptor cut.
 *
 * WHITE BAR THINNED (same day, third pass — Noah, pointing at a screenshot:
 * "make the top gap white bar that hosts the project title name thinner.
 * This will allow more room for the images below.") STICKY_TOP_SPACE and
 * this gap roughly halved together (34->16, 24->10). The header now
 * measures
 *   STICKY_TOP_SPACE + title + gap + rule = 16 + 26.67 + 10 + 8 = 60.67u,
 * down from 92.67u — still comfortably under the ~200u 16:9-video budget
 * this size was originally built around.
 *
 * Clamped at both ends so the title stays legible on a phone and doesn't
 * run away on an ultra-wide monitor. */
const DESCRIPTOR_SIZE_UNITS = 26.67;
/* The multiplier is a custom property so the phone can double it with a
 * media query — this is a server component and cannot read the hook. See
 * globals.css. */
const DESCRIPTOR_SIZE_CSS =
  `clamp(0.63rem, calc(var(--u) * ${DESCRIPTOR_SIZE_UNITS} * var(--descriptor-scale)), calc(2rem * var(--descriptor-scale)))`;
const DESCRIPTOR_GAP_UNITS = 10;
// Default cell quality: 100 (Next.js maximum) — no compression.
// Source images are 1500px wide max; at 1440px grid = ~1.04x no compression.
// All images rendered at full source resolution for maximum PPI.
const IMAGE_QUALITY = 100;

/**
 * ScaledMedia — renders the cell's media at a percentage of its natural
 * cell-filling size, matching the grid editor's 20–200% range exactly.
 *
 * 20–100%: shrink-and-center via width/height percentage (unchanged
 *   behavior) — the media renders smaller within the cell, centered,
 *   with the cell's background color filling the remaining space.
 * 100–200%: zoom IN via CSS transform: scale() — the media renders
 *   larger than its cell and gets cropped by the cell's `overflow:
 *   hidden`, matching how the grid editor's `applyScaleStyle()` handles
 *   zoom (transform-based, not width/height-based, since width/height
 *   percentages > 100% don't crop/zoom the same way a transform does).
 *
 * BUGFIX (2026-08-16): previously this component had `if (!scale ||
 * scale >= 100) return children` — meaning ANY scale value >= 100 was
 * silently ignored and rendered as if no scale were set at all. This
 * caused the "zoom amount doesn't reflect the JSON" symptom Noah
 * reported: the grid editor's scale slider goes up to 200% and shows
 * the zoom correctly in its own preview (which always used transform:
 * scale()), but the live site had no code path for scale > 100 at all,
 * so exported JSON with e.g. `scale: 150` rendered identically to no
 * scale being set. Fixed by adding a transform-based zoom path for the
 * 100–200% range, mirroring the editor's `applyScaleStyle()` exactly.
 */
function ScaledMedia({ scale, bgColor, phoneUnscaled, children }: { scale?: number; bgColor?: string; phoneUnscaled?: boolean; children: React.ReactNode }) {
  if (!scale || scale === 100) return <>{children}</>;
  // BUGFIX (2026-08-16k): previously this branched into two entirely
  // different layout strategies exactly at the 100% boundary — a
  // width/height-percentage shrink-and-center wrapper below 100%, and a
  // CSS transform: scale() zoom above 100%. Whenever a cell's image
  // aspect didn't exactly match its box, that discontinuity produced a
  // jarring visible "jump" in size right at 100% (99% -> small centered
  // image; 100%/101% -> ballooned to fill/crop the whole box) — reported
  // by Noah as "when you reach 100% on the zoom-in, it jumps to a massive
  // amount." Fixed to use ONE continuous mechanism (CSS transform: scale)
  // across the full 20-200% range, matching the grid editor's identical
  // fix in applyScaleStyle(). The cell's own `overflow: hidden` clips any
  // overflow above 100%, so nothing extra is needed here for the zoom-in
  // case; the `children` (an <Image>/<video> with object-fit already set
  // by the caller) is the same element being scaled the whole time.
  const clamped = Math.max(20, Math.min(200, scale));
  return (
    <div
      /* `js-scaled` lets a phone drop the transform for cells that only need
         it on a desktop — see .js-phone-unscaled in globals.css, and the
         `phoneUnscaled` cell flag that opts in. */
      className={`absolute inset-0 js-scaled${phoneUnscaled ? " js-phone-unscaled" : ""}`}
      style={{
        transform: `scale(${clamped / 100})`,
        transformOrigin: "center",
        background: bgColor || "var(--color-paper)",
      }}
    >
      {children}
    </div>
  );
}

function Cell({ cell, aspect, slug, bgColor }: { cell: MediaCell; aspect?: string; slug: string; bgColor?: string }) {
  if (cell.type === "video") {
    return (
      <div className="relative w-full h-full overflow-hidden bg-black" style={{ aspectRatio: cell.aspect ?? aspect ?? "16/9" }}>
        {cell.fit ? (
          <InViewVideo src={cell.src} objectFit={cell.objectFit} />
        ) : (
          <ScaledMedia scale={cell.scale} bgColor={bgColor} phoneUnscaled={cell.phoneUnscaled}>
            <InViewVideo src={cell.src} objectFit={cell.objectFit} />
          </ScaledMedia>
        )}
      </div>
    );
  }
  if (cell.type === "youtube") {
    return (
      <div className="relative w-full h-full overflow-hidden bg-black" style={{ aspectRatio: cell.aspect ?? aspect ?? "16/9" }}>
        <ScaledMedia scale={cell.scale} bgColor={bgColor} phoneUnscaled={cell.phoneUnscaled}>
          <iframe
            src={`https://www.youtube.com/embed/${cell.id}`}
            className="absolute inset-0 w-full h-full"
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </ScaledMedia>
      </div>
    );
  }
  // Per-cell override wins over the group's own bgColor — see the note on
  // MediaCell.bgColor above.
  const effectiveBg = cell.bgColor ?? bgColor;
  return (
    <div
      className="relative w-full overflow-hidden"
      style={
        cell.fit
          ? cell.cropAspect
            ? // "Fit" mode WITH a manual crop override (`cropAspect`):
              // Noah drags a horizontal handle in the editor to trim
              // excess height off a `fit` image that renders taller than
              // its row-mates (e.g. a 3-across row where one image's
              // natural aspect is taller than the other two, leaving a
              // gap below the shorter ones). This locks the cell to the
              // chosen aspect and top-aligns an object-cover image inside
              // it, cropping only from the BOTTOM — never stretching or
              // zooming the image, and never touching cells that don't
              // have this override set (plain `fit` cells above are
              // unaffected and keep hugging their image's full natural
              // height exactly as before).
              { aspectRatio: cell.cropAspect, backgroundColor: effectiveBg || undefined }
            : // Plain "Fit" mode: the GRID adapts to the image, not the
              // other way around. We deliberately do NOT force
              // `aspectRatio` here — doing so was the bug: it locked the
              // cell to the row's declared ratio and then cropped/zoomed
              // the image to cover that box (exactly what Noah said he
              // doesn't want). Instead this wrapper has no fixed aspect
              // ratio at all; the <img> below is rendered at its OWN
              // natural aspect ratio (full width, auto height) so the
              // cell's height — and therefore the horizontal rule/divider
              // above and below it — hugs the image exactly. No
              // cropping, no zooming, no letterboxing.
              { backgroundColor: effectiveBg || undefined }
          : { aspectRatio: aspect ?? `${cell.w ?? 4}/${cell.h ?? 3}`, backgroundColor: effectiveBg || undefined, height: "100%" }
      }
    >
      {cell.fit ? (
        cell.cropAspect ? (
          // Manual crop override active: object-cover + top alignment so
          // any excess height is trimmed off the BOTTOM of the image,
          // matching the drag-down gesture in the editor (dragging the
          // handle up shortens the box, revealing less of the image's
          // bottom — never stretching the image or cropping from the top).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/assets/${slug}/${cell.file}`}
            alt={cell.alt || ""}
            className={`w-full h-full object-cover object-top${cell.invertOnDark ? " invert-on-dark" : ""}`}
            style={{ display: "block", lineHeight: 0 }}
          />
        ) : (
          // Plain <img> (not next/image `fill`) so the browser sizes the
          // element from the file's own intrinsic dimensions — width:100%
          // + height:auto means the rendered height is however tall THIS
          // image naturally is at the column's width. This is what makes
          // "the top and bottom bars fit to the image" instead of the
          // image being force-cropped into a fixed-height box.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/assets/${slug}/${cell.file}`}
            alt={cell.alt || ""}
            className={`w-full h-auto${cell.invertOnDark ? " invert-on-dark" : ""}`}
            style={{ display: "block", lineHeight: 0, boxShadow: cell.shadow ? "0 6px 18px rgba(0,0,0,0.25)" : undefined }}
          />
        )
      ) : (
        <ScaledMedia scale={cell.scale} bgColor={effectiveBg} phoneUnscaled={cell.phoneUnscaled}>
          <Image
            src={`/assets/${slug}/${cell.file}`}
            alt={cell.alt || ""}
            fill
            quality={IMAGE_QUALITY}
            sizes="(max-width: 640px) 100vw, (max-width: 1440px) 100vw, 1500px"
            // BUGFIX (2026-08-16k): object-fit must stay "contain" for ANY
            // scaled cell (scale != 100, in either direction) — see
            // ScaledMedia's comment above. Previously this flipped to
            // "cover" once scale reached 100, which combined with
            // ScaledMedia's old wrapper-swap to cause the "jump at 100%"
            // bug. Only truly unscaled cells (scale === 100 or unset) use
            // "cover" edge-to-edge fill with no transform at all — UNLESS
            // the cell explicitly requests objectFit:"contain" (used for
            // portrait/odd-aspect media in a landscape cell that must
            // show the whole frame rather than crop it).
            className={
              (cell.objectFit === "contain" || (cell.scale && cell.scale !== 100)
                ? "w-full h-full object-contain"
                : "w-full h-full object-cover") + (cell.invertOnDark ? " invert-on-dark" : "")
            }
            style={{ display: "block", lineHeight: 0 }}
          />
        </ScaledMedia>
      )}
    </div>
  );
}

function Rule() {
  return <div className="w-full" style={{ height: RULE_WEIGHT_CSS, background: "var(--color-ink)" }} />;
}

export function ProjectGroup({
  slug,
  descriptor,
  rows,
  topGapUnits,
  bgColor,
  stackIndex = 0,
}: {
  slug: string;
  /** Italic serif label at the top of the grouping, e.g. "Times Square Advertisement". Rendered exactly as typed — write it in Title Case. */
  descriptor: string;
  rows: MediaRow[];
  /** Optional artboard-unit gap to render above this group (e.g. the 300u
   * gap after the statement block, only needed on the first group). */
  topGapUnits?: number;
  /** Optional background color for this group (hex color code). */
  bgColor?: string;
  /** This group's position among its page's groups. Drives the stacking
   * z-index so each section paints OVER the one before it — see the
   * STACKING SCROLL note below. */
  stackIndex?: number;
}) {

  /* STACKING SCROLL (2026-08-20, per Noah): "when the user scrolls down to
   * the section title, I want a small space above the title, the title
   * itself, and the bar immediately below it to be sticky... the content of
   * the section will vanish behind the title and bar... After that, a new
   * section will scroll up and over the old section and the process will
   * repeat. This effect will make it feel less like we're scrolling down
   * one long page, but rather that we are staying stationary and the
   * sections are the things that are scrolling."
   *
   * Refined twice more the same day: first "make sure... the old images we
   * already saw don't reappear at the top", then, after that fix
   * overcorrected, "I don't like how the section title disappears towards
   * the bottom. Make it so it's visible until the next section covers it."
   * Both are now handled by WHERE this header is placed in the tree, not by
   * any scroll math here — see the HEADER PLACEMENT note in
   * StackedSection.tsx, which is passed the header as its own `header` prop
   * specifically so it can render outside the recede-scale's transform.
   *
   * Built from two cooperating pieces:
   *
   * 1. The header (top space + descriptor + its rule) is `position: sticky;
   *    top: 0`, painted on an opaque surface. Because it's opaque, the
   *    section's own rows slide underneath and disappear behind it — "this
   *    will continue until we reach the end of the section".
   *
   * 2. Each section is opaque and carries an increasing z-index, so the
   *    NEXT section paints over the previous one — header included — as it
   *    scrolls up, rather than the two blending or the old one showing
   *    through. That's the "scroll up and over the old section" half, and
   *    it's also what makes the header disappear at exactly the right
   *    moment: the instant the next section's box actually arrives, no
   *    earlier and no later.
   *
   * Deliberately NOT done by making the whole <section> sticky: these
   * sections are far taller than the viewport, and a sticky element taller
   * than its scrollport pins its top edge and strands everything below the
   * fold — the content would become unreachable. Sticking only the header
   * is what makes the effect work at arbitrary section height.
   *
   * Scope is content groups only, per Noah — the hero and the
   * statement/hand block above still scroll normally.
   */
  // Opaque surface for both the section and its sticky header. Must not be
  // transparent: the whole effect depends on outgoing rows being hidden
  // behind the header, and on a section being able to cover its
  // predecessor.
  const surface = bgColor || "var(--color-paper)";
  const header = (
    <div
      className="sticky top-0 z-20"
      style={{
        background: surface,
        paddingTop: `calc(var(--u) * ${STICKY_TOP_SPACE_UNITS})`,
        marginTop: `calc(var(--u) * ${SECTION_PADDING_UNITS})`,
      }}
    >
      <h2
        className="leading-none"
        style={{
          fontSize: DESCRIPTOR_SIZE_CSS,
          fontFamily: "var(--font-sans)",
          marginBottom: `calc(var(--u) * ${DESCRIPTOR_GAP_UNITS})`,
        }}
      >
        {descriptor}
      </h2>

      {/* FULL-BLEED, unlike every other Rule() on the page (2026-08-23, per
          Noah: "lets make the line immediately under the section title span
          the whole browser width. This is only for the top line, not the
          grid lines"). The header sits inside the section's own
          GRID_MARGIN_UNITS side padding — negative margins matching that
          padding pull just this one rule back out to the section's outer
          edge, which is the shared artboard width every full-bleed rule on
          the site already uses as "the browser" (the home grid's rules and
          the project-header rule both stop at 1920u, not literal viewport
          width past that cap). The title text above it is untouched, still
          inset at the normal margin. */}
      <div
        style={{
          marginLeft: "calc(var(--u) * var(--grid-margin) * -1)",
          marginRight: "calc(var(--u) * var(--grid-margin) * -1)",
        }}
      >
        <Rule />
      </div>
    </div>
  );
  return (
    <>
      {topGapUnits != null && <Stage heightUnits={topGapUnits} />}
      <StackedSection
        stackIndex={stackIndex}
        surface={surface}
        /* THE VARIABLE, NOT THE CONSTANT (2026-08-25). These two have to be
           the same number, because the full-bleed rule under the section
           title cancels this padding with a negative margin of
           `var(--grid-margin)` — and on a phone the media query moves that
           variable to 250 while this stayed on the 178 constant. The rule
           then reached 72 units PAST the section's edge on each side, which
           is the 15px of horizontal document overflow measured at a 390px
           viewport (scrollWidth 405 against innerWidth 390).

           It also meant last round's "shrink the grid enough where the 'c'
           logo and the toggle switch can cleanly fit" never actually moved
           the grid: content stayed at 178u (36.2px on a 390px screen) while
           the C's ring ends at 39.8px, so they still overlapped. Reading the
           variable here is what applies that change to the content it was
           written for. GRID_MARGIN_UNITS remains the desktop value the
           variable is initialised to. */
        paddingXUnits="var(--grid-margin)"
        paddingBottomUnits={SECTION_PADDING_UNITS}
        header={header}
      >
        <div className="w-full">
          {rows.map((row, i) => {
            // Support asymmetric column widths: if any cell in the row
            // specifies a `colWidth` (relative width weight, e.g. 60/40
            // split), use those as the grid's fr values. Cells without
            // `colWidth` default to 1fr each. Falls back to perfectly
            // equal columns when no cell specifies `colWidth` (the
            // common case). NOTE: deliberately NOT named `w` — `w`/`h`
            // are already used as pixel-dimension fallbacks for aspect
            // ratio (see MediaCell type + the Cell renderer above).
            const hasCustomWidths = row.cells.some((c) => "colWidth" in c && c.colWidth != null);
            // ONE COLUMN ON A PHONE — see PHONE_GRID_MARGIN_UNITS. Any
            // declared column widths are ignored there for the same reason:
            // they describe how to divide a row that no longer exists.
            const gridTemplateColumns = hasCustomWidths
              ? row.cells.map((c) => `${"colWidth" in c && c.colWidth != null ? c.colWidth : 1}fr`).join(" ")
              : `repeat(${row.cells.length}, minmax(0, 1fr))`;
            // If EVERY cell in this row uses "Fit" (grid-adapts-to-image, see
            // Cell renderer above), the row's grid must NOT stretch cells
            // to a common height. CSS Grid defaults to `align-items:
            // stretch`, which would force every cell's wrapper div to the
            // height of the row's TALLEST cell — but a "fit" cell's content
            // only grows to its own image's natural height, so a shorter
            // fit cell sitting next to a taller one would be stretched
            // into an empty box with visible gap below the image (exactly
            // the "gap when fit is on" bug Noah reported: two different-
            // aspect fit images side by side, the shorter one gets padded
            // out to match the taller one). `alignItems: "start"` makes
            // every grid item size to its own content instead.
            // BUGFIX (2026-08-16l): this used to fire whenever ANY cell in
            // the row had `fit` set (row.cells.some(...)) — but that broke
            // the OPPOSITE, much more common case: a row mixing ONE fit
            // cell with a regular aspect-locked cell (e.g. More Work's
            // "front-cover" (scale, non-fit) + "back-cover" (fit) row, or
            // Trade Show's "posters-copy" (non-fit) + "trade-show-banner"
            // (fit) row). In THAT case the non-fit cell is SUPPOSED to
            // stretch to match the fit cell's natural height (this is
            // exactly what the grid editor's own preview does — it never
            // sets align-items at all, so it always defaults to stretch).
            // Forcing align-items:start there left a visible gap below the
            // shorter (non-fit) cell — Noah: "There's a gap that is
            // appearing below the two images on the right that I do not
            // see in the grid editor." Fixed to only special-case the
            // ALL-cells-are-fit scenario (row.cells.every(...)), matching
            // the original 2026-08-16f bug report exactly ("row has 2+
            // cells all set to fit: true"). Any row with a MIX of fit and
            // non-fit cells now falls through to default stretch, matching
            // the editor's behavior 1:1.
            const rowHasFitCell = row.cells.length > 1 && row.cells.every((c) => "fit" in c && c.fit);
            const gridAlignItems = rowHasFitCell ? "start" : undefined;

            return (
            <div key={i} className={`js-grid-row${row.phoneWide ? " js-phone-wide" : ""}`}>
              {row.gapped ? (
                <div
                  style={{
                    paddingTop: `calc(var(--u) * ${GAP_UNITS})`,
                    paddingBottom: `calc(var(--u) * ${GAP_UNITS})`,
                    paddingLeft: `calc(var(--u) * ${GAP_UNITS})`,
                    paddingRight: `calc(var(--u) * ${GAP_UNITS})`,
                  }}
                >
                  <div
                    className="grid js-project-row"
                    style={{
                      gridTemplateColumns,
                      columnGap: `calc(var(--u) * ${GAP_UNITS})`,
                      alignItems: gridAlignItems,
                    }}
                  >
                    {row.cells.map((cell, j) => (
                      <div key={j} className="relative overflow-hidden">
                        <Cell cell={cell} aspect={row.aspect} slug={slug} bgColor={bgColor} />
                        {/* Hairline seam centered in the gap to the right of
                            every cell but the last — matches the artboard's
                            thin black divider sitting inside the white gap. */}
                        {j < row.cells.length - 1 && (
                          <div
                            className="js-cell-seam absolute top-0 h-full"
                            style={{
                              right: `calc(calc(var(--u) * -${GAP_UNITS / 2}) - calc(${RULE_WEIGHT_CSS} / 2))`,
                              width: RULE_WEIGHT_CSS,
                              background: "var(--color-ink)",
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="grid js-project-row"
                  style={{ gridTemplateColumns, alignItems: gridAlignItems }}
                >
                  {row.cells.map((cell, j) => (
                    <div key={j} className="relative overflow-hidden">
                      <Cell cell={cell} aspect={row.aspect} slug={slug} bgColor={bgColor} />
                      {j > 0 && (
                        <div
                          className="js-cell-seam absolute top-0 left-0 h-full"
                          style={{ width: RULE_WEIGHT_CSS, background: "var(--color-ink)" }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* THE RULE BETWEEN ROWS, off on a phone (2026-08-29). Noah:
                  "let's make sure that there are no horizontal grid lines
                  within one section. This makes the content look separate
                  when it's not."

                  On a desktop each row is a band of side-by-side images and
                  the rule is the grid line under it. A phone stacks every
                  cell into its own row, so the same rule lands between two
                  images that are part of one row of the artwork and reads as
                  a section break. The section's own full-bleed rule under its
                  title still separates sections; the white row-gap still
                  separates stacked images. */}
              <div className="js-row-rule">
                <Rule />
              </div>
            </div>
            );
          })}
        </div>
      </StackedSection>
    </>
  );
}
