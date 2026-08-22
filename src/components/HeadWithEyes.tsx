"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useTheme } from "./ThemeProvider";
import { headAsset } from "@/lib/headAssets";

/*
 * The cut-out head with cursor-tracking eyes, shared by the About page's
 * throwable ragdoll and the footer's stationary peeking head.
 *
 * Extracted 2026-08-20 when the footer gained a head of its own — Noah:
 * "This will have the same eye tracking as on the about me page, but the
 * head can't be moved." Two copies of socket coordinates measured off an
 * alpha channel is exactly the kind of thing that drifts, so they live here
 * once.
 *
 * THEME (2026-08-21): which artwork, which socket coordinates, which pupil
 * images and which backing colour all come from src/lib/headAssets.ts,
 * because dark mode swaps in a different photograph — Noah in sunglasses.
 * BOTH variants track: the dark one renders lens-tinted pupils behind
 * near-clear sockets, so the tracking reads at the size the head is actually
 * drawn. See the note on HEAD_DARK for why the tint lives in the artwork.
 */

/** Light head's intrinsic aspect. Prefer `headAsset(theme).aspect` — this
 *  remains only for callers that size a box before a theme is known. */
export const HEAD_ASPECT = "1227/1605";

/* How far (px) a pupil may drift from dead-centre — SEPARATELY per axis,
 * because the socket is not round.
 *
 * 2026-08-22, Noah: "the eyes are moving too far, they were better before",
 * with a screenshot of the footer head looking straight UP. The travel had
 * in fact never changed — 3.2px since the tracking was written — but it was
 * being applied equally in x and y, and the socket is a flat almond. At the
 * footer head's rendered size the hole measures about 23.7px across and only
 * 5.7px tall, so the same 3.2px is 13% of the width but 56% of the HEIGHT:
 * sideways it reads as a glance, upwards it rolls the pupil to the top of
 * the socket. Looking straight up is the pure-vertical worst case, which is
 * exactly the screenshot.
 *
 * Y is set to hold roughly the same proportion of the socket that X does, so
 * a glance costs the same share of the available room in either direction.
 * X is untouched: left/right always read correctly and that is the half of
 * the behaviour Noah liked.
 *
 * These stay in absolute px, as they always have been. That means the travel
 * does NOT scale with the head, so on a wide viewport where the head is drawn
 * larger the glance is proportionally smaller. Worth revisiting — the rest of
 * the site sizes everything in --u for exactly this reason — but it predates
 * this fix and changing it would alter the feel at every width at once. */
const MAX_EYE_OFFSET_X_PX = 3.2;
const MAX_EYE_OFFSET_Y_PX = 1.0;

/** One tracked eye: computes its own instantaneous vector to the cursor and
 * translates toward it — no easing, per Noah's "instantaneous" requirement.
 * Each eye solves independently, which is what produces the converging
 * cross-eyed look when the cursor is close to the face.
 *
 * Anchors off this element's OWN rect: getBoundingClientRect() on a rotated
 * element returns the axis-aligned box of the rotated shape, whose corners
 * are not the head's corners, so deriving the socket position from the
 * head's rect silently drifts. This div is placed by percentage inside the
 * head's unrotated content box, so the browser puts it in the right spot at
 * any rotation and its own rect centre IS the socket. */
function TrackedEye({
  src,
  leftPct,
  topPct,
  widthPct,
  backing,
  rotationRef,
}: {
  src: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  /** Colour of the disc behind the socket; lens-dark for the shades. */
  backing: string;
  /** Live rotation of the host head, degrees. Omit for a head that never
   * rotates (the footer's), in which case no counter-rotation is needed. */
  rotationRef?: React.RefObject<number>;
}) {
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      const el = eyeRef.current;
      if (!el) return;
      // Clear any existing offset before measuring so the rect reflects the
      // neutral position rather than compounding on the previous frame.
      const prev = el.style.transform;
      el.style.transform = "translate(-50%, -50%)";
      const rect = el.getBoundingClientRect();
      el.style.transform = prev;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;

      // ROTATE FIRST, THEN CLAMP — the order matters, and getting it backwards
      // is a real bug this had briefly. A child's translate happens inside its
      // parent's already-rotated frame, so counter-rotating the direction is
      // what makes the pupils track the cursor rather than a direction offset
      // by the head's tilt. But the two limits below are not interchangeable:
      // they describe the SOCKET, which tilts with the head. Clamping in
      // screen space and rotating the result afterwards would align the
      // ellipse to the screen instead of to the eye, so on the About page —
      // where the head rests at 42 degrees — a purely sideways cursor put
      // 2.14px of travel along the socket's SHORT axis, twice the 1.0px it
      // allows, and rolled the pupil exactly the way it was meant to stop.
      // The footer head never rotates, so it hid the mistake entirely.
      //
      // Taking the direction into the head's own frame first and applying the
      // limits there keeps the ellipse locked to the socket at every angle,
      // including while the ragdoll is mid-tumble.
      const rad = (-(rotationRef?.current ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const ux = dx / dist;
      const uy = dy / dist;
      const localX = ux * cos - uy * sin;
      const localY = ux * sin + uy * cos;

      el.style.transform = `translate(-50%, -50%) translate(${
        localX * MAX_EYE_OFFSET_X_PX
      }px, ${localY * MAX_EYE_OFFSET_Y_PX}px)`;
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [rotationRef]);

  return (
    <>
      {/* Off-white backing disc BEHIND the eye, slightly larger, so an
          extreme offset can never expose the transparent socket hole (and
          whatever colour sits behind the head). Static, so it always fully
          backs the socket regardless of the eye's current offset. */}
      <div
        className="absolute"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct * 1.35}%`,
          aspectRatio: "1/1",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: backing,
        }}
      />
      <div
        ref={eyeRef}
        className="absolute"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          aspectRatio: "1/1",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          overflow: "hidden",
        }}
      >
        <Image src={src} alt="" fill className="object-cover" />
      </div>
    </>
  );
}

/** The head artwork plus its two tracked eyes, at the image's own aspect
 * ratio and filling whatever box the caller gives it. */
export default function HeadWithEyes({
  rotationRef,
  priority = false,
  alt = "",
}: {
  rotationRef?: React.RefObject<number>;
  priority?: boolean;
  alt?: string;
}) {
  const { theme } = useTheme();
  const head = headAsset(theme);

  return (
    <div className="relative w-full" style={{ aspectRatio: head.aspect }}>
      {/* Eyes render BEHIND the head image — the artwork's transparent
          socket holes mask each eye down to the correct narrow almond shape
          (the eyelid skin is painted into the head, on top). Eyes must come
          first in DOM order for that masking to work; with the head behind,
          each eye would show as a round patch over the face. The dark head
          works the same way; its sockets are cut through the lenses rather
          than through eyelids. */}
      {head.eyes && (
        <>
          <TrackedEye
            src={head.eyes.srcLeft}
            leftPct={head.eyes.left.x * 100}
            topPct={head.eyes.left.y * 100}
            widthPct={head.eyes.left.widthPct}
            backing={head.eyes.backing}
            rotationRef={rotationRef}
          />
          <TrackedEye
            src={head.eyes.srcRight}
            leftPct={head.eyes.right.x * 100}
            topPct={head.eyes.right.y * 100}
            widthPct={head.eyes.right.widthPct}
            backing={head.eyes.backing}
            rotationRef={rotationRef}
          />
        </>
      )}
      <Image
        src={head.src}
        alt={alt}
        fill
        className="object-contain relative z-10 pointer-events-none"
        priority={priority}
        draggable={false}
      />
    </div>
  );
}
