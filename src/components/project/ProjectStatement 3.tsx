"use client";

import Image from "next/image";
import { FitText } from "@/components/FitText";
import { Stage, Place } from "@/components/Stage";

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
  const serif = { fontFamily: "var(--font-serif)" };
  const paragraphs = Array.isArray(paragraph) ? paragraph : [paragraph];

  // Hand image (pre-rotated 90° so the finger points right — see
  // public/assets/shared/pointing-hand-static-rotated.webp, cropped tight
  // to its alpha bounds). Native size 2696x1490 (~1.81:1).
  const HAND_W = 360; // widened from 280 per Noah's request, still left-aligned
  const LEFT_MARGIN = 36; // same left edge as the statement text/rule above
  const PARAGRAPH_X = 438; // moved 100u left from 538 per Noah's request
  const PARAGRAPH_MAX_WIDTH = 1381; // widened by the same 100u so the right edge holds
  const RELEASE_EXTEND_UNITS = 90; // extends the sticky "stuck" range so it doesn't release too early (was 60, increased 30u per round 8)
  const START_RAISE_UNITS = 20; // lifts the hand's initial rest position 20u higher (unchanged)

  return (
    <div className="relative w-full" style={{ marginTop: "calc(var(--u) * 150)" }}>
      {/* Statement line + rule — fixed, known height, still Stage/Place. */}
      <Stage heightUnits={147} className="overflow-visible">
        <Place x={36} y={0} className="z-10">
          <FitText maxWidthUnits={1841} fontSizeUnits={105} className="leading-[1] tracking-tight">
            {lead}
            <span className="italic" style={serif}>
              {emphasis}
            </span>
            {tail}
          </FitText>
        </Place>
        <Place x={36} y={141} w={1841} className="z-0">
          <div style={{ height: "calc(var(--u) * 6)", background: "var(--color-ink)" }} />
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
      <div className="relative" style={{ marginTop: "calc(var(--u) * 75)" }}>
        <div
          className="absolute"
          style={{
            left: `calc(var(--u) * ${LEFT_MARGIN})`,
            width: `calc(var(--u) * ${HAND_W})`,
            top: `calc(var(--u) * -${START_RAISE_UNITS})`,
            bottom: `calc(var(--u) * -${RELEASE_EXTEND_UNITS})`,
          }}
        >
          <div className="sticky" style={{ top: "calc(var(--u) * 100)" }}>
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
        <div
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
                lineHeight: "1.1375",
              }}
            >
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
