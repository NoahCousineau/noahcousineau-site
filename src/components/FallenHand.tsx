"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { uFont } from "./Stage";
import { THIRD_COLUMN_X } from "./footerLayout";
import { useIsCompact } from "@/lib/useIsPhone";

/*
 * FALLEN HAND + NEXT PROJECT (2026-08-20, per Noah: "Let's have the hand on
 * the bottom of the page. It's pointing to a link that says 'next project',
 * which brings the user to the next project. The hand should be rocking
 * just slightly when it's first in view as if it just fell from high up.")
 *
 * This is the landing of the drop that begins in ProjectStatement, where
 * the hand swings off its loose nail at the end of the paragraph and falls
 * out of the page. Here it has come to rest at the bottom of the footer,
 * pointing at the way onward.
 *
 * NO FALL, NO FADE (2026-08-20, per Noah: "I don't like how the hand fades
 * in as we scroll down. It should already be down at the bottom and
 * rocking to a standstill like it already fell.") The earlier build
 * animated the hand IN — dropping from -34vh and fading from opacity 0 —
 * which read as the hand arriving right then, tied to the reader's scroll
 * position. Noah's correction: the fall already happened, off-screen,
 * before the reader ever got here. So the hand's position and opacity
 * never animate at all; it sits at its landed spot from the moment the
 * component exists (invisible behind the footer curtain until scrolled
 * into view, same as everything else back there). The ONLY thing that
 * plays is a decaying rotational wobble, starting from a displaced tilt
 * and settling to rest — the tail end of a fall the reader didn't see,
 * not the fall itself.
 *
 * PIVOT = THE HAND'S OWN LOWEST PIXEL (2026-08-20, per Noah: "I just want
 * it brought down to the very bottom of the viewport. the bottom-most
 * point of the hand should be rocking on the footer bottom.") Measured off
 * pointing-hand-static-rotated.webp's alpha channel: the artwork's lowest
 * opaque pixel sits at 99.9% down the image (effectively its own bottom
 * edge — this asset carries almost no transparent margin) at 38.4% across.
 * The wrapper sits flush (`bottom: 0`) against the footer's bottom edge,
 * and `transformOrigin` is set to that exact point, so it is the one pixel
 * that never moves under rotation — rocking happens AROUND it, which is
 * what "rocking on the footer bottom" means literally, not just visually.
 * A centre-of-element pivot would instead swing the whole hand through the
 * floor on every downswing.
 *
 * WHY IT TRIGGERS OFF THE SPACER: the footer is `position: fixed` (see the
 * curtain note in Footer.tsx), so it never travels through the scrollport
 * and cannot drive a ScrollTrigger itself. The spacer that reserves the
 * uncovering distance does scroll, so it is the honest signal for "the
 * reader has reached the bottom" — which is also "the hand is first in
 * view", the moment Noah wants the rocking to start.
 *
 * The hand and label sit in one flex row so the finger always points at the
 * label regardless of viewport width, rather than the two being positioned
 * independently and drifting apart as the artboard scales.
 */

/** Where the hand comes to rest, in degrees. Slightly nose-up so the finger
 * reads as pointing at the label rather than lying flat. */
const REST_ROTATION = -6;

/** Hand width, artboard units — unchanged from the previous build. */
const HAND_W_UNITS = 330;
/** Gap between the hand and the label. */
const HAND_LABEL_GAP_UNITS = 30;

/* The phone column — see the note at the render. The hand is turned on its
 * side there, so its rendered HEIGHT is this width times the artwork's
 * 1490/2696 aspect inverted; 900 units across gives a hand about as tall as
 * it is wide on a 390px screen. */
/* x1.5 on 2026-08-25, with the label — Noah: "make sure the hand is center
 * aligned to the page. Increase the size by 1.5x. increase the size of 'next
 * project'." */
const PHONE_HAND_W_UNITS = 900 * 1.5;
/*
 * AND A CEILING ON ALL OF IT (2026-08-29). Noah: "make sure the head or the
 * hand isn't so large that it conflicts with the footer content."
 *
 * The column layout now runs from 390 up to 1199, and every number in it is
 * in artboard units — which means it TRIPLES across that band. 1350 units is
 * 274px on a 390 screen and would be 843px at 1199, a hand two-thirds the
 * height of the window with the links behind it. The label does the same
 * thing: 144 units is 29px and would be 90px.
 *
 * So each is capped in px at roughly the size it reaches on a large phone.
 * Below that nothing moves — at 390 every min() below picks the unit term —
 * and above it the composition simply stops growing, which is what stops it
 * colliding with anything.
 */
