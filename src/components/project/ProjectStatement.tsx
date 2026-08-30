"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Stage, Place } from "@/components/Stage";
import { RULE_WEIGHT_CSS } from "./ProjectGroup";
import { lockScroll, releaseScroll } from "@/lib/scrollLock";
import { useIsPhone, useIsCompact } from "@/lib/useIsPhone";

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

/**
 * renderParagraph — combines the two paragraph-level text features:
 * parenthesis-italics markup AND URL auto-linking. Splits on italic
 * markup first, then runs linkify on each non-italic segment so a URL
 * can still appear outside (or, less usefully, inside) parens without
 * the two features conflicting.
 */
function renderParagraph(text: string): React.ReactNode[] {
  const segments = text.split(ITALIC_MARKUP_PATTERN);
  return segments.map((segment, i) =>
    i % 2 === 1 ? (
      <em key={i} style={{ fontStyle: "italic" }}>
        {segment}
      </em>
    ) : (
      <span key={i}>{linkify(segment)}</span>
    )
  );
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
  const compact = useIsCompact();
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
/** How far the pointing fingertip sits below the hand box's own top, as a
 *  fraction of the box's WIDTH. Measured off the asset: it is pre-rotated to
 *  point right at 2696x1490, its rightmost ink is at y 0.322 of the image,
 *  and the image is 0.5527 as tall as it is wide — 0.322 x 0.5527 = 0.178.
 *  Expressed against width because that is the dimension the layout sets. */
const FINGER_TIP_BELOW_TOP = 0.178;

  const handStickyRef = useRef<HTMLDivElement>(null);
  /** The sticky wrapper's own style attribute, saved while the fall pins it
   *  to the viewport so it can be handed back afterwards. */
  const restoreSticky = useRef<string | null>(null);
  /* WHETHER THE HAND HAS ALREADY FALLEN ON THIS PAGE VIEW. A ref, so it
   * survives the effect being torn down and rebuilt. */
  const hasFallen = useRef(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!handRef.current || !paragraphRef.current || !handStickyRef.current) return;

    /* ONCE IT HAS FALLEN IT STAYS DOWN (2026-08-30). Noah: "the hand will
     * awkwardly appear sometimes on project pages when changing the browser
     * window size."
     *
     * Reproduced exactly: fall the hand at 1512 (it ends `visibility: hidden`),
     * resize to 1100, and it is `visible, opacity 1` again. `gsap.context`
     * reverts the inline styles it set when the effect tears down — and
     * crossing the desktop/compact line is a teardown, because `compact` is in
     * the deps. The revert is right for everything else the context did; it is
     * wrong for the one state that is supposed to outlive it.
     *
     * So the fall records itself, and a rebuild puts the hand straight back
     * down instead of creating a trigger that has already had its turn. This
     * has to sit ABOVE the `compact` bail below, or resizing into the middle
     * band — which is how Noah found it — skips the hide entirely. */
    if (hasFallen.current) {
      gsap.set(handRef.current, { autoAlpha: 0 });
      return;
    }
    /* NOT ON A PHONE (2026-08-25). Noah: "let's not make the hand fall. Let's
     * just keep it stuck and pointing at the content."
     *
     * The whole gesture — the swing, the fall, and the scroll lock that holds
     * the page still while they play — is skipped, leaving the hand where the
     * sticky wrapper puts it, pointing at the copy. Returning before the
     * context is created means there is nothing to revert and nothing that
     * could leave `lockScroll` engaged on a device where getting the page
     * moving again matters more. */
    /* DESKTOP ONLY, 2026-08-29: "let's only have the hand falling animation
     * play when the screen is in desktop mode." Was `phone`, which left the
     * whole gesture — swing, fall, and the scroll lock that holds the page
     * still while they play — running across the entire middle band, where
     * the hand is small and the lock is most annoying. `compact` is the same
     * line the footer's own see-saw reflows on. */
    if (compact) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: paragraphRef.current,
          // The hand's own resolved sticky offset, in real px — see the
          // TRIGGER TIMING FIX note above. A function so it's re-read on
          // every ScrollTrigger refresh (resize, font load, etc.), the same
          // way the rest of this codebase keeps --u-derived pixel values
          // live rather than snapshotting them once.
          //
          // GUARD THE REF (2026-08-23, Noah: "the hand on the project pages
          // also doesn't stop and fall down like it did before"). This ran
          // as `getComputedStyle(handStickyRef.current!)` — the `!` was a
          // lie. `start` is a function specifically so ScrollTrigger can
          // re-call it on ANY refresh anywhere on the page, and StackedSection
          // triggers exactly that: its ResizeObserver fires
          // `ScrollTrigger.refresh()` — GLOBAL, every registered trigger,
          // not just its own — on every section resize, which happens
          // constantly while a page's images decode in. Navigate away
          // mid-decode (prev/next project, or straight back to one already
          // visited) and this component unmounts, `ctx.revert()` kills ITS
          // trigger, and `handStickyRef.current` goes back to null — but if
          // a resize on the page you landed on fires its global refresh
          // before that revert lands, this callback still gets invoked with
          // the now-null ref, and `getComputedStyle(null)` throws. Uncaught,
          // inside a ResizeObserver callback, that aborts ScrollTrigger's
          // refresh pass partway through — leaving OTHER triggers, on the
          // page you're actually looking at (this same hand-fall one very
          // much included), holding stale start positions from before
          // whatever just resized. The fall doesn't "break" so much as
          // never get a correct trigger point to fire from again. Bailing
          // to a start position that can never be crossed, rather than
          // throwing, means a torn-down trigger is inert instead of
          // poisoning every other trigger's next refresh.
          /* FIRES WHEN THE READER REACHES THE LAST SENTENCE (2026-08-25).
           *
           * Noah: "the scrolling then falling hand is getting messed up.
           * Let's have it fall right when the user reached the final sentence
           * in the last paragraph."
           *
           * The paragraph's BOTTOM edge is the end of its final sentence, so
           * the question is where that edge should be on screen when the hand
           * goes. `bottom bottom-=15%` is the moment it clears the foot of the
           * window by a sixth of a screen — the last sentence fully in view
           * and just read, rather than already gone.
           *
           * This reverses 2026-08-23's `bottom top-=80`, which held the fall
           * until the copy had left the screen entirely so the hand would be
           * the only thing moving. That reading is now superseded: he has seen
           * both and wants the fall tied to the reader's place in the text.
           * The hand pins itself to the viewport for the duration either way
           * (see onStart), so it is still whole and centred while it plays.
           *
           * ...AND THEN AT THE FINGERTIP (2026-08-25, second pass). Noah:
           * "the hand is rotating too early. When the pointer finger reaches
           * the last line, the hand should rotate then fall." He knows this
           * reverses the paragraph above — "I know that I'm reversing an
           * earlier decision, I'm proceeding anyway" — and it is a third
           * distinct answer to the same question, so it is worth being exact
           * about what makes it different from the first two.
           *
           * `bottom bottom-=15%` and `bottom top-=80` are both positions in
           * the VIEWPORT: one 15% up from its foot, one just off its top.
           * Neither has anything to do with where the hand is. This is a
           * position on the HAND — the fingertip — and the hand is stuck near
           * the top of the screen while the copy travels up past it, so
           * "the pointer finger reaches the last line" is literally the
           * moment the paragraph's bottom edge draws level with the tip.
           *
           * Both terms are measured rather than guessed:
           *
           *   the element's top   `top: calc(var(--u) * 100)` resolves to a
           *                       different pixel value at every viewport
           *                       width, so it is read off getComputedStyle.
           *   the tip within it   the artwork is pre-rotated to point RIGHT,
           *                       and its rightmost ink sits at 0.322 of the
           *                       asset's height (2696x1490, so height is
           *                       0.5527 of width) — 0.178 of the box's WIDTH
           *                       below its own top, which is the form that
           *                       survives the box being sized in units.
           *
           * Closest in spirit to 2026-08-20's `bottom ${sticky top}px`, which
           * used the box's top edge; the tip is ~0.178W lower than that, so
           * this holds the fall a little longer than that version did. */
          start: () => {
            const el = handStickyRef.current;
            // A trigger position past any real document height — a torn-
            // down component's dead trigger sits here forever rather than
            // crashing the refresh that every OTHER trigger on the page
            // depends on completing.
            if (!el) return 1e9;
            const stickyTop = parseFloat(getComputedStyle(el).top) || 0;
            const tipY = stickyTop + FINGER_TIP_BELOW_TOP * el.getBoundingClientRect().width;
            return `bottom ${tipY}px`;
          },
          once: true,
        },
        /* HOLD THE PAGE STILL WHILE IT PLAYS (2026-08-22, per Noah: "I would
         * like it so the user can't scroll until the hand falling animation
         * is out of the viewport. Let's have it so the interaction plays,
         * then the user can scroll down.")
         *
         * The whole gesture — swing, then fall — is about 1.7s, and the
         * lock spans exactly that: `onComplete` is the moment the hand has
         * left the viewport and hidden itself, so scrolling comes back the
         * instant there is nothing left to watch.
         *
         * The lock releases itself on a timer regardless (see scrollLock),
         * which matters here specifically because this timeline is driven by
         * gsap's rAF ticker: background the tab mid-fall and the ticker
         * stops, so `onComplete` would not arrive until the reader came
         * back. The failsafe means that can't strand anyone.
         *
         * Flagged as an experiment by Noah — "We can revert back if this
         * doesn't feel natural" — so it is one option on this timeline plus
         * a standalone module, and removing it is deleting these two
         * callbacks. */
        /* PINNED TO THE VIEWPORT FOR THE DURATION (2026-08-25).
         *
         * Noah: "When the scrolling/falling hand rotates downwards on the
         * project pages, about half of it is not visible. Make it so the full
         * hand can be seen, then it falls down."
         *
         * Measured mid-swing: the hand's box sits at top -155 in a 900px
         * window, so 139 of its ~300px show. The cause is that by the time
         * this trigger fires — deliberately late, once the last line of copy
         * has cleared the top of the screen — the sticky wrapper's own
         * containing block has ALSO ended, so the hand is no longer stuck. It
         * has gone back to being an ordinary in-flow element and scrolled up
         * with the page, and where it lands is wherever the reader's scroll
         * left it. (This is the same mechanism the `visibility: hidden` at the
         * end of the timeline exists to defend against, at the other end.)
         *
         * Extending the sticky range far enough to still be stuck here would
         * work and would cost 800-odd units of extra page height, all of it
         * blank. Fixing the hand to the viewport instead makes the position
         * deterministic rather than a consequence of scroll — and is safe
         * precisely here, because `lockScroll` means the page cannot move
         * while it plays.
         *
         * The top is computed rather than picked: a 90-degree rotation about
         * a 22%/50% origin puts the artwork's box from 0.5H - 0.22W to
         * 0.5H + 0.78W below the element's own top, so its height is W and
         * its offset is 0.5H - 0.22W. Centring THAT in the window is what
         * guarantees the whole hand is on screen at any window size. */
        onStart: () => {
          lockScroll();
          const el = handStickyRef.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          const W = r.width;
          const H = (W * 1490) / 2696; // the artwork's own aspect
          const rotTop = 0.5 * H - 0.22 * W;
          restoreSticky.current = el.getAttribute("style");
          Object.assign(el.style, {
            position: "fixed",
            top: `${Math.max(16, (window.innerHeight - W) / 2 - rotTop)}px`,
            left: `${r.left}px`,
            width: `${W}px`,
          });
        },
        onComplete: () => {
          releaseScroll();
          // Remembered outside the gsap context, so a later rebuild knows the
          // gesture is spent — see the note at the top of this effect.
          hasFallen.current = true;
          // The hand has hidden itself by now; put the wrapper back so there
          // is no fixed-position element left over on the page.
          const el = handStickyRef.current;
          if (el && restoreSticky.current !== null) {
            el.setAttribute("style", restoreSticky.current);
          }
        },
      });

      tl.to(handRef.current, {
        keyframes: [
          { rotate: 99, duration: 0.28, ease: "power2.out" },
          { rotate: 80, duration: 0.23, ease: "sine.inOut" },
          { rotate: 94, duration: 0.19, ease: "sine.inOut" },
          { rotate: 86.5, duration: 0.16, ease: "sine.inOut" },
          { rotate: 90, duration: 0.13, ease: "sine.inOut" },
        ],
      }).to(
        handRef.current,
        { y: "135vh", rotate: 148, duration: 0.6, ease: "power2.in" },
        "+=0.1"
      ).to(
        // Fades out over the fall's last 0.3s — belt-and-suspenders with
        // the hard hide below, so it visually dissolves rather than
        // snapping away if anything ever renders a frame right at the
        // cutoff.
        handRef.current,
        { opacity: 0, duration: 0.3, ease: "power1.in" },
        "-=0.3"
      ).set(handRef.current, {
        // DOESN'T JUST STOP (2026-08-20, third pass — Noah: "make sure the
        // hand doesn't just stop at some point. Right now it's reaching
        // the first project grid and stopping over it. This is breaking
        // the illusion that it's falling.")
        //
        // The fall's y:135vh transform sends the hand well past the
        // viewport bottom relative to where it's PINNED at the moment the
        // fall starts — but "pinned" is `position: sticky`, and sticky
        // isn't permanent: as the reader keeps scrolling past the
        // paragraph, the hand's wrapper un-sticks (per ordinary sticky
        // rules, once its containing block's own bottom edge passes) and
        // returns to a normal, in-flow document position — with the fall's
        // transform still sitting on top of it, now just a fixed pixel
        // offset on an otherwise ordinary scrolling element. From that
        // point on it scrolls like anything else, and wherever the reader
        // happens to stop scrolling is wherever it visually ends up —
        // which can easily be hovering over the first project grid,
        // exactly the "stopping" Noah saw.
        //
        // Fixed by making the disappearance unconditional rather than
        // relying on the fall having carried it far enough off-screen
        // before any of that could happen: `visibility: hidden` the
        // instant this one-time animation completes, permanently, so
        // there's no scroll position — during the fall, right after, or
        // much later — where it can be visible again. It isn't needed
        // again after this: the "landed" payoff is FallenHand.tsx, in the
        // footer, a separate element entirely.
        visibility: "hidden",
      });
    });
    return () => {
      // Navigating away mid-fall kills the timeline, so its onComplete —
      // which is what normally hands scrolling back — never runs. Release
      // here too, or the next page inherits a frozen scroll until the
      // failsafe expires.
      releaseScroll();
      ctx.revert();
    };
    /* `phone` is false for the server render and the first client render, so
     * without it here a phone would build the desktop timeline once and keep
     * it. */
  }, [phone, compact]);

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
