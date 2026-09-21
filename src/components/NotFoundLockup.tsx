"use client";

import Link from "next/link";

import ClockFace from "./ClockFace";
import {
  ARTBOARD_U,
  clockArcOverhang,
  clockWidth,
  lockupLinkStyle,
} from "@/lib/clockLockup";
import { useIsCompact, useIsPhone } from "@/lib/useIsPhone";

/**
 * The 404's lockup: the clock wearing this page's words, and the way out.
 *
 * Client-side because the sizes are chosen per tier, the same way the away
 * screen chooses them — see lib/clockLockup, which both read so the two
 * screens cannot drift apart again. not-found.tsx stays a server component so
 * it can keep exporting `metadata`.
 *
 * The words are written in capitals rather than left to `text-transform`.
 * Noah: "Let's also have the text in all caps." They were already uppercased
 * in CSS, which Chrome applies to SVG text and Safari does not, so on Safari
 * the arcs read "Oops! This is the" as typed. Real capitals need no browser's
 * cooperation.
 */
export default function NotFoundLockup() {
  const phone = useIsPhone();
  const compact = useIsCompact();

  return (
    /* `artboard` is what gives --u a value; the sizes below are written in it. */
    <div
      className="artboard flex w-full flex-col items-center"
      style={{
        ["--u" as string]: ARTBOARD_U,
        gap: "clamp(2rem, 6vh, 4.5rem)",
      }}
    >
      {/* The square is the disc; the arcs overflow it, and the margin reserves
          that room so nothing is laid out on top of them. */}
      <div
        style={{
          position: "relative",
          width: clockWidth(phone, compact),
          aspectRatio: "1 / 1",
          marginBlock: clockArcOverhang(phone, compact),
          flexShrink: 0,
        }}
      >
        <ClockFace
          idPrefix="not-found-clock"
          top="OOPS! THIS IS THE"
          bottom="404 PAGE!"
          /* The page IS the lockup here, so the light never stops sweeping. */
          active
        />
      </div>

      {/* Below the clock, not on it — and the way out. */}
      <Link href="/" data-return-home style={lockupLinkStyle(phone)}>
        RETURN TO SAFETY
      </Link>
    </div>
  );
}
