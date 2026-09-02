"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HeadWithEyes from "./HeadWithEyes";
import { useTheme } from "./ThemeProvider";
import { headAsset, HEAD_LIGHT, type HeadAsset } from "@/lib/headAssets";

/*
 * The footer's head, peeking up over the bottom edge of the browser window
 * (2026-08-20, per Noah: "at the bottom of the browser window, I want my
 * head to just peek out from the bottom. This will have the same eye
 * tracking as on the about me page, but the head can't be moved.")
 *
 * Same artwork and same tracking as the About page's head, minus the
 * physics — it shares HeadWithEyes so the socket coordinates can't drift
 * between the two.
 *
 * HOW MUCH SHOWS: the head is pushed below its container by a fraction of
 * its own height, so the cut is proportional and the same amount of face
 * shows at every viewport width. REVEAL_FRACTION is set just past the eye
 * line — the sockets sit at ~41.6% down the artwork, so revealing ~52%
 * clears them with room to spare and the tracking is actually visible,
 * which is the whole point of putting a tracking head down there.
 *
 * LINKS TO ABOUT ME (2026-08-20, second pass — Noah: "Let's also make the
 * head on the footer a link to the 'about me' page.") The OUTER wrapper
 * stays `pointer-events-none` — it's still scenery first, and sits over
 * the footer's link columns' airspace, so it must never intercept a click
 * meant for THEM. Only the <Link> immediately around the head re-enables
 * pointer events, so the clickable area is scoped to exactly the head's
 * own box (which sits well clear of the link columns above it), not the
 * empty space around it.
 */

/** Share of the head's height left visible above the bottom edge.
 *
 * Recomputed 2026-08-21 when the neck came off the artwork. The number that
 * matters is where the EYE LINE sits, since the whole point of a tracking
 * head down here is that you can see it tracking. On the old head+neck
 * image the sockets were ~41.6% down the box; on the neck-less crops they
 * sit at ~47% (light) and ~50% (dark, behind the shades), because the box
 * lost height from the bottom so every feature's fraction grew. 0.66
 * clears both with room to spare while keeping it a peek rather than a
 * whole head. */
const REVEAL_FRACTION = 0.66;
/** Head width in artboard units. */
const HEAD_WIDTH_UNITS = 300;
/* 2026-08-25, phones only: "Have the head now at the bottom center of the
 * phone. Have it larger than it currently is." 300 -> 620 units, which at a
 * 390px screen is 126px of head against 61px — and everything downstream
 * (the reveal fraction, the eye anchoring, the tracking) is expressed as a
 * fraction of this, so only the one number moves. */
/* 620 -> 1240, 2026-08-25: "On the mobile footer, double the size of the
 * head." Everything downstream — the reveal fraction, the eye anchoring, the
 * tracking radius — is a fraction of this, so only the one number moves. */
const PHONE_HEAD_WIDTH_UNITS = 1240;

/**
 * Mean eye position for a variant, as a fraction of its own box.
 *
 * 2026-08-23, Noah: "the heads in the footer seem to move position a lot when
 * they move between light mode and dark mode. Let's arrange the heads in a
 * way so the eyes don't shift over much when we switch between modes."
 *
 * The two variants are different photographs cropped to different boxes: the
 * dark head is a shade wider for its height (0.753 against 0.735) and its
 * sockets sit markedly lower within the crop (49.5% down, against 45.3%),
 * because the shades put the eye line further down the face. Anchoring by the
 * BOX — which is what `bottom` and a plain translateX(-50%) do — therefore
 * lands the eyes in two different places: measured, 18.8 units apart
 * vertically (about 15px at a 1512 viewport) and 2.8 apart horizontally.
 * Since the eyes are the whole point of a tracking head, they are what should
 * hold still, so the box is positioned FROM them rather than the other way
 * round.
 */
function eyeCentre(asset: HeadAsset) {
  if (!asset.eyes) return { x: 0.5, y: 0.5 };
  return {
    x: (asset.eyes.left.x + asset.eyes.right.x) / 2,
    y: (asset.eyes.left.y + asset.eyes.right.y) / 2,
  };
}

/* The light head's placement is the reference, so light mode is pixel-for-
 * pixel what it always was and only the dark head moves to meet it. */
const LIGHT_HEIGHT_UNITS = HEAD_WIDTH_UNITS / HEAD_LIGHT.aspectVal;
const LIGHT_EYE = eyeCentre(HEAD_LIGHT);
/** Where the eye line sits above the window's bottom edge, artboard units.
 *  Derived from the light head's existing reveal: bottom = -h(1-R), and the
 *  eyes sit h(1-eyeY) above that, so the two h terms collapse to this. */
const EYE_ABOVE_BOTTOM_UNITS = LIGHT_HEIGHT_UNITS * (REVEAL_FRACTION - LIGHT_EYE.y);

export { PHONE_HEAD_WIDTH_UNITS };

