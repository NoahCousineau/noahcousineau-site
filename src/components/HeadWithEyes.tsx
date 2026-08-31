"use client";

import { useEffect, useRef } from "react";
import { subscribeTilt } from "@/lib/deviceTilt";
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

/* How far a pupil may drift from dead-centre, as a share of the eye disc's
 * own rendered width.
 *
 * This was a flat 3.2px from the day the tracking was written, and that was
 * always about twice the room actually available. Measured across every
 * configuration this head has had, the eye disc only ever extended ~0.75% of
 * the head's width past the socket opening — about 1.5px at the size the
 * footer head is drawn — so a 3.2px drift slid the pupil ~1.7px CLEAR of the
 * hole and let the backing disc show. Noah, after two rounds of trying to
 * revert my way out of it: "the eyes are still moving out of the socket area
 * too much."
 *
 * Reverting could not fix it, which is why the last two attempts didn't: the
 * overshoot predates every change I made, and the ORIGINAL artwork was
 * marginally worse (1.79px against today's 1.70px), so going further back
 * makes it slightly worse rather than better.
 *
 * Expressed as a fraction of the disc rather than in pixels because the
 * margin scales with the head and a pixel constant does not. The footer head
 * is 200px wide at a 1280 viewport and 300px at 1920; a fixed 3.2px overshoots
 * at both but by different amounts, and on a narrow phone it would be wildly
 * out. 7.5% of the disc spends 0.89% of the head's width against the 0.75%
 * genuinely available, so at full stretch the pupil clears the socket by
 * about a seventh of a pixel — against the 1.7px it used to overshoot. That
 * last sliver is exactly what the backing disc is there to cover, and it buys
 * back visible movement: 6% was correct but read as too subtle once Noah saw
 * it ("It's just a little too subtle so let's take it up just a notch"). This
 * is the knob to turn if it ever wants tuning again — which is the
 * same reason the rest of the site sizes everything in --u.
 *
 * The motion is deliberately restrained; it always has been. Noah, when this
 * was first built: "it's important the eyes don't move too much... it will
 * look unnatural and reveal the red background behind." */
const EYE_TRAVEL_FRACTION_OF_DISC = 0.075;

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
    /* Where the pupil should point, as a unit direction. Shared by the two
     * inputs below so the geometry — the counter-rotation, the clamp to the
     * socket — is written once. */
    function aim(ux: number, uy: number) {
      const el = eyeRef.current;
      if (!el) return;
      const maxOffset = el.offsetWidth * EYE_TRAVEL_FRACTION_OF_DISC;
      const screenX = ux * maxOffset;
      const screenY = uy * maxOffset;
      const deg = rotationRef?.current ?? 0;
      if (deg === 0) {
        el.style.transform = `translate(-50%, -50%) translate(${screenX}px, ${screenY}px)`;
        return;
      }
      // Counter-rotate into the head's local space: a child's translate
      // happens inside its parent's already-rotated frame, so without this
      // the pupils track a direction offset by the head's tilt.
      const rad = (-deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      el.style.transform = `translate(-50%, -50%) translate(${
        screenX * cos - screenY * sin
      }px, ${screenX * sin + screenY * cos}px)`;
    }

    function handleMove(e: { clientX: number; clientY: number }) {
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
      // Scale the drift off the disc's CURRENT rendered size, so the pupil
      // keeps the same relationship to its socket at every viewport width.
      //
      // offsetWidth, NOT rect.width: on the About page the head is rotated,
      // and getBoundingClientRect returns the axis-aligned box of the rotated
      // square, which at the ragdoll's 42-degree rest is about 1.41x the real
      // width. Sizing the travel off that would hand the pupil 41% more room
      // on exactly the head where it is already hardest to keep in the socket.
      // offsetWidth is pure layout and ignores the transform.
      const dist = Math.hypot(dx, dy) || 1;
      aim(dx / dist, dy / dist);
    }

    /* ...AND ON A PHONE, THE PHONE'S OWN TILT (2026-08-25).
     *
     * Noah: "Have the eyes roll around to the phone movement."
     *
     * There is no cursor to follow on a phone, so the same pupils take their
     * direction from the device instead — the identical mapping the header's
     * falling icons use for gravity (see useDropField): `gamma` is the
     * left-right tilt, positive with the right edge down, and `beta` is +90
     * upright, 0 flat. (sin gamma, sin beta) is then the direction "down"
     * points in the plane of the screen, which is exactly where a pair of
     * googly eyes would roll.
     *
     * Not normalised to a unit vector, deliberately: `aim` multiplies by the
     * socket's radius, so leaving the magnitude alone means a small tilt
     * moves them a little and a big one sends them all the way over, instead
     * of pinning them to the rim the moment the phone is off level. Clamped
     * so they can never leave the socket.
     */
    /* The tilt reading, and crucially the iOS permission ask, come from
     * lib/deviceTilt — see the note at the top of that module. This listener
     * used to be attached directly to `deviceorientation`, which on iOS
     * delivers nothing until permission is granted, and nothing on the home
     * page ever asked. The eyes have had this code the whole time and it has
     * never once run on a phone. */
    const unsubscribe = subscribeTilt(({ x, y }) => aim(x, y));

    /* AND THE FINGER, ON A PHONE (2026-08-30). Noah: "I would also like for
     * the eyes to follow the user's finger when interacting with the site on
     * mobile."
     *
     * `touchmove` rather than `pointermove`, because pointer events for touch
     * only fire while the pointer is DOWN and are suppressed once the browser
     * decides the gesture is a scroll — which is most of them. touchmove
     * keeps coming through a scroll, so the eyes track a thumb dragging down
     * the page and not merely a deliberate press.
     *
     * Passive: this only reads a coordinate and must never be able to hold
     * up a scroll. */
    function handleTouch(e: TouchEvent) {
      const t = e.touches[0];
      if (t) handleMove({ clientX: t.clientX, clientY: t.clientY });
    }

    window.addEventListener("mousemove", handleMove as (e: MouseEvent) => void);
    window.addEventListener("touchmove", handleTouch, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMove as (e: MouseEvent) => void);
      window.removeEventListener("touchmove", handleTouch);
      unsubscribe();
    };
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
