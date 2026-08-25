"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Stage, Place } from "@/components/Stage";
import { RULE_WEIGHT_CSS } from "./ProjectGroup";
import { lockScroll, releaseScroll } from "@/lib/scrollLock";

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
  className = "",
  onWrapChange,
}: {
  lead: string;
  emphasis: string;
  tail: string;
  maxWidthUnits: number;
  fontSizeUnits: number;
  className?: string;
  onWrapChange?: (wrapped: boolean) => void;
}) {
  const leadText = normalizeSegment(lead, "lead");
  const tailText = normalizeSegment(tail, "tail");

  const probeRef = useRef<HTMLSpanElement>(null);
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

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [leadText, emphasis, tailText, maxWidthUnits, fontSizeUnits]);

  const serif = { fontFamily: "var(--font-serif)" };
  // Measure the PLAIN text (parens stripped) — the parens themselves
  // never render, so including them in the width probe would make the
  // fit-to-width calculation think the line is wider than it actually
  // displays, shrinking the type more than necessary.
  const oneLineText = `${stripItalicMarkup(leadText)}${emphasis}${stripItalicMarkup(tailText)}`;

  return (
    <span style={{ display: "block", position: "relative" }}>
      {/* invisible probe: exactly 1000 artboard units wide, used to read --u in real px */}
      <span
        ref={probeRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", width: "calc(var(--u) * 1000)", height: 0, pointerEvents: "none" }}
      />
      {/* invisible unscaled measurer for the full one-line text */}
      <span
        ref={measureOneLineRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", whiteSpace: "nowrap", top: 0, left: 0, pointerEvents: "none" }}
      >
        {oneLineText}
      </span>
      {/* the VISIBLE text */}
      <span
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
  /** The sticky wrapper's own style attribute, saved while the fall pins it
   *  to the viewport so it can be handed back afterwards. */
  const restoreSticky = useRef<string | null>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!handRef.current || !paragraphRef.current || !handStickyRef.current) return;
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
          /* FIRES ONCE THE COPY HAS LEFT THE SCREEN (2026-08-23, Noah: "I'm
           * noticing the hand will rotate down on the site and fall, but the
           * last sentence or so from the description text is still visible.
           * Let's move the hand down more so its the only thing that can be
           * seen when its interaction plays.")
           *
           * This used to fire when the paragraph's bottom edge reached the
           * hand's own sticky line, which is near the top of the window — so
           * the last line or two were still sitting just above the hand as it
           * swung. Keying off the viewport's top edge instead, with a margin
           * past it, means the trigger cannot fire until the text is
           * genuinely gone. The hand's resting line also moves down (see the
           * sticky wrapper below) so it plays nearer the middle of an empty
           * screen rather than hard against the top of one. */
          start: () => {
            const el = handStickyRef.current;
            // A trigger position past any real document height — a torn-
            // down component's dead trigger sits here forever rather than
            // crashing the refresh that every OTHER trigger on the page
            // depends on completing.
            if (!el) return 1e9;
            return "bottom top-=80";
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
  }, []);

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
  const STAGE_HEIGHT_ONE_LINE = 147;
  const STAGE_HEIGHT_TWO_LINE = 260; // ~2x the single-line text height + gap before rule
  const RULE_Y_ONE_LINE = 141;
  const RULE_Y_TWO_LINE = 254;

  return (
    // Vertical rhythm opened up 2026-08-20 (150 -> 230) per Noah's
    // "add more vertical space between sections of copy and images".
    <div className="relative w-full" style={{ marginTop: "calc(var(--u) * 230)" }}>
      {/* Statement line + rule — fixed, known height, still Stage/Place. */}
      <Stage heightUnits={statementWrapped ? STAGE_HEIGHT_TWO_LINE : STAGE_HEIGHT_ONE_LINE} className="overflow-visible">
        <Place x={36} y={0} className="z-10">
          <StatementFitText
            lead={lead}
            emphasis={emphasis}
            tail={tail}
            maxWidthUnits={1841}
            fontSizeUnits={105}
            className="leading-[1] tracking-tight"
            onWrapChange={setStatementWrapped}
          />
        </Place>
        <Place x={36} y={statementWrapped ? RULE_Y_TWO_LINE : RULE_Y_ONE_LINE} w={1841} className="z-0">
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
                fontSize: "calc(var(--text-lead) * 1.5)",
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