/*
 * IT COMES UP OUT OF THE PAGE (2026-09-01).
 *
 * Noah, pointing at aardvarkbookclub.com: "an object animates upwards
 * slightly when we reach the bottom of the page. I want a similar effect with
 * the head and hand... Before that, I want the head to be lower than it
 * currently is. When scrolling, it should almost feel like whack-a-mole or
 * something coming up from below the page."
 *
 * So the head's resting place is untouched — it still ends exactly where it
 * has always sat — and it simply starts this much further down and rises into
 * it the first time the footer is reached. As a share of the head's own
 * height, so it travels the same fraction of itself at every size.
 */
/* 30 -> 100 (2026-09-01). Noah: "I would like for it to be a more dramatic
 * reveal. The head and hand should start much lower and then appear at the
 * same final height." At a full head-height down it is entirely below the
 * footer's bottom edge — genuinely out of sight rather than merely low — so
 * what comes up reads as something surfacing rather than something shifting.
 * The resting place is untouched: this only says where it comes FROM. */
const RISE_PERCENT = 100;
const RISE_SECONDS = 0.8;

export default function PeekingHead({
  /** Horizontal centre, in artboard units. Defaults to the page centre; the
   * footer places it under its right-hand link columns instead (2026-08-20,
   * per Noah: "shift the head over so it's below the 'about me' and email
   * link"). */
  centerXUnits = 960,
  widthUnits = HEAD_WIDTH_UNITS,
  riseTriggerRef,
}: {
  centerXUnits?: number;
  /** Overridden on phones — see PHONE_HEAD_WIDTH_UNITS. */
  widthUnits?: number;
  /** What arriving at the footer looks like: the reveal spacer on desktop,
   *  the footer itself on a phone, where there is no spacer. */
  riseTriggerRef?: React.RefObject<HTMLElement | null>;
}) {
  /* Sized from the CURRENT theme's own aspect rather than one fixed number.
   * With a single hardcoded height the shorter dark head was letterboxed
   * inside a box shaped for the light one, so the same `bottom` offset hid
   * more of it and it sat visibly lower — Noah: "I would like the dark mode
   * head to be moved up a bit." Deriving the height per variant means both
   * heads reveal the same FRACTION OF THEMSELVES, which is what the reveal
   * was always meant to control. */
  const { theme } = useTheme();
  const asset = headAsset(theme);
  const heightUnits = widthUnits / asset.aspectVal;
  const eye = eyeCentre(asset);

  /* Position the box so this variant's OWN eye line lands on the shared
   * target, instead of revealing a fixed fraction of the box and letting the
   * eyes fall where they may. Both heads end up showing the same amount of
   * themselves BELOW the eyes, which is the part the window crops — so the
   * cut reads as the same cut in both themes. */
  // The eye line's height above the window's bottom edge scales with the
  // head, or a bigger head would sit with its eyes in the same place and the
  // rest of it off the bottom of the screen.
  const eyeAboveBottom =
    EYE_ABOVE_BOTTOM_UNITS * (widthUnits / HEAD_WIDTH_UNITS);
  const bottomUnits = eyeAboveBottom - heightUnits * (1 - eye.y);
  /* And the same for the horizontal: nudge by the difference between this
   * variant's eye centre and the light one's, so the sockets stay put
   * side-to-side too (the dark crop's are ~1% of the head further left). */
  const eyeShiftUnits = widthUnits * (LIGHT_EYE.x - eye.x);

  /* The rise lives on its own wrapper because the box above already carries a
   * translateX for the eye alignment, and one transform would overwrite the
   * other. */
  const riseRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = riseRef.current;
    const trigger = riseTriggerRef?.current;
    if (!el || !trigger) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { yPercent: RISE_PERCENT },
        {
          yPercent: 0,
          duration: reduced ? 0 : RISE_SECONDS,
          ease: "power3.out",
          scrollTrigger: {
            trigger,
            /* The same instant the fallen hand uses: the footer's first
               sliver appearing, which for the desktop curtain is the
               spacer's top reaching the bottom of the window. */
            start: "top bottom",
            /* AND BACK DOWN AGAIN (2026-09-01). Noah: "I would also like for
               the interaction to play the opposite way when the user scrolls
               back up... the head/hand should feel like it's going away."
               So this is no longer `once` — leaving the trigger backwards
               reverses the same tween, and reversing an ease-OUT gives an
               ease-IN on the way down, which is exactly the difference
               between arriving and retreating. */
            toggleActions: "play none none reverse",
          },
        }
      );
    });
    return () => ctx.revert();
  }, [riseTriggerRef]);

  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        width: `calc(var(--u) * ${widthUnits})`,
        bottom: `calc(var(--u) * ${bottomUnits})`,
        left: `calc(var(--u) * ${centerXUnits})`,
        transform: `translateX(calc(-50% + var(--u) * ${eyeShiftUnits}))`,
      }}
    >
      <div ref={riseRef}>
      <Link
        href="/about"
        aria-label="About me"
        className="block pointer-events-auto hover:opacity-80 transition-opacity"
      >
        <HeadWithEyes />
      </Link>
      </div>
    </div>
  );
}
