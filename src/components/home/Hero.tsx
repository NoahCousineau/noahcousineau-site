"use client";

import { Stage, Place } from "./Stage";
import HeroLockup from "./HeroLockup";
import RotatingHead from "../RotatingHead";
import BehindHead from "./BehindHead";
import ScrollCue from "./ScrollCue";
import Parallax from "../Parallax";
import { useTheme } from "../ThemeProvider";
import { useIsPhone } from "@/lib/useIsPhone";
import { HERO_DESKTOP, HERO_PHONE } from "./heroLayout";

/**
 * HERO — master slice y100–1000.
 * B&W cut-out head (RESERVED ROTATION ZONE) on Noah's photographed paper
 * cut-outs — a red star, a yellow star, a blue star and three clusters of
 * pencil marks, all animating on the head's own rotation beat (see
 * BehindHead.tsx). This replaced the placeholder SVG starburst and its slow
 * gsap spin/scale, which stood in for "animation of changing paper shapes"
 * until the real artwork existed. "noah cousineau" — Akzidenz Regular (no
 * bold, per spec) — right of head; "graphic design" in Quinn Text Italic
 * beneath.
 * FitText caps the name+label block at 830 units so it can NEVER bleed past
 * the artboard's right margin (x1877 = the same margin the description uses),
 * regardless of which font is currently active.
 */
export default function Hero() {
  const { theme } = useTheme();

  /* 2026-08-24, Noah: "shift both the animation and 'noah cousineau graphic
   * design' over to the right a bit to make it centered." Measured live
   * (yellow star's left edge to the lockup's right edge — the true visual
   * span, not the Place boxes, which carry transparent margin): the
   * composition's centre sat 31 units left of the viewport's actual centre.
   *
   * 2026-08-25, phones only: "stack the head spin animation and the 'noah
   * cousineau graphic design'. Have this center aligned."
   *
   * Both live in heroLayout.ts, shared with BehindHead — see the note there
   * for why moving the head is not an edit this file can make alone. */
  const phone = useIsPhone();
  const L = phone ? HERO_PHONE : HERO_DESKTOP;

  return (
    /* ONE VIEWPORT TALL, AND THE COMPOSITION CENTRED IN IT (2026-08-23, per
     * Noah: "Make sure the whole interaction and the 'noah cousineau graphic
     * designer' is shifted upwards to be vertically centered in the frame.")
     *
     * Not a nudge upwards, because which way it needed to move depended on
     * the window. Measured where the head-and-star mass actually landed
     * against the viewport's middle: HIGH by 56px at 1440x900, high by 37 at
     * 1512x900, high by 15 at 1920x1080 — but LOW by 75px at 1920x900. A
     * fixed offset would have fixed one of those and worsened the rest.
     *
     * The cause is that `--u` is 1/1920 of the WIDTH, so this Stage's 1080u
     * height grows with how wide the window is and has nothing to do with
     * how tall it is. On a wide, short window — a large display, or any
     * maximised browser on one — the Stage is taller than the viewport and
     * the composition is pushed below centre. (Same shape of bug as the
     * project header's rule, fixed the same day by moving it onto dvh.)
     *
     * So Hero gets its OWN `--u`, the smaller of the width-derived unit and
     * a height-derived one. The artboard still governs the layout exactly as
     * before; it just also promises never to need more height than there is,
     * scaling the whole composition down instead on windows too short for
     * it. Overriding the variable on this wrapper keeps it local — the
     * Description and Projects sections below still inherit main's own
     * width-based unit, which is what their fixed coordinates expect.
     *
     * Stage height 900 -> 1080 (2026-08-20, per Noah: "add some more space
     * between the top animation and the text area for more gravitas").
     */
    <div
      className="w-full flex items-center justify-center relative"
      style={{
        minHeight: "100dvh",
        // The height term keeps a wide, short window from pushing the
        // composition below centre (see above). On a phone the Stage is
        // 1900 units tall and deliberately taller than the screen — it is
        // meant to scroll — so capping by height would shrink the whole
        // layout to nothing. Width alone there.
        ["--u" as string]: phone
          ? `calc(100cqw / ${L.artboard})`
          : "min(100cqw / 1920, 100dvh / 1080)",
      }}
    >
    {/* The scroll hint. Inside this wrapper on purpose: it anchors to the
        hero's centre so it cannot drift against the lockup when a phone's
        URL bar collapses — see ScrollCue. Outside the Stage, which clips. */}
    <ScrollCue />
    <Stage heightUnits={L.stageH} className="overflow-hidden">
      {/* Red star (z-0), yellow star (z-1), blue star (z-20) and the pencil
          marks (z-30) — Noah's photographed paper cut-outs, replacing the
          placeholder starburst that used to sit here. The head below is at
          z-10, which is what puts it between the yellow and blue stars. See
          BehindHead.tsx. */}
      <BehindHead />

      {/* Rotating head animation — interactive drag-to-spin */}
      <Place x={150 + L.shiftX} y={L.headY} w={L.headW} h={L.headH} className="z-10 flex items-center justify-center overflow-hidden">
        {/* isDarkMode now follows the site theme rather than being pinned
            off — in dark mode this loads the sunglasses turntable
            (sprite-sheet-dark-staggered.webp), which is registered frame by
            frame against the light one, so the rotation doesn't jump when
            the theme is switched mid-spin. */}
        {/* The head's own plane, between the yellow star behind it and the
            blue star in front — see PARALLAX in BehindHead.tsx, whose values
            this sits between and has to stay ordered with. */}
        {/* Part of BehindHead's PARALLAX ladder — see the note there. Must
            stay between yellow (27) and blue (-23) or the head changes
            depth. 4 -> 7 on 2026-08-25 with the rest of the stack. */}
        <Parallax units={7}>
          <RotatingHead
            isDarkMode={theme === "dark"}
            variant="staggered"
            autoRotateSpeed={130}
            containerClassName="w-auto h-auto"
          />
        </Parallax>
      </Place>

      {/* "noah cousineau / graphic design" lockup — embedded from Noah's exact
          SVG (hand-kerned, not reproducible via CSS letter-spacing). Right
          column, capped at the artboard's right margin (x1877) so it can
          never bleed off-screen; aspect ratio locked to the source SVG.
          Sized ~15% smaller per feedback. */}
      <Place x={L.lockupX + (phone ? 0 : L.shiftX)} y={L.lockupY} w={L.lockupW} className="z-10">
        <HeroLockup />
      </Place>
    </Stage>
    </div>
  );
}
