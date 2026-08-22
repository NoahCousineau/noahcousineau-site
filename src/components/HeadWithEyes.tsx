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

/** Light head's intrinsic aspect. Kept in step with HEAD_LIGHT in
 *  headAssets.ts, which is where every caller actually reads it from — this
 *  export now has no consumers and is a stale-value hazard rather than a
 *  convenience, so prefer `headAsset(theme).aspect` and delete this once
 *  nothing outside the repo depends on it. */
export const HEAD_ASPECT = "1227/1669";

/** How far (px) a pupil may drift from dead-centre. Kept small and
 * radius-clamped so the socket edges never expose the transparent hole —
 * Noah: "it's important the eyes don't move too much... it will look
 * unnatural and reveal the red background behind." */
const MAX_EYE_OFFSET_PX = 3.2;

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
      const screenX = (dx / dist) * MAX_EYE_OFFSET_PX;
      const screenY = (dy / dist) * MAX_EYE_OFFSET_PX;

      // Counter-rotate into the head's local space: a child's translate
      // happens inside its parent's already-rotated frame, so without this
      // the pupils track a direction offset by the head's tilt.
      const deg = rotationRef?.current ?? 0;
      if (deg === 0) {
        el.style.transform = `translate(-50%, -50%) translate(${screenX}px, ${screenY}px)`;
        return;
      }
      const rad = (-deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      el.style.transform = `translate(-50%, -50%) translate(${
        screenX * cos - screenY * sin
      }px, ${screenX * sin + screenY * cos}px)`;
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
