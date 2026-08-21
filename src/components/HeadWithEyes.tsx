"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

/*
 * The cut-out head with cursor-tracking eyes, shared by the About page's
 * throwable ragdoll and the footer's stationary peeking head.
 *
 * Extracted 2026-08-20 when the footer gained a head of its own — Noah:
 * "This will have the same eye tracking as on the about me page, but the
 * head can't be moved." Two copies of socket coordinates measured off an
 * alpha channel is exactly the kind of thing that drifts, so they live here
 * once.
 */

/** Head image's intrinsic aspect, used by every wrapper that hosts it. */
export const HEAD_ASPECT = "1297/1970";

/* Eye socket centres as a fraction (0-1) of the head image's own box,
 * measured directly from head.png's alpha-channel hole positions
 * (connected-component analysis on the 1297x1970 canvas): left hole
 * x:325-451/y:803-838, right hole x:733-863/y:791-831. */
const LEFT_EYE_CENTER = { x: 0.2992, y: 0.4165 };
const RIGHT_EYE_CENTER = { x: 0.6153, y: 0.4117 };
const LEFT_EYE_WIDTH_PCT = 11.2;
const RIGHT_EYE_WIDTH_PCT = 11.6;

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
  rotationRef,
}: {
  src: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
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
          background: "#f3ddc9",
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
  return (
    <div className="relative w-full" style={{ aspectRatio: HEAD_ASPECT }}>
      {/* Eyes render BEHIND the head image — head.png's transparent socket
          holes mask each eye down to the correct narrow almond shape (the
          eyelid skin is painted into head.png, on top). Eyes must come
          first in DOM order for that masking to work; with the head behind,
          each eye would show as a round patch over the face. */}
      <TrackedEye
        src="/assets/about/eye-left.png"
        leftPct={LEFT_EYE_CENTER.x * 100}
        topPct={LEFT_EYE_CENTER.y * 100}
        widthPct={LEFT_EYE_WIDTH_PCT}
        rotationRef={rotationRef}
      />
      <TrackedEye
        src="/assets/about/eye-right.png"
        leftPct={RIGHT_EYE_CENTER.x * 100}
        topPct={RIGHT_EYE_CENTER.y * 100}
        widthPct={RIGHT_EYE_WIDTH_PCT}
        rotationRef={rotationRef}
      />
      <Image
        src="/assets/about/head.png"
        alt={alt}
        fill
        className="object-contain relative z-10 pointer-events-none"
        priority={priority}
        draggable={false}
      />
    </div>
  );
}
