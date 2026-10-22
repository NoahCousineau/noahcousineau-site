"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { Stage, Place } from "@/components/Stage";
import { RULE_WEIGHT_CSS } from "./ProjectGroup";
import { useIsPhone } from "@/lib/useIsPhone";
import { getLenis } from "@/components/SmoothScroll";

/**
 * linkify — auto-links bare domain mentions (e.g. "socalearth.org") and
 * full URLs inside plain paragraph copy into real, clickable <a> tags,
 * opened in a new tab. Lets Noah write copy like "...visit socalearth.org"
 * in the grid editor's plain-text paragraph field without needing markup.
 */
const URL_PATTERN = /(https?:\/\/[^\s]+|\b[a-zA-Z0-9-]+\.(?:com|org|net|io|co)\b(?:\/[^\s]*)?)/g;
function linkify(text: string): React.ReactNode[] {
  const parts = text.split(URL_PATTERN);
  const testPattern = /^(https?:\/\/[^\s]+|\b[a-zA-Z0-9-]+\.(?:com|org|net|io|co)\b(?:\/[^\s]*)?)$/;
  return parts.map((part, i) => {
    if (testPattern.test(part)) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="underline hover:opacity-60 transition-opacity"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

/**
 * Parenthesis-to-italics markup: writing `(word)` or `(a whole phrase)`
 * anywhere in the Page Text fields (statement lead/tail, or the
 * about/project paragraph) renders that word/phrase in italics on the
 * live site, with the parentheses themselves stripped. This gives Noah
 * a way to italicize MULTIPLE words/phrases within a single block of
 * copy — previously the only italicized segment available was the one
 * dedicated "emphasized phrase" field on the statement, which only
 * supports a single italic run per statement. Per Noah: "There might be
 * times where I want multiple words italicized in the statement text."
 *
 * Deliberately dumb/literal — no nested-parens support, no escaping.
 * Matches the simplest possible mental model for a non-technical editor:
 * "put parens around what you want italic."
 */
const ITALIC_MARKUP_PATTERN = /\(([^()]+)\)/g;

/** Strips the (...) markup down to its bare words, for plain-text uses
 * where JSX rendering isn't needed (e.g. width-measurement probes) — the
 * words show up in the measured width, just without italic styling
 * applied to the measurement itself (matches how the pre-existing
 * "emphasis" measurement already ignored italic font-metric differences). */
function stripItalicMarkup(text: string): string {
  return text.replace(ITALIC_MARKUP_PATTERN, "$1");
}

/**
 * renderWithItalics — splits text on `(...)` markup and wraps each
 * captured group in an <em>, leaving the surrounding text untouched.
 * Returns the original string unchanged (fast path, no wrapper nodes)
 * when no parenthesis markup is present, so existing content with no
 * parens renders exactly as it did before this feature existed.
 */
function renderWithItalics(text: string, keyPrefix: string): React.ReactNode {
  if (!text.includes("(")) return text;
  const segments = text.split(ITALIC_MARKUP_PATTERN);
  if (segments.length === 1) return text;
  return segments.map((segment, i) =>
    i % 2 === 1 ? (
      <em key={`${keyPrefix}-${i}`} style={{ fontStyle: "italic" }}>
        {segment}
      </em>
    ) : (
      segment
    )
  );
}

/* `[label](target)`, where the target is an address or a `#section` on this
 * page — the second added 2026-10-21 for the More Work copy's list of
 * projects. Anchored on `https?://` alone it matched neither, and the lines
 * rendered as literal "[Forced Perspective](#forced-perspective)". */
const LABELLED_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|#[^\s)]+)\)/g;

/**
 * renderInline — the original pair of paragraph features: `(...)` for italics
 * and bare addresses auto-linked by linkify.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const segments = text.split(ITALIC_MARKUP_PATTERN);
  return segments.map((segment, i) =>
    i % 2 === 1 ? (
      <em key={`${keyPrefix}-em-${i}`} style={{ fontStyle: "italic" }}>
        {segment}
      </em>
    ) : (
      <span key={`${keyPrefix}-t-${i}`}>{linkify(segment)}</span>
    )
  );
}

/**
 * renderParagraph — italics, links, and single line breaks.
 *
 * LABELLED LINKS ARE TAKEN OUT FIRST, and that order is the whole trick
 * (2026-10-16). `[here](https://…)` is a link whose text is not the address,
 * which Noah's Corita copy needs: "…can be found here." linking to the PRINT
 * Awards page. linkify alone cannot do it — it only turns an address into a
 * link showing that address, right for "visit socalearth.org".
 *
 * Written the obvious way round, it silently failed: the italics markup is
 * `(...)`, so splitting on that first tore the `(https://…)` out of the link
 * and rendered the URL in italics with a stray "[here]" beside it. Measured
 * on the built page — the sentence never matched and no anchor carried the
 * href. So the link is matched first and only the text between links goes
 * through the italics pass.
 *
 * Single line breaks survive as <br>, which the "More Work" bulleted lines
 * need; a blank line still means a new paragraph, and those are separate
 * entries in the `paragraph` array.
 */
/* IN-PAGE LINKS GO TO THE SECTION'S BAR, not to the top of its box
 * (2026-10-21). Noah, on the More Work page: "I wrote out links to the
 * various projects. Have these linked. When clicked on, the page scrolls
 * down to the corresponding project."
 *
 * Two things a plain `#id` jump gets wrong here. The sections are sticky,
 * so the element itself is rarely where its content begins — the anchor is
 * on the normal-flow sentinel instead. And every section carries 150 units
 * of its own above its header, so landing on the sentinel leaves the bar
 * that names the section still below the fold; adding the bar's own offset
 * puts it exactly where it pins, which is the state the header fades in
 * for.
 *
 * Through Lenis when it is running, so the page travels rather than jumps;
 * it is null under prefers-reduced-motion, and the native fallback there is
 * deliberately instant. */
function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>) {
  const id = e.currentTarget.getAttribute("href")?.slice(1);
  if (!id) return;
  const mark = document.getElementById(id);
  if (!mark) return;
  e.preventDefault();

  /* Measured fresh each time it is asked for, because it MOVES. A link
     near the top of the page can be a 9,000px jump, and the rows it
     travels past have not decoded yet — so the document grows under the
     scroll and a target worked out before setting off lands short. The
     second section of More Work missed by 884px, every time, while the
     five below it (by then loaded) landed exactly. */
  const targetY = () => {
    const section = mark.nextElementSibling as HTMLElement | null;
    /* The header's own TOP MARGIN, which is the 150 units each section
       carries above its bar — read as a resolved length so it is right at
       any width. Not `offsetTop`: the bar's offsetParent is the sticky
       header wrapping it, so that measured 0 and every link landed a bar's
       height short. Not the bar's rect either, which is wherever sticky
       has it pinned at the moment of the click. */
    const head = section?.querySelector<HTMLElement>(":scope > .sticky");
    const lead = head ? parseFloat(getComputedStyle(head).marginTop) || 0 : 0;
    return mark.getBoundingClientRect().top + window.scrollY + lead;
  };

  const lenis = getLenis();
  let tries = 0;
  /* Re-aim after arriving, up to a few times: each correction is shorter
     than the last because less is left to load, and it stops as soon as
     the page is where it should be. */
  const settle = () => {
    if (tries >= 3) return;
    window.setTimeout(() => {
      if (Math.abs(targetY() - window.scrollY) > 2) go(0.4);
    }, 140);
  };
  const go = (duration: number) => {
    tries += 1;
    const y = targetY();
    if (lenis) lenis.scrollTo(y, { duration, onComplete: settle });
    else {
      // No Lenis under prefers-reduced-motion; the jump is instant there.
      window.scrollTo({ top: y });
      settle();
    }
  };
  go(1.2);
}

function renderParagraph(text: string): React.ReactNode[] {
  return text.split("\n").flatMap((line, li) => {
    const out: React.ReactNode[] = [];
    let at = 0;
    for (const m of line.matchAll(LABELLED_LINK)) {
      if (m.index > at) out.push(...renderInline(line.slice(at, m.index), `${li}-${at}`));
      const inPage = m[2].startsWith("#");
      out.push(
        <a
          key={`${li}-link-${m.index}`}
          href={m[2]}
          target={inPage ? undefined : "_blank"}
          rel={inPage ? undefined : "noreferrer"}
          onClick={inPage ? scrollToSection : undefined}
          className="underline hover:opacity-60 transition-opacity"
        >
          {m[1]}
        </a>
      );
      at = m.index + m[0].length;
    }
    if (at < line.length) out.push(...renderInline(line.slice(at), `${li}-${at}`));
    return li === 0 ? out : [<br key={`br-${li}`} />, ...out];
  });
}

/**
 * StatementFitText — like the shared FitText, but for the "How do you
 * make X look Y?" statement line specifically: it measures the FULL
 * one-line text at the target size and, if it would overflow the max
 * width even after being allowed to shrink to a MIN readable size, wraps
 * onto two lines (tail text drops to its own line) instead of shrinking
 * indefinitely into illegibility. Below the wrap threshold it behaves
 * exactly like FitText (single line, shrink-to-fit).
 *
 * Per Noah: "If the text gets too large, please have 'look resourceful?'
 * drop down a line" — rather than just keep shrinking the whole line.
 *
 * Also normalizes spacing between lead/emphasis/tail: the source data
 * doesn't reliably include trailing/leading spaces around the emphasized
 * phrase (e.g. "How do you make" + "a brand" + "look resourceful?" with
 * no spaces baked in), so this pads each segment with a single space
 * where needed instead of relying on the JSON to supply exact whitespace.
 */
function normalizeSegment(s: string, side: "lead" | "tail"): string {
  const trimmed = s.replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  if (side === "lead") return trimmed.endsWith(" ") ? trimmed : trimmed + " ";
  return trimmed.startsWith(" ") ? trimmed : " " + trimmed;
}

function StatementFitText({
  lead,
  emphasis,
  tail,
  maxWidthUnits,
  fontSizeUnits,
  fitToWidth = true,
  onHeightChange,
  className = "",
  onWrapChange,
}: {
  lead: string;
  emphasis: string;
  tail: string;
  maxWidthUnits: number;
  fontSizeUnits: number;
  /** When false the type stays at `fontSizeUnits` and wraps instead of being
   *  shrunk onto one line — see the phone note at the call site. */
  fitToWidth?: boolean;
  /** Reports the rendered height in artboard units. Needed because with
   *  `fitToWidth` off the line count is not knowable in advance — see the
   *  note on STAGE_HEIGHT below. */
  onHeightChange?: (units: number) => void;
  className?: string;
  onWrapChange?: (wrapped: boolean) => void;
}) {
  const leadText = normalizeSegment(lead, "lead");
  const tailText = normalizeSegment(tail, "tail");

  const probeRef = useRef<HTMLSpanElement>(null);
  const visibleRef = useRef<HTMLSpanElement>(null);
  const measureOneLineRef = useRef<HTMLSpanElement>(null);
  const [fontScale, setFontScale] = useState(1);
  const [wrapped, setWrapped] = useState(false);

  // Minimum scale before we give up on shrinking and wrap to two lines
  // instead — keeps the type from getting illegibly small on long copy.
  const MIN_SCALE = 0.55;

  useLayoutEffect(() => {
    const probe = probeRef.current;
    const measureOneLine = measureOneLineRef.current;
    if (!probe || !measureOneLine) return;

    const fit = () => {
      if (!fitToWidth) {
        // Full size, wrapping freely. `wrapped` is the multi-line branch of
        // the render below, which is exactly what is wanted here — it is
        // only ever reached on desktop as a last resort, but it is the same
        // layout.
        setFontScale(1);
        setWrapped(true);
        onWrapChange?.(true);
        return;
      }
      const uPx = probe.getBoundingClientRect().width / 1000;
      measureOneLine.style.fontSize = `${fontSizeUnits * uPx}px`;
      const maxPx = uPx * maxWidthUnits;
      const w = measureOneLine.scrollWidth;
      if (maxPx <= 0) {
        setFontScale(1);
        setWrapped(false);
        onWrapChange?.(false);
        return;
      }
      const scale = maxPx / w;
      if (scale < MIN_SCALE) {
        // Would need to shrink below the readable floor — wrap the tail
        // onto its own line instead, at the min scale.
        setWrapped(true);
        setFontScale(MIN_SCALE);
        onWrapChange?.(true);
      } else {
        setWrapped(false);
        setFontScale(Math.min(1, scale));
        onWrapChange?.(false);
      }
    };

    /* The rendered height, for callers that cannot predict the line count.
     * Reported in artboard units so it composes with everything else. */
    const report = () => {
      const el = visibleRef.current;
      if (!el || !onHeightChange) return;
      const uPx = probe.getBoundingClientRect().width / 1000;
      if (uPx > 0) onHeightChange(el.getBoundingClientRect().height / uPx);
    };

    const run = () => {
      fit();
      report();
    };

    fit();
    report();
    const ro = new ResizeObserver(run);
    ro.observe(document.documentElement);
    if (visibleRef.current) ro.observe(visibleRef.current);
    window.addEventListener("resize", run);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", run);
    };
    // `onWrapChange`/`onHeightChange` are deliberately not dependencies: both
    // are callers' inline callbacks, so a new identity every render, and
    // listing them would tear down and rebuild the ResizeObserver on every
    // single render. They are only ever called, never read for their value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadText, emphasis, tailText, maxWidthUnits, fontSizeUnits, fitToWidth]);

  const serif = { fontFamily: "var(--font-serif)" };
  // Measure the PLAIN text (parens stripped) — the parens themselves
  // never render, so including them in the width probe would make the
  // fit-to-width calculation think the line is wider than it actually
  // displays, shrinking the type more than necessary.
  const oneLineText = `${stripItalicMarkup(leadText)}${emphasis}${stripItalicMarkup(tailText)}`;

  return (
    <span style={{ display: "block", position: "relative" }}>
      {/* THE TWO MEASURING SPANS LIVE IN A CLIPPED 0x0 BOX.
          `visibility: hidden` hides them but does not stop them taking part
          in layout, and the one-line measurer is `white-space: nowrap` by
          construction — it exists to find out how wide the text WOULD be on
          one line. So it is as wide as that answer, and it was pushing the
          document out to match: measured on a phone at the doubled size,
          776px of it inside a 390px window, which set off mobile
          shrink-to-fit and quietly rescaled the whole site. A 0x0
          `overflow: hidden` parent is a scroll container, so its children's
          size stops there and never reaches the document — while each child
          still lays out at its own real width, which is the only thing the
          measurements need. */}
      <span
        aria-hidden
        style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
      >
        {/* exactly 1000 artboard units wide, used to read --u in real px */}
        <span
          ref={probeRef}
          style={{ display: "block", width: "calc(var(--u) * 1000)", height: 0 }}
        />
        {/* unscaled measurer for the full one-line text */}
        <span
          ref={measureOneLineRef}
          style={{ display: "block", whiteSpace: "nowrap" }}
        >
          {oneLineText}
        </span>
      </span>
      {/* the VISIBLE text */}
      <span
        ref={visibleRef}
        className={className}
        style={{
          display: "block",
          whiteSpace: wrapped ? "normal" : "nowrap",
          fontSize: `calc(var(--u) * ${fontSizeUnits * fontScale})`,
        }}
      >
        {wrapped ? (
          <>
            <span style={{ display: "block" }}>
              {renderWithItalics(leadText, "lead")}
              <span className="italic" style={serif}>
                {emphasis}
              </span>
            </span>
            <span style={{ display: "block" }}>{renderWithItalics(tailText.trimStart(), "tail")}</span>
          </>
        ) : (
          <>
            {renderWithItalics(leadText, "lead")}
            <span className="italic" style={serif}>
              {emphasis}
            </span>
            {renderWithItalics(tailText, "tail")}
          </>
        )}
      </span>
    </span>
  );
}

/*
 * ProjectStatement — the "What does X look like?" block that opens every
 * project's write-up, directly under the hero image.
 *
 * Per Noah: "The formatting for this should have the same text size,
 * fonts, horizontal rule, and spacing as on the home screen." So the
 * statement line + rule reuse the EXACT same building blocks as the
 * homepage's Description component (Stage/Place unit system, FitText,
 * 105u font size, 6u rule) — guarantees a literal match, not a lookalike.
 *
 * Below the rule, the hand + paragraph are laid out in NORMAL FLOW (not
 * fixed-height Stage/Place) so the block's height is intrinsic to however
 * many lines the paragraph wraps to — a fixed-height absolute layout
 * would either clip long copy or leave dead space for short copy, and
 * this is a reusable template other projects' (longer/shorter) copy will
 * flow through. The hand is absolutely positioned *within* that flow
 * block so it doesn't affect the paragraph's own height.
 *
 * Spacing per feedback round 2:
 *  - 150u gap between the hero image and this block (was 0 — missed in
 *    the prior pass).
 *  - 75u gap between the rule and the hand/paragraph row.
 *  - Hand is static (no rotation animation, unlike the homepage's), sized
 *    down close to the artboard sketch's hand-icon proportions.
 *  - Hand rotated 90° so the finger points sideways, aligned to the same
 *    left margin as the statement text/rule (x36) rather than being
 *    derived from the paragraph's position — per Noah's explicit request
 *    to "align it to the left margin."
 *  - Paragraph type size increased 1.5x per feedback round 3.
 *  - Text column extended 100u further left (round 4) — PARAGRAPH_X moved
 *    from 538 to 438, widening the column to hold longer copy without the
 *    hand's overlap zone changing (hand still sits at the left margin).
 *  - `paragraph` accepts a string OR string[] so a project can run
 *    multiple paragraphs (each its own <p>, stacked with normal spacing).
 *  - Hand becomes sticky once scrolled 100u from the viewport top (round
 *    5): the hand's horizontal position never changes; vertically it
 *    pins at 100u from the top while the reader scrolls through the
 *    paragraph copy, then releases and scrolls away normally once the
 *    text block ends (standard CSS sticky-sidebar pattern — the sticky
 *    child's "stuck" range is bounded by its own wrapper's height, which
 *    is stretched via absolute inset-y-0 to exactly match the paragraph
 *    column's height, so it detaches right as the last line passes).
 *  - Hand widened to 360u (round 6, was 280u), still left-aligned at the
 *  - Release point extended 90u further (round 8, was 60u).
 *  - Starting position raised 20u (round 7) — hand engages sticky 20u
 *    earlier. Release point independent (governed by bottom offset).
 *  - Leading reduced 15% on about text (round 13, was 30%): from
 *    leading-relaxed (1.625) to ~1.38125, a gentler tightening that
 *    keeps better breathing room. Hand sticky start/end unchanged.
 *  - 300u gap after this block before the first project group — see
 *    topGapUnits on ProjectGroup.
 */
export function ProjectStatement({
  lead,
  emphasis,
  tail,
  paragraph,
}: {
  /** Text before the emphasized word/phrase, e.g. "What does " */
  lead: string;
  /** The italic-serif emphasized word/phrase, e.g. "fresh" */
  emphasis: string;
  /** Text after, e.g. " look like?" */
  tail: string;
  /** Body copy below the hand — one string, or an array for multiple paragraphs. */
  paragraph: string | string[];
}) {
  const phone = useIsPhone();
  /** The question's rendered height in artboard units, on phones where the
   *  line count is not known ahead of time. See STAGE_HEIGHT below. */
  const [questionHeight, setQuestionHeight] = useState<number | null>(null);
  const paragraphs = Array.isArray(paragraph) ? paragraph : [paragraph];
  const [statementWrapped, setStatementWrapped] = useState(false);
  const handRef = useRef<HTMLDivElement>(null);
  const paragraphRef = useRef<HTMLDivElement>(null);

  /* SWING, THEN FALL (2026-08-20, per Noah: "change the hand from a
   * scrolling animation to more of a one-and-done triggered animation. In
   * this, the hand rotation downwards doesn't start until we get to the end
   * of the paragraph. It then swings a bit as if it's swinging from one
   * loose nail. The hand then falls down and out of the view of the project
   * page.")
   *
   * The hand asset is pre-rotated so the finger points RIGHT at rest, which
   * makes +90deg point it straight DOWN — at the content waiting below.
   *
   * ONE-AND-DONE: `once: true`, so it fires at the end of the paragraph and
   * never rewinds. The previous version used toggleActions with a reverse,
   * which meant nudging back up the page un-dropped the hand — wrong for a
   * gesture that is supposed to have happened.
   *
   * THE LOOSE NAIL: a decaying alternation around 90deg, overshooting then
   * undershooting by less each pass. That shape is the point — a single
   * eased tween arrives smoothly and reads as a mechanism, whereas swinging
   * past the mark and losing amplitude each time reads as weight hanging
   * off one nail. The pivot sits at the wrist end, not the centre, so it
   * hinges from the arm rather than spinning about its middle.
   *
   * THE FALL: after the swing settles it drops clean off the bottom of the
   * page, turning as it goes, on an accelerating ease so gravity reads. It
   * lands in the footer — see components/FallenHand.tsx, which is the other
   * half of "it should feel as if it fell off and went all the way to the
   * bottom of the page."
   *
   * TRIGGER TIMING FIX (2026-08-20, second pass — Noah: "the turning and
   * dropping is happening too early. It should only happen when the pointer
   * finger reaches the very end of the last paragraph.") The old trigger,
   * `start: "bottom 78%"`, fired once the paragraph's bottom edge reached
   * 78% down the VIEWPORT — a number with no relationship to where the hand
   * actually sits. The hand pins at `top: 100u` (see the sticky wrapper
   * below), which is close to the TOP of the screen, not 78% down — so the
   * swing fired while several lines of text were still below the hand,
   * un-read.
   *
   * The fingertip only "reaches the end" at the moment the paragraph's own
   * bottom edge scrolls up PAST the hand's fixed height — since the hand
   * stays put on screen while the text moves up through it, that's the
   * instant the last line passes the hand, matching the reader's own
   * progress rather than an arbitrary viewport fraction. `handStickyRef`
   * below is measured (not hardcoded) because `top: 100u` is a --u value
   * that scales with viewport width — its real pixel offset is whatever
   * the browser resolves `calc(var(--u) * 100)` to right now, which a
   * static ScrollTrigger position can't express.
   */

  const handStickyRef = useRef<HTMLDivElement>(null);
  /* THE HAND NO LONGER SWINGS, FALLS, OR HOLDS THE PAGE STILL (2026-10-21).
   *
   * Noah: "on the project pages on desktop, stopping the page for the hand
   * to fall is stopping the flow of things. Let's update the hand that is
   * still pointing to the description, but make it so the finger doesn't
   * rotate and then fall down. It should act like how it does on mobile."
   *
   * What stood here was the swing, the drop, and a `lockScroll` that held
   * the page while they played — about 280 lines of it, already skipped on
   * anything narrower than 1200 (Noah, 2026-08-25: "let's not make the hand
   * fall. Let's just keep it stuck and pointing at the content"). Desktop
   * now does what the phone has done since: the sticky wrapper below puts
   * the hand beside the copy and it stays there, pointing. */

  // Hand image (pre-rotated 90° so the finger points right — see
  // public/assets/shared/pointing-hand-static-rotated.webp, cropped tight
  // to its alpha bounds). Native size 2696x1490 (~1.81:1).
  const HAND_W = 360; // widened from 280 per Noah's request, still left-aligned
  const LEFT_MARGIN = 36; // same left edge as the statement text/rule above
  const PARAGRAPH_X = 438; // moved 100u left from 538 per Noah's request
  const PARAGRAPH_MAX_WIDTH = 1381; // widened by the same 100u so the right edge holds
  const RELEASE_EXTEND_UNITS = 90; // extends the sticky "stuck" range so it doesn't release too early (was 60, increased 30u per round 8)
  const START_RAISE_UNITS = 20; // lifts the hand's initial rest position 20u higher (unchanged)

  // When the statement wraps to two lines (tail drops down per Noah's
  // request), the Stage needs extra height and the rule needs to sit
  // below the second line instead of at its single-line position.
  /* These two are the desktop cases: the question is fitted onto one line,
   * or wrapped onto exactly two when it will not shrink far enough. Both
   * counts are knowable in advance, so both heights can be constants.
   *
   * On a phone neither holds. The question renders at its full doubled size
   * and wraps to however many lines the words happen to need — three for
   * SoCal Earth, more or fewer elsewhere — so the height is MEASURED and
   * reported back by StatementFitText instead. Leaving it at the two-line
   * constant is what put the question on top of the paragraph below it. */
  const STAGE_HEIGHT_ONE_LINE = 147;
  const STAGE_HEIGHT_TWO_LINE = 260; // ~2x the single-line text height + gap before rule
  /** Space between the question's last line and the rule under it. */
  const RULE_GAP_UNITS = 36;
  const RULE_Y_ONE_LINE = 141;
  const RULE_Y_TWO_LINE = 254;

  return (
    // Vertical rhythm opened up 2026-08-20 (150 -> 230) per Noah's
    // "add more vertical space between sections of copy and images".
    <div className="relative w-full" style={{ marginTop: "calc(var(--u) * 230)" }}>
      {/* Statement line + rule — fixed, known height, still Stage/Place. */}
      <Stage
        heightUnits={
          phone && questionHeight != null
            ? questionHeight + RULE_GAP_UNITS + 6
            : statementWrapped
            ? STAGE_HEIGHT_TWO_LINE
            : STAGE_HEIGHT_ONE_LINE
        }
        className="overflow-visible"
      >
        <Place x={36} y={0} className="z-10">
          <StatementFitText
            lead={lead}
            emphasis={emphasis}
            tail={tail}
            maxWidthUnits={1841}
            /* 2026-08-25, phones: "Double the size of the lead-in question."
               Raising this alone does nothing, which is worth recording: the
               component shrinks the type until the whole question fits on ONE
               line of `maxWidthUnits`, so a bigger ceiling just means a
               smaller scale factor and an identical rendered size. The size
               only takes effect once the one-line rule is dropped — hence
               `fitToWidth={false}`, which lets it wrap and keeps it at 210. */
            fontSizeUnits={phone ? 210 : 105}
            fitToWidth={!phone}
            onHeightChange={setQuestionHeight}
            className="leading-[1] tracking-tight"
            onWrapChange={setStatementWrapped}
          />
        </Place>
        <Place
          x={36}
          y={
            phone && questionHeight != null
              ? questionHeight + RULE_GAP_UNITS
              : statementWrapped
              ? RULE_Y_TWO_LINE
              : RULE_Y_ONE_LINE
          }
          w={1841}
          className="z-0"
        >
          <div style={{ height: RULE_WEIGHT_CSS, background: "var(--color-ink)" }} />
        </Place>
      </Stage>

      {/* Hand + paragraph(s) — normal flow (intrinsic height). The hand's
          wrapper is absolutely positioned but stretched (top offset raised
          20u to lift its starting position, extended slightly past
          bottom:0) to exceed the paragraph column's height by
          RELEASE_EXTEND_UNITS; the hand itself is position:sticky inside
          that wrapper, so it pins 100u from the viewport top while
          scrolling through the text and releases just after the last
          line, rather than slightly before it. */}
      <div className="relative" style={{ marginTop: "calc(var(--u) * 115)" }}>
        <div
          className="absolute"
          style={{
            left: `calc(var(--u) * ${LEFT_MARGIN})`,
            width: `calc(var(--u) * ${HAND_W})`,
            top: `calc(var(--u) * -${START_RAISE_UNITS})`,
            bottom: `calc(var(--u) * -${RELEASE_EXTEND_UNITS})`,
            // HAND STAYS ABOVE PROJECT CONTENT WHILE IT FALLS (2026-08-20,
            // per Noah: "Make it so when the hand falls, it doesn't get
            // covered by any of the project content.") Every project group
            // section below carries an explicit z-index (see
            // StackedSection's `stackIndex + 1`, needed for the
            // stacking-scroll effect) — a real, positive number. This
            // wrapper had none, which for stacking purposes is treated as
            // z-index:auto (effectively 0), so as soon as the falling hand
            // dropped low enough to visually overlap any section, that
            // section — having an explicit, higher z-index — painted OVER
            // it, not under. A number safely above the highest realistic
            // stackIndex (comfortably clears even a project with dozens of
            // groups) keeps the hand on top for its entire fall, without
            // guessing the exact count for any given project.
            zIndex: 100,
          }}
        >
          {/* 100u -> 320u: the hand rests nearer the middle of the window,
              so the fall reads against empty page rather than starting at
              its very top edge. See the trigger note above. */}
          <div ref={handStickyRef} className="sticky" style={{ top: "calc(var(--u) * 320)" }}>
            {/* Rotation wrapper for the end-of-paragraph swing (see the
                effect above). Kept separate from the sticky element so the
                two transforms never fight: sticky owns the vertical
                travel, this owns the rotation. */}
            <div ref={handRef} style={{ transformOrigin: "22% 50%" }}>
              <Image
                src="/assets/shared/pointing-hand-static-rotated.webp"
                alt=""
                width={2696}
                height={1490}
                sizes="20vw"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
        <div
          ref={paragraphRef}
          style={{
            marginLeft: `calc(var(--u) * ${PARAGRAPH_X})`,
            maxWidth: `calc(var(--u) * ${PARAGRAPH_MAX_WIDTH})`,
          }}
        >
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className={`m-0 ${i > 0 ? "mt-[1em]" : ""}`}
              style={{
                /* ...and "Reduce the descriptive text size down by 1/3."
                   1.5 -> 1.0 of --text-lead, which is that two-thirds. */
                fontSize: phone
                  /* +15% on 2026-08-29: "in mobile mode, let's increase the
                     size of the descriptive copy by 15%." */
                  ? "calc(var(--text-lead) * 1.15)"
                  : "calc(var(--text-lead) * 1.5)",
                fontFamily: "var(--font-sans)",
                lineHeight: "1.38125",
              }}
            >
              {renderParagraph(p)}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
