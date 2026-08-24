"use client";

import { Stage, Place } from "./Stage";
import HeroLockup from "./HeroLockup";
import RotatingHead from "../RotatingHead";
import BehindHead from "./BehindHead";
import { useTheme } from "../ThemeProvider";

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

  // Right column caps at the artboard margin (x1877), starting at x990 -> 887 units max
  const RIGHT_MAX_W = 887;

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
      className="w-full flex items-center justify-center"
      style={{
        minHeight: "100dvh",
        ["--u" as string]: "min(100cqw / 1920, 100dvh / 1080)",
      }}
    >
    <Stage heightUnits={1080} className="overflow-hidden">
      {/* Red star (z-0), yellow star (z-1), blue star (z-20) and the pencil
          marks (z-30) — Noah's photographed paper cut-outs, replacing the
          placeholder starburst that used to sit here. The head below is at
          z-10, which is what puts it between the yellow and blue stars. See
          BehindHead.tsx. */}
      <BehindHead />

      {/* Rotating head animation — interactive drag-to-spin */}
      <Place x={150} y={50} w={650} h={950} className="z-10 flex items-center justify-center overflow-hidden">
        {/* isDarkMode now follows the site theme rather than being pinned
            off — in dark mode this loads the sunglasses turntable
            (sprite-sheet-dark-staggered.webp), which is registered frame by
            frame against the light one, so the rotation doesn't jump when
            the theme is switched mid-spin. */}
        <RotatingHead
          isDarkMode={theme === "dark"}
          variant="staggered"
          autoRotateSpeed={130}
          containerClassName="w-auto h-auto"
        />
      </Place>

      {/* "noah cousineau / graphic design" lockup — embedded from Noah's exact
          SVG (hand-kerned, not reproducible via CSS letter-spacing). Right
          column, capped at the artboard's right margin (x1877) so it can
          never bleed off-screen; aspect ratio locked to the source SVG.
          Sized ~15% smaller per feedback. */}
      <Place x={990} y={360} w={RIGHT_MAX_W * 0.85} className="z-10">
        <HeroLockup />
      </Place>
    </Stage>
    </div>
  );
}