const PHONE_HAND_MAX_PX = 300;
const PHONE_LABEL_MAX_PX = 30;
/** The hand's rendered width: artboard units until they exceed the cap. */
const PHONE_HAND_W_CSS = `min(calc(var(--u) * ${PHONE_HAND_W_UNITS}), ${PHONE_HAND_MAX_PX}px)`;
const PHONE_LABEL_GAP_UNITS = 40;
const PHONE_LABEL_FONT = 96 * 1.5;

/*
 * WHERE THE FINGERTIP ACTUALLY ENDS UP, and why the hand needed centring at
 * all (2026-08-25).
 *
 * The phone hand is the same artwork turned a quarter anticlockwise, and the
 * turn happens about the pivot the fall uses — 38.4%/99.9%, the artwork's
 * lowest opaque pixel — not about the box's centre. Rotating about an
 * off-centre point MOVES the box, so `items-center` was centring a box whose
 * contents had walked out of it: measured on a 390px screen, the fingertip
 * sat at x=105 against a page centre of 195. Ninety pixels off, under a rule
 * it is supposed to be holding up.
 *
 * Solving it rather than nudging it. The fingertip is the artwork's rightmost
 * ink, 99.96% across and 32.315% down its own box; the box is 1490/2696 =
 * 0.5527 as tall as it is wide. Carrying both through a -90 degree rotation
 * about the pivot puts the fingertip at (0.0105W, -0.0635W) from the div's
 * own top-left, W being its width — and the rotated bounding box runs from
 * y = -0.0639W, so the fingertip lands 0.0004W below its top edge. It IS the
 * top edge, which is what makes the layout below simple: give the hand a
 * container one W tall, sit the bounding box's top at the container's top,
 * and the fingertip is exactly at that container's top edge.
 */
const PHONE_TIP_DX = 0.0105;
const PHONE_TIP_DY = -0.0635;
/** The rotated bounding box's height, which is the hand's own width once it
 *  is on its side. (Its left edge is at -0.1681W, recorded here in prose
 *  since the layout centres on the fingertip rather than on the box.) */
const PHONE_ROT_H = 1.0;

/** Pointing straight up. The artwork is drawn pointing right. */
const PHONE_REST_ROTATION = -90;
/** Where the column sits against the foot of the screen. NEGATIVE since
 *  2026-08-29 — Noah: "scoot the whole interaction down so the bottom of the
 *  hand bleeds off the bottom of the page." It used to be lifted 200 units
 *  clear; now the wrist runs off the edge instead of stopping short of it. */
const PHONE_BOTTOM_UNITS = -300;
/** The label's left edge lands at THIRD_COLUMN_X (2026-08-20, per Noah:
 * "Have 'next project' in the same column as 'valley strong credit union'
 * and 'more work'. Shift the hand over as needed to keep it pointing to
 * it.") The row is `left + [hand][gap][label]`, so solving for the row's
 * own left edge is what shifts the hand along with the label — moving
 * either alone would separate the finger from what it's pointing at. */
const ROOT_LEFT_UNITS = THIRD_COLUMN_X - HAND_W_UNITS - HAND_LABEL_GAP_UNITS;

/** Pivot point, as a fraction of the hand image's own box — the artwork's
 * measured bottom-most opaque pixel (see the file header). */
const PIVOT = { xPct: 38.4, yPct: 99.9 };

/** Hand height, derived from its width and the asset's own aspect ratio
 * (2696x1490), for the fingertip math below. */
const HAND_H_UNITS = (HAND_W_UNITS * 1490) / 2696;
/** How far up from the row's bottom edge the label sits, so it lands at
 * fingertip height rather than at an eyeballed offset. The fingertip
 * (rightmost opaque pixel) measures 32.3% down the hand's own box, i.e.
 * HAND_H_UNITS * (1 - 0.323) above the bottom — trimmed by the label's own
 * ~10u bottom padding (its underline sits below the text baseline), since
 * what needs to land at fingertip height is the visible text, not the
 * link element's outer box. */
const LABEL_MARGIN_BOTTOM_UNITS = HAND_H_UNITS * (1 - 0.32315) - 10;

export default function FallenHand({
  triggerRef,
  nextHref,
}: {
  /** The footer's scroll spacer; see above for why this and not the footer. */
  triggerRef: React.RefObject<HTMLDivElement | null>;
  /** Destination for the label — the next project in the running order. */
  nextHref: string;
}) {
  /* THE COLUMN ARRANGEMENT RUNS THE WHOLE WAY DOWN FROM 1200, matching the
   * links beside it — see the note in Footer.tsx. Nothing here is
   * phone-specific any more: the sizes that used to need a separate phone
   * case are now capped in px instead (PHONE_HAND_MAX_PX and friends), which
   * covers both tiers with one set of numbers. */
  const compact = useIsCompact();
  const handRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** The plank — "next project" and the rule it sits on, as one rigid body. */
  const plankRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hand = handRef.current;
    const trigger = triggerRef.current;
    if (!hand || !trigger) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger,
          // FIX (2026-08-20, per Noah: "make it start to rock as soon as we
          // see it at the bottom") — this used to be "bottom bottom+=140",
          // which fires only once the SPACER's bottom clears the viewport
          // bottom by 140px more. Since the spacer is exactly one viewport
          // tall and immediately precedes the fixed footer in the document,
          // its bottom clearing the viewport doesn't happen until the
          // reveal is already fully finished — so the wobble was starting
          // well after the hand had been sitting there, fully visible, the
          // whole time.
          //
          // The footer doesn't slide in; it's already there, fixed, the
          // whole page long — what moves is .site-content sliding UP and
          // off, uncovering the (stationary) footer from the BOTTOM of the
          // viewport upward. The hand sits at the very bottom of the
          // footer, so it's the very FIRST sliver the reveal exposes — the
          // instant that happens is the spacer's TOP reaching the
          // viewport's bottom, i.e. "top bottom", not its bottom.
          start: "top bottom",
          once: true,
        },
      });

      // Rotation only — no y, no opacity. The "from" here is applied the
      // moment this tween is created (GSAP's default immediateRender for
      // fromTo), which is on mount, not on trigger — but the hand is
      // sitting behind the opaque footer curtain at that point (see the
      // full-page footer reveal in Footer.tsx), so the jump to a displaced
      // tilt is never actually seen. All the reader sees is: the curtain
      // slides away, the hand is already there, already a little tilted —
      // and immediately settles, exactly as if it landed moments before
      // they arrived.
      /* THE REST ANGLE DEPENDS ON THE LAYOUT, and until 2026-08-25 this
       * tween assumed the desktop one. On a phone the hand points straight
       * up, and this animated it to -6 — flat — which would have undone the
       * quarter turn entirely.
       *
       * It never actually did, because of a second bug that was hiding the
       * first: `useIsPhone` answers false for the first client render, this
       * effect ran against the desktop element, and its deps were
       * `[triggerRef]` — which never changes — so it did not re-run when the
       * phone branch replaced it. The tween was left pointing at an unmounted
       * node. The phone hand simply never rocked. Adding `phone` to the deps
       * fixes that and makes the rest angle matter, so both are handled here
       * together. */
      /* THE PHONE HAND DOES NOT ROCK (2026-08-29). Noah: "in the footer on
       * mobile project pages, let's keep the hand stationery on the bottom.
       * It shouldn't be moving and should act like a steady fulcrum for the
       * teeter totter. The teetering animation on 'next project' is good
       * though."
       *
       * Which is the right call, and it is worth saying why rather than just
       * deleting a tween: a see-saw's fulcrum is the part that DOESN'T move.
       * With both halves rocking, the plank read as sitting on something
       * unsteady instead of balancing on something planted. The plank keeps
       * its own tween below, so the gesture is unchanged -- it just now has
       * something fixed to pivot on.
       *
       * The desktop hand still settles: there it is a hand that has just
       * fallen and landed, not a fulcrum. */
      const rest = compact ? PHONE_REST_ROTATION : REST_ROTATION;
      if (!compact) {
        tl.fromTo(
          hand,
          { rotate: rest - 22 },
          {
            keyframes: [
              { rotate: rest + 11, duration: 0.3, ease: "sine.out" },
              { rotate: rest - 7.5, duration: 0.36, ease: "sine.inOut" },
              { rotate: rest + 4.5, duration: 0.32, ease: "sine.inOut" },
              { rotate: rest - 2.5, duration: 0.28, ease: "sine.inOut" },
              { rotate: rest + 1.2, duration: 0.24, ease: "sine.inOut" },
              { rotate: rest, duration: 0.22, ease: "sine.inOut" },
            ],
          }
        );
      }

      /* THE TEETER-TOTTER (2026-08-25). Noah: "I would also like this and the
       * rule that 'next project' are on to balance on top of the finger, like
       * a teeter-totter."
       *
       * Two halves to that. The balance is geometric and is handled in the
       * markup — the fingertip is centred under the rule, so the plank rests
       * on its own midpoint. The teeter is this: the plank tips against the
       * hand, on the same decaying beat, and comes to rest level. Opposite
       * phase because that is what a see-saw does — the end the fulcrum
       * leans away from goes down — and about a third of the amplitude,
       * since the plank is what is being balanced, not what is doing the
       * balancing. Same pivot as the hand's, which is the whole point: the
       * plank's transform-origin is its bottom centre, and that is the pixel
       * the fingertip is under. */
      if (compact && plankRef.current) {
        tl.fromTo(
          plankRef.current,
          { rotate: 7 },
          {
            /* Every duration doubled, 2026-08-29: "let's double the amount
               of time the 'next project' teeters." The amplitudes are
               untouched, so it is the same swing taken at half speed rather
               than a bigger one. */
            keyframes: [
              { rotate: -3.6, duration: 0.6, ease: "sine.out" },
              { rotate: 2.4, duration: 0.72, ease: "sine.inOut" },
              { rotate: -1.5, duration: 0.64, ease: "sine.inOut" },
              { rotate: 0.8, duration: 0.56, ease: "sine.inOut" },
              { rotate: -0.4, duration: 0.48, ease: "sine.inOut" },
              { rotate: 0, duration: 0.44, ease: "sine.inOut" },
            ],
          },
          0
        );
      }
    }, rootRef);
    return () => ctx.revert();
  }, [triggerRef, compact]);

  /*
   * PHONE (2026-08-25). Noah: "let's remove the head. Have the hand replace
   * the head. Have it point straight vertical. It should be pointing to 'next
   * project', which is center aligned just above the hand and takes up 3/4 of
   * the screen width."
   *
   * Desktop lays the hand and its label out as a ROW — hand at the left
   * margin, finger pointing right at the words beside it. On a phone that
   * becomes a COLUMN: the label above, the hand below it pointing straight
   * up. The asset is drawn pointing right, so "straight up" is -90 degrees
   * from rest, and the rotation happens about the same pivot the fall uses so
   * the two cannot disagree about where the hand's own centre is.
   *
   * The head that used to sit here is dropped by the footer itself — see
   * Footer.tsx, which is what knows whether it is on a project page.
   */
  if (compact) {
    return (
      <div
        ref={rootRef}
        className="absolute flex flex-col items-center"
        style={{
          /* THREE QUARTERS OF THE SCREEN, BUT NOT MORE THAN 420px. On a
             phone 75% is 292px and this is unchanged; across the middle band
             75% would be 615px at 820 and 900 at 1199, and the plank's rule
             then reaches back under the left-hand link column. Capping it and
             centring on `margin-inline` keeps the see-saw a self-contained
             object at the foot of the footer instead of a line drawn across
             everything else. */
          left: 0,
          right: 0,
          marginInline: "auto",
          width: "min(75%, 420px)",
          /* Negative, so `max` is what caps its MAGNITUDE: the wrist runs
             off the bottom edge by 61px on a phone and never by more than
             70, however wide the window gets. */
          bottom: `max(calc(var(--u) * ${PHONE_BOTTOM_UNITS}), -70px)`,
          /* No gap on a phone: "make the line sit on the very tip of the
             finger." The fingertip is placed at the fulcrum box's own top
             edge (see PHONE_TIP_DX), so any gap here is daylight between the
             plank and the thing holding it up. */
          gap: compact ? "0px" : `calc(var(--u) * ${PHONE_LABEL_GAP_UNITS})`,
        }}
      >
        {/* THE PLANK — the words and the rule as one rigid body, so they tip
            together. Its transform-origin is its own bottom centre, which is
            the pixel the fingertip sits under (see PHONE_TIP_DX above), so
            the rotation this carries is a see-saw about the finger rather
            than a skew of the text. */}
        <div
          ref={plankRef}
          className="w-full"
          style={{ transformOrigin: "50% 100%", willChange: "transform" }}
        >
          <Link
            prefetch={false}
            href={nextHref}
            className="lowercase text-center hover:opacity-60 transition-opacity block w-full"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: `min(${uFont(PHONE_LABEL_FONT)}, ${PHONE_LABEL_MAX_PX}px)`,
              // In units like every other rule on the site, so it keeps its
              // weight against the type at any width — and heavier now that
              // it is a plank with something balanced on it.
              /* 30 -> 14 units, 2026-08-29: "reduce the line thickness
                 under 'next project' in the project footers." */
              borderBottom: `calc(var(--u) * 14) solid currentColor`,
              paddingBottom: "calc(var(--u) * 36)",
            }}
          >
            next project
          </Link>
        </div>
        {/* THE FULCRUM. A box exactly as tall as the rotated hand's bounding
            box (which is the hand's own WIDTH once it is on its side), with
            the hand absolutely placed inside it so that box's top-left lands
            at the container's top-left. The fingertip sits 0.0004W below that
            top edge — near enough exactly on it — so centring the fingertip
            is just `left: 50%` less the tip's own offset within the div. */}
        <div
          className="relative w-full"
          style={{ height: `calc(${PHONE_ROT_H} * ${PHONE_HAND_W_CSS})` }}
        >
          <div
            ref={handRef}
            aria-hidden
            className="pointer-events-none select-none absolute"
            style={{
              width: PHONE_HAND_W_CSS,
              // Both offsets are fractions OF THE HAND'S OWN WIDTH, so they
              // follow the cap automatically rather than needing one each.
              left: `calc(50% - ${PHONE_TIP_DX} * ${PHONE_HAND_W_CSS})`,
              top: `calc(${-PHONE_TIP_DY} * ${PHONE_HAND_W_CSS})`,
              transformOrigin: `${PIVOT.xPct}% ${PIVOT.yPct}%`,
              // The artwork points RIGHT at rest; a quarter turn anticlockwise
              // aims it at the label directly above.
              transform: `rotate(${PHONE_REST_ROTATION}deg)`,
              willChange: "transform, opacity",
            }}
          >
            <Image
              src="/assets/shared/pointing-hand-static-rotated.webp"
              alt=""
              width={2696}
              height={1490}
              sizes="60vw"
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="absolute flex items-end"
      style={{
        left: `calc(var(--u) * ${ROOT_LEFT_UNITS})`,
        bottom: 0,
        gap: `calc(var(--u) * ${HAND_LABEL_GAP_UNITS})`,
      }}
    >
      <div
        ref={handRef}
        aria-hidden
        className="pointer-events-none select-none shrink-0"
        style={{
          width: `calc(var(--u) * ${HAND_W_UNITS})`,
          transformOrigin: `${PIVOT.xPct}% ${PIVOT.yPct}%`,
          transform: `rotate(${REST_ROTATION}deg)`,
          willChange: "transform, opacity",
        }}
      >
        <Image
          src="/assets/shared/pointing-hand-static-rotated.webp"
          alt=""
          width={2696}
          height={1490}
          sizes="25vw"
          className="w-full h-auto"
        />
      </div>
      {/* Matches the footer's own link treatment — same face, same size,
          same underline — so it reads as part of the footer rather than a
          separate control. marginBottom lands it at fingertip height (see
          LABEL_MARGIN_BOTTOM_UNITS above), not an eyeballed offset. */}
      <Link
        href={nextHref}
        className="lowercase whitespace-nowrap hover:opacity-60 transition-opacity block"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: uFont(17.9),
          borderBottom: "2px solid currentColor",
          paddingBottom: "calc(var(--u) * 10)",
          marginBottom: `calc(var(--u) * ${LABEL_MARGIN_BOTTOM_UNITS})`,
        }}
      >
        next project
      </Link>
    </div>
  );
}
